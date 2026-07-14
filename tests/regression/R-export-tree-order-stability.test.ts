import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/lib/db/schema'
import { deriveExportProjectJSON } from '../../src/lib/export/registry-export'
import { deriveImportProjectJSON } from '../../src/lib/export/registry-import'
import { normalizeFixtureRoundtripBusinessPair } from '../helpers/d04-fixture-kit'

const NOW = 1_700_000_000_000

async function addProject(name: string, id = 9_001): Promise<number> {
  return await db.projects.add({
    id,
    name,
    genre: 'fantasy',
    description: 'tree export order regression',
    targetWordCount: 10_000,
    enableMultiWorld: false,
    createdAt: NOW,
    updatedAt: NOW,
  } as any) as number
}

describe('R-export-tree-order-stability', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(() => {
    db.close()
  })

  it('exports parents before lower-id children and remains field-equal after import/re-export', async () => {
    const projectName = 'tree-order-source'
    const projectId = await addProject(projectName)

    // Explicit, non-contiguous keys force IndexedDB primary-key order to put
    // each child before its parent. Export must use topology, not numeric id.
    await db.outlineNodes.add({
      id: 101,
      projectId,
      parentId: 901,
      type: 'chapter',
      title: 'child outline',
      summary: 'child',
      order: 1,
      worldGroupId: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await db.outlineNodes.add({
      id: 901,
      projectId,
      parentId: null,
      type: 'volume',
      title: 'parent outline',
      summary: 'parent',
      order: 0,
      worldGroupId: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await db.chapters.add({
      id: 51,
      projectId,
      outlineNodeId: 101,
      title: 'child chapter',
      content: 'content',
      wordCount: 7,
      status: 'draft',
      order: 0,
      notes: '',
      createdAt: NOW,
      updatedAt: NOW,
    })

    await db.importantLocations.add({
      id: 102,
      projectId,
      parentId: 902,
      name: 'child location',
      tags: '[]',
      description: 'child',
      significance: '',
      sortOrder: 1,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await db.importantLocations.add({
      id: 902,
      projectId,
      parentId: null,
      name: 'parent location',
      tags: '[]',
      description: 'parent',
      significance: '',
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })

    const sourceExport = await deriveExportProjectJSON(projectId)

    expect(sourceExport.outlineNodes).toMatchObject([
      { title: 'parent outline', _exportId: 0, _parentExportId: null },
      { title: 'child outline', _exportId: 1, _parentExportId: 0 },
    ])
    expect(sourceExport.importantLocations).toMatchObject([
      { name: 'parent location', _exportId: 0, _parentExportId: null },
      { name: 'child location', _exportId: 1, _parentExportId: 0 },
    ])
    expect(sourceExport.chapters).toMatchObject([
      { title: 'child chapter', _outlineExportId: 1 },
    ])

    await db.delete()
    await db.open()
    const importedProjectId = await deriveImportProjectJSON(sourceExport)
    const reExport = await deriveExportProjectJSON(importedProjectId)

    expect(reExport.project.name).toBe(`${projectName}（导入）`)
    const normalized = normalizeFixtureRoundtripBusinessPair(sourceExport, reExport)
    expect(normalized.reExported).toEqual(normalized.source)
  })

  it('exports temporalFacts supersedesFactId parent-first and preserves the forward reference', async () => {
    const projectId = await addProject('temporal-fact-tree')

    // The newer fact has the lower key, so raw primary-key order exposes the
    // forward reference unless temporalFacts participates in tree ordering.
    await db.temporalFacts.add({
      id: 121,
      projectId,
      supersedesFactId: 921,
      subjectName: '林惊羽',
      predicate: 'location',
      factKind: 'state',
      value: '新城',
      sourceType: 'manual',
      status: 'confirmed',
      locked: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await db.temporalFacts.add({
      id: 921,
      projectId,
      subjectName: '林惊羽',
      predicate: 'location',
      factKind: 'state',
      value: '旧城',
      sourceType: 'manual',
      status: 'superseded',
      locked: false,
      createdAt: NOW,
      updatedAt: NOW,
    })

    const sourceExport = await deriveExportProjectJSON(projectId)
    expect(sourceExport.temporalFacts).toMatchObject([
      { value: '旧城', _exportId: 0, _supersedesExportId: null },
      { value: '新城', _exportId: 1, _supersedesExportId: 0 },
    ])

    await db.delete()
    await db.open()
    const importedProjectId = await deriveImportProjectJSON(sourceExport)
    const importedFacts = await db.temporalFacts
      .where('projectId')
      .equals(importedProjectId)
      .toArray()
    const importedParent = importedFacts.find(fact => fact.value === '旧城')
    const importedChild = importedFacts.find(fact => fact.value === '新城')
    expect(importedParent?.id).toBeDefined()
    expect(importedChild?.supersedesFactId).toBe(importedParent?.id)

    const reExport = await deriveExportProjectJSON(importedProjectId)
    const normalized = normalizeFixtureRoundtripBusinessPair(sourceExport, reExport)
    expect(normalized.reExported).toEqual(normalized.source)
  })

  it('fails closed on a single-node self-parent cycle', async () => {
    const projectId = await addProject('self-parent-cycle')
    await db.outlineNodes.add({
      id: 113,
      projectId,
      parentId: 113,
      type: 'volume',
      title: 'self-cycle',
      summary: '',
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })

    await expect(deriveExportProjectJSON(projectId)).rejects.toThrow(
      /\[deriveExport\] outlineNodes tree contains a parent cycle/,
    )
  })

  it.each([
    ['missing', async () => 999_999],
    ['cross-project', async () => {
      const foreignProjectId = await addProject('foreign-parent-project', 9_002)
      await db.outlineNodes.add({
        id: 778,
        projectId: foreignProjectId,
        parentId: null,
        type: 'volume',
        title: 'foreign parent',
        summary: '',
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      })
      return 778
    }],
  ] as const)('fails closed on a %s tree parent instead of exporting it as a root', async (kind, getParentId) => {
    const projectId = await addProject(`${kind}-parent-source`)
    const parentId = await getParentId()
    await db.outlineNodes.add({
      id: 114,
      projectId,
      parentId,
      type: 'chapter',
      title: `${kind} parent child`,
      summary: '',
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })

    await expect(deriveExportProjectJSON(projectId)).rejects.toThrow(
      new RegExp(
        `\\[deriveExport\\] outlineNodes tree row 114 references missing or cross-project parent ${parentId}`,
      ),
    )
  })

  it.each([
    ['outlineNodes', async (projectId: number) => {
      await db.outlineNodes.bulkAdd([
        {
          id: 111,
          projectId,
          parentId: 911,
          type: 'volume',
          title: 'cycle-a',
          summary: '',
          order: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 911,
          projectId,
          parentId: 111,
          type: 'volume',
          title: 'cycle-b',
          summary: '',
          order: 1,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ])
    }],
    ['importantLocations', async (projectId: number) => {
      await db.importantLocations.bulkAdd([
        {
          id: 112,
          projectId,
          parentId: 912,
          name: 'cycle-a',
          tags: '[]',
          description: '',
          significance: '',
          sortOrder: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 912,
          projectId,
          parentId: 112,
          name: 'cycle-b',
          tags: '[]',
          description: '',
          significance: '',
          sortOrder: 1,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ])
    }],
  ] as const)('fails closed when %s contains a two-node parent cycle', async (_table, seedCycle) => {
    const projectId = await addProject(`cycle-${_table}`)
    await seedCycle(projectId)

    await expect(deriveExportProjectJSON(projectId)).rejects.toThrow(
      new RegExp(`\\[deriveExport\\] ${_table} tree contains a parent cycle`),
    )
  })
})
