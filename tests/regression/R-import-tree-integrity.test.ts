import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/lib/db/schema'
import { deriveExportProjectJSON } from '../../src/lib/export/registry-export'
import { deriveImportProjectJSON } from '../../src/lib/export/registry-import'

const NOW = 1_700_000_000_000

async function makeExportWithOneOutlineNode() {
  const projectId = await db.projects.add({
    name: 'import-tree-integrity',
    genre: 'fantasy',
    description: '',
    targetWordCount: 10_000,
    enableMultiWorld: false,
    createdAt: NOW,
    updatedAt: NOW,
  } as any) as number
  await db.outlineNodes.add({
    projectId,
    parentId: null,
    type: 'volume',
    title: 'root',
    summary: '',
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  const locationId = await db.importantLocations.add({
    projectId,
    parentId: null,
    name: 'location-a',
    tags: '[]',
    description: '',
    significance: '',
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  } as any) as number
  await db.importantLocations.add({
    projectId,
    parentId: null,
    name: 'location-b',
    tags: '[]',
    description: '',
    significance: '',
    sortOrder: 1,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.temporalFacts.add({
    projectId,
    locationId,
    subjectName: '林惊羽',
    predicate: 'location',
    factKind: 'state',
    value: 'location-a',
    sourceType: 'manual',
    status: 'confirmed',
    locked: false,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  return await deriveExportProjectJSON(projectId)
}

async function expectAtomicImportFailure(exported: any, message: string): Promise<void> {
  await db.delete()
  await db.open()

  await expect(deriveImportProjectJSON(exported)).rejects.toThrow(message)
  expect(await db.projects.count()).toBe(0)
  expect(await db.outlineNodes.count()).toBe(0)
  expect(await db.importantLocations.count()).toBe(0)
  expect(await db.temporalFacts.count()).toBe(0)
}

describe('R-import-tree-integrity', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(() => {
    db.close()
  })

  it.each([
    ['a self-parent cycle', 0, 'parent cycle'],
    ['a missing parent', 99, 'references missing export index 99'],
  ] as const)('fails closed and rolls back the project for %s', async (_case, parentExportId, message) => {
    const exported = await makeExportWithOneOutlineNode()
    exported.outlineNodes[0]._parentExportId = parentExportId

    await expectAtomicImportFailure(exported, message)
  })

  it.each([
    ['string', '0'],
    ['fraction', 0.5],
    ['negative', -1],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ] as const)('rejects a %s explicit export ID before optional references can be nulled', async (_case, malformedId) => {
    const exported = await makeExportWithOneOutlineNode()
    ;(exported.importantLocations[0] as any)._exportId = malformedId

    await expectAtomicImportFailure(exported, '_exportId must be a non-negative safe integer')
  })

  it('rejects duplicate explicit export IDs atomically', async () => {
    const exported = await makeExportWithOneOutlineNode()
    exported.importantLocations[1]._exportId = exported.importantLocations[0]._exportId

    await expectAtomicImportFailure(exported, 'contains duplicate _exportId')
  })

  it.each([
    ['string', '0'],
    ['fraction', 0.5],
    ['negative', -1],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ] as const)('rejects a %s optional foreign export index instead of silently writing null', async (_case, malformedId) => {
    const exported = await makeExportWithOneOutlineNode()
    ;(exported.temporalFacts![0] as any)._locExportId = malformedId

    await expectAtomicImportFailure(exported, '_locExportId must be a non-negative safe integer')
  })

  it('rejects an out-of-domain optional foreign export index instead of silently writing null', async () => {
    const exported = await makeExportWithOneOutlineNode()
    ;(exported.temporalFacts![0] as any)._locExportId = 999

    await expectAtomicImportFailure(exported, '_locExportId references missing export index 999')
  })
})
