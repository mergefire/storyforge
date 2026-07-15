import 'fake-indexeddb/auto'

import { createHash } from 'node:crypto'
import Dexie from 'dexie'

import { db, StoryForgeDB } from '../src/lib/db/schema'
import { exportProjectJSON, importProjectJSON } from '../src/lib/export/json-export'
import { PROJECT_TABLES } from '../src/lib/registry/project-tables'
import { canonicalFixtureArtifactJson } from './lib/windows-desktop-fixture-manifest.mjs'
import {
  D04_FIXTURE_CLOCK_ISO,
  D04_FIXTURE_CLOCK_MS,
  assertRegistryCoverage,
  buildRegistryCoverage,
  fixtureRoundtripBusinessHashes,
  stableFixtureNumericId,
} from '../tests/helpers/d04-fixture-kit'
import { assertRegisteredReferenceIntegrity } from '../tests/helpers/d04-reference-integrity'
import { seedFullProject } from '../tests/helpers/seed-full-project'
import { seedLargeSyntheticProject } from '../tests/helpers/seed-large-synthetic-project'

export const D04_FIXTURE_FILES = Object.freeze({
  empty: 'empty-v1.json',
  small: 'small-v1.storyforge.json',
  large: 'large-synthetic-v1.storyforge.json',
  legacy: 'legacy-matrix-v1.json',
  manifest: 'fixture-manifest.json',
})

export interface GeneratedFixtureArtifact {
  artifactKind:
    | 'empty-database-recipe-v1'
    | 'project-export-v4'
    | 'schema-upgrade-matrix-v1'
  artifactPath: string
  assertions: Array<{ id: string; status: 'PASS' }>
  businessSha256: string
  logicalCounts: Record<string, number>
  text: string
}

export interface GeneratedFixtureRuntimeBundle {
  empty: GeneratedFixtureArtifact
  small: GeneratedFixtureArtifact
  large: GeneratedFixtureArtifact
  legacy: GeneratedFixtureArtifact
}

export function canonicalFixtureArtifactText(value: unknown): string {
  return canonicalFixtureArtifactJson(value)
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
}

async function collectExportablePrimaryKeys(): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>()
  for (const spec of PROJECT_TABLES.filter(candidate => candidate.exportable)) {
    const keys = await db.table(spec.name).toCollection().primaryKeys() as number[]
    result.set(spec.name, keys)
  }
  return result
}

function logicalCountsFromExport(value: Record<string, unknown>): Record<string, number> {
  const counts: Record<string, number> = { projects: 1 }
  for (const spec of PROJECT_TABLES.filter(candidate => (
    candidate.exportable && candidate.name !== 'projects'
  ))) {
    const rows = value[spec.name]
    if (!Array.isArray(rows)) throw new Error(`${spec.name} is missing from project export`)
    counts[spec.name] = rows.length
  }
  return counts
}

async function buildEmptyFixture(): Promise<GeneratedFixtureArtifact> {
  await resetDatabase()
  const tableCounts: Record<string, number> = {}
  for (const spec of PROJECT_TABLES) tableCounts[spec.name] = await db.table(spec.name).count()
  const nonEmpty = Object.entries(tableCounts).filter(([, count]) => count !== 0)
  if (nonEmpty.length > 0) throw new Error(`empty-v1 is not empty: ${nonEmpty.map(([name]) => name).join(', ')}`)

  const coverage = buildRegistryCoverage()
  assertRegistryCoverage(coverage)
  const recipe = {
    schemaVersion: '1.0.0',
    fixtureId: 'empty-v1',
    artifactKind: 'empty-database-recipe-v1',
    generatedAt: D04_FIXTURE_CLOCK_ISO,
    databaseName: db.name,
    registryTableCount: PROJECT_TABLES.length,
    tableCounts,
  }
  const text = canonicalFixtureArtifactText(recipe)
  return {
    artifactKind: 'empty-database-recipe-v1',
    artifactPath: D04_FIXTURE_FILES.empty,
    assertions: [
      { id: 'EMPTY-ALL-REGISTERED-TABLES-ZERO', status: 'PASS' },
      { id: 'EMPTY-REGISTRY-COVERAGE-COMPLETE', status: 'PASS' },
    ],
    businessSha256: sha256Utf8(text),
    logicalCounts: tableCounts,
    text,
  }
}

async function buildSmallFixture(): Promise<GeneratedFixtureArtifact> {
  await resetDatabase()
  const seeded = await seedFullProject({
    fixtureId: 'small-v1',
    projectName: 'D0.4 small-v1',
    chapterCount: 10,
    nonWhitespaceCharactersPerChapter: 2_000,
    useDeterministicPrimaryKeys: true,
  })
  await assertRegisteredReferenceIntegrity()
  const sourceExport = await exportProjectJSON(seeded.projectId)
  sourceExport.exportedAt = D04_FIXTURE_CLOCK_MS
  if (sourceExport.version !== 4 || sourceExport.nestedRefEncoding !== 'export-index-v1') {
    throw new Error('small-v1 must use project export v4 with export-index-v1 references')
  }
  const sourceRecord = sourceExport as unknown as Record<string, unknown>
  const counts = logicalCountsFromExport(sourceRecord)
  const uncovered = PROJECT_TABLES
    .filter(spec => spec.exportable)
    .filter(spec => (counts[spec.name] ?? 0) < 1)
  if (uncovered.length > 0) {
    throw new Error(`small-v1 does not cover exportable tables: ${uncovered.map(spec => spec.name).join(', ')}`)
  }

  const sourceKeys = await collectExportablePrimaryKeys()
  const text = canonicalFixtureArtifactText(sourceExport)
  const throughArtifactBoundary = JSON.parse(text) as typeof sourceExport

  await resetDatabase()
  const importedProjectId = await importProjectJSON(throughArtifactBoundary)
  await assertRegisteredReferenceIntegrity()
  const importedKeys = await collectExportablePrimaryKeys()
  for (const spec of PROJECT_TABLES.filter(candidate => candidate.exportable)) {
    const before = sourceKeys.get(spec.name) ?? []
    const after = importedKeys.get(spec.name) ?? []
    const beforeSet = new Set(before)
    if (before.length !== after.length || after.some(key => beforeSet.has(key))) {
      throw new Error(`${spec.name} did not receive a complete fresh primary-key set`)
    }
  }

  const reExported = await exportProjectJSON(importedProjectId)
  reExported.exportedAt = D04_FIXTURE_CLOCK_MS
  const reExportedArtifact = JSON.parse(canonicalFixtureArtifactText(reExported)) as typeof reExported
  const reExportCounts = logicalCountsFromExport(
    reExportedArtifact as unknown as Record<string, unknown>,
  )
  if (JSON.stringify(counts) !== JSON.stringify(reExportCounts)) {
    throw new Error('small-v1 table counts changed across import/export')
  }
  const businessHashes = fixtureRoundtripBusinessHashes(
    throughArtifactBoundary,
    reExportedArtifact,
  )
  if (!businessHashes.equal) throw new Error('small-v1 business hash changed across import/export')

  return {
    artifactKind: 'project-export-v4',
    artifactPath: D04_FIXTURE_FILES.small,
    assertions: [
      { id: 'SMALL-PROJECT-EXPORT-V4', status: 'PASS' },
      { id: 'SMALL-EXPORTABLE-TABLE-COVERAGE-COMPLETE', status: 'PASS' },
      { id: 'SMALL-PRIMARY-KEYS-REMAPPED', status: 'PASS' },
      { id: 'SMALL-ROUNDTRIP-BUSINESS-HASH-EQUAL', status: 'PASS' },
    ],
    businessSha256: businessHashes.sourceSha256,
    logicalCounts: counts,
    text,
  }
}

async function buildLargeFixture(): Promise<GeneratedFixtureArtifact> {
  await resetDatabase()
  const seeded = await seedLargeSyntheticProject()
  await assertRegisteredReferenceIntegrity()

  const sourceExport = await exportProjectJSON(seeded.projectId)
  sourceExport.exportedAt = D04_FIXTURE_CLOCK_MS
  if (sourceExport.version !== 4 || sourceExport.nestedRefEncoding !== 'export-index-v1') {
    throw new Error('large-synthetic-v1 must use project export v4 with export-index-v1 references')
  }
  const sourceRecord = sourceExport as unknown as Record<string, unknown>
  const counts = logicalCountsFromExport(sourceRecord)
  for (const [tableName, expectedCount] of Object.entries(seeded.targetCounts)) {
    if (counts[tableName] !== expectedCount) throw new Error(`large ${tableName} count mismatch`)
  }
  if (counts.worldGroups !== 1 || counts.worldviews !== 1 || counts.outlineNodes !== 1_010) {
    throw new Error('large-synthetic-v1 frozen world/outline shape is invalid')
  }
  const chapterRows = sourceRecord.chapters as Array<{ content?: unknown }>
  if (chapterRows.length !== 1_000
    || chapterRows.some(row => typeof row.content !== 'string' || row.content.length !== 5_000)) {
    throw new Error('large-synthetic-v1 must contain 1,000 exact 5,000-character chapters')
  }
  const uncovered = PROJECT_TABLES
    .filter(spec => spec.exportable)
    .filter(spec => (counts[spec.name] ?? 0) < 1)
  if (uncovered.length > 0) throw new Error(`large does not cover: ${uncovered.map(s => s.name)}`)

  const sourceKeys = await collectExportablePrimaryKeys()
  const text = canonicalFixtureArtifactText(sourceExport)
  const throughArtifactBoundary = JSON.parse(text) as typeof sourceExport
  await resetDatabase()
  const importedProjectId = await importProjectJSON(throughArtifactBoundary)
  await assertRegisteredReferenceIntegrity()
  const importedKeys = await collectExportablePrimaryKeys()
  for (const spec of PROJECT_TABLES.filter(candidate => candidate.exportable)) {
    const before = sourceKeys.get(spec.name) ?? []
    const after = importedKeys.get(spec.name) ?? []
    const beforeSet = new Set(before)
    if (before.length !== after.length || after.some(key => beforeSet.has(key))) {
      throw new Error(`${spec.name} did not receive fresh large-fixture primary keys`)
    }
  }

  const reExported = await exportProjectJSON(importedProjectId)
  reExported.exportedAt = D04_FIXTURE_CLOCK_MS
  const reExportedArtifact = JSON.parse(canonicalFixtureArtifactText(reExported)) as typeof reExported
  const reExportCounts = logicalCountsFromExport(reExportedArtifact as unknown as Record<string, unknown>)
  if (JSON.stringify(counts) !== JSON.stringify(reExportCounts)) {
    throw new Error('large-synthetic-v1 table counts changed across import/export')
  }
  const businessHashes = fixtureRoundtripBusinessHashes(throughArtifactBoundary, reExportedArtifact)
  if (!businessHashes.equal) throw new Error('large-synthetic-v1 business hash changed across import/export')

  return {
    artifactKind: 'project-export-v4',
    artifactPath: D04_FIXTURE_FILES.large,
    assertions: [
      { id: 'LARGE-TEN-VOLUMES-ONE-THOUSAND-CHAPTERS', status: 'PASS' },
      { id: 'LARGE-FIVE-MILLION-EDITOR-CHARACTERS', status: 'PASS' },
      { id: 'LARGE-DENSE-REGISTERED-REFERENCES-VALID', status: 'PASS' },
      { id: 'LARGE-GRAPH-AND-MEMORY-LOAD-SHAPES', status: 'PASS' },
      { id: 'LARGE-PRIMARY-KEYS-REMAPPED', status: 'PASS' },
      { id: 'LARGE-ROUNDTRIP-BUSINESS-HASH-EQUAL', status: 'PASS' },
    ],
    businessSha256: businessHashes.sourceSha256,
    logicalCounts: counts,
    text,
  }
}

interface DexieVersionDeclaration {
  version: number
  stores: Record<string, string | null>
}

function currentSchemaDeclarations(): DexieVersionDeclaration[] {
  const internal = db as unknown as {
    _versions: Array<{ _cfg: { version: number; storesSource: Record<string, string | null> } }>
  }
  const declarations = internal._versions.map(entry => ({
    version: entry._cfg.version,
    stores: { ...entry._cfg.storesSource },
  }))
  const expected = Array.from({ length: declarations.length }, (_, index) => index + 1)
  if (JSON.stringify(declarations.map(entry => entry.version)) !== JSON.stringify(expected)) {
    throw new Error('schema.ts Dexie versions must form a contiguous range starting at 1')
  }
  return declarations
}

function cumulativeStoreCount(
  declarations: readonly DexieVersionDeclaration[],
  sourceVersion: number,
): number {
  const stores = new Set<string>()
  for (const declaration of declarations.filter(entry => entry.version <= sourceVersion)) {
    for (const [name, schema] of Object.entries(declaration.stores)) {
      if (schema === null) stores.delete(name)
      else stores.add(name)
    }
  }
  return stores.size
}

async function upgradeLegacySource(
  declarations: readonly DexieVersionDeclaration[],
  sourceVersion: number,
) {
  const databaseName = `storyforge-d04-legacy-${sourceVersion}`
  await Dexie.delete(databaseName)
  const legacy = new Dexie(databaseName)
  for (const declaration of declarations.filter(entry => entry.version <= sourceVersion)) {
    legacy.version(declaration.version).stores(declaration.stores)
  }
  const projectId = stableFixtureNumericId('legacy-matrix-v1', 'projects', 0)
  try {
    await legacy.open()
    await legacy.table('projects').add({
      id: projectId,
      name: 'D0.4 legacy-matrix-v1',
      createdAt: D04_FIXTURE_CLOCK_MS,
      updatedAt: D04_FIXTURE_CLOCK_MS,
    })
  } finally {
    legacy.close()
  }

  const upgraded = new StoryForgeDB(databaseName)
  try {
    await upgraded.open()
    const tables: Record<string, unknown[]> = {}
    const tableCounts: Record<string, number> = {}
    for (const spec of PROJECT_TABLES) {
      const rows = await upgraded.table(spec.name).toArray()
      tables[spec.name] = rows
      tableCounts[spec.name] = rows.length
    }
    if (tableCounts.projects !== 1
      || Object.entries(tableCounts).some(([name, count]) => name !== 'projects' && count !== 0)) {
      throw new Error(`legacy source v${sourceVersion} did not normalize to the minimal current project`)
    }
    const normalizedSha256 = sha256Utf8(canonicalFixtureArtifactText({ tables }))
    return {
      sourceVersion,
      sourceStoreCount: cumulativeStoreCount(declarations, sourceVersion),
      sourceDeclarationSha256: sha256Utf8(canonicalFixtureArtifactText(
        declarations.filter(entry => entry.version <= sourceVersion),
      )),
      upgradedVersion: upgraded.verno,
      normalizedSha256,
    }
  } finally {
    upgraded.close()
    await Dexie.delete(databaseName)
  }
}

async function buildLegacyMatrixFixture(): Promise<GeneratedFixtureArtifact> {
  const declarations = currentSchemaDeclarations()
  const sourceArtifacts = []
  for (const declaration of declarations) {
    sourceArtifacts.push(await upgradeLegacySource(declarations, declaration.version))
  }
  const normalizedHashes = new Set(sourceArtifacts.map(entry => entry.normalizedSha256))
  if (normalizedHashes.size !== 1) {
    throw new Error('legacy matrix sources do not rebuild to one normalized latest-schema hash')
  }
  const latestVersion = declarations.at(-1)?.version
  if (latestVersion === undefined
    || sourceArtifacts.some(entry => entry.upgradedVersion !== latestVersion)) {
    throw new Error('legacy matrix did not upgrade every source to the current schema version')
  }
  const artifact = {
    schemaVersion: '1.0.0',
    fixtureId: 'legacy-matrix-v1',
    artifactKind: 'schema-upgrade-matrix-v1',
    schemaSource: 'src/lib/db/schema.ts',
    sourceVersionRange: {
      minimum: declarations[0].version,
      maximum: latestVersion,
      count: declarations.length,
    },
    currentProjectTableCount: PROJECT_TABLES.length,
    declarationSetSha256: sha256Utf8(canonicalFixtureArtifactText(declarations)),
    normalizedLatestSha256: [...normalizedHashes][0],
    sourceArtifacts,
  }
  const text = canonicalFixtureArtifactText(artifact)
  return {
    artifactKind: 'schema-upgrade-matrix-v1',
    artifactPath: D04_FIXTURE_FILES.legacy,
    assertions: [
      { id: 'LEGACY-RANGE-DERIVED-FROM-CURRENT-SCHEMA', status: 'PASS' },
      { id: 'LEGACY-ARTIFACT-PER-DECLARED-VERSION', status: 'PASS' },
      { id: 'LEGACY-ALL-SOURCES-UPGRADE-TO-LATEST', status: 'PASS' },
      { id: 'LEGACY-NORMALIZED-LATEST-HASH-EQUAL', status: 'PASS' },
    ],
    businessSha256: artifact.normalizedLatestSha256,
    logicalCounts: {
      schemaVersions: declarations.length,
      sourceArtifacts: sourceArtifacts.length,
      currentProjectTables: PROJECT_TABLES.length,
    },
    text,
  }
}

export async function buildD04FixtureRuntimeBundle(): Promise<GeneratedFixtureRuntimeBundle> {
  try {
    const empty = await buildEmptyFixture()
    const small = await buildSmallFixture()
    const large = await buildLargeFixture()
    const legacy = await buildLegacyMatrixFixture()
    return { empty, small, large, legacy }
  } finally {
    db.close()
  }
}
