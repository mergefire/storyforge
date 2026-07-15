import { describe, expect, it } from 'vitest'

import {
  MIGRATION_FORMAT,
  MIGRATION_FORMAT_VERSION,
  type ArchivePayload,
  type MigrationManifest,
  type MigrationSourceAudit,
} from '../../src/lib/migration/archive-types'
import { buildMigrationArchive, verifyMigrationArchive } from '../../src/lib/migration/archive-container'
import { canonicalMigrationJson, contentDigest, sha256Bytes, utf8Bytes } from '../../src/lib/migration/canonical-hash'

async function fixture(version: number = MIGRATION_FORMAT_VERSION) {
  const sourceAudit: MigrationSourceAudit = {
    projectCount: 0,
    chapterCount: 0,
    totalWords: 0,
    tableCounts: {},
    tableHashes: {},
    settingsCount: 1,
    settingsSha256: '',
  }
  const settingsBytes = utf8Bytes(canonicalMigrationJson({ 'storyforge-theme': 'warm' }))
  sourceAudit.settingsSha256 = await sha256Bytes(settingsBytes)
  const auditBytes = utf8Bytes(canonicalMigrationJson(sourceAudit))
  const payloads: ArchivePayload[] = [
    { path: 'settings/preferences.json', bytes: settingsBytes, sha256: await sha256Bytes(settingsBytes) },
    { path: 'reports/source-audit.json', bytes: auditBytes, sha256: await sha256Bytes(auditBytes) },
  ]
  const manifest: MigrationManifest = {
    format: MIGRATION_FORMAT,
    formatVersion: version as typeof MIGRATION_FORMAT_VERSION,
    exportId: 'security-fixture',
    exportedAt: '2026-01-02T03:04:05.000Z',
    source: { appVersion: '3.1.0', schemaVersion: 37, dbName: 'storyforge', origin: 'test://fixture' },
    tables: [],
    blobs: [],
    settings: {
      path: 'settings/preferences.json',
      count: 1,
      bytes: settingsBytes.byteLength,
      sha256: await sha256Bytes(settingsBytes),
    },
    omissions: [],
    sourceAudit,
    contentDigest: await contentDigest(payloads),
  }
  return { bytes: await buildMigrationArchive(payloads, manifest), manifest, payloads }
}

function findBytes(haystack: Uint8Array, needleText: string): number {
  const needle = utf8Bytes(needleText)
  outer: for (let offset = 0; offset <= haystack.length - needle.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[offset + index] !== needle[index]) continue outer
    }
    return offset
  }
  return -1
}

describe('M2 migration archive security envelope', () => {
  it('verifies registered payloads and rejects tampering or truncation', async () => {
    const { bytes } = await fixture()
    await expect(verifyMigrationArchive(bytes)).resolves.toMatchObject({
      manifest: { exportId: 'security-fixture' },
      settings: { 'storyforge-theme': 'warm' },
    })

    const tampered = bytes.slice()
    const offset = findBytes(tampered, 'warm')
    expect(offset).toBeGreaterThan(0)
    tampered[offset] ^= 1
    await expect(verifyMigrationArchive(tampered)).rejects.toThrow()
    await expect(verifyMigrationArchive(bytes.slice(0, -8))).rejects.toThrow()
  })

  it('rejects unknown versions and unsafe payload paths', async () => {
    const unknown = await fixture(99)
    await expect(verifyMigrationArchive(unknown.bytes)).rejects.toThrow('unsupported migration archive format')

    const valid = await fixture()
    const unsafeBytes = utf8Bytes('unsafe')
    const unsafe = { path: '../escape', bytes: unsafeBytes, sha256: await sha256Bytes(unsafeBytes) }
    await expect(buildMigrationArchive([...valid.payloads, unsafe], {
      ...valid.manifest,
      contentDigest: await contentDigest([...valid.payloads, unsafe]),
    })).rejects.toThrow('invalid or duplicate migration payload path')
  })
})
