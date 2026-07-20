import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Copy,
  FilePenLine,
  GitCompare,
  ListChecks,
  Loader2,
  LocateFixed,
  MessageSquareText,
  NotebookPen,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import { CTextarea } from '../shared/CompositionInput'
import PromptRunPanel from '../shared/PromptRunPanel'
import ChapterMemoryPanel from './ChapterMemoryPanel'
import type { UseAIStreamReturn } from '../../hooks/useAIStream'
import type { ChapterPlanReconciliation } from '../../lib/types'
import type { RunOptions } from '../../lib/ai/adapters/chapter-adapter'
import type { PromptModuleKey } from '../../lib/types/prompt'
import { CONTEXT_SOURCE_BY_KEY } from '../../lib/registry/context-sources'
import { getRuntime } from '../../runtime'
import type { TemporalFact } from '../../lib/types/temporal-fact'
import type { FactCandidatePatch } from '../../lib/fact-ledger/fact-ledger'
import ChapterFactCandidateWorkspace from './ChapterFactCandidateWorkspace'
import { resolveChapterAssistantMode } from '../../lib/ai/chapter-assistant-intent'
import { buildChapterDiff } from '../../lib/editor/chapter-diff'

const ASSISTANT_WIDTH_KEY = 'storyforge.chapter-ai.width'
const DEFAULT_ASSISTANT_WIDTH = 420
const MIN_ASSISTANT_WIDTH = 340

function loadAssistantWidth(): number {
  try {
    const stored = Number(localStorage.getItem(ASSISTANT_WIDTH_KEY))
    return Number.isFinite(stored) && stored >= MIN_ASSISTANT_WIDTH ? stored : DEFAULT_ASSISTANT_WIDTH
  } catch {
    return DEFAULT_ASSISTANT_WIDTH
  }
}
import type {
  ChapterAssistantAction,
  ChapterAssistantApplyMode,
  ChapterAssistantInteractionMode,
  ChapterAssistantSession,
} from '../../stores/chapter-ai-chat'

export type ChapterAssistantPanelTab = 'assistant' | 'links'

export interface ChapterAssistantLinkedWorkspace {
  goalTitle: string
  goalSummary: string
  memorySummary?: string
  memoryBusy: boolean
  reconciliation?: ChapterPlanReconciliation
  reconciliationCurrent: boolean
  autoStatus?: string
  pendingStateCount: number
  stateBusy: boolean
  factBusy: boolean
  factInfo?: string
  factCandidates: TemporalFact[]
  impactBusy: boolean
  impactInfo?: string
  notes: string
  onNotesChange: (value: string) => void
  onGenerateMemory: () => void
  onConfirmProgress: () => void
  onApplyOutlineCandidate: () => void
  onExtractState: () => void
  onExtractFacts: () => void
  onUpdateFactCandidate: (factId: number, patch: FactCandidatePatch) => Promise<void>
  onConfirmFactCandidates: (factIds: number[]) => Promise<void>
  onRejectFactCandidates: (factIds: number[]) => Promise<void>
  onOpenFactLibrary: () => void
  onAnalyzeImpact: () => void
  onOpenOutline: () => void
  onOpenReview: () => void
  onOpenNotes: () => void
  onOpenEmotion: () => void
}

interface Props {
  session: ChapterAssistantSession
  stream: UseAIStreamReturn
  hasText: boolean
  activeTab: ChapterAssistantPanelTab
  selectionValid?: boolean
  centralReviewActive?: boolean
  linked: ChapterAssistantLinkedWorkspace
  onTabChange: (tab: ChapterAssistantPanelTab) => void
  onClose: () => void
  onClear: () => void
  onQuickAction: (
    action: Extract<ChapterAssistantAction, 'generate' | 'continue' | 'deai'>,
    instruction: string,
    runOptions?: RunOptions,
  ) => void | Promise<void>
  onSend: (instruction: string, mode: ChapterAssistantInteractionMode, runOptions?: RunOptions) => void | Promise<void>
  onApply: () => void
  onRetry: (runOptions?: RunOptions) => void | Promise<void>
  onResumePartial: (runOptions?: RunOptions) => void | Promise<void>
  onDiscard: () => void
  onUseWholeChapterScope: () => void
  onRevealSelection: () => void
}

type QuickAction = Extract<ChapterAssistantAction, 'generate' | 'continue' | 'deai'>

const QUICK_ACTIONS: Record<QuickAction, { label: string; instruction: string; moduleKey: PromptModuleKey }> = {
  generate: {
    label: '生成整章',
    instruction: '严格按照本章章纲与项目设定生成正文。',
    moduleKey: 'chapter.content',
  },
  continue: {
    label: '续写正文',
    instruction: '从当前正文结尾自然续写，推进本章目标，不要重复已有内容。',
    moduleKey: 'chapter.continue',
  },
  deai: {
    label: '去 AI 味',
    instruction: '降低模板化和 AI 腔，改善句式、节奏与细节选择；保持篇幅、事实、情节和人物口吻基本不变。',
    moduleKey: 'chapter.de-ai',
  },
}

function contextSourceLabel(key: string): string {
  return CONTEXT_SOURCE_BY_KEY.get(key)?.label ?? key
}

function applyLabel(mode: ChapterAssistantApplyMode): string {
  if (mode === 'replace-selection') return '替换选区'
  if (mode === 'append-chapter') return '追加到正文'
  return '替换整章'
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-[11px] font-semibold text-text-muted">{children}</h3>
}

function WorkspaceButton({
  icon,
  label,
  detail,
  busy,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
  detail?: string
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="flex min-h-14 items-start gap-2 border border-border bg-bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-hover hover:bg-bg-hover disabled:opacity-45"
    >
      <span className="mt-0.5 text-accent">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-text-primary">{label}</span>
        {detail && <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-text-muted">{detail}</span>}
      </span>
    </button>
  )
}

export default function ChapterAIAssistantPanel({
  session,
  stream,
  hasText,
  activeTab,
  selectionValid = true,
  centralReviewActive = false,
  linked,
  onTabChange,
  onClose,
  onClear,
  onQuickAction,
  onSend,
  onApply,
  onRetry,
  onResumePartial,
  onDiscard,
  onUseWholeChapterScope,
  onRevealSelection,
}: Props) {
  const [instruction, setInstruction] = useState('')
  const [interactionMode, setInteractionMode] = useState<ChapterAssistantInteractionMode>('auto')
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null)
  const [parameterValues, setParameterValues] = useState<Record<string, unknown>>({})
  const [systemOverride, setSystemOverride] = useState<string | null>(null)
  const [userOverride, setUserOverride] = useState<string | null>(null)
  const [promptPanelOpen, setPromptPanelOpen] = useState(false)
  const [resultView, setResultView] = useState<'candidate' | 'compare'>('candidate')
  const [panelWidth, setPanelWidth] = useState(loadAssistantWidth)
  const [resizing, setResizing] = useState(false)
  const [hasUnreadOutput, setHasUnreadOutput] = useState(false)
  const [submissionPending, setSubmissionPending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const instructionRef = useRef<HTMLTextAreaElement>(null)
  const submissionInFlightRef = useRef(false)
  const task = session.activeTask
  const assistantBusy = stream.isStreaming || submissionPending || task?.status === 'generating'
  const resolvedInputMode = resolveChapterAssistantMode(interactionMode, instruction)
  const lastDiscussionMessageId = task?.selection && task.lastResponseApplyMode === 'none'
    ? [...session.messages].reverse().find(message => message.role === 'assistant')?.id
    : undefined
  const promptModuleKey: PromptModuleKey = pendingAction
    ? QUICK_ACTIONS[pendingAction].moduleKey
    : 'chapter.assistant'
  const runOptions = useMemo<RunOptions | undefined>(() => {
    const overrides = systemOverride != null || userOverride != null
      ? {
          systemPrompt: systemOverride ?? undefined,
          userPromptTemplate: userOverride ?? undefined,
        }
      : undefined
    return Object.keys(parameterValues).length || overrides
      ? { parameterValues: Object.keys(parameterValues).length ? parameterValues : undefined, overrides }
      : undefined
  }, [parameterValues, systemOverride, userOverride])
  const contextTokensByKey = useMemo(
    () => new Map((session.contextMeta?.sources ?? []).map(source => [source.key, source.tokens])),
    [session.contextMeta?.sources],
  )
  const cappedSourceKeys = useMemo(
    () => (session.contextMeta?.sourceLimits ?? []).filter(limit => limit.applied).map(limit => limit.key),
    [session.contextMeta?.sourceLimits],
  )

  const scrollToBottom = () => {
    const viewport = scrollRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
    nearBottomRef.current = true
    setHasUnreadOutput(false)
  }

  useEffect(() => {
    if (nearBottomRef.current) scrollToBottom()
    else setHasUnreadOutput(true)
  }, [session.messages, stream.output, stream.reasoning])

  useEffect(() => {
    try { localStorage.setItem(ASSISTANT_WIDTH_KEY, String(Math.round(panelWidth))) } catch { /* 偏好持久化失败不阻断协作 */ }
  }, [panelWidth])

  useEffect(() => {
    if (!resizing) return
    const handlePointerMove = (event: PointerEvent) => {
      const maxWidth = Math.max(MIN_ASSISTANT_WIDTH, window.innerWidth * 0.7)
      setPanelWidth(Math.min(maxWidth, Math.max(MIN_ASSISTANT_WIDTH, window.innerWidth - event.clientX)))
    }
    const stopResizing = () => setResizing(false)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [resizing])

  useEffect(() => {
    setResultView('candidate')
  }, [task?.id, task?.candidate])

  useEffect(() => {
    if (!task?.selection || task.status !== 'draft' || task.iteration > 0) return
    setPendingAction(null)
    setInteractionMode(task.action === 'check' ? 'discuss' : 'auto')
    setInstruction(task.action === 'ask' ? '' : task.instruction)
    setParameterValues({})
    setSystemOverride(null)
    setUserOverride(null)
    setPromptPanelOpen(false)
    queueMicrotask(() => instructionRef.current?.focus())
  }, [task?.action, task?.id, task?.instruction, task?.iteration, task?.selection, task?.status])

  const prepareQuickAction = (action: QuickAction) => {
    const next = QUICK_ACTIONS[action]
    setPendingAction(action)
    setInteractionMode('edit')
    setInstruction(next.instruction)
    setParameterValues({})
    setSystemOverride(null)
    setUserOverride(null)
    setPromptPanelOpen(true)
    queueMicrotask(() => instructionRef.current?.focus())
  }

  const cancelQuickAction = () => {
    setPendingAction(null)
    setInstruction('')
    setParameterValues({})
    setSystemOverride(null)
    setUserOverride(null)
    setPromptPanelOpen(false)
  }

  const runExclusiveSubmission = async (run: () => void | Promise<void>) => {
    if (assistantBusy || submissionInFlightRef.current) return
    submissionInFlightRef.current = true
    setSubmissionPending(true)
    try {
      await run()
    } finally {
      submissionInFlightRef.current = false
      setSubmissionPending(false)
    }
  }

  const runDefaultQuickAction = (action: QuickAction) => {
    void runExclusiveSubmission(async () => {
      const next = QUICK_ACTIONS[action]
      setPendingAction(null)
      setInstruction('')
      setParameterValues({})
      setSystemOverride(null)
      setUserOverride(null)
      setPromptPanelOpen(false)
      await onQuickAction(action, next.instruction)
    })
  }

  const submit = () => {
    const value = instruction.trim()
    if (!value) return
    void runExclusiveSubmission(async () => {
      if (pendingAction) {
        await onQuickAction(pendingAction, value, runOptions)
        setPendingAction(null)
        setParameterValues({})
        setSystemOverride(null)
        setUserOverride(null)
        setPromptPanelOpen(false)
      } else {
        await onSend(value, interactionMode, runOptions)
      }
      setInstruction('')
    })
  }

  const originalText = task?.sourceText || task?.selection?.text || ''
  const selectionDiff = useMemo(
    () => task?.selection && task.candidate ? buildChapterDiff(task.selection.text, task.candidate) : null,
    [task?.candidate, task?.selection],
  )
  const hasCandidate = task?.status === 'completed' && !!task.candidate && task.applyMode !== 'none'
  const guardedOutput = task?.status === 'stopped' || task?.status === 'failed'
    ? task.partialOutput || task.candidate
    : task?.status === 'blocked' ? task.candidate : undefined
  const outlineReady = linked.goalSummary.trim().length > 0
  const scopeLabel = task?.selection
    ? `选中 ${task.selection.text.length.toLocaleString()} 字`
    : task?.candidate
      ? '当前待采纳稿'
      : '整章正文'

  return (
    <aside
      className="sf-chapter-assistant flex h-full min-h-0 shrink-0 flex-col border-l border-border bg-bg-surface"
      style={{ '--chapter-ai-width': `${panelWidth}px` } as React.CSSProperties}
      aria-label="章节协作区"
    >
      <div
        role="separator"
        aria-label="调整 AI 面板宽度"
        aria-orientation="vertical"
        aria-valuemin={MIN_ASSISTANT_WIDTH}
        aria-valuemax={Math.round(typeof window === 'undefined' ? 1200 : window.innerWidth * 0.7)}
        aria-valuenow={Math.round(panelWidth)}
        tabIndex={0}
        className={`sf-chapter-assistant-resizer ${resizing ? 'is-resizing' : ''}`}
        onPointerDown={event => { event.preventDefault(); setResizing(true) }}
        onDoubleClick={() => setPanelWidth(DEFAULT_ASSISTANT_WIDTH)}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const delta = event.key === 'ArrowLeft' ? 20 : -20
          const maxWidth = Math.max(MIN_ASSISTANT_WIDTH, window.innerWidth * 0.7)
          setPanelWidth(width => Math.min(maxWidth, Math.max(MIN_ASSISTANT_WIDTH, width + delta)))
        }}
      />
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {activeTab === 'assistant' ? <Sparkles className="h-4 w-4 text-accent" /> : <ListChecks className="h-4 w-4 text-accent" />}
            {activeTab === 'assistant' ? 'AI 协作' : '章节关联'}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {activeTab === 'assistant' ? '完整上下文参与判断，确认后才写入正文' : '大纲、记忆、事实与审校集中在这里'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {activeTab === 'assistant' && (
            <button
              type="button"
              onClick={onClear}
              disabled={session.messages.length === 0 && !session.activeTask}
              className="p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
              aria-label="清空本章 AI 对话"
              title="清空本章对话"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={onClose} className="p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary" aria-label="关闭章节协作区">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 border-b border-border" role="tablist" aria-label="章节协作区视图">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'assistant'}
          onClick={() => onTabChange('assistant')}
          className={`border-b-2 px-3 py-2 text-xs ${activeTab === 'assistant' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          写作对话
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'links'}
          onClick={() => onTabChange('links')}
          className={`border-b-2 px-3 py-2 text-xs ${activeTab === 'links' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          关联资料
        </button>
      </div>

      {activeTab === 'assistant' ? (
        <>
          <div className="shrink-0 border-b border-border/70 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex">
                <button
                  type="button"
                  onClick={() => runDefaultQuickAction('generate')}
                  disabled={assistantBusy || !outlineReady}
                  className="inline-flex items-center gap-1.5 border border-accent/45 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15 disabled:opacity-40"
                  title={outlineReady ? '直接按章纲与项目资料生成候选' : '请先补齐本章章纲'}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {hasText ? '重写整章' : '生成正文'}
                </button>
                <button
                  type="button"
                  onClick={() => prepareQuickAction('generate')}
                  disabled={assistantBusy || !outlineReady}
                  className="border-y border-r border-accent/45 bg-accent/10 px-2 text-accent hover:bg-accent/15 disabled:opacity-40"
                  aria-label="带要求生成正文"
                  title="带要求生成 / 查看本次 Prompt"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => runDefaultQuickAction('continue')}
                disabled={assistantBusy || !hasText || !outlineReady}
                className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs disabled:opacity-40 ${pendingAction === 'continue' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
              >
                <FilePenLine className="h-3.5 w-3.5" />续写
              </button>
              <button
                type="button"
                onClick={() => runDefaultQuickAction('deai')}
                disabled={assistantBusy || !hasText}
                className={`border px-3 py-1.5 text-xs disabled:opacity-40 ${pendingAction === 'deai' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
              >
                去 AI 味
              </button>
            </div>

            {!outlineReady && (
              <div className="mt-2 flex items-center justify-between gap-3 border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11px] text-warning">
                <span>本章还没有章纲，生成与续写会暂停，避免 AI 脱离规划创作。</span>
                <button type="button" onClick={linked.onOpenOutline} className="shrink-0 underline underline-offset-2 hover:text-text-primary">打开章纲</button>
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
              <span className="border border-accent/25 bg-accent/10 px-2 py-1 text-accent">修改范围：{scopeLabel}</span>
              <span className="border border-border bg-bg-elevated px-2 py-1">读取范围：整章 + 章纲 + 项目资料</span>
              {task?.selection && (
                <button
                  type="button"
                  onClick={onRevealSelection}
                  disabled={!selectionValid}
                  className="inline-flex items-center gap-1 border border-accent/30 bg-accent/10 px-2 py-1 text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
                  title={selectionValid ? '将正文滚动到当前锁定范围' : '选区已经失效，请重新选择'}
                >
                  <LocateFixed className="h-3 w-3" />回到选区
                </button>
              )}
              {task?.selection && (
                <button type="button" onClick={onUseWholeChapterScope} className="border border-border px-2 py-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary">切换为整章</button>
              )}
              {!!session.contextMeta?.trimmed.length && (
                <span className="border border-warning/30 bg-warning/10 px-2 py-1 text-warning">{session.contextMeta.trimmed.length} 项因总窗口裁剪</span>
              )}
            </div>
            {session.contextMeta && (
              <details className="mt-2 border border-border bg-bg-elevated text-[10px] text-text-muted">
                <summary className="cursor-pointer px-2.5 py-2 text-text-secondary hover:text-text-primary">
                  {session.contextMeta.phase === 'preparing'
                    ? `正在装配本轮上下文 · 计划读取 ${session.contextMeta.planned?.length ?? 0} 类资料`
                    : `本次实际读取 ${session.contextMeta.included.length} 类资料 · 约 ${session.contextMeta.totalInputTokens.toLocaleString()} tokens`}
                </summary>
                <div className="space-y-2 border-t border-border px-2.5 py-2.5">
                  {session.contextMeta.model && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 border border-border bg-bg-surface px-2 py-2 text-text-secondary">
                      <span>创作模型</span><span className="text-right text-text-primary">{session.contextMeta.model}</span>
                      <span>上下文窗口</span><span className="text-right text-text-primary">{session.contextMeta.contextWindowTokens?.toLocaleString() ?? '未知'} token</span>
                      <span>本次输入</span><span className="text-right text-text-primary">{session.contextMeta.phase === 'assembled' ? session.contextMeta.totalInputTokens.toLocaleString() : '装配中'} token</span>
                      <span>输出上限</span><span className="text-right text-text-primary">{session.contextMeta.maxOutputTokens?.toLocaleString() ?? '未知'} token</span>
                    </div>
                  )}
                  {session.contextMeta.phase === 'preparing' && !!session.contextMeta.planned?.length && (
                    <p>准备读取：{session.contextMeta.planned.map(contextSourceLabel).join('、')}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {session.contextMeta.included.map(key => (
                      <span key={key} className="bg-bg-surface px-1.5 py-1 text-text-secondary">
                        {contextSourceLabel(key)}
                        {contextTokensByKey.get(key) != null
                          ? ` · ${contextTokensByKey.get(key)!.toLocaleString()}t`
                          : ''}
                      </span>
                    ))}
                  </div>
                  {!!session.contextMeta.omitted?.length && (
                    <p>本轮没有内容：{session.contextMeta.omitted.map(contextSourceLabel).join('、')}</p>
                  )}
                  {session.contextMeta.omitted?.includes('detailedOutline') && (
                    <p className="text-text-secondary">未发现有效场景细纲，本轮将完整按章纲正常生成。</p>
                  )}
                  {!!cappedSourceKeys.length && (
                    <p className="text-warning">来源自身限额：{cappedSourceKeys.map(contextSourceLabel).join('、')} 已按各自动态上限截短。</p>
                  )}
                  {!!session.contextMeta.trimmed.length && (
                    <p className="text-warning">总窗口裁剪：本次输入超过实际模型窗口，未发送 {session.contextMeta.trimmed.map(contextSourceLabel).join('、')}。</p>
                  )}
                  {!!session.contextMeta.compressed?.length && (
                    <p className="text-accent">AI 语义压缩：{session.contextMeta.compressed.map(contextSourceLabel).join('、')} 已摘要，实体清单仍完整保留。</p>
                  )}
                  {!!session.contextMeta.protectedSources?.length && (
                    <p>保护来源（存在时完整保留）：{session.contextMeta.protectedSources.map(contextSourceLabel).join('、')}</p>
                  )}
                </div>
              </details>
            )}
            {task?.selection && <p className="mt-2 line-clamp-2 border border-accent/30 bg-bg-elevated px-2.5 py-2 text-[11px] leading-5 text-text-secondary">“{task.selection.text}”</p>}
            {task?.selection && !selectionValid && <p className="mt-2 border border-danger/30 bg-danger/10 px-2.5 py-2 text-[11px] text-danger">锁定范围已因正文编辑而失效，旧候选不可采纳；请按当前正文重新生成。</p>}
          </div>

          <div
            ref={scrollRef}
            className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
            onScroll={event => {
              const viewport = event.currentTarget
              nearBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 72
              if (nearBottomRef.current) setHasUnreadOutput(false)
            }}
          >
            {session.messages.length === 0 && !assistantBusy && (
              <div className="border border-dashed border-border px-4 py-5 text-center">
                <MessageSquareText className="mx-auto h-5 w-5 text-text-muted" />
                <p className="mt-2 text-xs font-medium text-text-secondary">告诉 AI 这章要怎么写</p>
                <p className="mt-1 text-[11px] leading-5 text-text-muted">“生成正文”可直接按章纲生成；有额外要求时点旁边箭头。框选只锁定写回范围，AI 仍读取整章与项目资料。</p>
              </div>
            )}

            {session.messages.map(message => (
              <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : message.role === 'status' ? 'flex justify-center' : 'flex justify-start'}>
                <div className={message.role === 'user'
                  ? 'max-w-[80%] bg-accent/12 px-3 py-2.5 text-xs leading-6 text-text-primary'
                  : message.role === 'status'
                    ? 'max-w-[92%] text-center text-[11px] text-text-muted'
                    : 'max-w-[85%] border border-border bg-bg-elevated px-3 py-2.5 text-xs leading-6 text-text-primary'}
                >
                  {message.role !== 'status' && <p className={`mb-1 text-[10px] font-medium ${message.role === 'user' ? 'text-accent' : 'text-text-muted'}`}>{message.role === 'user' ? '你' : 'AI'}</p>}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                {message.id === lastDiscussionMessageId && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                    {[
                      ['按建议修改', '把刚才讨论中指出的问题直接修改掉，只输出原选区的替换正文。'],
                      ['润色', '根据刚才的讨论润色原选区，保持事实与人物口吻不变。'],
                      ['扩写', '根据刚才的讨论扩写原选区，只补充有效细节。'],
                      ['缩写', '根据刚才的讨论精简原选区，保留关键信息。'],
                      ['重新改写', '根据刚才的讨论重新改写原选区，解决已指出的问题。'],
                    ].map(([label, followup]) => (
                      <button key={label} type="button" onClick={() => { void runExclusiveSubmission(() => onSend(followup, 'edit')) }} disabled={assistantBusy} className="border border-border px-2 py-1 text-[10px] text-text-secondary hover:bg-bg-hover hover:text-accent disabled:opacity-40">{label}</button>
                    ))}
                  </div>
                )}
                </div>
              </div>
            ))}

            {task?.status === 'generating' && !stream.isStreaming && (
              <div className="border border-accent/35 bg-bg-elevated px-3 py-2.5" role="status">
                <div className="flex items-center gap-2 text-[11px] text-accent"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在整理连续性并装配本轮上下文…</div>
                <p className="mt-1 text-[10px] leading-5 text-text-muted">任务已经锁定，请稍候；不会重复发起相同请求。</p>
              </div>
            )}

            {stream.isStreaming && (
              <div className="border border-accent/35 bg-bg-elevated px-3 py-2.5">
                <div className="flex items-center gap-2 text-[11px] text-accent"><Loader2 className="h-3.5 w-3.5 animate-spin" />AI 正在处理当前指令</div>
                {stream.reasoning && (
                  <details className="mt-2 text-[11px] text-text-muted">
                    <summary className="cursor-pointer">查看思考过程</summary>
                    <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap">{stream.reasoning}</p>
                  </details>
                )}
                {stream.output && <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-text-primary">{stream.output}</p>}
                <button type="button" onClick={stream.stop} className="mt-3 inline-flex items-center gap-1 border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover">
                  <Square className="h-3 w-3" />停止
                </button>
              </div>
            )}

            {stream.error && task?.status !== 'failed' && (
              <div className="border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <p>{stream.error}</p>
                {task && (
                    <button type="button" onClick={() => { void runExclusiveSubmission(() => onRetry(runOptions)) }} disabled={assistantBusy} className="mt-2 inline-flex items-center gap-1 border border-danger/30 px-2 py-1 text-[11px] hover:bg-danger/10 disabled:opacity-40">
                    <RefreshCw className="h-3 w-3" />按原指令重试
                  </button>
                )}
              </div>
            )}

            {task && ['stopped', 'failed', 'blocked'].includes(task.status) && (
              <div className="border border-warning/35 bg-warning/10 px-3 py-2.5 text-xs text-text-secondary">
                <p className="font-medium text-warning">
                  {task.status === 'stopped' ? '未完成输出' : task.status === 'blocked' ? '候选已被安全守卫拦截' : '本轮生成失败'}
                </p>
                <p className="mt-1 text-[11px] leading-5">
                  {task.status === 'stopped'
                    ? task.partialOutput
                      ? `已保留 ${task.partialOutput.replace(/\s/g, '').length.toLocaleString()} 字未完成正文。可以先查看或复制，再从保留内容继续补齐。`
                      : '停止生成后的内容可能缺少结尾，不能直接采纳。'
                    : task.status === 'failed' && task.partialOutput
                      ? `连接中断前的 ${task.partialOutput.replace(/\s/g, '').length.toLocaleString()} 字已经保留。可复制、从断点继续，或按当前正文重新生成。`
                      : task.blockedReason || task.failureMessage || '正文没有发生变化，原指令和已有内容仍然保留。'}
                </p>
                {guardedOutput && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-text-muted">查看保留的输出</summary>
                    <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border border-border bg-bg-surface px-2 py-2 leading-6 text-text-primary">{guardedOutput}</p>
                  </details>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {guardedOutput && (
                    <button type="button" onClick={() => { void getRuntime().clipboard.writeText('chapter-ai-output', guardedOutput) }} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[11px] hover:bg-bg-hover">
                      <Copy className="h-3 w-3" />复制输出
                    </button>
                  )}
                  {task.partialOutput && task.status !== 'blocked' && (
                    <button type="button" onClick={() => { void runExclusiveSubmission(() => onResumePartial(runOptions)) }} disabled={assistantBusy || !selectionValid} className="inline-flex items-center gap-1 border border-accent/35 bg-accent/10 px-2 py-1 text-[11px] text-accent hover:bg-accent/15 disabled:opacity-40">
                      <FilePenLine className="h-3 w-3" />从保留内容继续
                    </button>
                  )}
                  <button type="button" onClick={() => { void runExclusiveSubmission(() => onRetry(runOptions)) }} disabled={assistantBusy} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[11px] hover:bg-bg-hover disabled:opacity-40">
                    <RefreshCw className="h-3 w-3" />按当前正文重新生成
                  </button>
                  <button type="button" onClick={onDiscard} className="border border-border px-2 py-1 text-[11px] hover:bg-bg-hover">放弃</button>
                </div>
              </div>
            )}
            {hasUnreadOutput && (
              <button type="button" onClick={scrollToBottom} className="sticky bottom-0 left-1/2 z-10 mx-auto block -translate-x-1/2 border border-accent/30 bg-bg-elevated px-3 py-1.5 text-[11px] text-accent shadow-theme-md">有新输出，回到底部</button>
            )}
          </div>

          {hasCandidate && centralReviewActive && (
            <div className="shrink-0 border-t border-accent/25 bg-accent/10 px-4 py-2.5 text-[11px] leading-5 text-text-secondary">
              整章候选已在正文区打开审阅；可以继续对话提出修改要求，写回范围仍锁定为整章。
            </div>
          )}

          {hasCandidate && task?.candidate && !centralReviewActive && (
            <div className="max-h-[42%] shrink-0 border-t border-border bg-bg-elevated/70">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="flex gap-3 text-[11px]">
                  <button type="button" onClick={() => setResultView('candidate')} className={resultView === 'candidate' ? 'text-accent' : 'text-text-muted hover:text-text-primary'}>候选结果</button>
                  <button type="button" onClick={() => setResultView('compare')} disabled={!originalText} className={`${resultView === 'compare' ? 'text-accent' : 'text-text-muted hover:text-text-primary'} disabled:opacity-35`}>
                    <GitCompare className="mr-1 inline h-3 w-3" />原文对照
                  </button>
                </div>
                <button type="button" onClick={() => { void runExclusiveSubmission(() => onRetry(runOptions)) }} disabled={assistantBusy} className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary disabled:opacity-40">
                  <RefreshCw className="h-3 w-3" />重新生成
                </button>
              </div>
              <div className="max-h-[45vh] overflow-y-auto px-4 py-3 text-xs leading-6">
                {selectionDiff && (
                  <p className="mb-3 border-b border-border/70 pb-2 text-[11px] text-text-muted">
                    原文 {selectionDiff.stats.originalCharacters.toLocaleString()} 字 → 候选 {selectionDiff.stats.candidateCharacters.toLocaleString()} 字 · {selectionDiff.stats.deltaPercent > 0 ? `增加 ${selectionDiff.stats.deltaPercent}%` : selectionDiff.stats.deltaPercent < 0 ? `减少 ${Math.abs(selectionDiff.stats.deltaPercent)}%` : '篇幅不变'} · 锁定原选区
                  </p>
                )}
                {resultView === 'candidate' ? (
                  <p className="whitespace-pre-wrap text-text-primary">{task.candidate}</p>
                ) : selectionDiff ? (
                  <div className="space-y-3" aria-label="选区字词差异">
                    {selectionDiff.rows.map((row, rowIndex) => (
                      <p key={rowIndex} className="whitespace-pre-wrap text-text-primary">
                        {row.kind === 'modified' && row.pieces
                          ? row.pieces.map((piece, pieceIndex) => piece.kind === 'delete'
                            ? <del key={pieceIndex} className="bg-danger/15 text-danger decoration-danger/70">{piece.value}</del>
                            : piece.kind === 'insert'
                              ? <ins key={pieceIndex} className="bg-success/15 text-success no-underline">{piece.value}</ins>
                              : <span key={pieceIndex}>{piece.value}</span>)
                          : row.kind === 'deleted'
                            ? <del className="bg-danger/15 text-danger">{row.original}</del>
                            : row.kind === 'added'
                              ? <ins className="bg-success/15 text-success no-underline">{row.candidate}</ins>
                              : row.candidate}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div><p className="mb-1 text-[10px] text-danger">原文</p><p className="whitespace-pre-wrap bg-danger/5 px-2 py-1.5 text-text-secondary line-through decoration-danger/35">{originalText}</p></div>
                    <div><p className="mb-1 text-[10px] text-success">候选</p><p className="whitespace-pre-wrap bg-success/5 px-2 py-1.5 text-text-primary">{task.candidate}</p></div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 border-t border-border px-4 py-3">
                <button type="button" onClick={onApply} disabled={!selectionValid} className="inline-flex flex-1 items-center justify-center gap-1.5 bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40">
                  <Check className="h-3.5 w-3.5" />{applyLabel(task.applyMode)}
                </button>
                <button type="button" onClick={onDiscard} className="border border-border px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary">放弃</button>
                {task.selection && <button type="button" onClick={() => { setInteractionMode('edit'); instructionRef.current?.focus() }} className="border border-border px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary">继续修改</button>}
              </div>
            </div>
          )}

            <div className="max-h-[58%] shrink-0 overflow-y-auto border-t border-border bg-bg-surface p-3">
              {task?.selection && (
                <p className="mb-2 border border-accent/25 bg-accent/10 px-2.5 py-2 text-[11px] leading-5 text-text-secondary">当前锁定原选区。可以继续讨论，也可以直接让 AI 修改这段。</p>
              )}
            {pendingAction ? (
              <div className="mb-2 flex items-center justify-between border border-accent/30 bg-accent/10 px-2.5 py-2 text-[11px]">
                <span className="text-accent">本轮将{QUICK_ACTIONS[pendingAction].label}，可先修改要求与 Prompt</span>
                <button type="button" onClick={cancelQuickAction} className="text-text-muted hover:text-text-primary">取消</button>
              </div>
            ) : (
              <div className="mb-2 flex w-fit border border-border bg-bg-elevated p-0.5 text-[11px]" role="group" aria-label="AI 回复方式">
                <button type="button" onClick={() => setInteractionMode('auto')} className={`px-2.5 py-1 ${interactionMode === 'auto' ? 'bg-bg-surface text-accent' : 'text-text-muted'}`}>自动判断</button>
                <button type="button" onClick={() => setInteractionMode('edit')} className={`px-2.5 py-1 ${interactionMode === 'edit' ? 'bg-bg-surface text-accent' : 'text-text-muted'}`}>生成候选</button>
                <button type="button" onClick={() => setInteractionMode('discuss')} className={`px-2.5 py-1 ${interactionMode === 'discuss' ? 'bg-bg-surface text-accent' : 'text-text-muted'}`}>仅讨论</button>
              </div>
            )}
            <div className="mb-2">
              <PromptRunPanel
                moduleKey={promptModuleKey}
                parameterValues={parameterValues}
                onParamChange={setParameterValues}
                systemOverride={systemOverride}
                onSystemOverrideChange={setSystemOverride}
                userOverride={userOverride}
                onUserOverrideChange={setUserOverride}
                open={promptPanelOpen}
                onOpenChange={setPromptPanelOpen}
              />
            </div>
            <div className="border border-border bg-bg-elevated focus-within:border-accent">
              <CTextarea
                ref={instructionRef}
                value={instruction}
                onChange={event => setInstruction(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    submit()
                  }
                }}
                placeholder={pendingAction ? '补充本次生成要求…' : task?.selection ? '继续修改这段文字…' : task?.candidate ? '继续调整当前候选…' : '例如：写第一章，开场直接从婚礼现场切入…'}
                rows={3}
                disabled={assistantBusy}
                className="w-full resize-none bg-transparent px-3 py-2 text-xs leading-5 text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
                aria-label="给 AI 的本章指令"
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-[10px] text-text-muted">
                  {pendingAction
                    ? '先生成候选，确认后才写入正文'
                    : interactionMode === 'auto'
                      ? resolvedInputMode === 'edit'
                        ? task?.selection ? '本轮将生成选区候选' : '本轮将生成正文候选'
                        : '本轮只进行讨论'
                      : interactionMode === 'edit'
                        ? '输出候选，确认后写入'
                        : '只给建议，不生成候选'}
                </span>
                <button type="button" onClick={submit} disabled={!instruction.trim() || assistantBusy} className="inline-flex items-center gap-1 bg-accent px-2 py-1.5 text-[11px] text-white hover:bg-accent-hover disabled:opacity-40" aria-label={pendingAction ? `开始${QUICK_ACTIONS[pendingAction].label}` : '发送指令'}>
                  <Send className="h-3.5 w-3.5" />{pendingAction ? '开始' : '发送'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="border-b border-border px-4 py-4">
            <SectionTitle>本章任务</SectionTitle>
            <p className="mt-2 text-sm font-medium text-text-primary">{linked.goalTitle}</p>
            <p className="mt-1 text-xs leading-6 text-text-secondary">{linked.goalSummary || '尚未填写章纲摘要。建议先补齐本章目标，再让 AI 生成正文。'}</p>
          </section>

          <section className="border-b border-border px-4 py-4">
            <ChapterMemoryPanel
              compact
              summary={linked.memorySummary}
              hasText={hasText}
              memoryBusy={linked.memoryBusy}
              reconciliation={linked.reconciliation}
              reconciliationCurrent={linked.reconciliationCurrent}
              onGenerateMemory={linked.onGenerateMemory}
              onConfirmActualProgress={linked.onConfirmProgress}
              onApplyOutlineCandidate={linked.onApplyOutlineCandidate}
            />
            {linked.autoStatus && <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-success"><Loader2 className="h-3 w-3 animate-spin" />{linked.autoStatus}</p>}
          </section>

          {linked.factCandidates.length > 0 && (
            <section className="border-b border-border px-4 py-4">
              <SectionTitle>长期事实候选</SectionTitle>
              <div className="mt-3">
                <ChapterFactCandidateWorkspace
                  candidates={linked.factCandidates}
                  busy={linked.factBusy}
                  onUpdate={linked.onUpdateFactCandidate}
                  onConfirm={linked.onConfirmFactCandidates}
                  onReject={linked.onRejectFactCandidates}
                  onOpenLibrary={linked.onOpenFactLibrary}
                />
              </div>
            </section>
          )}

          <section className="border-b border-border px-4 py-4">
            <SectionTitle>联动检查</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <WorkspaceButton icon={<ListChecks className="h-3.5 w-3.5" />} label="提取状态" detail={linked.pendingStateCount ? `${linked.pendingStateCount} 条待审核` : '角色、地点、物品'} busy={linked.stateBusy} disabled={!hasText} onClick={linked.onExtractState} />
              <WorkspaceButton icon={<NotebookPen className="h-3.5 w-3.5" />} label="提取长期事实" detail={linked.factInfo || '人物位置、状态、目标、物品、认知和关系'} busy={linked.factBusy} disabled={!hasText} onClick={linked.onExtractFacts} />
              <WorkspaceButton icon={<GitCompare className="h-3.5 w-3.5" />} label="影响分析" detail={linked.impactInfo || '历史章修改后的下游影响'} busy={linked.impactBusy} disabled={!hasText} onClick={linked.onAnalyzeImpact} />
              <WorkspaceButton icon={<ShieldCheck className="h-3.5 w-3.5" />} label="质量审校" detail="连续性、人物与语言" disabled={!hasText} onClick={linked.onOpenReview} />
            </div>
          </section>

          <section className="border-b border-border px-4 py-4">
            <SectionTitle>创作资料</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <WorkspaceButton icon={<BookOpen className="h-3.5 w-3.5" />} label="大纲预览" detail="章纲与场景细纲" onClick={linked.onOpenOutline} />
              <WorkspaceButton icon={<Brain className="h-3.5 w-3.5" />} label="情感节拍" detail="情绪曲线与转折" onClick={linked.onOpenEmotion} />
              <WorkspaceButton icon={<StickyNote className="h-3.5 w-3.5" />} label="项目便签" detail="章节关联便签" onClick={linked.onOpenNotes} />
              <WorkspaceButton icon={<WandSparkles className="h-3.5 w-3.5" />} label="AI 上下文" detail={`${session.contextMeta?.included.length ?? 0} 项最近读取`} onClick={() => onTabChange('assistant')} />
            </div>
          </section>

          <section className="px-4 py-4">
            <SectionTitle>作者笔记</SectionTitle>
            <textarea
              value={linked.notes}
              onChange={event => linked.onNotesChange(event.target.value)}
              rows={5}
              placeholder="只给自己看的本章备忘…"
              className="mt-3 w-full resize-y border border-border bg-bg-elevated px-3 py-2 text-xs leading-5 text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </section>
        </div>
      )}
    </aside>
  )
}
