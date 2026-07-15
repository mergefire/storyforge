import type { MigrationPolicy } from '../registry/types'

export const MIGRATION_FORMAT = 'storyforge-profile-migration' as const
export const MIGRATION_FORMAT_VERSION = 1 as const
export const MIGRATION_ARCHIVE_EXTENSION = '.storyforge-migrate' as const

export interface MigrationTableManifest {
  name: string
  policy: Exclude<MigrationPolicy, 'omit-and-rebuild'>
  keyPath: string | string[]
  count: number
  bytes: number
  sha256: string
}

export interface MigrationBlobManifest {
  table: string
  primaryKey: string | number
  field: string
  file: string
  size: number
  sha256: string
  mimeType?: string
}

export interface MigrationOmission {
  resource: string
  reason: 'rebuildable' | 'device-bound' | 'secret'
  recoveryAction: string
}

export interface MigrationSettingsManifest {
  path: 'settings/preferences.json'
  count: number
  bytes: number
  sha256: string
}

export interface MigrationSourceAudit {
  projectCount: number
  chapterCount: number
  totalWords: number
  tableCounts: Record<string, number>
  tableHashes: Record<string, string>
  settingsCount: number
  settingsSha256: string
}

export interface MigrationManifest {
  format: typeof MIGRATION_FORMAT
  formatVersion: typeof MIGRATION_FORMAT_VERSION
  exportId: string
  exportedAt: string
  source: {
    appVersion: string
    schemaVersion: number
    dbName: string
    origin: string
  }
  tables: MigrationTableManifest[]
  blobs: MigrationBlobManifest[]
  settings: MigrationSettingsManifest
  omissions: MigrationOmission[]
  sourceAudit: MigrationSourceAudit
  contentDigest: string
}

export interface ArchivePayload {
  path: string
  bytes: Uint8Array
  sha256: string
}

export interface VerifiedMigrationArchive {
  archiveSha256: string
  manifest: MigrationManifest
  tableRows: ReadonlyMap<string, unknown[]>
  settings: Readonly<Record<string, string>>
  blobs: ReadonlyMap<string, Blob>
}

export interface MigrationTableResult {
  name: string
  expectedCount: number
  actualCount: number
  expectedSha256: string
  actualSha256: string
  status: 'verified' | 'failed'
}

export interface MigrationBlobResult {
  table: string
  primaryKey: string | number
  field: string
  expectedSize: number
  actualSize: number
  expectedSha256: string
  actualSha256: string
  status: 'verified' | 'failed'
}

export interface MigrationReceipt {
  exportId: string
  archiveSha256: string
  sourceAppVersion: string
  sourceSchemaVersion: number
  targetAppVersion: string
  importedAt: string
  tableResults: MigrationTableResult[]
  blobResults: MigrationBlobResult[]
  rebuildQueue: string[]
  reauthorization: string[]
  integrityErrors: string[]
  status: 'verified' | 'failed'
}

export type MigrationJournalPhase =
  | 'awaiting-choice'
  | 'archive-received'
  | 'archive-verified'
  | 'importing'
  | 'data-verified'
  | 'activated'
  | 'failed'
  | 'rolled-back'

export interface MigrationJournal {
  phase: MigrationJournalPhase
  exportId?: string
  archiveSha256?: string
  updatedAt: string
  errorCode?: string
}

export interface MigrationPreflight {
  archive: VerifiedMigrationArchive
  requiredBytes: number
  tableCount: number
  recordCount: number
  projectCount: number
  chapterCount: number
  totalWords: number
  reauthorization: string[]
}
