import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/lib/db/schema'
import { exportProjectJSON, importProjectJSON } from '../../src/lib/export/json-export'
import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'
import {
  assertRegistryCoverage,
  buildRegistryCoverage,
  canonicalFixtureJson,
  createFixtureText,
  D04_CANONICAL_EXCLUDED_FIELDS,
  D04_FIXTURE_CLOCK_ISO,
  D04_FIXTURE_CLOCK_MS,
  D04_FIXTURE_SEED,
  fixtureSha256,
  stableFixtureHexId,
  stableFixtureNumericId,
} from '../helpers/d04-fixture-kit'
import { seedFullProject } from '../helpers/seed-full-project'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixtureSpec = JSON.parse(fs.readFileSync(path.join(
  root,
  'docs',
  'windows-desktop',
  'baseline-fixtures.json',
), 'utf8'))
const smallFixtureSpec = fixtureSpec.fixtures.find(
  (fixture: { id: string }) => fixture.id === 'small-v1',
) as {
  artifactStatus: string
  currentValidation: {
    roundtripHashStatus: string
    status: string
  }
  expected: {
    chapters: number
    projects: number
    sourceAndImportedPrimaryKeysMustDiffer: boolean
    volumes: number
    wordsPerChapter: number
    worldGroups: number
    worldNodes: number
    worldviews: number
  }
} | undefined

if (!smallFixtureSpec) throw new Error('small-v1 fixture specification is missing')

async function collectExportablePrimaryKeys(): Promise<Map<string, number[]>> {
  const rows = await Promise.all(
    PROJECT_TABLES
      .filter(spec => spec.exportable)
      .map(async spec => [
        spec.name,
        await db.table(spec.name).toCollection().primaryKeys() as number[],
      ] as const),
  )
  return new Map(rows)
}

function countNonWhitespace(value: string): number {
  return value.replace(/\s/gu, '').length
}

function parseNumericIdArray(value: unknown, path: string): number[] {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new Error(`${path} must contain valid JSON`)
    }
  }
  if (parsed == null) return []
  if (!Array.isArray(parsed)
    || parsed.some(item => !Number.isSafeInteger(item) || item < 1)) {
    throw new Error(`${path} must be an array of positive safe integer IDs`)
  }
  return parsed as number[]
}

async function collectDanglingFixtureReferences(projectId: number): Promise<string[]> {
  const characterIds = new Set(
    (await db.characters.where('projectId').equals(projectId).primaryKeys()) as number[],
  )
  const referenceIds = new Set(
    (await db.references.where('projectId').equals(projectId).primaryKeys()) as number[],
  )
  const foreshadowIds = new Set(
    (await db.foreshadows.where('projectId').equals(projectId).primaryKeys()) as number[],
  )
  const codexEntryIds = new Set(
    (await db.codexEntries.where('projectId').equals(projectId).primaryKeys()) as number[],
  )
  const details = await db.detailedOutlines.where('projectId').equals(projectId).toArray()
  const rules = await db.creativeRules.where('projectId').equals(projectId).toArray()
  const codexEntries = await db.codexEntries.where('projectId').equals(projectId).toArray()
  const dangling: string[] = []

  details.forEach((detail, detailIndex) => {
    for (const [index, characterId] of (detail.appearingCharacterIds ?? []).entries()) {
      if (!characterIds.has(characterId)) {
        dangling.push(`detailedOutlines[${detailIndex}].appearingCharacterIds[${index}]`)
      }
    }
    for (const [sceneIndex, scene] of (detail.scenes ?? []).entries()) {
      for (const [index, characterId] of (scene.characterIds ?? []).entries()) {
        if (!characterIds.has(characterId)) {
          dangling.push(
            `detailedOutlines[${detailIndex}].scenes[${sceneIndex}].characterIds[${index}]`,
          )
        }
      }
    }
    for (const [index, foreshadowId] of (detail.foreshadowIds ?? []).entries()) {
      if (!foreshadowIds.has(foreshadowId)) {
        dangling.push(`detailedOutlines[${detailIndex}].foreshadowIds[${index}]`)
      }
    }
  })
  rules.forEach((rule, ruleIndex) => {
    const citedReferenceIds = parseNumericIdArray(
      rule.citedReferenceIds,
      `creativeRules[${ruleIndex}].citedReferenceIds`,
    )
    for (const [index, referenceId] of citedReferenceIds.entries()) {
      if (!referenceIds.has(referenceId)) {
        dangling.push(`creativeRules[${ruleIndex}].citedReferenceIds[${index}]`)
      }
    }
  })
  codexEntries.forEach((entry, entryIndex) => {
    let refs: unknown = entry.refs
    if (typeof refs === 'string') {
      try {
        refs = JSON.parse(refs)
      } catch {
        throw new Error(`codexEntries[${entryIndex}].refs must contain valid JSON`)
      }
    }
    if (refs == null) return
    if (typeof refs !== 'object' || Array.isArray(refs)) {
      throw new Error(`codexEntries[${entryIndex}].refs must be an object of ID arrays`)
    }
    for (const [key, value] of Object.entries(refs)) {
      for (const [index, codexEntryId] of parseNumericIdArray(
        value,
        `codexEntries[${entryIndex}].refs.${key}`,
      ).entries()) {
        if (!codexEntryIds.has(codexEntryId)) {
          dangling.push(`codexEntries[${entryIndex}].refs.${key}[${index}]`)
        }
      }
    }
  })
  return dangling.sort()
}

describe('D0.4 deterministic fixture contract', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(() => {
    db.close()
  })

  it('derives stable IDs, exact text and canonical hashes from the frozen seed', () => {
    const hexId = stableFixtureHexId('small-v1', 'chapters', 0)
    const numericId = stableFixtureNumericId('small-v1', 'chapters', 0)
    const text = createFixtureText('small-v1', 'chapter-content', 0, 2000)

    expect(hexId).toMatch(/^[a-f0-9]{64}$/)
    expect(stableFixtureHexId('small-v1', 'chapters', 0)).toBe(hexId)
    expect(stableFixtureHexId('ab', 'c', 0)).not.toBe(stableFixtureHexId('a', 'bc', 0))
    expect(numericId).toBeGreaterThan(0)
    expect(Number.isSafeInteger(numericId)).toBe(true)
    expect(countNonWhitespace(text)).toBe(2000)
    expect(createFixtureText('small-v1', 'chapter-content', 0, 2000)).toBe(text)
    expect(createFixtureText('small-v1', 'chapter-content', 1, 2000)).not.toBe(text)

    const left = { b: 2, a: { updatedAt: 123, y: 2, x: 1 } }
    const right = { a: { x: 1, y: 2, updatedAt: 999 }, b: 2 }
    expect(canonicalFixtureJson(left)).toBe(canonicalFixtureJson(right))
    expect(fixtureSha256(left)).toBe(fixtureSha256(right))
    expect(fixtureSha256({ title: 'source' })).not.toBe(fixtureSha256({ title: 'changed' }))

    const prototypeKey = JSON.parse('{"__proto__":{"x":1}}')
    expect(canonicalFixtureJson(prototypeKey)).toBe('{"__proto__":{"x":1}}')
    expect(fixtureSha256(prototypeKey)).not.toBe(fixtureSha256({}))
    expect(fixtureSpec.determinism.seed).toBe(D04_FIXTURE_SEED)
    expect(fixtureSpec.determinism.canonicalJson.excludedRuntimeFields).toEqual(
      D04_CANONICAL_EXCLUDED_FIELDS,
    )
    expect(() => stableFixtureNumericId('', 'chapters', 0)).toThrow('fixtureId')
    expect(() => createFixtureText('small-v1', 'chapter', 0, -1)).toThrow(
      'nonWhitespaceCharacters',
    )
  })

  it('derives exactly one coverage row per PROJECT_TABLES entry', () => {
    const coverage = buildRegistryCoverage()
    expect(() => assertRegistryCoverage(coverage)).not.toThrow()
    expect(coverage).toHaveLength(PROJECT_TABLES.length)
    expect(new Set(coverage.map(entry => entry.name)).size).toBe(PROJECT_TABLES.length)
    expect(coverage.find(entry => entry.name === 'importFiles')?.classification).toBe('blob')
    expect(coverage.find(entry => entry.name === 'promptTemplates')?.classification).toBe('global')
    expect(coverage.find(entry => entry.name === 'chapters')?.classification).toBe('exportable')
  })

  it('builds small-v1 deterministically with 10 chapters and full exportable-table coverage', async () => {
    const seeded = await seedFullProject({
      fixtureId: 'small-v1',
      projectName: 'D0.4 small-v1',
      chapterCount: smallFixtureSpec.expected.chapters,
      nonWhitespaceCharactersPerChapter: smallFixtureSpec.expected.wordsPerChapter,
      useDeterministicPrimaryKeys: true,
    })

    expect(seeded.projectId).toBe(stableFixtureNumericId('small-v1', 'projects', 0))
    expect(await db.projects.get(seeded.projectId)).toMatchObject({
      createdAt: D04_FIXTURE_CLOCK_MS,
      updatedAt: D04_FIXTURE_CLOCK_MS,
    })
    expect(seeded.chapterIds).toHaveLength(smallFixtureSpec.expected.chapters)
    expect(seeded.chapNodeIds).toHaveLength(smallFixtureSpec.expected.chapters)
    expect(await db.projects.count()).toBe(smallFixtureSpec.expected.projects)
    expect(await db.worldGroups.where('projectId').equals(seeded.projectId).count()).toBe(
      smallFixtureSpec.expected.worldGroups,
    )
    expect(await db.worldviews.where('projectId').equals(seeded.projectId).count()).toBe(
      smallFixtureSpec.expected.worldviews,
    )
    expect(await db.worldNodes.where('projectId').equals(seeded.projectId).count()).toBe(
      smallFixtureSpec.expected.worldNodes,
    )
    expect(await db.outlineNodes
      .where('projectId')
      .equals(seeded.projectId)
      .filter(node => node.type === 'volume')
      .count()).toBe(smallFixtureSpec.expected.volumes)

    const chapters = await db.chapters.where('projectId').equals(seeded.projectId).sortBy('order')
    expect(chapters).toHaveLength(smallFixtureSpec.expected.chapters)
    for (const chapter of chapters) {
      expect(countNonWhitespace(chapter.content)).toBe(smallFixtureSpec.expected.wordsPerChapter)
      expect(chapter.wordCount).toBe(smallFixtureSpec.expected.wordsPerChapter)
    }

    const exported = await exportProjectJSON(seeded.projectId)
    for (const spec of PROJECT_TABLES.filter(spec => spec.exportable && spec.name !== 'projects')) {
      expect(
        (exported as unknown as Record<string, unknown[]>)[spec.name]?.length,
        `${spec.name} must be represented in small-v1`,
      ).toBeGreaterThan(0)
    }
  })

  it('keeps small-v1 invalid while semantic FK remap blockers remain visible', async () => {
    const source = await seedFullProject({
      fixtureId: 'small-v1',
      projectName: 'D0.4 small-v1',
      chapterCount: smallFixtureSpec.expected.chapters,
      nonWhitespaceCharactersPerChapter: smallFixtureSpec.expected.wordsPerChapter,
      useDeterministicPrimaryKeys: true,
    })
    expect(await db.characters.get(source.char1)).toMatchObject({
      roleWeight: 'main',
      moralAxis: 'good',
      orderAxis: 'neutral',
    })
    const exported = await exportProjectJSON(source.projectId)
    const sourceKeys = await collectExportablePrimaryKeys()

    await db.delete()
    await db.open()
    const importedProjectId = await importProjectJSON(exported)
    const importedKeys = await collectExportablePrimaryKeys()

    expect(importedProjectId).not.toBe(source.projectId)
    expect(smallFixtureSpec.expected.sourceAndImportedPrimaryKeysMustDiffer).toBe(true)
    for (const spec of PROJECT_TABLES.filter(spec => spec.exportable)) {
      const before = sourceKeys.get(spec.name) ?? []
      const after = importedKeys.get(spec.name) ?? []
      expect(after, `${spec.name} imported key count`).toHaveLength(before.length)
      expect(
        after.every(key => !before.includes(key)),
        `${spec.name} imported primary keys must differ from source keys`,
      ).toBe(true)
    }
    const importedCharacter = await db.characters
      .where('projectId')
      .equals(importedProjectId)
      .filter(character => character.name === '林惊羽')
      .first()
    expect(importedCharacter?.id).not.toBe(source.char1)
    expect(importedCharacter).toMatchObject({
      roleWeight: 'main',
      moralAxis: 'good',
      orderAxis: 'neutral',
    })

    const reExported = await exportProjectJSON(importedProjectId)
    for (const spec of PROJECT_TABLES.filter(spec => spec.exportable && spec.name !== 'projects')) {
      expect(
        (reExported as unknown as Record<string, unknown[]>)[spec.name]?.length,
        `${spec.name} row count must survive roundtrip`,
      ).toBe((exported as unknown as Record<string, unknown[]>)[spec.name]?.length)
    }

    const dangling = await collectDanglingFixtureReferences(importedProjectId)
    const expectedDangling = [
      ...Array.from({ length: smallFixtureSpec.expected.chapters }, (_, index) => (
        `detailedOutlines[${index}].appearingCharacterIds[0]`
      )),
      ...Array.from({ length: smallFixtureSpec.expected.chapters }, (_, index) => (
        `detailedOutlines[${index}].scenes[0].characterIds[0]`
      )),
      ...Array.from({ length: smallFixtureSpec.expected.chapters }, (_, index) => (
        `detailedOutlines[${index}].foreshadowIds[0]`
      )),
      'creativeRules[0].citedReferenceIds[0]',
      'codexEntries[0].refs.related[0]',
    ].sort()
    expect(dangling).toEqual(expectedDangling)

    expect(smallFixtureSpec.artifactStatus).toBe('NOT_GENERATED')
    expect(smallFixtureSpec.currentValidation.status).toBe(
      'BLOCKED_SEMANTIC_REFERENCE_REMAP_AND_HASH_NORMALIZATION',
    )
    expect(smallFixtureSpec.currentValidation.roundtripHashStatus).toBe('NOT_IMPLEMENTED')
    const sourceDiagnosticHash = fixtureSha256(exported)
    const importedDiagnosticHash = fixtureSha256(reExported)
    expect(sourceDiagnosticHash).toMatch(/^[a-f0-9]{64}$/)
    expect(importedDiagnosticHash).toMatch(/^[a-f0-9]{64}$/)
    expect(importedDiagnosticHash).not.toBe(sourceDiagnosticHash)
    expect(fixtureSpec.determinism.clock).toBe(D04_FIXTURE_CLOCK_ISO)
  })
})
