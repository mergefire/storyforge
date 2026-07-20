import type { EditorSelectionSnapshot } from './selection-snapshot'
import { inspectChapterCandidate } from './chapter-candidate-guard'

export interface SelectionCandidateInspection {
  ok: boolean
  reason?: string
}

const PROMPT_LEAK_MARKERS = [
  '【目标前邻文',
  '【目标后邻文',
  '【项目只读上下文】',
  '【本轮可写目标】',
  '【交付协议】',
]

function normalizeForBoundaryCheck(text: string): string {
  return text.replace(/\s+/gu, '')
}

function boundaryAnchor(text: string, side: 'start' | 'end', length = 24): string {
  const normalized = normalizeForBoundaryCheck(text)
  if (normalized.length < 16) return ''
  return side === 'start' ? normalized.slice(0, length) : normalized.slice(-length)
}

function boundaryOverlap(left: string, right: string, minimum = 12, maximum = 120): number {
  const normalizedLeft = normalizeForBoundaryCheck(left)
  const normalizedRight = normalizeForBoundaryCheck(right)
  const limit = Math.min(normalizedLeft.length, normalizedRight.length, maximum)
  for (let length = limit; length >= minimum; length -= 1) {
    if (normalizedLeft.slice(-length) === normalizedRight.slice(0, length)) return length
  }
  return 0
}

/**
 * 选区写回的第二道防线：发现模型回显邻文或 Prompt 区块时，不提供采纳入口。
 * 真正的硬边界仍由 EditorSelectionSnapshot 的坐标 + 原文校验保证。
 */
export function inspectSelectionCandidate(
  candidate: string,
  snapshot: EditorSelectionSnapshot,
): SelectionCandidateInspection {
  const trimmed = candidate.trim()
  const generic = inspectChapterCandidate(trimmed, 'replace-selection')
  if (!generic.ok) return generic

  const leakedMarker = PROMPT_LEAK_MARKERS.find(marker => trimmed.includes(marker))
  if (leakedMarker) {
    return { ok: false, reason: 'AI 返回了只读上下文或 Prompt 内容。' }
  }

  const normalizedCandidate = normalizeForBoundaryCheck(trimmed)
  const normalizedTarget = normalizeForBoundaryCheck(snapshot.text)
  const beforeAnchor = boundaryAnchor(snapshot.beforeText, 'end')
  const afterAnchor = boundaryAnchor(snapshot.afterText, 'start')
  const beforeOverlap = boundaryOverlap(snapshot.beforeText, trimmed)
  const afterOverlap = boundaryOverlap(trimmed, snapshot.afterText)

  if (
    beforeOverlap > 0
    || (beforeAnchor && !normalizedTarget.includes(beforeAnchor) && normalizedCandidate.includes(beforeAnchor))
  ) {
    return { ok: false, reason: 'AI 把选区之前的邻文一并输出了。' }
  }
  if (
    afterOverlap > 0
    || (afterAnchor && !normalizedTarget.includes(afterAnchor) && normalizedCandidate.includes(afterAnchor))
  ) {
    return { ok: false, reason: 'AI 把选区之后的邻文一并输出了。' }
  }

  return { ok: true }
}
