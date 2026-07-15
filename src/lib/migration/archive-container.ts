import JSZip from 'jszip'

import {
  MIGRATION_FORMAT,
  MIGRATION_FORMAT_VERSION,
  type ArchivePayload,
  type MigrationManifest,
  type MigrationSourceAudit,
  type VerifiedMigrationArchive,
} from './archive-types'
import {
  canonicalMigrationJson,
  contentDigest,
  sha256Bytes,
} from './canonical-hash'
import { assertSafeMigrationSettings } from './settings-policy'
import { decodeMigrationValue } from './value-codec'

const MANIFEST_PATH = 'manifest.json'
const CHECKSUMS_PATH = 'checksums.sha256'
const SOURCE_AUDIT_PATH = 'reports/source-audit.json'
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 768 * 1024 * 1024
const MAX_ENTRY_COUNT = 10_000
const MAX_COMPRESSION_RATIO = 200
const FIXED_ZIP_DATE = new Date('1980-01-01T00:00:00.000Z')

interface CentralDirectoryEntry {
  name: string
  compressedBytes: number
  uncompressedBytes: number
  directory: boolean
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0
}

function safeArchivePath(path: string): boolean {
  if (!path || path.length > 512 || path.includes('\\') || path.includes('\0')) return false
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').includes('..')) return false
  return !path.split('/').some(segment => segment === '' || segment === '.')
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.byteLength - 65_557)
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (u32(bytes, offset) === 0x06054b50) return offset
  }
  throw new Error('migration archive has no ZIP end record')
}

function inspectCentralDirectory(bytes: Uint8Array): CentralDirectoryEntry[] {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('migration archive exceeds the 512 MiB safety limit')
  }
  const end = findEndOfCentralDirectory(bytes)
  const diskNumber = u16(bytes, end + 4)
  const directoryDisk = u16(bytes, end + 6)
  const entryCount = u16(bytes, end + 10)
  const directoryBytes = u32(bytes, end + 12)
  const directoryOffset = u32(bytes, end + 16)
  const commentBytes = u16(bytes, end + 20)
  if (diskNumber !== 0 || directoryDisk !== 0) throw new Error('multi-disk ZIP archives are forbidden')
  if (entryCount === 0xffff || directoryBytes === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new Error('ZIP64 archives exceed the current self-use safety envelope')
  }
  if (entryCount === 0 || entryCount > MAX_ENTRY_COUNT) throw new Error('invalid ZIP entry count')
  if (end + 22 + commentBytes !== bytes.byteLength) throw new Error('trailing ZIP data is forbidden')
  if (directoryOffset + directoryBytes !== end) throw new Error('invalid ZIP central directory bounds')

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const names = new Set<string>()
  const entries: CentralDirectoryEntry[] = []
  let totalUncompressed = 0
  let offset = directoryOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(bytes, offset) !== 0x02014b50) throw new Error('invalid ZIP central directory entry')
    const flags = u16(bytes, offset + 8)
    const method = u16(bytes, offset + 10)
    const compressedBytes = u32(bytes, offset + 20)
    const uncompressedBytes = u32(bytes, offset + 24)
    const nameBytes = u16(bytes, offset + 28)
    const extraBytes = u16(bytes, offset + 30)
    const entryCommentBytes = u16(bytes, offset + 32)
    if ((flags & 0x1) !== 0) throw new Error('encrypted ZIP entries are forbidden')
    if (method !== 0 && method !== 8) throw new Error('unsupported ZIP compression method')
    const nameStart = offset + 46
    const nameEnd = nameStart + nameBytes
    if (nameEnd > end) throw new Error('invalid ZIP filename bounds')
    const name = decoder.decode(bytes.subarray(nameStart, nameEnd))
    if (!safeArchivePath(name)) throw new Error(`unsafe ZIP path: ${name}`)
    if (names.has(name)) throw new Error(`duplicate ZIP path: ${name}`)
    names.add(name)
    const directory = name.endsWith('/')
    if (!directory && compressedBytes === 0 && uncompressedBytes > 0) {
      throw new Error(`invalid compressed size for ${name}`)
    }
    if (!directory && compressedBytes > 0 && uncompressedBytes / compressedBytes > MAX_COMPRESSION_RATIO) {
      throw new Error(`unsafe compression ratio for ${name}`)
    }
    totalUncompressed += uncompressedBytes
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error('ZIP expands beyond the safety limit')
    entries.push({ name, compressedBytes, uncompressedBytes, directory })
    offset = nameEnd + extraBytes + entryCommentBytes
  }
  if (offset !== end) throw new Error('ZIP central directory contains unparsed data')
  return entries
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, label: string, max = 2048): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function requireCount(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} must be a count`)
  return value as number
}

function requireSha256(value: unknown, label: string): string {
  const hash = requireString(value, label, 64)
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`${label} must be a SHA-256 digest`)
  return hash
}

function parseManifest(value: unknown): MigrationManifest {
  const manifest = requireRecord(value, 'manifest')
  if (manifest.format !== MIGRATION_FORMAT || manifest.formatVersion !== MIGRATION_FORMAT_VERSION) {
    throw new Error('unsupported migration archive format')
  }
  requireString(manifest.exportId, 'manifest.exportId', 128)
  const exportedAt = requireString(manifest.exportedAt, 'manifest.exportedAt', 64)
  if (!Number.isFinite(Date.parse(exportedAt))) throw new Error('manifest.exportedAt is invalid')
  const source = requireRecord(manifest.source, 'manifest.source')
  requireString(source.appVersion, 'manifest.source.appVersion', 64)
  requireCount(source.schemaVersion, 'manifest.source.schemaVersion')
  requireString(source.dbName, 'manifest.source.dbName', 128)
  requireString(source.origin, 'manifest.source.origin', 2048)
  if (!Array.isArray(manifest.tables) || !Array.isArray(manifest.blobs)
    || !Array.isArray(manifest.omissions)) {
    throw new Error('manifest collections are invalid')
  }
  const tableNames = new Set<string>()
  for (const raw of manifest.tables) {
    const table = requireRecord(raw, 'manifest table')
    const name = requireString(table.name, 'table.name', 128)
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || tableNames.has(name)) {
      throw new Error(`invalid or duplicate migration table: ${name}`)
    }
    tableNames.add(name)
    if (!['required', 'optional-history', 'operational'].includes(String(table.policy))) {
      throw new Error(`invalid migration policy for ${name}`)
    }
    if (!(typeof table.keyPath === 'string'
      || (Array.isArray(table.keyPath) && table.keyPath.every(item => typeof item === 'string')))) {
      throw new Error(`invalid keyPath for ${name}`)
    }
    requireCount(table.count, `${name}.count`)
    requireCount(table.bytes, `${name}.bytes`)
    requireSha256(table.sha256, `${name}.sha256`)
  }
  const blobFiles = new Set<string>()
  for (const raw of manifest.blobs) {
    const blob = requireRecord(raw, 'manifest Blob')
    requireString(blob.table, 'blob.table', 128)
    if (typeof blob.primaryKey !== 'string' && typeof blob.primaryKey !== 'number') {
      throw new Error('blob.primaryKey is invalid')
    }
    requireString(blob.field, 'blob.field', 128)
    const file = requireString(blob.file, 'blob.file', 512)
    if (!safeArchivePath(file) || !file.startsWith('blobs/') || blobFiles.has(file)) {
      throw new Error(`invalid or duplicate Blob path: ${file}`)
    }
    blobFiles.add(file)
    requireCount(blob.size, 'blob.size')
    requireSha256(blob.sha256, 'blob.sha256')
    if (blob.mimeType !== undefined && typeof blob.mimeType !== 'string') {
      throw new Error('blob.mimeType is invalid')
    }
  }
  const settings = requireRecord(manifest.settings, 'manifest.settings')
  if (settings.path !== 'settings/preferences.json') throw new Error('manifest settings path is invalid')
  requireCount(settings.count, 'settings.count')
  requireCount(settings.bytes, 'settings.bytes')
  requireSha256(settings.sha256, 'settings.sha256')
  requireRecord(manifest.sourceAudit, 'manifest.sourceAudit')
  requireSha256(manifest.contentDigest, 'manifest.contentDigest')
  return manifest as unknown as MigrationManifest
}

function checksumText(payloads: readonly ArchivePayload[]): string {
  return [...payloads]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(payload => `${payload.sha256}  ${payload.path}`)
    .join('\n') + '\n'
}

export async function buildMigrationArchive(
  payloads: readonly ArchivePayload[],
  manifest: MigrationManifest,
): Promise<Uint8Array> {
  const paths = new Set<string>()
  for (const payload of payloads) {
    if (!safeArchivePath(payload.path) || paths.has(payload.path)) {
      throw new Error(`invalid or duplicate migration payload path: ${payload.path}`)
    }
    paths.add(payload.path)
    if (await sha256Bytes(payload.bytes) !== payload.sha256) {
      throw new Error(`migration payload hash mismatch before archive: ${payload.path}`)
    }
  }
  const expectedDigest = await contentDigest(payloads)
  if (manifest.contentDigest !== expectedDigest) throw new Error('manifest contentDigest is stale')

  const zip = new JSZip()
  for (const payload of [...payloads].sort((left, right) => left.path.localeCompare(right.path))) {
    zip.file(payload.path, payload.bytes, {
      date: FIXED_ZIP_DATE,
      compression: 'STORE',
      createFolders: false,
    })
  }
  zip.file(MANIFEST_PATH, canonicalMigrationJson(manifest), {
    date: FIXED_ZIP_DATE,
    compression: 'STORE',
    createFolders: false,
  })
  zip.file(CHECKSUMS_PATH, checksumText(payloads), {
    date: FIXED_ZIP_DATE,
    compression: 'STORE',
    createFolders: false,
  })
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
  inspectCentralDirectory(bytes)
  return bytes
}

async function readZipBytes(zip: JSZip, path: string): Promise<Uint8Array> {
  const entry = zip.file(path)
  if (!entry) throw new Error(`migration archive is missing ${path}`)
  return entry.async('uint8array')
}

function parseChecksums(value: string): Map<string, string> {
  const checksums = new Map<string, string>()
  for (const line of value.split('\n')) {
    if (!line) continue
    const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/)
    if (!match || !safeArchivePath(match[2]) || checksums.has(match[2])) {
      throw new Error('checksums.sha256 is invalid')
    }
    checksums.set(match[2], match[1])
  }
  return checksums
}

export async function verifyMigrationArchive(bytes: Uint8Array): Promise<VerifiedMigrationArchive> {
  const centralEntries = inspectCentralDirectory(bytes).filter(entry => !entry.directory)
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false })
  const manifestBytes = await readZipBytes(zip, MANIFEST_PATH)
  const manifest = parseManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)))
  const checksums = parseChecksums(
    new TextDecoder('utf-8', { fatal: true }).decode(await readZipBytes(zip, CHECKSUMS_PATH)),
  )

  const expectedPaths = new Set<string>([
    ...manifest.tables.map(table => `tables/${table.name}.ndjson`),
    ...manifest.blobs.map(blob => blob.file),
    manifest.settings.path,
    SOURCE_AUDIT_PATH,
  ])
  const actualPaths = new Set(centralEntries.map(entry => entry.name))
  if (actualPaths.size !== expectedPaths.size + 2
    || !actualPaths.has(MANIFEST_PATH)
    || !actualPaths.has(CHECKSUMS_PATH)
    || [...expectedPaths].some(path => !actualPaths.has(path))) {
    throw new Error('migration archive contains missing or unregistered entries')
  }
  if (checksums.size !== expectedPaths.size || [...expectedPaths].some(path => !checksums.has(path))) {
    throw new Error('migration archive checksum index is incomplete')
  }

  const payloads: ArchivePayload[] = []
  const payloadBytes = new Map<string, Uint8Array>()
  for (const path of [...expectedPaths].sort()) {
    const payload = await readZipBytes(zip, path)
    const hash = await sha256Bytes(payload)
    if (checksums.get(path) !== hash) throw new Error(`migration payload was modified: ${path}`)
    payloads.push({ path, bytes: payload, sha256: hash })
    payloadBytes.set(path, payload)
  }
  if (await contentDigest(payloads) !== manifest.contentDigest) {
    throw new Error('migration archive content digest mismatch')
  }

  for (const table of manifest.tables) {
    const path = `tables/${table.name}.ndjson`
    const payload = payloadBytes.get(path)!
    if (payload.byteLength !== table.bytes || await sha256Bytes(payload) !== table.sha256) {
      throw new Error(`migration table metadata mismatch: ${table.name}`)
    }
  }
  for (const blob of manifest.blobs) {
    const payload = payloadBytes.get(blob.file)!
    if (payload.byteLength !== blob.size || await sha256Bytes(payload) !== blob.sha256) {
      throw new Error(`migration Blob metadata mismatch: ${blob.file}`)
    }
  }
  const settingsPayload = payloadBytes.get(manifest.settings.path)!
  if (settingsPayload.byteLength !== manifest.settings.bytes
    || await sha256Bytes(settingsPayload) !== manifest.settings.sha256) {
    throw new Error('migration settings metadata mismatch')
  }
  const settings = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(settingsPayload)) as unknown
  const settingsRecord = requireRecord(settings, 'migration settings') as Record<string, string>
  if (Object.values(settingsRecord).some(value => typeof value !== 'string')
    || Object.keys(settingsRecord).length !== manifest.settings.count) {
    throw new Error('migration settings payload is invalid')
  }
  assertSafeMigrationSettings(settingsRecord)

  const sourceAuditBytes = payloadBytes.get(SOURCE_AUDIT_PATH)!
  const sourceAudit = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sourceAuditBytes)) as MigrationSourceAudit
  if (canonicalMigrationJson(sourceAudit) !== canonicalMigrationJson(manifest.sourceAudit)) {
    throw new Error('source audit payload does not match the manifest')
  }

  const blobMap = new Map<string, Blob>()
  for (const blob of manifest.blobs) {
    blobMap.set(blob.file, new Blob([payloadBytes.get(blob.file)!.slice().buffer], { type: blob.mimeType ?? '' }))
  }
  const tableRows = new Map<string, unknown[]>()
  for (const table of manifest.tables) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes.get(`tables/${table.name}.ndjson`)!)
    const lines = text === '' ? [] : text.split('\n').filter(Boolean)
    if (lines.length !== table.count) throw new Error(`migration row count mismatch: ${table.name}`)
    const rows = lines.map(line => decodeMigrationValue(JSON.parse(line), (file, size, mimeType) => {
      const blob = blobMap.get(file)
      if (!blob || blob.size !== size || blob.type !== mimeType) throw new Error(`invalid Blob reference: ${file}`)
      return blob
    }))
    tableRows.set(table.name, rows)
  }

  return {
    archiveSha256: await sha256Bytes(bytes),
    manifest,
    tableRows,
    settings: settingsRecord,
    blobs: blobMap,
  }
}

export { SOURCE_AUDIT_PATH }
