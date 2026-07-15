import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BLOB_LADDER_SIZES,
  buildBlobLadderRecipe,
  createDeterministicBlobChunk,
  hashDeterministicBlob,
  validateBlobLadderRecipe,
} from '../../scripts/lib/windows-desktop-blob-fixture.mjs'
import { db } from '../../src/lib/db/schema'
import { exportProjectJSON, importProjectJSON } from '../../src/lib/export/json-export'
import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'
import {
  assertRegistryCoverage,
  buildRegistryCoverage,
  canonicalFixtureJson,
  createFixtureText,
  D04_FIXTURE_CLOCK_ISO,
  D04_FIXTURE_CLOCK_MS,
  D04_FIXTURE_SEED,
  D04_IMPORT_PROJECT_NAME_SUFFIX,
  D04_ROUNDTRIP_EXCLUDED_PATHS,
  D04_SINGLE_STATE_EXCLUDED_PATHS,
  fixtureRoundtripBusinessHashes,
  fixtureSha256,
  normalizeFixtureRoundtripBusinessPair,
  stableFixtureHexId,
  stableFixtureNumericId,
} from '../helpers/d04-fixture-kit'
import { assertRegisteredReferenceIntegrity } from '../helpers/d04-reference-integrity'
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
    referenceRemapEvidence: string[]
    referenceRemapStatus: string
    roundtripComparatorVersion: string
    roundtripHashEvidence: string[]
    roundtripHashStatus: string
    status: string
    treeExportOrderStatus: string
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

/** Exercise the same serialized JSON boundary as a downloaded/imported fixture artifact. */
function throughJsonArtifact<T>(value: T): T {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('fixture export must serialize to a JSON value')
  return JSON.parse(serialized) as T
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

    const left = { exportedAt: 123, b: 2, a: { y: 2, x: 1 } }
    const right = { a: { x: 1, y: 2 }, b: 2, exportedAt: 999 }
    expect(canonicalFixtureJson(left)).toBe(canonicalFixtureJson(right))
    expect(fixtureSha256(left)).toBe(fixtureSha256(right))
    expect(fixtureSha256({ title: 'source' })).not.toBe(fixtureSha256({ title: 'changed' }))
    expect(fixtureSha256({ nested: { updatedAt: 1 } })).not.toBe(
      fixtureSha256({ nested: { updatedAt: 2 } }),
    )

    const prototypeKey = JSON.parse('{"__proto__":{"x":1}}')
    expect(canonicalFixtureJson(prototypeKey)).toBe('{"__proto__":{"x":1}}')
    expect(fixtureSha256(prototypeKey)).not.toBe(fixtureSha256({}))
    expect(fixtureSpec.determinism.seed).toBe(D04_FIXTURE_SEED)
    expect(fixtureSpec.determinism.canonicalJson.singleStateExcludedPaths).toEqual(
      D04_SINGLE_STATE_EXCLUDED_PATHS,
    )
    expect(fixtureSpec.determinism.canonicalJson.roundtripExcludedPaths).toEqual(
      D04_ROUNDTRIP_EXCLUDED_PATHS,
    )
    expect(() => stableFixtureNumericId('', 'chapters', 0)).toThrow('fixtureId')
    expect(() => createFixtureText('small-v1', 'chapter', 0, -1)).toThrow(
      'nonWhitespaceCharacters',
    )
  })

  it('validates excluded runtime paths before omitting them from canonical data', () => {
    const invalidExcludedValues: Array<[string, unknown, string]> = [
      ['Blob', new Blob(['bytes']), 'Blob must be hashed as bytes'],
      ['function', () => undefined, 'unsupported canonical value at $.exportedAt: function'],
      ['symbol', Symbol('timestamp'), 'unsupported canonical value at $.exportedAt: symbol'],
      ['bigint', 1n, 'unsupported canonical value at $.exportedAt: bigint'],
      ['undefined', undefined, 'unsupported canonical value at $.exportedAt: undefined'],
      ['non-finite number', Number.NaN, 'non-finite number at $.exportedAt'],
      ['invalid Date', new Date(Number.NaN), 'invalid Date at $.exportedAt'],
      ['non-plain object', new Map(), 'non-plain canonical object at $.exportedAt'],
    ]
    for (const [label, value, expectedError] of invalidExcludedValues) {
      expect(
        () => canonicalFixtureJson({ exportedAt: value, payload: 'still-visible' }),
        label,
      ).toThrow(expectedError)
    }

    const cyclicTimestamp: Record<string, unknown> = {}
    cyclicTimestamp.self = cyclicTimestamp
    expect(() => canonicalFixtureJson({
      exportedAt: cyclicTimestamp,
      payload: 'still-visible',
    })).toThrow('cyclic canonical value at $.exportedAt.self')

    const target = {
      project: { name: `项目${D04_IMPORT_PROJECT_NAME_SUFFIX}` },
      chapters: [{}],
    }
    expect(() => normalizeFixtureRoundtripBusinessPair(
      {
        project: { name: '项目', updatedAt: new Blob(['hidden-project-timestamp']) },
        chapters: [{}],
      },
      target,
    )).toThrow('Blob must be hashed as bytes instead of canonical JSON at $.project.updatedAt')
    expect(() => normalizeFixtureRoundtripBusinessPair(
      {
        project: { name: '项目' },
        chapters: [{ createdAt: Symbol('hidden-row-timestamp') }],
      },
      target,
    )).toThrow('unsupported canonical value at $.chapters[0].createdAt: symbol')

    expect(canonicalFixtureJson({
      exportedAt: new Date(0),
      payload: 'still-visible',
    })).toBe('{"payload":"still-visible"}')
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

  it('normalizes only the exact import-name transform and keeps business changes hash-visible', () => {
    const names = [
      '普通项目',
      `原名${D04_IMPORT_PROJECT_NAME_SUFFIX}`,
      `双后缀${D04_IMPORT_PROJECT_NAME_SUFFIX}${D04_IMPORT_PROJECT_NAME_SUFFIX}`,
    ]

    for (const sourceName of names) {
      const source = {
        version: 4,
        exportedAt: 1,
        project: { name: sourceName, description: 'same', createdAt: 1, updatedAt: 1 },
        chapters: [
          {
            title: '第一章', order: 0, createdAt: 1, updatedAt: 1,
            metadata: { updatedAt: 'business-value' },
          },
          {
            title: '第二章', order: 1, createdAt: 1, updatedAt: 1,
            metadata: { updatedAt: 'business-value-2' },
          },
        ],
      }
      const reExported = {
        version: 4,
        exportedAt: 2,
        project: {
          name: `${sourceName}${D04_IMPORT_PROJECT_NAME_SUFFIX}`,
          description: 'same',
          createdAt: 2,
          updatedAt: 2,
        },
        chapters: [
          {
            title: '第一章', order: 0, createdAt: 2, updatedAt: 2,
            metadata: { updatedAt: 'business-value' },
          },
          {
            title: '第二章', order: 1, createdAt: 2, updatedAt: 2,
            metadata: { updatedAt: 'business-value-2' },
          },
        ],
      }
      const before = structuredClone(reExported)
      const hashes = fixtureRoundtripBusinessHashes(source, reExported)
      expect(hashes.equal, sourceName).toBe(true)
      expect(hashes.sourceSha256).toBe(hashes.reExportedSha256)
      expect(reExported).toEqual(before)

      reExported.chapters[0].title = '被篡改'
      expect(fixtureRoundtripBusinessHashes(source, reExported).equal).toBe(false)
      reExported.chapters[0].title = '第一章'
      reExported.chapters[0].metadata.updatedAt = 'nested-business-change'
      expect(fixtureRoundtripBusinessHashes(source, reExported).equal).toBe(false)
      reExported.chapters[0].metadata.updatedAt = 'business-value'
      reExported.chapters.reverse()
      expect(fixtureRoundtripBusinessHashes(source, reExported).equal).toBe(false)
      reExported.chapters.reverse()
      reExported.chapters.push(structuredClone(reExported.chapters[1]))
      expect(fixtureRoundtripBusinessHashes(source, reExported).equal).toBe(false)
    }

    const source = { project: { name: '项目' }, chapters: [] }
    for (const invalidName of ['项目', '项目（副本）', '项目（导入）（导入）', '项目(导入)']) {
      expect(() => normalizeFixtureRoundtripBusinessPair(
        source,
        { project: { name: invalidName }, chapters: [] },
      ), invalidName).toThrow('unexpected imported project name')
    }
    expect(() => fixtureRoundtripBusinessHashes(
      { ...source, payload: new Blob(['bytes']) },
      { project: { name: `项目${D04_IMPORT_PROJECT_NAME_SUFFIX}` }, chapters: [] },
    )).toThrow('Blob must be hashed as bytes')
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

  it('passes semantic references and normalized business hash for generated artifacts', async () => {
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
    expect(exported).toMatchObject({
      version: 4,
      nestedRefEncoding: 'export-index-v1',
    })
    const exportedArtifact = throughJsonArtifact(exported)
    const sourceKeys = await collectExportablePrimaryKeys()

    await db.delete()
    await db.open()
    const importedProjectId = await importProjectJSON(exportedArtifact)
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
    const reExportedArtifact = throughJsonArtifact(reExported)
    for (const spec of PROJECT_TABLES.filter(spec => spec.exportable && spec.name !== 'projects')) {
      expect(
        (reExportedArtifact as unknown as Record<string, unknown[]>)[spec.name]?.length,
        `${spec.name} row count must survive roundtrip`,
      ).toBe((exportedArtifact as unknown as Record<string, unknown[]>)[spec.name]?.length)
    }

    const dangling = await collectDanglingFixtureReferences(importedProjectId)
    expect(dangling).toEqual([])

    expect(smallFixtureSpec.artifactStatus).toBe('GENERATED_VALID')
    expect(smallFixtureSpec.currentValidation.status).toBe(
      'PASS_ARTIFACT_GENERATED_VALIDATED',
    )
    expect(smallFixtureSpec.currentValidation.referenceRemapStatus).toBe('PASS')
    expect(smallFixtureSpec.currentValidation.referenceRemapEvidence).toEqual(
      expect.arrayContaining([
        'tests/regression/R-export-nested-reference-remap.test.ts',
        'tests/desktop-contract/D0.4-fixtures.test.ts',
      ]),
    )
    expect(smallFixtureSpec.currentValidation.treeExportOrderStatus).toBe('PASS')
    expect(smallFixtureSpec.currentValidation.roundtripHashStatus).toBe('PASS')
    expect(smallFixtureSpec.currentValidation.roundtripComparatorVersion).toBe(
      'd04-roundtrip-v1',
    )
    expect(smallFixtureSpec.currentValidation.roundtripHashEvidence).toEqual(
      expect.arrayContaining([
        'tests/desktop-contract/D0.4-fixtures.test.ts',
        'tests/regression/R-export-tree-order-stability.test.ts',
      ]),
    )
    const sourceDiagnosticHash = fixtureSha256(exportedArtifact)
    const importedDiagnosticHash = fixtureSha256(reExportedArtifact)
    expect(sourceDiagnosticHash).toMatch(/^[a-f0-9]{64}$/)
    expect(importedDiagnosticHash).toMatch(/^[a-f0-9]{64}$/)
    expect(importedDiagnosticHash).not.toBe(sourceDiagnosticHash)
    const businessHashes = fixtureRoundtripBusinessHashes(
      exportedArtifact,
      reExportedArtifact,
    )
    expect(businessHashes.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(businessHashes.reExportedSha256).toBe(businessHashes.sourceSha256)
    expect(businessHashes.equal).toBe(true)
    expect(fixtureSpec.determinism.clock).toBe(D04_FIXTURE_CLOCK_ISO)
  })

  it('roundtrips the committed maximum project with exact scale and registered references', async () => {
    const fixtureRoot = path.join(root, 'tests', 'fixtures', 'windows-desktop', 'd0.4-v1')
    const largeBytes = fs.readFileSync(path.join(fixtureRoot, 'large-synthetic-v1.storyforge.json'))
    const large = JSON.parse(largeBytes.toString('utf8')) as Record<string, unknown>
    const manifest = JSON.parse(fs.readFileSync(
      path.join(fixtureRoot, 'fixture-manifest.json'),
      'utf8',
    )) as { fixtures: Array<Record<string, unknown>> }
    const manifestEntry = manifest.fixtures.find(entry => entry.id === 'large-synthetic-v1')
    expect(manifestEntry).toBeDefined()
    expect(createHash('sha256').update(largeBytes).digest('hex')).toBe(manifestEntry?.sha256)

    const chapters = large.chapters as Array<{ content: string }>
    const outlineNodes = large.outlineNodes as Array<{ type: string }>
    expect(chapters).toHaveLength(1_000)
    expect(chapters.every(chapter => countNonWhitespace(chapter.content) === 5_000)).toBe(true)
    expect(outlineNodes.filter(node => node.type === 'volume')).toHaveLength(10)
    expect((large.worldGroups as unknown[])).toHaveLength(1)
    for (const spec of PROJECT_TABLES.filter(spec => spec.exportable && spec.name !== 'projects')) {
      const rows = large[spec.name]
      expect(Array.isArray(rows), `${spec.name} must be derived into the large export`).toBe(true)
      expect((rows as unknown[]).length, `${spec.name} must be populated`).toBeGreaterThan(0)
    }

    const importedProjectId = await importProjectJSON(large as never)
    await assertRegisteredReferenceIntegrity()
    const reExported = throughJsonArtifact(await exportProjectJSON(importedProjectId))
    const hashes = fixtureRoundtripBusinessHashes(large, reExported)
    expect(hashes.equal).toBe(true)
    expect(hashes.sourceSha256).toBe(manifestEntry?.businessSha256)

    const damaged = structuredClone(large)
    ;(damaged.chapters as Array<{ content: string }>)[511].content += '损坏'
    expect(fixtureSha256(damaged)).not.toBe(fixtureSha256(large))
  }, 30_000)

  it('proves streamed blob and actual-schema legacy properties over representative cases', () => {
    const fixtureRoot = path.join(root, 'tests', 'fixtures', 'windows-desktop', 'd0.4-v1')
    const blobRecipe = validateBlobLadderRecipe(JSON.parse(fs.readFileSync(
      path.join(fixtureRoot, 'blob-ladder-v1.json'),
      'utf8',
    )))
    expect(blobRecipe.chunkBytes).toBe(1_048_576)
    expect(blobRecipe.peakGeneratedBytes).toBe(1_048_576)
    expect(blobRecipe.ordinaryCiIncludesOneGiB).toBe(false)
    expect(blobRecipe.sizes.map((entry: { bytes: number }) => entry.bytes)).toEqual([
      10 * 1_048_576,
      100 * 1_048_576,
      500 * 1_048_576,
      1_024 * 1_048_576,
    ])

    const tenMiB = BLOB_LADDER_SIZES[0]
    for (const chunkIndex of [0, 1, 9]) {
      const first = createDeterministicBlobChunk(tenMiB, chunkIndex)
      const second = createDeterministicBlobChunk(tenMiB, chunkIndex)
      expect(first).toHaveLength(1_048_576)
      expect(second.equals(first)).toBe(true)
      const damaged = Buffer.from(first)
      damaged[chunkIndex] ^= 0xff
      expect(createHash('sha256').update(damaged).digest('hex')).not.toBe(
        createHash('sha256').update(first).digest('hex'),
      )
    }
    expect(hashDeterministicBlob(tenMiB)).toBe(blobRecipe.sizes[0].sha256)
    expect(hashDeterministicBlob(tenMiB)).toBe(blobRecipe.sizes[0].sha256)
    expect(() => buildBlobLadderRecipe({ includeOneGiB: false })).toThrow(
      'locked 1 GiB SHA-256',
    )
    expect(() => hashDeterministicBlob(BLOB_LADDER_SIZES[3])).toThrow(
      'explicit includeOneGiB opt-in',
    )
    expect(() => validateBlobLadderRecipe({
      ...blobRecipe,
      ordinaryCiIncludesOneGiB: true,
    })).toThrow('frozen metadata')

    const legacy = JSON.parse(fs.readFileSync(
      path.join(fixtureRoot, 'legacy-matrix-v1.json'),
      'utf8',
    )) as {
      normalizedLatestSha256: string
      sourceArtifacts: Array<{
        normalizedSha256: string
        sourceVersion: number
        upgradedVersion: number
      }>
      sourceVersionRange: { count: number; maximum: number; minimum: number }
    }
    const schemaSource = fs.readFileSync(path.join(root, 'src', 'lib', 'db', 'schema.ts'), 'utf8')
    const declaredVersions = [...schemaSource.matchAll(/this\.version\((\d+)\)/g)]
      .map(match => Number(match[1]))
    const actualSchema = {
      count: declaredVersions.length,
      minimum: Math.min(...declaredVersions),
      maximum: Math.max(...declaredVersions),
    }
    expect(legacy.sourceVersionRange).toEqual({
      count: actualSchema.count,
      minimum: actualSchema.minimum,
      maximum: actualSchema.maximum,
    })
    expect(legacy.sourceArtifacts.map(entry => entry.sourceVersion)).toEqual(
      Array.from({ length: actualSchema.count }, (_, index) => actualSchema.minimum + index),
    )
    expect(legacy.sourceArtifacts.every(entry => (
      entry.upgradedVersion === actualSchema.maximum
      && entry.normalizedSha256 === legacy.normalizedLatestSha256
    ))).toBe(true)
  })
})
