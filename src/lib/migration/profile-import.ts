import type { Table } from 'dexie'

import { getRuntime, type RuntimeAdapter } from '../../runtime'
import { db } from '../db/schema'
import { PROJECT_TABLES, REGISTRY_BY_NAME } from '../registry/project-tables'
import type { TableSpec } from '../registry/types'
import type {
  MigrationJournalPhase,
  MigrationPreflight,
  MigrationReceipt,
  VerifiedMigrationArchive,
} from './archive-types'
import { verifyMigrationArchive } from './archive-container'
import { canonicalMigrationJson } from './canonical-hash'
import {
  migrationJournal,
  recordMigrationPhase,
  transitionMigrationJournal,
} from './migration-journal'
import {
  applyMigrationSettings,
  clearAllMigrationSettings,
  rollbackMigrationSettings,
  type StorageWriter,
} from './settings-policy'
import { verifyImportedProfile, verifyMigrationRelationships } from './profile-verify'

const BATCH_SIZE = 250

export interface MigrationFailureInjection {
  failAt?: string
  crashAt?: string
}

export type MigrationStartupState =
  | { status: 'ready'; receipt?: MigrationReceipt }
  | { status: 'awaiting-choice' }

class SimulatedMigrationCrash extends Error {
  constructor(readonly point: string) {
    super(`simulated migration process termination at ${point}`)
  }
}

function defaultStorage(): StorageWriter {
  if (typeof localStorage === 'undefined') {
    const values = new Map<string, string>()
    return {
      get length() { return values.size },
      key: index => [...values.keys()][index] ?? null,
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
      removeItem: key => { values.delete(key) },
    }
  }
  return localStorage
}

function keyPath(spec: TableSpec): string | string[] {
  const value = spec.table.schema.primKey.keyPath
  if (typeof value === 'string' || Array.isArray(value)) return value
  throw new Error(`migration table has no primary key: ${spec.name}`)
}

function migratedSpecs(): TableSpec[] {
  return PROJECT_TABLES.filter(spec => spec.migration.policy !== 'omit-and-rebuild')
}

function sameKeyPath(left: string | string[], right: string | string[]): boolean {
  return canonicalMigrationJson(left) === canonicalMigrationJson(right)
}

function assertArchiveRegistry(archive: VerifiedMigrationArchive): void {
  const expected = migratedSpecs()
  if (archive.manifest.tables.length !== expected.length) {
    throw new Error('migration archive does not cover every registered table policy')
  }
  const manifestTables = new Map(archive.manifest.tables.map(table => [table.name, table] as const))
  for (const spec of expected) {
    const table = manifestTables.get(spec.name)
    if (!table
      || table.policy !== spec.migration.policy
      || !sameKeyPath(table.keyPath, keyPath(spec))) {
      throw new Error(`migration archive registry contract mismatch: ${spec.name}`)
    }
  }
  const expectedRebuild = PROJECT_TABLES
    .filter(spec => spec.migration.policy === 'omit-and-rebuild')
    .map(spec => `${spec.name}:${spec.migration.recoveryAction}`)
    .sort()
  const actualRebuild = archive.manifest.omissions
    .filter(omission => omission.reason === 'rebuildable')
    .map(omission => `${omission.resource}:${omission.recoveryAction}`)
    .sort()
  if (canonicalMigrationJson(expectedRebuild) !== canonicalMigrationJson(actualRebuild)) {
    throw new Error('migration archive rebuild policy does not match PROJECT_TABLES')
  }
}

function projectIds(archive: VerifiedMigrationArchive): Set<number> {
  return new Set((archive.tableRows.get('projects') ?? []).flatMap(row => {
    const id = row && typeof row === 'object' ? (row as { id?: unknown }).id : undefined
    return typeof id === 'number' ? [id] : []
  }))
}

function assertProjectSettings(archive: VerifiedMigrationArchive): void {
  const ids = projectIds(archive)
  const prefixes = [
    'sf-inspiration-draft-',
    'sf-scene-verify-',
    'storyforge-context-memo-',
    'sf-gist-proj-',
  ]
  for (const key of Object.keys(archive.settings)) {
    const prefix = prefixes.find(candidate => key.startsWith(candidate))
    if (!prefix) continue
    const id = Number(key.slice(prefix.length))
    if (!ids.has(id)) throw new Error(`migration setting references a missing project: ${key}`)
  }
}

async function assertTargetEmpty(): Promise<void> {
  for (const spec of PROJECT_TABLES) {
    if (await spec.table.count() !== 0) throw new Error(`migration target is not empty: ${spec.name}`)
  }
}

async function clearTargetTables(): Promise<void> {
  const tables = PROJECT_TABLES.map(spec => spec.table as Table)
  await db.transaction('rw', tables, async () => {
    for (const spec of [...PROJECT_TABLES].reverse()) await spec.table.clear()
  })
}

function inject(point: string, injection: MigrationFailureInjection): void {
  if (injection.crashAt === point) throw new SimulatedMigrationCrash(point)
  if (injection.failAt === point) throw new Error(`injected migration failure at ${point}`)
}

async function importTables(
  archive: VerifiedMigrationArchive,
  injection: MigrationFailureInjection,
): Promise<void> {
  for (const manifestTable of archive.manifest.tables) {
    const spec = REGISTRY_BY_NAME.get(manifestTable.name)!
    const sourceRows = archive.tableRows.get(manifestTable.name) ?? []
    const rows = [...sourceRows]
    inject(`before-table:${spec.name}`, injection)
    const batchSize = spec.migration.binaryFields?.length ? 8 : BATCH_SIZE
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      await spec.table.bulkPut(rows.slice(offset, offset + batchSize))
      inject(`after-batch:${spec.name}:${Math.floor(offset / batchSize)}`, injection)
    }
    inject(`after-table:${spec.name}`, injection)
  }
}

export async function preflightMigrationArchive(
  bytes: Uint8Array,
  runtime: RuntimeAdapter = getRuntime(),
): Promise<MigrationPreflight> {
  recordMigrationPhase(runtime, 'preflight', 'started')
  try {
    const archive = await verifyMigrationArchive(bytes)
    assertArchiveRegistry(archive)
    assertProjectSettings(archive)
    const relationshipErrors = verifyMigrationRelationships(archive.tableRows)
    if (relationshipErrors.length > 0) {
      throw new Error(`migration archive contains invalid references: ${relationshipErrors[0]}`)
    }
    if (await runtime.migration.readReceipt(archive.manifest.exportId)) {
      throw new Error('this exportId has already been imported')
    }
    const requiredBytes = archive.manifest.tables.reduce((sum, table) => sum + table.bytes, 0)
      + archive.manifest.blobs.reduce((sum, blob) => sum + blob.size, 0)
      + archive.manifest.settings.bytes
    const durability = await runtime.durability.inspect()
    if (durability.quotaBytes !== undefined && durability.usageBytes !== undefined) {
      const free = durability.quotaBytes - durability.usageBytes
      if (free < requiredBytes * 2) throw new Error('target storage does not have the required migration reserve')
    }
    const recordCount = archive.manifest.tables.reduce((sum, table) => sum + table.count, 0)
    const result: MigrationPreflight = {
      archive,
      requiredBytes,
      tableCount: archive.manifest.tables.length,
      recordCount,
      projectCount: archive.manifest.sourceAudit.projectCount,
      chapterCount: archive.manifest.sourceAudit.chapterCount,
      totalWords: archive.manifest.sourceAudit.totalWords,
      reauthorization: archive.manifest.omissions
        .filter(omission => omission.reason === 'secret' || omission.reason === 'device-bound')
        .map(omission => omission.recoveryAction),
    }
    recordMigrationPhase(runtime, 'preflight', 'completed', {
      tableCount: result.tableCount,
      recordCount,
    })
    return result
  } catch (error) {
    recordMigrationPhase(runtime, 'preflight', 'failed')
    throw error
  }
}

async function markFailure(
  runtime: RuntimeAdapter,
  phase: MigrationJournalPhase,
  archive: { exportId: string; archiveSha256: string },
): Promise<void> {
  if (phase === 'awaiting-choice') return
  await transitionMigrationJournal(runtime, migrationJournal('failed', archive, 'IMPORT_FAILED'), phase)
}

export async function importFullMigrationArchive(
  input: Uint8Array | MigrationPreflight,
  options: {
    runtime?: RuntimeAdapter
    storage?: StorageWriter
    injection?: MigrationFailureInjection
  } = {},
): Promise<MigrationReceipt> {
  const runtime = options.runtime ?? getRuntime()
  const storage = options.storage ?? defaultStorage()
  const injection = options.injection ?? {}
  const preflight = input instanceof Uint8Array
    ? await preflightMigrationArchive(input, runtime)
    : input
  const archiveIdentity = {
    exportId: preflight.archive.manifest.exportId,
    archiveSha256: preflight.archive.archiveSha256,
  }
  await assertTargetEmpty()
  let phase: MigrationJournalPhase = 'awaiting-choice'
  let writtenSettings: string[] = []
  try {
    const current = await runtime.migration.readJournal()
    if (!current) {
      await transitionMigrationJournal(runtime, migrationJournal('awaiting-choice'), null)
    } else if (current.phase !== 'awaiting-choice') {
      throw new Error(`migration cannot start from ${current.phase}`)
    }
    await transitionMigrationJournal(runtime, migrationJournal('archive-received', archiveIdentity), 'awaiting-choice')
    phase = 'archive-received'
    await transitionMigrationJournal(runtime, migrationJournal('archive-verified', archiveIdentity), phase)
    phase = 'archive-verified'
    await transitionMigrationJournal(runtime, migrationJournal('importing', archiveIdentity), phase)
    phase = 'importing'
    recordMigrationPhase(runtime, 'import', 'started', {
      tableCount: preflight.tableCount,
      recordCount: preflight.recordCount,
    })
    inject('before-import', injection)
    await importTables(preflight.archive, injection)
    inject('before-settings', injection)
    writtenSettings = applyMigrationSettings(storage, preflight.archive.settings)
    inject('before-verify', injection)
    recordMigrationPhase(runtime, 'verify', 'started')
    const distribution = await runtime.distribution.getInfo()
    const receipt = await verifyImportedProfile(preflight.archive, {
      storage,
      ...(distribution.version ? { targetAppVersion: distribution.version } : {}),
    })
    if (receipt.status !== 'verified') throw new Error(receipt.integrityErrors[0] ?? 'migration verification failed')
    recordMigrationPhase(runtime, 'verify', 'completed', {
      tableCount: preflight.tableCount,
      recordCount: preflight.recordCount,
    })
    await transitionMigrationJournal(runtime, migrationJournal('data-verified', archiveIdentity), phase)
    phase = 'data-verified'
    await runtime.migration.writeReceipt(receipt)
    inject('before-activate', injection)
    recordMigrationPhase(runtime, 'activate', 'started')
    await transitionMigrationJournal(runtime, migrationJournal('activated', archiveIdentity), phase)
    recordMigrationPhase(runtime, 'activate', 'completed')
    recordMigrationPhase(runtime, 'import', 'completed', {
      tableCount: preflight.tableCount,
      recordCount: preflight.recordCount,
    })
    return receipt
  } catch (error) {
    if (error instanceof SimulatedMigrationCrash) throw error
    recordMigrationPhase(runtime, 'import', 'failed')
    try {
      await markFailure(runtime, phase, archiveIdentity)
      phase = phase === 'awaiting-choice' ? phase : 'failed'
      await clearTargetTables()
      rollbackMigrationSettings(storage, writtenSettings)
      await runtime.migration.deleteReceipt(archiveIdentity.exportId)
      if (phase === 'failed') {
        await transitionMigrationJournal(runtime, migrationJournal('rolled-back', archiveIdentity), phase)
        await transitionMigrationJournal(runtime, migrationJournal('awaiting-choice'), 'rolled-back')
      }
    } catch (cleanupError) {
      console.error('[migration] failed to clean unactivated target:', cleanupError)
    }
    throw error
  }
}

export async function prepareMigrationStartup(
  options: { runtime?: RuntimeAdapter; storage?: StorageWriter } = {},
): Promise<MigrationStartupState> {
  const runtime = options.runtime ?? getRuntime()
  const storage = options.storage ?? defaultStorage()
  if (!runtime.migration.policy.requiresFirstRunChoice) return { status: 'ready' }

  const journal = await runtime.migration.readJournal()
  if (!journal) {
    const hasData = (await Promise.all(PROJECT_TABLES.map(spec => spec.table.count())))
      .some(count => count > 0)
    if (hasData) {
      await transitionMigrationJournal(runtime, migrationJournal('activated'), null)
      return { status: 'ready' }
    }
    await transitionMigrationJournal(runtime, migrationJournal('awaiting-choice'), null)
    return { status: 'awaiting-choice' }
  }
  if (journal.phase === 'activated') {
    const receipt = journal.exportId ? await runtime.migration.readReceipt(journal.exportId) : null
    return { status: 'ready', ...(receipt ? { receipt } : {}) }
  }
  if (journal.phase === 'awaiting-choice') return { status: 'awaiting-choice' }
  if (journal.phase === 'data-verified' && journal.exportId) {
    const receipt = await runtime.migration.readReceipt(journal.exportId)
    if (receipt?.status === 'verified') {
      await transitionMigrationJournal(runtime, migrationJournal('activated', {
        exportId: journal.exportId,
        archiveSha256: journal.archiveSha256!,
      }), 'data-verified')
      return { status: 'ready', receipt }
    }
  }

  const identity = journal.exportId && journal.archiveSha256
    ? { exportId: journal.exportId, archiveSha256: journal.archiveSha256 }
    : undefined
  if (journal.phase !== 'failed' && journal.phase !== 'rolled-back') {
    await transitionMigrationJournal(runtime, migrationJournal('failed', identity, 'INTERRUPTED'), journal.phase)
  }
  await clearTargetTables()
  clearAllMigrationSettings(storage)
  const failedOrRolledBack = journal.phase === 'rolled-back' ? 'rolled-back' : 'failed'
  if (failedOrRolledBack === 'failed') {
    await transitionMigrationJournal(runtime, migrationJournal('rolled-back', identity), 'failed')
  }
  await transitionMigrationJournal(runtime, migrationJournal('awaiting-choice'), 'rolled-back')
  return { status: 'awaiting-choice' }
}

export async function chooseEmptyDesktopProfile(runtime: RuntimeAdapter = getRuntime()): Promise<void> {
  await assertTargetEmpty()
  const current = await runtime.migration.readJournal()
  if (!current) await transitionMigrationJournal(runtime, migrationJournal('awaiting-choice'), null)
  else if (current.phase !== 'awaiting-choice') throw new Error('empty profile choice is no longer available')
  await transitionMigrationJournal(runtime, migrationJournal('activated'), 'awaiting-choice')
}

export async function rollbackActivatedMigration(
  options: { runtime?: RuntimeAdapter; storage?: StorageWriter } = {},
): Promise<void> {
  const runtime = options.runtime ?? getRuntime()
  const storage = options.storage ?? defaultStorage()
  const journal = await runtime.migration.readJournal()
  if (!journal || journal.phase !== 'activated' || !journal.exportId || !journal.archiveSha256) {
    throw new Error('there is no activated migration to roll back')
  }
  const identity = { exportId: journal.exportId, archiveSha256: journal.archiveSha256 }
  recordMigrationPhase(runtime, 'rollback', 'started')
  await clearTargetTables()
  clearAllMigrationSettings(storage)
  await transitionMigrationJournal(runtime, migrationJournal('rolled-back', identity), 'activated')
  await transitionMigrationJournal(runtime, migrationJournal('awaiting-choice'), 'rolled-back')
  recordMigrationPhase(runtime, 'rollback', 'completed')
}
