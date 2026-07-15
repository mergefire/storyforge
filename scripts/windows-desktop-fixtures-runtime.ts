import 'fake-indexeddb/auto'

import { createHash } from 'node:crypto'

import { db } from '../src/lib/db/schema'
import { exportProjectJSON, importProjectJSON } from '../src/lib/export/json-export'
import { PROJECT_TABLES } from '../src/lib/registry/project-tables'
import { canonicalFixtureArtifactJson } from './lib/windows-desktop-fixture-manifest.mjs'
import {
  D04_FIXTURE_CLOCK_ISO,
  D04_FIXTURE_CLOCK_MS,
  assertRegistryCoverage,
  buildRegistryCoverage,
  fixtureRoundtripBusinessHashes,
} from '../tests/helpers/d04-fixture-kit'
import { seedFullProject } from '../tests/helpers/seed-full-project'

export const D04_FIXTURE_FILES = Object.freeze({
  empty: 'empty-v1.json',
  small: 'small-v1.storyforge.json',
  manifest: 'fixture-manifest.json',
})

export interface GeneratedFixtureArtifact {
  artifactKind: 'empty-database-recipe-v1' | 'project-export-v4'
  artifactPath: string
  assertions: Array<{ id: string; status: 'PASS' }>
  businessSha256: string
  logicalCounts: Record<string, number>
  text: string
}

export interface GeneratedFixtureRuntimeBundle {
  empty: GeneratedFixtureArtifact
  small: GeneratedFixtureArtifact
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
    if (!Array.isArray(rows)) throw new Error(`${spec.name} is missing from small-v1 export`)
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
  const importedKeys = await collectExportablePrimaryKeys()
  for (const spec of PROJECT_TABLES.filter(candidate => candidate.exportable)) {
    const before = sourceKeys.get(spec.name) ?? []
    const after = importedKeys.get(spec.name) ?? []
    if (before.length !== after.length || after.some(key => before.includes(key))) {
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

export async function buildD04FixtureRuntimeBundle(): Promise<GeneratedFixtureRuntimeBundle> {
  try {
    const empty = await buildEmptyFixture()
    const small = await buildSmallFixture()
    return { empty, small }
  } finally {
    db.close()
  }
}
