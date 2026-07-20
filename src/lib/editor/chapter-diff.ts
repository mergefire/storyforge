export type ChapterDiffPieceKind = 'equal' | 'insert' | 'delete'

export interface ChapterDiffPiece {
  kind: ChapterDiffPieceKind
  value: string
}

export interface ChapterDiffRow {
  kind: 'equal' | 'modified' | 'added' | 'deleted'
  original?: string
  candidate?: string
  pieces?: ChapterDiffPiece[]
}

export interface ChapterDiffStats {
  originalCharacters: number
  candidateCharacters: number
  deltaCharacters: number
  deltaPercent: number
  changedParagraphs: number
  modifiedParagraphs: number
  addedParagraphs: number
  deletedParagraphs: number
  substantialChange: boolean
}

export interface ChapterDiffResult {
  rows: ChapterDiffRow[]
  stats: ChapterDiffStats
}

interface SequencePiece<T> {
  kind: ChapterDiffPieceKind
  value: T
}

function fallbackSequenceDiff<T>(left: T[], right: T[], equal: (a: T, b: T) => boolean): SequencePiece<T>[] {
  let prefix = 0
  while (prefix < left.length && prefix < right.length && equal(left[prefix], right[prefix])) prefix += 1
  let suffix = 0
  while (
    suffix < left.length - prefix
    && suffix < right.length - prefix
    && equal(left[left.length - 1 - suffix], right[right.length - 1 - suffix])
  ) suffix += 1
  return [
    ...left.slice(0, prefix).map(value => ({ kind: 'equal' as const, value })),
    ...left.slice(prefix, left.length - suffix).map(value => ({ kind: 'delete' as const, value })),
    ...right.slice(prefix, right.length - suffix).map(value => ({ kind: 'insert' as const, value })),
    ...left.slice(left.length - suffix).map(value => ({ kind: 'equal' as const, value })),
  ]
}

function sequenceDiff<T>(
  left: T[],
  right: T[],
  equal: (a: T, b: T) => boolean,
  maxCells: number,
): SequencePiece<T>[] {
  const width = right.length + 1
  const cells = (left.length + 1) * width
  if (cells > maxCells) return fallbackSequenceDiff(left, right, equal)
  const lengths = new Uint32Array(cells)
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      const offset = i * width + j
      lengths[offset] = equal(left[i], right[j])
        ? lengths[(i + 1) * width + j + 1] + 1
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1])
    }
  }
  const result: SequencePiece<T>[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (equal(left[i], right[j])) {
      result.push({ kind: 'equal', value: left[i] })
      i += 1
      j += 1
    } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) {
      result.push({ kind: 'delete', value: left[i] })
      i += 1
    } else {
      result.push({ kind: 'insert', value: right[j] })
      j += 1
    }
  }
  while (i < left.length) result.push({ kind: 'delete', value: left[i++] })
  while (j < right.length) result.push({ kind: 'insert', value: right[j++] })
  return result
}

function paragraphs(text: string): string[] {
  return text.replace(/\r/g, '').split(/\n+/).map(value => value.trim()).filter(Boolean)
}

function tokens(text: string): string[] {
  return text.match(/[\p{Script=Han}]|[\p{L}\p{N}_]+|\s+|[^\s]/gu) ?? []
}

function wordDiff(original: string, candidate: string): ChapterDiffPiece[] {
  const raw = sequenceDiff(tokens(original), tokens(candidate), (a, b) => a === b, 300_000)
  const merged: ChapterDiffPiece[] = []
  for (const piece of raw) {
    const previous = merged[merged.length - 1]
    if (previous?.kind === piece.kind) previous.value += piece.value
    else merged.push({ kind: piece.kind, value: piece.value })
  }
  return merged
}

function characterCount(text: string): number {
  return Array.from(text.replace(/\s/gu, '')).length
}

export function buildChapterDiff(original: string, candidate: string): ChapterDiffResult {
  const originalParagraphs = paragraphs(original)
  const candidateParagraphs = paragraphs(candidate)
  const paragraphPieces = sequenceDiff(
    originalParagraphs,
    candidateParagraphs,
    (a, b) => a === b,
    1_500_000,
  )
  const rows: ChapterDiffRow[] = []
  let cursor = 0
  while (cursor < paragraphPieces.length) {
    const piece = paragraphPieces[cursor]
    if (piece.kind === 'equal') {
      rows.push({ kind: 'equal', original: piece.value, candidate: piece.value })
      cursor += 1
      continue
    }
    const deleted: string[] = []
    const inserted: string[] = []
    while (cursor < paragraphPieces.length && paragraphPieces[cursor].kind !== 'equal') {
      const changed = paragraphPieces[cursor]
      if (changed.kind === 'delete') deleted.push(changed.value)
      else inserted.push(changed.value)
      cursor += 1
    }
    const paired = Math.min(deleted.length, inserted.length)
    for (let index = 0; index < paired; index += 1) {
      rows.push({
        kind: 'modified',
        original: deleted[index],
        candidate: inserted[index],
        pieces: wordDiff(deleted[index], inserted[index]),
      })
    }
    for (const value of deleted.slice(paired)) rows.push({ kind: 'deleted', original: value })
    for (const value of inserted.slice(paired)) rows.push({ kind: 'added', candidate: value })
  }

  const originalCharacters = characterCount(original)
  const candidateCharacters = characterCount(candidate)
  const deltaCharacters = candidateCharacters - originalCharacters
  const deltaPercent = originalCharacters === 0
    ? candidateCharacters > 0 ? 100 : 0
    : Math.round((deltaCharacters / originalCharacters) * 100)
  const modifiedParagraphs = rows.filter(row => row.kind === 'modified').length
  const addedParagraphs = rows.filter(row => row.kind === 'added').length
  const deletedParagraphs = rows.filter(row => row.kind === 'deleted').length
  const changedParagraphs = modifiedParagraphs + addedParagraphs + deletedParagraphs
  const paragraphBase = Math.max(1, originalParagraphs.length)

  return {
    rows,
    stats: {
      originalCharacters,
      candidateCharacters,
      deltaCharacters,
      deltaPercent,
      changedParagraphs,
      modifiedParagraphs,
      addedParagraphs,
      deletedParagraphs,
      substantialChange: Math.abs(deltaPercent) >= 30 || changedParagraphs / paragraphBase >= 0.5,
    },
  }
}
