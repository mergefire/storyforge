import { useEffect, useState } from 'react'
import { Check, ExternalLink, Save, Trash2 } from 'lucide-react'
import type { TemporalFact } from '../../lib/types/temporal-fact'
import { FACT_PREDICATE_REGISTRY } from '../../lib/registry/fact-predicate-registry'
import type { FactCandidatePatch } from '../../lib/fact-ledger/fact-ledger'

interface Props {
  candidates: TemporalFact[]
  busy?: boolean
  onUpdate: (factId: number, patch: FactCandidatePatch) => Promise<void>
  onConfirm: (factIds: number[]) => Promise<void>
  onReject: (factIds: number[]) => Promise<void>
  onOpenLibrary: () => void
}

type CandidateDraft = FactCandidatePatch

function draftFromFact(fact: TemporalFact): CandidateDraft {
  return {
    subjectName: fact.subjectName,
    predicate: fact.predicate,
    value: fact.value,
    sourceQuote: fact.sourceQuote || '',
  }
}

export default function ChapterFactCandidateWorkspace({
  candidates,
  busy,
  onUpdate,
  onConfirm,
  onReject,
  onOpenLibrary,
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, CandidateDraft>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [workingIds, setWorkingIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  useEffect(() => {
    const next: Record<number, CandidateDraft> = {}
    for (const fact of candidates) if (fact.id != null) next[fact.id] = draftFromFact(fact)
    setDrafts(next)
    setSelected(current => new Set([...current].filter(id => id in next)))
  }, [candidates])

  const patchDraft = (factId: number, patch: Partial<CandidateDraft>) => {
    setDrafts(current => ({ ...current, [factId]: { ...current[factId], ...patch } }))
  }

  const run = async (ids: number[], operation: () => Promise<void>) => {
    if (!ids.length) return
    setError('')
    setWorkingIds(current => new Set([...current, ...ids]))
    try {
      await operation()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setWorkingIds(current => new Set([...current].filter(id => !ids.includes(id))))
    }
  }

  const saveOne = async (factId: number) => {
    const draft = drafts[factId]
    if (!draft) return
    await run([factId], () => onUpdate(factId, draft))
  }

  const saveAndConfirm = async (ids: number[]) => {
    await run(ids, async () => {
      for (const id of ids) {
        const draft = drafts[id]
        if (draft) await onUpdate(id, draft)
      }
      await onConfirm(ids)
      setSelected(current => new Set([...current].filter(id => !ids.includes(id))))
    })
  }

  if (!candidates.length) {
    return (
      <div className="border border-dashed border-border px-3 py-4 text-center text-[11px] leading-5 text-text-muted">
        本章还没有待确认的长期事实。提取后可在这里编辑证据并决定是否写入后续章节的一致性记忆。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] leading-5 text-text-secondary">
        <p className="font-medium text-text-primary">本章提取到 {candidates.length} 条长期事实候选</p>
        <p>确认后才会用于后续章节；证据保存时会逐字回查当前正文。</p>
      </div>

      {error && <p className="border border-danger/30 bg-danger/10 px-3 py-2 text-[11px] text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { void saveAndConfirm(candidates.flatMap(fact => fact.id ?? [])) }} disabled={busy || workingIds.size > 0} className="inline-flex items-center gap-1 bg-accent px-2.5 py-1.5 text-[11px] text-white disabled:opacity-40">
          <Check className="h-3 w-3" />全部确认
        </button>
        <button type="button" onClick={() => { void saveAndConfirm([...selected]) }} disabled={!selected.size || busy || workingIds.size > 0} className="border border-border px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-bg-hover disabled:opacity-40">
          仅确认勾选项
        </button>
        <button type="button" onClick={() => { void run(candidates.flatMap(fact => fact.id ?? []), () => onReject(candidates.flatMap(fact => fact.id ?? []))) }} disabled={busy || workingIds.size > 0} className="border border-danger/30 px-2.5 py-1.5 text-[11px] text-danger hover:bg-danger/10 disabled:opacity-40">
          放弃本轮全部
        </button>
        <button type="button" onClick={onOpenLibrary} className="ml-auto inline-flex items-center gap-1 border border-border px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-bg-hover">
          <ExternalLink className="h-3 w-3" />完整事实库
        </button>
      </div>

      <div className="space-y-2">
        {candidates.map(fact => {
          if (fact.id == null) return null
          const draft = drafts[fact.id] ?? draftFromFact(fact)
          const working = workingIds.has(fact.id)
          return (
            <article key={fact.id} className="border border-border bg-bg-elevated px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[11px] text-text-secondary">
                  <input type="checkbox" checked={selected.has(fact.id)} onChange={event => setSelected(current => {
                    const next = new Set(current)
                    if (event.target.checked) next.add(fact.id!)
                    else next.delete(fact.id!)
                    return next
                  })} />
                  选择候选 #{fact.id}
                </label>
                <span className="text-[10px] text-text-muted">待作者确认</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-text-muted">
                  主体
                  <input value={draft.subjectName} onChange={event => patchDraft(fact.id!, { subjectName: event.target.value })} className="mt-1 w-full border border-border bg-bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
                </label>
                <label className="text-[10px] text-text-muted">
                  事实类型
                  <select value={draft.predicate} onChange={event => patchDraft(fact.id!, { predicate: event.target.value })} className="mt-1 w-full border border-border bg-bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent">
                    {FACT_PREDICATE_REGISTRY.filter(spec => spec.factKind !== 'derived').map(spec => <option key={spec.key} value={spec.key}>{spec.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-[10px] text-text-muted">
                事实值
                <input value={draft.value} onChange={event => patchDraft(fact.id!, { value: event.target.value })} className="mt-1 w-full border border-border bg-bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
              </label>
              <label className="mt-2 block text-[10px] text-text-muted">
                正文证据（必须逐字存在）
                <textarea value={draft.sourceQuote} onChange={event => patchDraft(fact.id!, { sourceQuote: event.target.value })} rows={2} className="mt-1 w-full resize-y border border-border bg-bg-surface px-2 py-1.5 text-xs leading-5 text-text-primary outline-none focus:border-accent" />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => { void saveOne(fact.id!) }} disabled={working || busy} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:opacity-40"><Save className="h-3 w-3" />保存编辑</button>
                <button type="button" onClick={() => { void saveAndConfirm([fact.id!]) }} disabled={working || busy} className="inline-flex items-center gap-1 border border-success/30 px-2 py-1 text-[11px] text-success hover:bg-success/10 disabled:opacity-40"><Check className="h-3 w-3" />确认</button>
                <button type="button" onClick={() => { void run([fact.id!], () => onReject([fact.id!])) }} disabled={working || busy} className="inline-flex items-center gap-1 border border-danger/30 px-2 py-1 text-[11px] text-danger hover:bg-danger/10 disabled:opacity-40"><Trash2 className="h-3 w-3" />放弃</button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
