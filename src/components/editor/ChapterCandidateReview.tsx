import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Columns2, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react'
import { buildChapterDiff, type ChapterDiffPiece, type ChapterDiffRow } from '../../lib/editor/chapter-diff'

type ReviewView = 'candidate' | 'original' | 'inline' | 'split'

interface Props {
  chapterTitle: string
  originalText: string
  candidateText: string
  onApply: () => void
  onContinue: () => void
  onRegenerate: () => void
  onDiscard: () => void
}

function paragraphList(text: string) {
  const values = text.replace(/\r/g, '').split(/\n+/).map(value => value.trim()).filter(Boolean)
  return values.length ? values : ['（空白正文）']
}

function Piece({ piece, side }: { piece: ChapterDiffPiece; side: 'inline' | 'original' | 'candidate' }) {
  if (side === 'original' && piece.kind === 'insert') return null
  if (side === 'candidate' && piece.kind === 'delete') return null
  if (piece.kind === 'delete') return <del className="bg-danger/15 text-danger decoration-danger/70">{piece.value}</del>
  if (piece.kind === 'insert') return <ins className="bg-success/15 text-success no-underline">{piece.value}</ins>
  return <>{piece.value}</>
}

function SideParagraph({ row, side }: { row: ChapterDiffRow; side: 'original' | 'candidate' }) {
  const text = side === 'original' ? row.original : row.candidate
  if (!text) return <p className="min-h-7 bg-bg-elevated/45 px-3 py-2 text-text-muted">（此侧无段落）</p>
  if (row.kind === 'modified' && row.pieces) {
    return <p className="whitespace-pre-wrap px-3 py-2">{row.pieces.map((piece, index) => <Piece key={index} piece={piece} side={side} />)}</p>
  }
  const changed = (side === 'original' && row.kind === 'deleted') || (side === 'candidate' && row.kind === 'added')
  return <p className={`whitespace-pre-wrap px-3 py-2 ${changed ? side === 'original' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success' : ''}`}>{text}</p>
}

export default function ChapterCandidateReview({
  chapterTitle,
  originalText,
  candidateText,
  onApply,
  onContinue,
  onRegenerate,
  onDiscard,
}: Props) {
  const [view, setView] = useState<ReviewView>('candidate')
  const [activeChangeGroup, setActiveChangeGroup] = useState(0)
  const changeRefs = useRef<Array<HTMLDivElement | null>>([])
  const diff = useMemo(() => buildChapterDiff(originalText, candidateText), [originalText, candidateText])
  const isInitialDraft = diff.stats.originalCharacters === 0
  const changeNavigation = useMemo(() => {
    const starts: number[] = []
    const groupByRow: number[] = []
    let currentGroup = -1
    let previousChanged = false
    diff.rows.forEach((row, rowIndex) => {
      const changed = row.kind !== 'equal'
      if (changed && !previousChanged) {
        starts.push(rowIndex)
        currentGroup += 1
      }
      groupByRow[rowIndex] = changed ? currentGroup : -1
      previousChanged = changed
    })
    return { starts, groupByRow }
  }, [diff.rows])
  const deltaLabel = diff.stats.deltaPercent > 0
    ? `增加 ${diff.stats.deltaPercent}%`
    : diff.stats.deltaPercent < 0
      ? `减少 ${Math.abs(diff.stats.deltaPercent)}%`
      : '篇幅不变'

  useEffect(() => {
    setView('candidate')
    setActiveChangeGroup(0)
    changeRefs.current = []
  }, [originalText, candidateText])

  const navigate = (direction: -1 | 1) => {
    if (!changeNavigation.starts.length) return
    const next = (activeChangeGroup + direction + changeNavigation.starts.length) % changeNavigation.starts.length
    setActiveChangeGroup(next)
    changeRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const viewOptions: ReadonlyArray<readonly [ReviewView, string]> = isInitialDraft
    ? [['candidate', '候选正文']]
    : [
        ['candidate', '候选正文'],
        ['original', '原文'],
        ['inline', '行内 Diff'],
        ['split', '并排 Diff'],
      ]
  const diffViewActive = view === 'inline' || view === 'split'

  return (
    <section className="mx-auto max-w-[1120px] border border-border bg-[var(--editor-page-bg)]" aria-label="整章候选审阅">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-accent">{isInitialDraft ? '新正文审阅' : '整章候选审阅'}</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-text-primary">{chapterTitle}</h2>
            <p className="mt-1 text-xs text-text-muted">
              {isInitialDraft
                ? `候选 ${diff.stats.candidateCharacters.toLocaleString()} 字 · ${diff.stats.addedParagraphs.toLocaleString()} 段`
                : `原文 ${diff.stats.originalCharacters.toLocaleString()} 字 → 候选 ${diff.stats.candidateCharacters.toLocaleString()} 字 · ${deltaLabel} · 修改 ${diff.stats.changedParagraphs} 段 · 删除 ${diff.stats.deletedParagraphs} 段`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {viewOptions.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`border px-2.5 py-1.5 text-[11px] ${view === key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                {key === 'split' && <Columns2 className="mr-1 inline h-3 w-3" />}{label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 border-t border-border/70 pt-2 text-[11px] leading-5 text-text-muted">
          {isInitialDraft
            ? '这是首次生成，没有需要逐项核对的旧正文。通读候选后，可直接整章采纳。'
            : '当前默认显示完整候选。Diff 只用于按需对照，不需要逐项确认。'}
        </div>
        {!isInitialDraft && diffViewActive && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
            <p className="text-[11px] text-text-muted">
              差异片段 {changeNavigation.starts.length} 组 · 当前 {changeNavigation.starts.length ? activeChangeGroup + 1 : 0}/{changeNavigation.starts.length}
            </p>
            <div className="flex gap-1">
              <button type="button" onClick={() => navigate(-1)} disabled={!changeNavigation.starts.length} className="border border-border p-1.5 text-text-secondary hover:bg-bg-hover disabled:opacity-35" aria-label="上一组差异"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => navigate(1)} disabled={!changeNavigation.starts.length} className="border border-border p-1.5 text-text-secondary hover:bg-bg-hover disabled:opacity-35" aria-label="下一组差异"><ArrowDown className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
        {!isInitialDraft && diff.stats.substantialChange && (
          <div className="mt-2 flex items-start gap-2 border border-warning/35 bg-warning/10 px-3 py-2 text-[11px] leading-5 text-warning" role="alert">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />候选存在大幅篇幅或结构变化，请重点检查删除段落、情节连续性和结尾衔接后再采纳。
          </div>
        )}
      </header>

      <div className="sf-candidate-review-body min-h-[560px] px-5 py-8 font-serif text-[15px] leading-8 text-text-primary sm:px-9">
        {(view === 'candidate' ? paragraphList(candidateText) : view === 'original' ? paragraphList(originalText) : []).map((paragraph, index) => (
          <p key={index} className="mb-5 whitespace-pre-wrap">{paragraph}</p>
        ))}

        {view === 'inline' && diff.rows.map((row, rowIndex) => {
          const changeGroupIndex = changeNavigation.groupByRow[rowIndex]
          const isGroupStart = changeGroupIndex >= 0 && changeNavigation.starts[changeGroupIndex] === rowIndex
          return (
            <div key={rowIndex} ref={node => { if (isGroupStart) changeRefs.current[changeGroupIndex] = node }} data-diff-kind={row.kind} className={`mb-5 scroll-mt-40 ${isGroupStart && changeGroupIndex === activeChangeGroup ? 'outline outline-1 outline-accent/45 outline-offset-4' : ''}`}>
              {row.kind === 'modified' && row.pieces
                ? <p className="whitespace-pre-wrap">{row.pieces.map((piece, index) => <Piece key={index} piece={piece} side="inline" />)}</p>
                : row.kind === 'deleted'
                  ? <p className="whitespace-pre-wrap bg-danger/10 px-2 text-danger line-through">{row.original}</p>
                  : row.kind === 'added'
                    ? <p className="whitespace-pre-wrap bg-success/10 px-2 text-success">{row.candidate}</p>
                    : <p className="whitespace-pre-wrap">{row.candidate}</p>}
            </div>
          )
        })}

        {view === 'split' && (
          <div className="grid gap-x-4 lg:grid-cols-2">
            <h3 className="sticky top-36 z-[5] border-b border-border bg-[var(--editor-page-bg)] py-2 text-xs font-sans font-medium text-text-muted">原文</h3>
            <h3 className="sticky top-36 z-[5] hidden border-b border-border bg-[var(--editor-page-bg)] py-2 text-xs font-sans font-medium text-text-muted lg:block">候选</h3>
            {diff.rows.map((row, rowIndex) => {
              const changeGroupIndex = changeNavigation.groupByRow[rowIndex]
              const isGroupStart = changeGroupIndex >= 0 && changeNavigation.starts[changeGroupIndex] === rowIndex
              return <div key={rowIndex} className="contents">
                <div ref={node => { if (isGroupStart) changeRefs.current[changeGroupIndex] = node }} className={`mb-3 scroll-mt-40 border border-border/60 ${isGroupStart && changeGroupIndex === activeChangeGroup ? 'outline outline-1 outline-accent/45 outline-offset-2' : ''}`}><SideParagraph row={row} side="original" /></div>
                <div className="mb-3 border border-border/60"><SideParagraph row={row} side="candidate" /></div>
              </div>
            })}
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onContinue} className="border border-border px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover">继续修改</button>
          <button type="button" onClick={onRegenerate} className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover"><RefreshCw className="h-3.5 w-3.5" />重新生成</button>
          <button type="button" onClick={onDiscard} className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover"><RotateCcw className="h-3.5 w-3.5" />放弃</button>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <span className="text-[11px] text-text-muted">无需逐项确认差异</span>
          <button type="button" onClick={onApply} className="bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover">采纳并替换整章</button>
        </div>
      </footer>
    </section>
  )
}
