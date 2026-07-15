import type { Table } from 'dexie'

import { db } from '../db/schema'
import { PROJECT_TABLES } from '../registry/project-tables'
import type { TableSpec } from '../registry/types'
import { APP_VERSION } from '../version'
import { getRuntime } from '../../runtime'
import {
  MIGRATION_ARCHIVE_EXTENSION,
  MIGRATION_FORMAT,
  MIGRATION_FORMAT_VERSION,
  type ArchivePayload,
  type MigrationBlobManifest,
  type MigrationManifest,
  type MigrationOmission,
  type MigrationSourceAudit,
  type MigrationTableManifest,
} from './archive-types'
import { buildMigrationArchive, SOURCE_AUDIT_PATH } from './archive-container'
import {
  canonicalMigrationJson,
  contentDigest,
  sha256Bytes,
  utf8Bytes,
} from './canonical-hash'
import {
  collectMigrationSettings,
  STATIC_MIGRATION_OMISSIONS,
  type StorageReader,
} from './settings-policy'
import { encodeMigrationValue } from './value-codec'
import { prepareRecordForMigration } from './record-policy'

interface ProfileSnapshot {
  rows: ReadonlyMap<string, unknown[]>
  settings: Readonly<Record<string, string>>
}

interface EncodedSnapshot {
  payloads: ArchivePayload[]
  tables: MigrationTableManifest[]
  blobs: MigrationBlobManifest[]
  sourceAudit: MigrationSourceAudit
}

export interface ProfileExportOptions {
  storage?: StorageReader
  appVersion?: string
  origin?: string
  exportedAt?: Date
  exportId?: string
}

export interface ProfileExportResult {
  bytes: Uint8Array
  manifest: MigrationManifest
  archiveSha256: string
}

function migratedSpecs(): TableSpec[] {
  return PROJECT_TABLES.filter(spec => spec.migration.policy !== 'omit-and-rebuild')
}

function assertMigrationRegistryCoverage(): void {
  const databaseNames = db.tables.map(table => table.name).sort()
  const registryNames = PROJECT_TABLES.map(spec => spec.name).sort()
  if (databaseNames.length !== registryNames.length
    || databaseNames.some((name, index) => name !== registryNames[index])) {
    throw new Error('PROJECT_TABLES does not cover the complete Dexie schema')
  }
  for (const spec of PROJECT_TABLES) {
    if (!spec.migration?.policy) throw new Error(`table has no migration policy: ${spec.name}`)
    if (spec.migration.policy === 'omit-and-rebuild' && !spec.migration.recoveryAction) {
      throw new Error(`omitted table has no recovery action: ${spec.name}`)
    }
  }
}

function recordFilter(spec: TableSpec, row: unknown): boolean {
  if (!spec.migration.recordFilterId) return true
  if (spec.migration.recordFilterId === 'user-scope-only') {
    return !!row && typeof row === 'object' && (row as { scope?: unknown }).scope === 'user'
  }
  const unreachable: never = spec.migration.recordFilterId
  throw new Error(`unknown migration record filter: ${unreachable}`)
}

function primaryKeyPath(spec: TableSpec): string | string[] {
  const keyPath = spec.table.schema.primKey.keyPath
  if (typeof keyPath === 'string' && keyPath.length > 0) return keyPath
  if (Array.isArray(keyPath) && keyPath.length > 0 && keyPath.every(value => typeof value === 'string')) {
    return [...keyPath]
  }
  throw new Error(`migration table has no explicit primary key path: ${spec.name}`)
}

function fieldValue(record: unknown, field: string): unknown {
  if (!record || typeof record !== 'object') return undefined
  return (record as Record<string, unknown>)[field]
}

function primaryKey(record: unknown, keyPath: string | string[]): unknown {
  return typeof keyPath === 'string'
    ? fieldValue(record, keyPath)
    : keyPath.map(field => fieldValue(record, field))
}

function simplePrimaryKey(record: unknown, keyPath: string | string[], table: string): string | number {
  const key = primaryKey(record, keyPath)
  if (typeof key !== 'string' && typeof key !== 'number') {
    throw new Error(`Blob table requires a string or numeric primary key: ${table}`)
  }
  return key
}

function sortRows(rows: unknown[], keyPath: string | string[]): unknown[] {
  return [...rows].sort((left, right) => canonicalMigrationJson(primaryKey(left, keyPath))
    .localeCompare(canonicalMigrationJson(primaryKey(right, keyPath))))
}

async function captureRows(): Promise<ReadonlyMap<string, unknown[]>> {
  const tables = PROJECT_TABLES.map(spec => spec.table as Table)
  return db.transaction('r', tables, async () => {
    const rows = new Map<string, unknown[]>()
    for (const spec of PROJECT_TABLES) rows.set(spec.name, await spec.table.toArray())
    return rows
  })
}

function defaultStorage(): StorageReader {
  if (typeof localStorage === 'undefined') {
    return { length: 0, key: () => null, getItem: () => null }
  }
  return localStorage
}

async function captureSnapshot(storage: StorageReader): Promise<ProfileSnapshot> {
  const rows = await captureRows()
  const projects = rows.get('projects') ?? []
  const projectIds = new Set(projects.flatMap(row => {
    const id = fieldValue(row, 'id')
    return typeof id === 'number' ? [id] : []
  }))
  return { rows, settings: collectMigrationSettings(storage, projectIds) }
}

function safeBlobPathPart(value: string | number): string {
  const encoded = encodeURIComponent(String(value)).split('%').join('_')
  if (!encoded || encoded.length > 160) throw new Error('Blob primary key is unsafe for an archive path')
  return encoded
}

export async function encodeTableForMigration(
  spec: TableSpec,
  sourceRows: readonly unknown[],
): Promise<{
  payload: ArchivePayload
  table: MigrationTableManifest
  blobs: MigrationBlobManifest[]
  blobPayloads: ArchivePayload[]
}> {
  const keyPath = primaryKeyPath(spec)
  const rows = sortRows(
    sourceRows
      .filter(row => recordFilter(spec, row))
      .map(row => spec.migration.policy === 'operational'
        ? prepareRecordForMigration(spec.name, row)
        : row),
    keyPath,
  )
  const blobs: MigrationBlobManifest[] = []
  const blobPayloads: ArchivePayload[] = []
  const seenBlobPaths = new Set<string>()
  const lines: string[] = []

  for (const row of rows) {
    const encoded = await encodeMigrationValue(row, async (blob, path) => {
      const rowKey = simplePrimaryKey(row, keyPath, spec.name)
      const field = path.length === 1 && typeof path[0] === 'string' ? path[0] : null
      if (!field || !spec.migration.binaryFields?.includes(field)) {
        throw new Error(`undeclared Blob field in ${spec.name}: ${path.join('.')}`)
      }
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const hash = await sha256Bytes(bytes)
      const file = `blobs/${spec.name}/${safeBlobPathPart(rowKey)}-${field}-${hash}.bin`
      if (seenBlobPaths.has(file)) throw new Error(`duplicate Blob archive path: ${file}`)
      seenBlobPaths.add(file)
      blobs.push({
        table: spec.name,
        primaryKey: rowKey,
        field,
        file,
        size: bytes.byteLength,
        sha256: hash,
        ...(blob.type ? { mimeType: blob.type } : {}),
      })
      blobPayloads.push({ path: file, bytes, sha256: hash })
      return { file, size: bytes.byteLength, mimeType: blob.type }
    })
    lines.push(canonicalMigrationJson(encoded))
  }

  const bytes = utf8Bytes(lines.length === 0 ? '' : `${lines.join('\n')}\n`)
  const hash = await sha256Bytes(bytes)
  return {
    payload: { path: `tables/${spec.name}.ndjson`, bytes, sha256: hash },
    table: {
      name: spec.name,
      policy: spec.migration.policy as 'required' | 'optional-history' | 'operational',
      keyPath,
      count: rows.length,
      bytes: bytes.byteLength,
      sha256: hash,
    },
    blobs,
    blobPayloads,
  }
}

function totalWords(chapters: readonly unknown[]): number {
  return chapters.reduce<number>((total, row) => {
    const content = fieldValue(row, 'content')
    return total + (typeof content === 'string' ? content.replace(/\s/g, '').length : 0)
  }, 0)
}

async function encodeSnapshot(snapshot: ProfileSnapshot): Promise<EncodedSnapshot> {
  const payloads: ArchivePayload[] = []
  const tables: MigrationTableManifest[] = []
  const blobs: MigrationBlobManifest[] = []

  for (const spec of migratedSpecs()) {
    const encoded = await encodeTableForMigration(spec, snapshot.rows.get(spec.name) ?? [])
    payloads.push(encoded.payload, ...encoded.blobPayloads)
    tables.push(encoded.table)
    blobs.push(...encoded.blobs)
  }

  const settingsBytes = utf8Bytes(canonicalMigrationJson(snapshot.settings))
  const settingsHash = await sha256Bytes(settingsBytes)
  payloads.push({ path: 'settings/preferences.json', bytes: settingsBytes, sha256: settingsHash })

  const sourceAudit: MigrationSourceAudit = {
    projectCount: tables.find(table => table.name === 'projects')?.count ?? 0,
    chapterCount: tables.find(table => table.name === 'chapters')?.count ?? 0,
    totalWords: totalWords(snapshot.rows.get('chapters') ?? []),
    tableCounts: Object.fromEntries(PROJECT_TABLES.map(spec => [
      spec.name,
      spec.migration.policy === 'omit-and-rebuild'
        ? (snapshot.rows.get(spec.name)?.length ?? 0)
        : (tables.find(table => table.name === spec.name)?.count ?? 0),
    ])),
    tableHashes: Object.fromEntries(tables.map(table => [table.name, table.sha256])),
    settingsCount: Object.keys(snapshot.settings).length,
    settingsSha256: settingsHash,
  }
  const auditBytes = utf8Bytes(canonicalMigrationJson(sourceAudit))
  payloads.push({ path: SOURCE_AUDIT_PATH, bytes: auditBytes, sha256: await sha256Bytes(auditBytes) })
  return { payloads, tables, blobs, sourceAudit }
}

function omissions(): MigrationOmission[] {
  const rebuildable = PROJECT_TABLES.flatMap(spec => spec.migration.policy === 'omit-and-rebuild'
    ? [{
        resource: spec.name,
        reason: 'rebuildable' as const,
        recoveryAction: spec.migration.recoveryAction!,
      }]
    : [])
  return [...rebuildable, ...STATIC_MIGRATION_OMISSIONS]
}

function assertUnchanged(before: MigrationSourceAudit, after: MigrationSourceAudit): void {
  if (canonicalMigrationJson(before) !== canonicalMigrationJson(after)) {
    throw new Error('source profile changed during migration export; close other StoryForge tabs and retry')
  }
}

export async function exportFullMigrationArchive(
  options: ProfileExportOptions = {},
): Promise<ProfileExportResult> {
  assertMigrationRegistryCoverage()
  const storage = options.storage ?? defaultStorage()
  const before = await captureSnapshot(storage)
  const encoded = await encodeSnapshot(before)
  const after = await captureSnapshot(storage)
  const afterAudit = (await encodeSnapshot(after)).sourceAudit
  assertUnchanged(encoded.sourceAudit, afterAudit)

  const manifest: MigrationManifest = {
    format: MIGRATION_FORMAT,
    formatVersion: MIGRATION_FORMAT_VERSION,
    exportId: options.exportId ?? crypto.randomUUID(),
    exportedAt: (options.exportedAt ?? new Date()).toISOString(),
    source: {
      appVersion: options.appVersion ?? APP_VERSION,
      schemaVersion: db.verno,
      dbName: db.name,
      origin: options.origin ?? (typeof location === 'undefined' ? 'test://storyforge' : location.origin),
    },
    tables: encoded.tables,
    blobs: encoded.blobs,
    settings: {
      path: 'settings/preferences.json',
      count: encoded.sourceAudit.settingsCount,
      bytes: encoded.payloads.find(payload => payload.path === 'settings/preferences.json')!.bytes.byteLength,
      sha256: encoded.sourceAudit.settingsSha256,
    },
    omissions: omissions(),
    sourceAudit: encoded.sourceAudit,
    contentDigest: await contentDigest(encoded.payloads),
  }
  const bytes = await buildMigrationArchive(encoded.payloads, manifest)
  return { bytes, manifest, archiveSha256: await sha256Bytes(bytes) }
}

export async function exportFullMigrationArchiveToFile(
  options: ProfileExportOptions = {},
): Promise<ProfileExportResult & { displayName: string | null }> {
  const runtime = getRuntime()
  const distribution = await runtime.distribution.getInfo()
  const result = await exportFullMigrationArchive({
    ...options,
    appVersion: options.appVersion ?? distribution.version ?? APP_VERSION,
  })
  const saved = await runtime.files.save({
    purpose: 'full-migration-archive',
    suggestedName: `storyforge-profile-${result.manifest.exportId}${MIGRATION_ARCHIVE_EXTENSION}`,
    content: { kind: 'bytes', bytes: result.bytes },
  })
  return { ...result, displayName: saved.status === 'completed' ? saved.value.displayName : null }
}
