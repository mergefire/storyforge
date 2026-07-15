import { PROJECT_TABLES, REGISTRY_BY_NAME } from '../registry/project-tables'
import type { JsonRef, TableSpec } from '../registry/types'
import { APP_VERSION } from '../version'
import type {
  MigrationBlobResult,
  MigrationReceipt,
  MigrationTableResult,
  VerifiedMigrationArchive,
} from './archive-types'
import { canonicalMigrationJson, sha256Bytes, utf8Bytes } from './canonical-hash'
import { encodeTableForMigration } from './profile-export'
import { collectMigrationSettings, type StorageReader } from './settings-policy'

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function pathValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => record(current)?.[segment], value)
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function primaryKeyValue(row: unknown, keyPath: string | string[]): unknown {
  return typeof keyPath === 'string'
    ? record(row)?.[keyPath]
    : keyPath.map(field => record(row)?.[field])
}

function tableKeyPath(spec: TableSpec): string | string[] {
  const keyPath = spec.table.schema.primKey.keyPath
  if (typeof keyPath === 'string' || Array.isArray(keyPath)) return keyPath
  throw new Error(`table has no migration key path: ${spec.name}`)
}

function idsFor(rows: readonly unknown[], keyPath: string | string[]): Set<unknown> {
  return new Set(rows.map(row => canonicalMigrationJson(primaryKeyValue(row, keyPath))))
}

function hasId(ids: ReadonlySet<unknown>, value: unknown): boolean {
  return ids.has(canonicalMigrationJson(value))
}

function validateJsonReference(
  sourceTable: string,
  rowKey: unknown,
  row: Record<string, unknown>,
  ref: JsonRef,
  targetIds: ReadonlySet<unknown>,
  errors: string[],
): void {
  if (row[ref.field] === null || row[ref.field] === undefined || row[ref.field] === '') return
  const value = parseJsonValue(row[ref.field])
  let candidates: unknown[] = []
  if (ref.jsonPath === '$[].characterIds[]' && Array.isArray(value)) {
    candidates = value.flatMap(scene => {
      const ids = record(scene)?.characterIds
      return Array.isArray(ids) ? ids : []
    })
  } else if (ref.jsonPath === '$.*' && record(value)) {
    candidates = Object.values(value as Record<string, unknown>)
  } else {
    errors.push(`${sourceTable}[${String(rowKey)}].${ref.field} has an unsupported JSON reference shape`)
    return
  }
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && !hasId(targetIds, candidate)) {
      errors.push(`${sourceTable}[${String(rowKey)}].${ref.field} references a missing record`)
    }
  }
}

export function verifyMigrationRelationships(
  tableRows: ReadonlyMap<string, readonly unknown[]>,
): string[] {
  const errors: string[] = []
  const idSets = new Map<string, Set<unknown>>()
  for (const spec of PROJECT_TABLES) {
    idSets.set(spec.name, idsFor(tableRows.get(spec.name) ?? [], tableKeyPath(spec)))
  }
  const projectIds = idSets.get('projects') ?? new Set()

  for (const spec of PROJECT_TABLES) {
    if (spec.migration.policy === 'omit-and-rebuild') continue
    const rows = tableRows.get(spec.name) ?? []
    const keyPath = tableKeyPath(spec)
    const ownIds = idSets.get(spec.name)!
    if (ownIds.size !== rows.length) errors.push(`${spec.name} contains duplicate primary keys`)
    for (const raw of rows) {
      const row = record(raw)
      if (!row) {
        errors.push(`${spec.name} contains a non-object record`)
        continue
      }
      const rowKey = primaryKeyValue(row, keyPath)
      if (rowKey === undefined || (Array.isArray(rowKey) && rowKey.some(value => value === undefined))) {
        errors.push(`${spec.name} contains a record without its primary key`)
      }
      if (typeof row.projectId === 'number' && !hasId(projectIds, row.projectId)) {
        errors.push(`${spec.name}[${String(rowKey)}].projectId references a missing project`)
      }

      for (const mapping of spec.exportRemap ?? []) {
        const value = row[mapping.field]
        if (value === null || value === undefined) continue
        const targetIds = idSets.get(mapping.remapVia)
        if (!targetIds || !hasId(targetIds, value)) {
          errors.push(`${spec.name}[${String(rowKey)}].${mapping.field} references missing ${mapping.remapVia}`)
        }
      }
      for (const path of spec.selfIdPaths ?? []) {
        const value = pathValue(row, path)
        if (value !== null && value !== undefined
          && canonicalMigrationJson(value) !== canonicalMigrationJson(rowKey)) {
          errors.push(`${spec.name}[${String(rowKey)}].${path} does not match its own primary key`)
        }
      }
      for (const ref of spec.refs ?? []) {
        if (ref.kind === 'array' && ref.portable) {
          const values = row[ref.field]
          const targetIds = idSets.get(ref.itemTarget)
          if (values === null || values === undefined) continue
          if (!Array.isArray(values) || !targetIds) {
            errors.push(`${spec.name}[${String(rowKey)}].${ref.field} has an invalid reference array`)
            continue
          }
          for (const value of values) {
            if (!hasId(targetIds, value)) {
              errors.push(`${spec.name}[${String(rowKey)}].${ref.field} references missing ${ref.itemTarget}`)
            }
          }
        } else if (ref.kind === 'json' && ref.portable) {
          const target = ref.target.match(/^([A-Za-z][A-Za-z0-9]*)\[id\]$/)?.[1]
          const targetIds = target ? idSets.get(target) : undefined
          if (!targetIds) {
            errors.push(`${spec.name}[${String(rowKey)}].${ref.field} has an invalid target contract`)
            continue
          }
          validateJsonReference(spec.name, rowKey, row, ref, targetIds, errors)
        } else if (ref.kind === 'indirect') {
          const targetIds = idSets.get(ref.via.table)
          const value = row[ref.via.field]
          if (!targetIds || value === null || value === undefined || !hasId(targetIds, value)) {
            errors.push(`${spec.name}[${String(rowKey)}].${ref.via.field} references missing ${ref.via.table}`)
          }
        }
      }
      for (const remap of spec.exportRefRemap ?? []) {
        if (remap.kind !== 'portals') continue
        if (row[remap.field] === null || row[remap.field] === undefined || row[remap.field] === '') continue
        const portals = parseJsonValue(row[remap.field])
        const targetIds = idSets.get(remap.remapVia)
        if (!Array.isArray(portals) || !targetIds) {
          errors.push(`${spec.name}[${String(rowKey)}].${remap.field} has invalid portal JSON`)
          continue
        }
        for (const portal of portals) {
          const targetWorldId = record(portal)?.targetWorldId
          if (targetWorldId !== null && targetWorldId !== undefined && !hasId(targetIds, targetWorldId)) {
            errors.push(`${spec.name}[${String(rowKey)}].${remap.field} references a missing world node`)
          }
        }
      }
    }
  }
  return [...new Set(errors)].sort()
}

function defaultStorage(): StorageReader {
  if (typeof localStorage === 'undefined') {
    return { length: 0, key: () => null, getItem: () => null }
  }
  return localStorage
}

function projectIdsFromRows(rows: readonly unknown[]): Set<number> {
  return new Set(rows.flatMap(row => {
    const id = record(row)?.id
    return typeof id === 'number' ? [id] : []
  }))
}

export async function verifyImportedProfile(
  archive: VerifiedMigrationArchive,
  options: { storage?: StorageReader; targetAppVersion?: string } = {},
): Promise<MigrationReceipt> {
  const tableResults: MigrationTableResult[] = []
  const blobResults: MigrationBlobResult[] = []
  const actualRows = new Map<string, unknown[]>()
  const actualBlobs = new Map<string, { size: number; sha256: string }>()

  for (const expected of archive.manifest.tables) {
    const spec = REGISTRY_BY_NAME.get(expected.name)
    if (!spec || spec.migration.policy === 'omit-and-rebuild') {
      throw new Error(`archive table is not registered for migration: ${expected.name}`)
    }
    const rows = await spec.table.toArray()
    actualRows.set(spec.name, rows)
    const encoded = await encodeTableForMigration(spec, rows)
    tableResults.push({
      name: expected.name,
      expectedCount: expected.count,
      actualCount: encoded.table.count,
      expectedSha256: expected.sha256,
      actualSha256: encoded.table.sha256,
      status: expected.count === encoded.table.count && expected.sha256 === encoded.table.sha256
        ? 'verified'
        : 'failed',
    })
    for (const blob of encoded.blobs) actualBlobs.set(blob.file, { size: blob.size, sha256: blob.sha256 })
  }

  for (const expected of archive.manifest.blobs) {
    const actual = actualBlobs.get(expected.file)
    blobResults.push({
      table: expected.table,
      primaryKey: expected.primaryKey,
      field: expected.field,
      expectedSize: expected.size,
      actualSize: actual?.size ?? -1,
      expectedSha256: expected.sha256,
      actualSha256: actual?.sha256 ?? '',
      status: actual?.size === expected.size && actual.sha256 === expected.sha256 ? 'verified' : 'failed',
    })
  }

  const storage = options.storage ?? defaultStorage()
  const actualSettings = collectMigrationSettings(
    storage,
    projectIdsFromRows(actualRows.get('projects') ?? []),
  )
  const actualSettingsHash = await sha256Bytes(utf8Bytes(canonicalMigrationJson(actualSettings)))
  const integrityErrors = verifyMigrationRelationships(actualRows)
  if (actualSettingsHash !== archive.manifest.settings.sha256
    || Object.keys(actualSettings).length !== archive.manifest.settings.count) {
    integrityErrors.push('migrated settings do not match the archive')
  }
  for (const result of tableResults) {
    if (result.status === 'failed') integrityErrors.push(`table verification failed: ${result.name}`)
  }
  for (const result of blobResults) {
    if (result.status === 'failed') {
      integrityErrors.push(`Blob verification failed: ${result.table}[${String(result.primaryKey)}].${result.field}`)
    }
  }

  const rebuildQueue = archive.manifest.omissions
    .filter(omission => omission.reason === 'rebuildable')
    .map(omission => omission.recoveryAction)
  const reauthorization = archive.manifest.omissions
    .filter(omission => omission.reason === 'secret' || omission.reason === 'device-bound')
    .map(omission => omission.recoveryAction)
  return {
    exportId: archive.manifest.exportId,
    archiveSha256: archive.archiveSha256,
    sourceAppVersion: archive.manifest.source.appVersion,
    sourceSchemaVersion: archive.manifest.source.schemaVersion,
    targetAppVersion: options.targetAppVersion ?? APP_VERSION,
    importedAt: new Date().toISOString(),
    tableResults,
    blobResults,
    rebuildQueue,
    reauthorization,
    integrityErrors: [...new Set(integrityErrors)].sort(),
    status: integrityErrors.length === 0 ? 'verified' : 'failed',
  }
}
