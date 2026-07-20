import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/lib/db/schema'
import {
  applyChapterCandidate,
  ChapterCandidateConflictError,
  ChapterCandidateWriteError,
  hashChapterContentState,
  readChapterContentState,
  replaceWholeChapterContent,
  undoChapterAdoption,
} from '../../src/lib/editor/chapter-candidate-adoption'
import { hashChapterText } from '../../src/lib/ai/chapter-memory/text-normalization'
import { adopt } from '../../src/lib/registry/adopt'
import type { AdoptResult } from '../../src/lib/registry/types'

function successResult(): AdoptResult {
  return {
    written: [{ id: 1, fields: ['content'] }],
    aliasMapped: [],
    unknown: [],
    typeErrors: [],
    fkErrors: [],
    skipped: [],
  }
}

function skippedResult(reason: string): AdoptResult {
  return {
    written: [],
    aliasMapped: [],
    unknown: [],
    typeErrors: [],
    fkErrors: [],
    skipped: [{ reason, data: null }],
  }
}

async function createProjectAndChapter(content: string): Promise<{ projectId: number; chapterId: number }> {
  const now = Date.now()
  const projectId = await db.projects.add({
    name: '正文采纳安全测试',
    genre: '',
    description: '',
    targetWordCount: 0,
    enableMultiWorld: false,
    createdAt: now,
    updatedAt: now,
  } as never) as number
  const chapterId = await db.chapters.add({
    projectId,
    title: '第一章',
    content,
    wordCount: 2,
    order: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  } as never) as number
  return { projectId, chapterId }
}

describe('EDITOR-6.2 · 正文候选安全采纳', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(() => {
    db.close()
  })

  it('严格按持久化当前稿、创建快照、构造候选、统一写回的顺序执行', async () => {
    const before = { html: '<p>旧稿</p>', plainText: '旧稿' }
    const expectedHash = await hashChapterText(before.html)
    const events: string[] = []
    const receipt = await applyChapterCandidate({
      projectId: 1,
      chapterId: 2,
      expectedChapterId: 2,
      expectedChapterHash: expectedHash,
      mode: 'replace-chapter',
      label: '采纳整章候选',
      readCurrent: () => before,
      persistBaseline: async () => { events.push('persist') },
      createSnapshot: async () => { events.push('snapshot'); return 17 },
      buildNextContent: () => { events.push('build'); return { html: '<p>新稿</p>', plainText: '新稿' } },
      write: async () => { events.push('write'); return successResult() },
      restoreEditor: () => { events.push('restore') },
    })

    expect(events).toEqual(['persist', 'snapshot', 'build', 'write'])
    expect(receipt.snapshotId).toBe(17)
    expect(receipt.beforeHash).toBe(expectedHash)
    expect(receipt.afterHash).toBe(await hashChapterText('<p>新稿</p>'))
  })

  it('候选基线始终按编辑器 HTML 计算，纯文本分段差异不会制造假冲突', async () => {
    const state = {
      html: '<p>第一段</p><p>第二段</p>',
      // TipTap getText 的块分隔可能与 HTML 标准化不同。
      plainText: '第一段\n\n第二段',
    }
    await expect(hashChapterContentState(state)).resolves.toBe(await hashChapterText(state.html))
    expect(await hashChapterContentState(state)).not.toBe(await hashChapterText(state.plainText))
  })

  it('快照失败时不构造候选、不写正文，并保留调用方会话', async () => {
    const before = { html: '<p>旧稿</p>', plainText: '旧稿' }
    const build = vi.fn()
    const write = vi.fn()

    await expect(applyChapterCandidate({
      projectId: 1,
      chapterId: 2,
      expectedChapterId: 2,
      expectedChapterHash: await hashChapterText(before.html),
      mode: 'replace-chapter',
      label: '采纳整章候选',
      readCurrent: () => before,
      persistBaseline: async () => undefined,
      createSnapshot: async () => { throw new Error('snapshot failed') },
      buildNextContent: build,
      write,
      restoreEditor: vi.fn(),
    })).rejects.toThrow('snapshot failed')

    expect(build).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('生成后正文变化时在快照前阻止覆盖', async () => {
    const current = { html: '<p>作者新改的稿件</p>', plainText: '作者新改的稿件' }
    const persist = vi.fn()
    const snapshot = vi.fn()

    await expect(applyChapterCandidate({
      projectId: 1,
      chapterId: 2,
      expectedChapterId: 2,
      expectedChapterHash: await hashChapterText('<p>生成时旧稿</p>'),
      mode: 'replace-chapter',
      label: '采纳整章候选',
      readCurrent: () => current,
      persistBaseline: persist,
      createSnapshot: snapshot,
      buildNextContent: vi.fn(),
      write: vi.fn(),
      restoreEditor: vi.fn(),
    })).rejects.toBeInstanceOf(ChapterCandidateConflictError)

    expect(persist).not.toHaveBeenCalled()
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('统一写回抛异常或返回跳过时恢复编辑器原稿', async () => {
    const before = { html: '<p>旧稿</p>', plainText: '旧稿' }
    const restoreAfterThrow = vi.fn()
    const common = {
      projectId: 1,
      chapterId: 2,
      expectedChapterId: 2,
      expectedChapterHash: await hashChapterText(before.html),
      mode: 'replace-chapter' as const,
      label: '采纳整章候选',
      readCurrent: () => before,
      persistBaseline: async () => undefined,
      createSnapshot: async () => 18,
      buildNextContent: () => ({ html: '<p>新稿</p>', plainText: '新稿' }),
    }

    await expect(applyChapterCandidate({
      ...common,
      write: async () => { throw new Error('database failed') },
      restoreEditor: restoreAfterThrow,
    })).rejects.toThrow('database failed')
    expect(restoreAfterThrow).toHaveBeenCalledWith(before)

    const restoreAfterSkip = vi.fn()
    await expect(applyChapterCandidate({
      ...common,
      write: async () => skippedResult('正文版本冲突'),
      restoreEditor: restoreAfterSkip,
    })).rejects.toBeInstanceOf(ChapterCandidateWriteError)
    expect(restoreAfterSkip).toHaveBeenCalledWith(before)
  })

  it('独立撤销仅在正文仍等于采纳后版本时生效', async () => {
    const beforeHtml = '<p>旧稿</p>'
    const afterHtml = '<p>候选稿</p>'
    const receipt = {
      chapterId: 2,
      mode: 'replace-chapter' as const,
      snapshotId: 23,
      label: '采纳整章候选',
      beforeHtml,
      beforeHash: await hashChapterText(beforeHtml),
      afterHtml,
      afterHash: await hashChapterText(afterHtml),
      appliedAt: Date.now(),
    }
    const write = vi.fn(async () => successResult())
    const undone = await undoChapterAdoption({
      receipt,
      chapterId: 2,
      readCurrent: () => ({ html: afterHtml, plainText: '候选稿' }),
      write,
    })
    expect(undone.html).toBe(beforeHtml)
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ expectedHash: receipt.afterHash }))

    const changedWrite = vi.fn()
    await expect(undoChapterAdoption({
      receipt,
      chapterId: 2,
      readCurrent: () => ({ html: '<p>采纳后又修改</p>', plainText: '采纳后又修改' }),
      write: changedWrite,
    })).rejects.toBeInstanceOf(ChapterCandidateConflictError)
    expect(changedWrite).not.toHaveBeenCalled()
  })

  it('真实 IndexedDB 写回使用正文 hash CAS，旧候选不能覆盖新稿', async () => {
    const original = '<p>旧稿</p>'
    const { projectId, chapterId } = await createProjectAndChapter(original)
    const originalHash = await hashChapterText(original)
    const first = await adopt({
      projectId,
      target: 'chapters',
      mode: 'replace',
      recordId: chapterId,
      compareAndSet: {
        kind: 'chapter-content-hash',
        expectedHash: originalHash,
        textNormalizationVersion: 'chapter-text-v1',
      },
      data: { content: '<p>新稿</p>', wordCount: 2 },
    })
    expect(first.written).toHaveLength(1)

    const stale = await adopt({
      projectId,
      target: 'chapters',
      mode: 'replace',
      recordId: chapterId,
      compareAndSet: {
        kind: 'chapter-content-hash',
        expectedHash: originalHash,
        textNormalizationVersion: 'chapter-text-v1',
      },
      data: { content: '<p>旧候选覆盖</p>', wordCount: 6 },
    })
    expect(stale.written).toHaveLength(0)
    expect(stale.skipped[0]?.reason).toContain('正文已变化')
    expect((await db.chapters.get(chapterId))?.content).toBe('<p>新稿</p>')
  })

  it('中央审阅卸载 RichEditor 后仍使用 React 正文基线完成整章采纳', async () => {
    const before = { html: '<p>旧稿</p>', plainText: '旧稿' }
    const next = { html: '<p>中央审阅候选</p>', plainText: '中央审阅候选' }
    const { projectId, chapterId } = await createProjectAndChapter(before.html)
    const receipt = await applyChapterCandidate({
      projectId,
      chapterId,
      expectedChapterId: chapterId,
      expectedChapterHash: await hashChapterText(before.html),
      mode: 'replace-chapter',
      label: '中央审阅整章采纳',
      // 中央审阅会卸载 RichEditor；这里必须走组件 state，而不是静默 return。
      readCurrent: () => readChapterContentState(null, before),
      persistBaseline: async () => undefined,
      createSnapshot: async () => 31,
      buildNextContent: () => replaceWholeChapterContent(null, next),
      write: async ({ html, plainText, expectedHash, textNormalizationVersion }) => adopt({
        projectId,
        target: 'chapters',
        mode: 'replace',
        recordId: chapterId,
        compareAndSet: {
          kind: 'chapter-content-hash',
          expectedHash,
          textNormalizationVersion,
        },
        data: { content: html, wordCount: plainText.length },
      }),
      restoreEditor: vi.fn(),
    })

    expect(receipt.afterHtml).toBe(next.html)
    expect((await db.chapters.get(chapterId))?.content).toBe(next.html)
  })
})
