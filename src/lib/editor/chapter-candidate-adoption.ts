import { CHAPTER_TEXT_NORMALIZATION_VERSION, hashChapterText, normalizeChapterText } from '../ai/chapter-memory/text-normalization'
import type { AdoptResult } from '../registry/types'

export type ChapterCandidateApplyMode = 'replace-chapter' | 'append-chapter' | 'replace-selection'

export interface ChapterContentState {
  html: string
  plainText: string
}

export interface ChapterContentEditorPort {
  getHTML: () => string
  getPlainText: () => string
  setContent: (html: string) => void
}

/**
 * 中央整章审阅会暂时卸载 RichEditor，因此正文基线必须允许回退到 React state。
 * 有编辑器时仍以编辑器当前值为准，保证选区与续写读取作者眼前的最新稿件。
 */
export function readChapterContentState(
  editor: Pick<ChapterContentEditorPort, 'getHTML' | 'getPlainText'> | null,
  fallback: ChapterContentState,
): ChapterContentState {
  return editor
    ? { html: editor.getHTML(), plainText: editor.getPlainText() }
    : { ...fallback }
}

/** 整章候选可以在 RichEditor 已卸载时纯计算新正文，写回成功后再由 state 重挂编辑器。 */
export function replaceWholeChapterContent(
  editor: ChapterContentEditorPort | null,
  replacement: ChapterContentState,
): ChapterContentState {
  if (!editor) return { ...replacement }
  editor.setContent(replacement.html)
  return { html: editor.getHTML(), plainText: editor.getPlainText() }
}

/**
 * 候选版本始终以编辑器 HTML 为唯一基线。
 * TipTap getText() 的块分隔符与 HTML 标准化结果可能不同，混用会把未修改正文误判为冲突。
 */
export function hashChapterContentState(state: ChapterContentState): Promise<string> {
  return hashChapterText(state.html)
}

export interface ChapterAdoptionReceipt {
  chapterId: number
  mode: ChapterCandidateApplyMode
  snapshotId: number
  label: string
  beforeHtml: string
  beforeHash: string
  afterHtml: string
  afterHash: string
  appliedAt: number
}

export class ChapterCandidateConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChapterCandidateConflictError'
  }
}

export class ChapterCandidateWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChapterCandidateWriteError'
  }
}

interface ApplyChapterCandidateArgs {
  projectId: number
  chapterId: number
  expectedChapterId?: number
  expectedChapterHash?: string
  expectedTailAnchor?: string
  mode: ChapterCandidateApplyMode
  label: string
  readCurrent: () => ChapterContentState
  persistBaseline: (state: ChapterContentState) => Promise<void>
  createSnapshot: (projectId: number, label: string, type: 'manual') => Promise<number>
  buildNextContent: () => Promise<ChapterContentState> | ChapterContentState
  write: (args: {
    html: string
    plainText: string
    expectedHash: string
    textNormalizationVersion: string
  }) => Promise<AdoptResult>
  restoreEditor: (state: ChapterContentState) => void
}

function firstWriteError(result: AdoptResult): string {
  if (result.skipped[0]?.reason) return result.skipped[0].reason
  if (result.typeErrors[0]) {
    const issue = result.typeErrors[0]
    return `字段 ${issue.field} 类型不符合要求（需要 ${issue.expected}）`
  }
  if (result.fkErrors[0]) return `字段 ${result.fkErrors[0].field} 的引用不存在`
  return '统一写回校验未通过'
}

async function validateBaseline(args: ApplyChapterCandidateArgs, state: ChapterContentState): Promise<string> {
  if (args.expectedChapterId == null || args.expectedChapterId !== args.chapterId) {
    throw new ChapterCandidateConflictError('候选不属于当前章节，请回到生成候选的章节重新处理。')
  }
  if (!args.expectedChapterHash) {
    throw new ChapterCandidateConflictError('候选缺少完整正文版本，请基于当前正文重新生成。')
  }
  const currentHash = await hashChapterContentState(state)
  if (currentHash !== args.expectedChapterHash) {
    throw new ChapterCandidateConflictError('生成候选后正文已经变化，为避免覆盖新稿，本次没有写入。')
  }
  if (
    args.mode === 'append-chapter'
    && args.expectedTailAnchor
    && !normalizeChapterText(state.html).endsWith(normalizeChapterText(args.expectedTailAnchor))
  ) {
    throw new ChapterCandidateConflictError('正文结尾已经变化，旧续写候选不能继续追加。')
  }
  return currentHash
}

export async function applyChapterCandidate(
  args: ApplyChapterCandidateArgs,
): Promise<ChapterAdoptionReceipt> {
  const before = args.readCurrent()
  const beforeHash = await validateBaseline(args, before)

  await args.persistBaseline(before)
  const snapshotId = await args.createSnapshot(args.projectId, args.label, 'manual')

  const afterSnapshot = args.readCurrent()
  await validateBaseline(args, afterSnapshot)

  try {
    const next = await args.buildNextContent()
    const result = await args.write({
      html: next.html,
      plainText: next.plainText,
      expectedHash: beforeHash,
      textNormalizationVersion: CHAPTER_TEXT_NORMALIZATION_VERSION,
    })
    if (result.written.length === 0) throw new ChapterCandidateWriteError(firstWriteError(result))

    return {
      chapterId: args.chapterId,
      mode: args.mode,
      snapshotId,
      label: args.label,
      beforeHtml: before.html,
      beforeHash,
      afterHtml: next.html,
      afterHash: await hashChapterContentState(next),
      appliedAt: Date.now(),
    }
  } catch (error) {
    args.restoreEditor(before)
    throw error
  }
}

interface UndoChapterAdoptionArgs {
  receipt: ChapterAdoptionReceipt
  chapterId: number
  readCurrent: () => ChapterContentState
  write: ApplyChapterCandidateArgs['write']
}

export async function undoChapterAdoption(args: UndoChapterAdoptionArgs): Promise<ChapterContentState> {
  if (args.chapterId !== args.receipt.chapterId) {
    throw new ChapterCandidateConflictError('撤销凭据不属于当前章节。')
  }
  const current = args.readCurrent()
  if (await hashChapterContentState(current) !== args.receipt.afterHash) {
    throw new ChapterCandidateConflictError('采纳后正文已经继续修改，不能直接撤销；请从项目快照恢复。')
  }
  const before = {
    html: args.receipt.beforeHtml,
    plainText: normalizeChapterText(args.receipt.beforeHtml),
  }
  const result = await args.write({
    html: before.html,
    plainText: before.plainText,
    expectedHash: args.receipt.afterHash,
    textNormalizationVersion: CHAPTER_TEXT_NORMALIZATION_VERSION,
  })
  if (result.written.length === 0) throw new ChapterCandidateWriteError(firstWriteError(result))
  return before
}
