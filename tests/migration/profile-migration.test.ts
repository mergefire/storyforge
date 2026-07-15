import { Blob as NodeBlob } from 'node:buffer'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/lib/db/schema'
import { exportFullMigrationArchive } from '../../src/lib/migration/profile-export'
import {
  importFullMigrationArchive,
  preflightMigrationArchive,
  prepareMigrationStartup,
  rollbackActivatedMigration,
} from '../../src/lib/migration/profile-import'
import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'
import { createFakeRuntime, type FakeRuntimeAdapter } from '../../src/runtime/fake'
import type { StorageWriter } from '../../src/lib/migration/settings-policy'

class MemoryStorage implements StorageWriter {
  private readonly values = new Map<string, string>()

  constructor(entries: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(entries)) this.values.set(key, value)
  }

  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const sourceStorage = new MemoryStorage({
  'storyforge-theme': 'warm',
  'storyforge-editor-typography': JSON.stringify({ fontSize: 18, token: 'must-be-scrubbed' }),
  'storyforge-ai-config': JSON.stringify({ provider: 'openai', apiKey: 'sk-m2-never-export' }),
  'sf-inspiration-draft-7': '保留这段草稿',
  'unrelated-key': 'do-not-migrate',
})

let archiveBytes: Uint8Array
const OriginalBlob = globalThis.Blob

async function clearBusinessDatabase(): Promise<void> {
  for (const spec of [...PROJECT_TABLES].reverse()) await spec.table.clear()
}

function migrationRuntime(): FakeRuntimeAdapter {
  const runtime = createFakeRuntime()
  runtime.durability.inspect = async () => ({
    persisted: true,
    usageBytes: 1024,
    quotaBytes: 128 * 1024 * 1024,
  })
  return runtime
}

beforeAll(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob
  db.close()
  await db.delete()
  await db.open()
  const now = Date.parse('2025-12-31T00:00:00.000Z')
  await db.table('projects').put({ id: 7, name: '旧版长篇', createdAt: now, updatedAt: now, legacyOpenedAt: new Date(now) })
  await db.table('outlineNodes').put({ id: 11, projectId: 7, parentId: null, title: '第一章', type: 'chapter', order: 0, summary: '' })
  await db.table('chapters').put({
    id: 13,
    projectId: 7,
    outlineNodeId: 11,
    title: '第一章',
    order: 0,
    status: 'draft',
    content: '迁移正文不能少一个字。',
    continuityHandoff: { chapterId: 13, note: undefined },
    planReconciliation: { chapterId: 13 },
  })
  await db.table('characters').put({ id: 17, projectId: 7, name: '林渡' })
  await db.table('detailedOutlines').put({
    id: 19,
    projectId: 7,
    outlineNodeId: 11,
    appearingCharacterIds: [17],
    foreshadowIds: [],
    scenes: JSON.stringify([{ title: '开场', characterIds: [17] }]),
  })
  await db.table('importSessions').put({
    id: 23,
    projectId: 7,
    status: 'running',
    updatedAt: now,
    fileHash: 'legacy-large-blob',
    chunks: [{ index: 0, status: 'running' }],
  })
  const largeBlobBytes = new Uint8Array(2 * 1024 * 1024)
  for (let index = 0; index < largeBlobBytes.length; index += 1) largeBlobBytes[index] = index % 251
  await db.table('importFiles').put({
    sessionId: 23,
    fileHash: 'legacy-large-blob',
    blob: new Blob([largeBlobBytes], { type: 'application/octet-stream' }),
    createdAt: now,
  })
  expect((await db.table('importFiles').get(23)).blob).toBeInstanceOf(Blob)
  await db.table('snapshots').put({ id: 29, projectId: 7, label: '迁移前历史', createdAt: now })
  await db.table('promptTemplates').bulkPut([
    { id: 31, scope: 'system', moduleKey: 'system-seed', name: '系统模板', updatedAt: now },
    { id: 32, scope: 'user', moduleKey: 'user-template', name: '用户模板', updatedAt: now },
  ])
  await db.table('promptWorkflows').put({ id: 33, scope: 'user', name: '用户工作流', updatedAt: now })
  await db.table('aiUsageLog').put({ id: 35, projectId: 7, provider: 'legacy', totalTokens: 12, createdAt: now })
  await db.table('retrievalChunks').put({ id: 37, projectId: 7, sourceChapterId: 13, text: '可重建索引' })

  const exported = await exportFullMigrationArchive({
    storage: sourceStorage,
    appVersion: '3.1.0-legacy',
    exportId: 'm2-legacy-large-blob',
    exportedAt: new Date('2026-01-02T03:04:05.000Z'),
  })
  archiveBytes = exported.bytes
  expect((await db.table('importSessions').get(23)).status).toBe('running')
  expect((await db.table('chapters').get(13)).content).toBe('迁移正文不能少一个字。')
  await clearBusinessDatabase()
})

beforeEach(async () => {
  await clearBusinessDatabase()
})

afterAll(async () => {
  db.close()
  await db.delete()
  globalThis.Blob = OriginalBlob
})

describe('M2 full profile migration rehearsal', () => {
  it('imports one legacy profile with a large Blob, verifies it, and rolls it back', async () => {
    const runtime = migrationRuntime()
    const targetStorage = new MemoryStorage()
    const archiveText = new TextDecoder().decode(archiveBytes)
    expect(archiveText).not.toContain('sk-m2-never-export')
    expect(archiveText).not.toContain('must-be-scrubbed')

    const preflight = await preflightMigrationArchive(archiveBytes, runtime)
    expect(preflight).toMatchObject({ projectCount: 1, chapterCount: 1 })
    expect(preflight.archive.manifest.source.appVersion).toBe('3.1.0-legacy')
    expect(preflight.archive.manifest.blobs).toHaveLength(1)
    expect(preflight.archive.manifest.blobs[0].size).toBe(2 * 1024 * 1024)

    const receipt = await importFullMigrationArchive(preflight, { runtime, storage: targetStorage })
    expect(receipt.status).toBe('verified')
    expect(receipt.integrityErrors).toEqual([])
    expect(receipt.tableResults.every(result => result.status === 'verified')).toBe(true)
    expect(receipt.blobResults).toEqual([expect.objectContaining({ status: 'verified', actualSize: 2 * 1024 * 1024 })])
    expect(receipt.reauthorization).toEqual(expect.arrayContaining([
      'reauthorize-primary-ai-key',
      'reauthorize-embedding-key',
      'reauthorize-github-pat',
    ]))
    expect(receipt.rebuildQueue).toEqual(expect.arrayContaining([
      'rebuild-retrieval-index',
      'rebuild-narrative-summaries',
    ]))

    expect((await db.table('chapters').get(13)).content).toBe('迁移正文不能少一个字。')
    const session = await db.table('importSessions').get(23)
    expect(session.status).toBe('paused')
    expect(session.chunks[0].status).toBe('pending')
    expect(await db.table('retrievalChunks').count()).toBe(0)
    expect(await db.table('promptTemplates').toArray()).toEqual([
      expect.objectContaining({ id: 32, scope: 'user' }),
    ])
    expect(JSON.parse(targetStorage.getItem('storyforge-ai-config')!)).toMatchObject({ apiKey: '' })
    expect(targetStorage.getItem('unrelated-key')).toBeNull()

    await rollbackActivatedMigration({ runtime, storage: targetStorage })
    expect((await Promise.all(PROJECT_TABLES.map(spec => spec.table.count()))).every(count => count === 0)).toBe(true)
    expect(targetStorage.length).toBe(0)
    expect(runtime.state.migrationJournal?.phase).toBe('awaiting-choice')
  })

  it('cleans a failed partial import and leaves no visible half-profile', async () => {
    const runtime = migrationRuntime()
    const targetStorage = new MemoryStorage()

    await expect(importFullMigrationArchive(archiveBytes, {
      runtime,
      storage: targetStorage,
      injection: { failAt: 'before-activate' },
    })).rejects.toThrow('injected migration failure')

    expect((await Promise.all(PROJECT_TABLES.map(spec => spec.table.count()))).every(count => count === 0)).toBe(true)
    expect(targetStorage.length).toBe(0)
    expect(runtime.state.migrationReceipts.size).toBe(0)
    expect(runtime.state.migrationJournal?.phase).toBe('awaiting-choice')
  })

  it('recovers an interrupted process on the next startup', async () => {
    const runtime = migrationRuntime()
    const targetStorage = new MemoryStorage()

    await expect(importFullMigrationArchive(archiveBytes, {
      runtime,
      storage: targetStorage,
      injection: { crashAt: 'before-verify' },
    })).rejects.toThrow('simulated migration process termination')
    expect(runtime.state.migrationJournal?.phase).toBe('importing')
    expect(targetStorage.length).toBeGreaterThan(0)

    await expect(prepareMigrationStartup({ runtime, storage: targetStorage })).resolves.toEqual({
      status: 'awaiting-choice',
    })
    expect((await Promise.all(PROJECT_TABLES.map(spec => spec.table.count()))).every(count => count === 0)).toBe(true)
    expect(targetStorage.length).toBe(0)
    expect(runtime.state.migrationJournal?.phase).toBe('awaiting-choice')
  })
})
