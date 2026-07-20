import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ListChecks, Sparkles } from 'lucide-react'
import { useChapterStore } from '../../stores/chapter'
import { useOutlineStore } from '../../stores/outline'
import { useStateCardStore } from '../../stores/state-card'
import { useCharacterStore } from '../../stores/character'
import { useAIStream } from '../../hooks/useAIStream'
import { createAISessionKey, useAIGenerationSessionStore } from '../../stores/ai-generation-session'
import {
  createChapterAssistantTask,
  selectChapterAssistantSession,
  useChapterAssistantStore,
  type ChapterAssistantAction,
  type ChapterAssistantApplyMode,
  type ChapterAssistantInteractionMode,
  type ChapterAssistantTask,
} from '../../stores/chapter-ai-chat'
import { useAutoSave } from '../../hooks/useAutoSave'
import { useBeforeUnload } from '../../hooks/useBeforeUnload'
import {
  buildChapterAssistantConversationHistory,
  buildChapterAssistantPrompt,
  buildChapterContentPrompt,
  buildContinuePrompt,
  buildPolishPrompt,
  buildExpandPrompt,
  buildDeAIPrompt,
  type RunOptions,
} from '../../lib/ai/adapters/chapter-adapter'
import { resolveChapterAssistantMode } from '../../lib/ai/chapter-assistant-intent'
import { buildReviewRevisePrompt, type ReviewResult } from '../../lib/ai/adapters/review-adapter'
import { buildStateExtractPrompt, parseStateDiffs } from '../../lib/ai/adapters/state-extract-adapter'
import { buildFactExtractPrompt, parseFactExtractResult } from '../../lib/ai/adapters/fact-extract-adapter'
import { useFactLedgerStore } from '../../stores/fact-ledger'
import { rebuildChapterChunks, ensureChunkEmbeddings, rebuildProjectNarrativeSummaries } from '../../lib/retrieval/retrieval'
import { isEmbeddingReady } from '../../lib/ai/adapters/embedding-adapter'
import { propagateChapterEditStale, analyzeEditImpact } from '../../lib/consistency/impact-analysis'
import { runChapterMemoryTask } from '../../lib/ai/chapter-memory/run-chapter-memory'
import { prepareContinuityContext } from '../../lib/ai/chapter-memory/continuity-context'
import { isPlanReconciliationCurrent } from '../../lib/ai/chapter-memory/plan-reconciliation'
import { findNextCanonicalChapter, findPreviousCanonicalChapter } from '../../lib/ai/chapter-memory/canonical-chapter-sequence'
import { chat, resolveRequestConfig, type ResolvedRequestConfig } from '../../lib/ai/client'
import { db } from '../../lib/db/schema'
import { buildGenreConstraintContext } from '../../lib/ai/genre-metadata'
import { buildStylePromptInjection } from '../../lib/ai/writing-styles'
import { assembleContext } from '../../lib/registry/assemble-context'
import { adopt } from '../../lib/registry/adopt'
import { resolveChapterDisplayMeta } from '../../lib/outline/chapter-display'
import { pickBestChapterForOutline } from '../../lib/chapters/selectors'
import { useCreativeRulesStore } from '../../stores/project-singletons'
import { useStoryArcStore } from '../../stores/story-arc'
import { useForeshadowStore } from '../../stores/foreshadow'
import { htmlToPlainText, plainTextToHtml, plainTextToInlineHtml, countWords } from '../../lib/utils/html'
import { useDialog } from '../shared/Dialog'
import { useAIConfigStore } from '../../stores/ai-config'
import { getModelPreset } from '../../lib/ai/context-budget'
import StateDiffModal from '../state/StateDiffModal'
import RichEditor, { type RichEditorHandle } from './RichEditor'
import EmotionBeatCard from './EmotionBeatCard'
import OutlinePreview from '../outline/OutlinePreview'
import ReviewPanel from './ReviewPanel'
import NotePanel from './NotePanel'
import FloatingToolbar from './FloatingToolbar'
import type { SelectionAIAction } from './FloatingToolbar'
import ChapterAIAssistantPanel, { type ChapterAssistantPanelTab } from './ChapterAIAssistantPanel'
import ComparePolishPanel from './ComparePolishPanel'
import ChapterEditorHeader from './ChapterEditorHeader'
import ChapterCandidateReview from './ChapterCandidateReview'
import ChapterContextPreview from './ChapterContextPreview'
import { useItemLedgerStore } from '../../stores/item-ledger'
import { useLocationStore } from '../../stores/location'
import { useCodexStore } from '../../stores/codex'
import { buildEditorEntityReferences } from '../../lib/editor/entity-reference'
import type {
  EditorSelectionPresentation,
  EditorSelectionSnapshot,
} from '../../lib/editor/selection-snapshot'
import { inspectSelectionCandidate } from '../../lib/editor/selection-candidate-guard'
import { inspectChapterCandidate } from '../../lib/editor/chapter-candidate-guard'
import { sha256Text } from '../../lib/ai/chapter-memory/text-normalization'
import {
  applyChapterCandidate,
  ChapterCandidateConflictError,
  hashChapterContentState,
  readChapterContentState,
  replaceWholeChapterContent,
  type ChapterAdoptionReceipt,
  undoChapterAdoption,
} from '../../lib/editor/chapter-candidate-adoption'
import { useBackupStore } from '../../stores/backup'
import type { ChatMessage, Project, StateDiffItem } from '../../lib/types'
import type { FactCandidatePatch } from '../../lib/fact-ledger/fact-ledger'

/** 生成任务类型(原 memory-builder 三层记忆已被 assembleContext 取代,此类型仅用于调试日志标签) */
type MemoryTaskType = 'write' | 'plan' | 'review'

const CHAPTER_AI_BASE_SOURCE_KEYS = [
  'contextMemo', 'chapterOutline', 'detailedOutline', 'chapterContinuityHandoff',
  'previousPlanReconciliation', 'previousChapterEnding', 'recentChapterSummaries',
  'worldview', 'storyCore', 'powerSystem', 'codex', 'characters', 'creativeRules',
  'worldRules', 'historical', 'locations', 'foreshadows', 'storyArcs', 'emotionBeats',
  'stateCards', 'currentFacts', 'heldItems', 'retrievedPassages', 'references',
  'userStyleProfile',
]

const CHAPTER_AI_PROTECTED_SOURCE_KEYS = ['chapterOutline', 'detailedOutline']

interface Props {
  project: Project
  outlineNodeId?: number | null
  onOpenFactLibrary?: () => void
  onAssistantOpenChange?: (open: boolean) => void
}

const CHAPTER_ASSISTANT_OPEN_KEY = 'storyforge.chapter-ai.open'

export default function ChapterEditor({ project, outlineNodeId, onOpenFactLibrary, onAssistantOpenChange }: Props) {
  const {
    chapters,
    currentChapter,
    selectChapter,
    getOrCreateByOutlineNode,
    updateChapter,
    refreshChapter,
    loadAll: loadChapters,
  } = useChapterStore()
  const { nodes, updateNode } = useOutlineStore()
  const { cards: stateCards, loadAll: loadStateCards, buildStateContext, buildSelectiveStateContext, applyDiffs } = useStateCardStore()
  const { characters, loadAll: loadCharacters } = useCharacterStore()
  const { creativeRules } = useCreativeRulesStore()
  const { loadAll: loadArcs } = useStoryArcStore()
  const { buildForeshadowContext, loadAll: loadForeshadows } = useForeshadowStore()
  const { entries: itemEntries, loadAll: loadItemLedger } = useItemLedgerStore()
  const { locations, loadAll: loadLocations } = useLocationStore()
  const { categories: codexCategories, entries: codexEntries, loadExisting: loadCodex } = useCodexStore()
  const factLedgerFacts = useFactLedgerStore(state => state.facts)

  // content 为 HTML 字符串；旧数据是纯文本，RichEditor 内部会自动包装
  const [content, setContent] = useState('')
  const [plainText, setPlainText] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualSaveError, setManualSaveError] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(CHAPTER_ASSISTANT_OPEN_KEY) === 'true'
  })
  const [assistantTab, setAssistantTab] = useState<ChapterAssistantPanelTab>('assistant')
  const [extracting, setExtracting] = useState(false)
  const [extractingFacts, setExtractingFacts] = useState(false)
  const [factInfo, setFactInfo] = useState<string | null>(null)
  const [factBatchIds, setFactBatchIds] = useState<number[]>([])
  const [impactInfo, setImpactInfo] = useState<string | null>(null)
  const [analyzingImpact, setAnalyzingImpact] = useState(false)
  const [pendingDiffs, setPendingDiffs] = useState<StateDiffItem[] | null>(null)
  // A2: 按需召回 — 手动额外勾选/取消的状态卡 ID
  const [extraStateIds, setExtraStateIds] = useState<number[]>([])
  const [showStatePreview, setShowStatePreview] = useState(false)
  const assistantSessionKey = createAISessionKey(
    project.id!,
    'chapter.assistant',
    currentChapter?.id ?? outlineNodeId ?? 'unselected',
  )
  const ai = useAIStream(assistantSessionKey)
  const assistantSession = useChapterAssistantStore(useMemo(
    () => selectChapterAssistantSession(assistantSessionKey),
    [assistantSessionKey],
  ))
  const chapterFactCandidates = useMemo(
    () => factLedgerFacts.filter(fact => (
      fact.sourceChapterId === currentChapter?.id
      && fact.status === 'candidate'
      && (factBatchIds.length === 0 || (fact.id != null && factBatchIds.includes(fact.id)))
    )),
    [currentChapter?.id, factBatchIds, factLedgerFacts],
  )
  const stateAI = useAIStream()
  const memoryAI = useAIStream()
  const factAI = useAIStream()
  const editorRef = useRef<RichEditorHandle>(null)
  const memoryRebuildInFlightRef = useRef(new Set<number>())
  const creatingChapterForOutlineRef = useRef(new Set<number>())
  // Phase A1: 自动流程标记
  const [autoProcessing, setAutoProcessing] = useState<'idle' | 'extracting' | 'memory'>('idle')
  const [showOutlinePreview, setShowOutlinePreview] = useState(false)
  const [showReviewPanel, setShowReviewPanel] = useState(false)
  const [showNotePanel, setShowNotePanel] = useState(false)
  const [showEmotionPanel, setShowEmotionPanel] = useState(false)
  const [compareSourceHtml, setCompareSourceHtml] = useState<string | null>(null)
  const [floatingSelection, setFloatingSelection] = useState<EditorSelectionPresentation | null>(null)
  const [assistantSelectionValid, setAssistantSelectionValid] = useState(true)
  const [lastAdoptionReceipt, setLastAdoptionReceipt] = useState<ChapterAdoptionReceipt | null>(null)
  const [planReconciliationCurrent, setPlanReconciliationCurrent] = useState(false)
  const aiConfig = useAIConfigStore(s => s.config)
  const dialog = useDialog()

  useEffect(() => {
    window.localStorage.setItem(CHAPTER_ASSISTANT_OPEN_KEY, String(assistantOpen))
    onAssistantOpenChange?.(assistantOpen)
  }, [assistantOpen, onAssistantOpenChange])

  useEffect(() => {
    useChapterAssistantStore.getState().hydrateSession(assistantSessionKey)
  }, [assistantSessionKey])
  const runningAssistantTaskId = assistantSession.activeTask?.status === 'generating'
    ? assistantSession.activeTask.id
    : null
  useEffect(() => {
    if (!runningAssistantTaskId) return
    const persistPartialOutput = () => {
      const output = useAIGenerationSessionStore.getState().sessions[assistantSessionKey]?.output.trim()
      if (!output) return
      useChapterAssistantStore.getState().patchRunningTask(
        assistantSessionKey,
        runningAssistantTaskId,
        { partialOutput: output },
      )
    }
    const interval = window.setInterval(persistPartialOutput, 1_000)
    return () => {
      window.clearInterval(interval)
      persistPartialOutput()
    }
  }, [assistantSessionKey, runningAssistantTaskId])
  useEffect(() => {
    if (project.id != null) void useFactLedgerStore.getState().load(project.id)
  }, [project.id])
  useEffect(() => {
    setFloatingSelection(null)
    setFactBatchIds([])
    setAssistantSelectionValid(true)
  }, [currentChapter?.id])
  useEffect(() => { setAssistantSelectionValid(true) }, [assistantSession.activeTask?.id])

  // 字数（基于纯文本）
  const wordCount = useMemo(() => countWords(plainText), [plainText])

  // 有未保存内容时阻止页面关闭
  useBeforeUnload(content !== savedContent && plainText.length > 0)

  useEffect(() => { loadChapters(project.id!) }, [project.id, loadChapters])
  useEffect(() => { loadStateCards(project.id!) }, [project.id, loadStateCards])
  useEffect(() => { loadCharacters(project.id!) }, [project.id, loadCharacters])
  useEffect(() => { loadArcs(project.id!) }, [project.id, loadArcs])
  useEffect(() => { loadForeshadows(project.id!) }, [project.id, loadForeshadows])
  useEffect(() => { loadItemLedger(project.id!) }, [project.id, loadItemLedger])
  useEffect(() => { loadLocations(project.id!) }, [project.id, loadLocations])
  useEffect(() => { loadCodex(project.id!) }, [project.id, loadCodex])

  // 如果从大纲进入，选择/创建对应章节（自动创建）
  useEffect(() => {
    if (!outlineNodeId) return
    const existing = pickBestChapterForOutline(chapters.filter(c => c.outlineNodeId === outlineNodeId))
    if (existing?.id) {
      selectChapter(existing.id)
      return
    }

    const node = nodes.find(n => n.id === outlineNodeId)
    if (!node || creatingChapterForOutlineRef.current.has(outlineNodeId)) return

    creatingChapterForOutlineRef.current.add(outlineNodeId)
    void getOrCreateByOutlineNode(project.id!, outlineNodeId, {
      title: node.title,
      content: '', wordCount: 0, status: 'outline', order: chapters.length, notes: '',
    })
      .then(chapter => {
        if (chapter.id) selectChapter(chapter.id)
      })
      .finally(() => {
        creatingChapterForOutlineRef.current.delete(outlineNodeId)
      })
  }, [outlineNodeId, chapters, selectChapter, nodes, getOrCreateByOutlineNode, project.id])

  const persistCurrentEditorContent = useCallback(async (): Promise<{ html: string; plain: string; wordCount: number } | null> => {
    if (!currentChapter?.id) return null
    const html = editorRef.current?.getHTML() ?? content
    const plain = editorRef.current?.getPlainText() ?? htmlToPlainText(html)
    const wc = countWords(plain)
    await updateChapter(currentChapter.id, { content: html, wordCount: wc })
    setContent(html)
    setPlainText(plain)
    setSavedContent(html)
    return { html, plain, wordCount: wc }
  }, [content, currentChapter?.id, updateChapter])

  const handleManualSave = useCallback(async () => {
    if (manualSaving) return
    setManualSaving(true)
    setManualSaveError('')
    try {
      await persistCurrentEditorContent()
    } catch (error) {
      setManualSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setManualSaving(false)
    }
  }, [manualSaving, persistCurrentEditorContent])

  // 切换章节：同步到本地 state（RichEditor 会基于 value 重建内容）
  useEffect(() => {
    const raw = currentChapter?.content || ''
    setContent(raw)
    setPlainText(htmlToPlainText(raw))
  }, [currentChapter])

  // 切换章节时同步 savedContent（只在章节 id 变化时）
  useEffect(() => {
    setSavedContent(currentChapter?.content || '')
    setManualSaveError('')
  }, [currentChapter?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- 保存基线只在切章时重置，自动保存不能重置脏状态

  useEffect(() => {
    setCompareSourceHtml(null)
  }, [currentChapter?.id])

  useEffect(() => {
    let cancelled = false
    if (!currentChapter?.planReconciliation) {
      setPlanReconciliationCurrent(false)
      return
    }
    isPlanReconciliationCurrent(project.id!, currentChapter).then(current => {
      if (!cancelled) setPlanReconciliationCurrent(current)
    })
    return () => { cancelled = true }
  }, [project.id, currentChapter])

  // 自动保存
  useAutoSave(content, useCallback(async (html: string) => {
    if (currentChapter?.id) {
      const wc = countWords(htmlToPlainText(html))
      await updateChapter(currentChapter.id, { content: html, wordCount: wc })
      setSavedContent(html)
    }
  }, [currentChapter?.id, updateChapter]))

  const outlineNode = currentChapter ? nodes.find(n => n.id === currentChapter.outlineNodeId) : null
  const chapterDisplay = useMemo(() => {
    return currentChapter ? resolveChapterDisplayMeta(currentChapter, nodes) : null
  }, [currentChapter, nodes])
  // 多世界：沿父链找到所属卷的 worldGroupId
  const chapterWorldGroupId = useMemo(() => {
    if (!project.enableMultiWorld || !outlineNode) return null
    let cur: typeof outlineNode | undefined = outlineNode
    const guard = new Set<number>()
    while (cur && !guard.has(cur.id!)) {
      if (cur.worldGroupId != null) return cur.worldGroupId
      guard.add(cur.id!)
      cur = cur.parentId != null ? nodes.find(n => n.id === cur!.parentId) : undefined
    }
    return null
  }, [project.enableMultiWorld, outlineNode, nodes])
  const entityReferences = useMemo(() => buildEditorEntityReferences({
    characters,
    itemEntries,
    locations,
    codexCategories,
    codexEntries,
    worldGroupId: project.enableMultiWorld ? chapterWorldGroupId : undefined,
  }), [characters, itemEntries, locations, codexCategories, codexEntries, project.enableMultiWorld, chapterWorldGroupId])

  const [worldCtx, setWorldCtx] = useState('')
  const [charCtx, setCharCtx] = useState('')
  useEffect(() => {
    let cancelled = false
    assembleContext({
      projectId: project.id!,
      worldGroupId: chapterWorldGroupId ?? null,
      outlineNodeId: outlineNode?.id ?? null,
      chapterId: currentChapter?.id ?? null,
      provider: aiConfig.provider,
      model: aiConfig.model,
      sourceKeys: ['contextMemo', 'chapterOutline', 'worldview', 'storyCore', 'powerSystem', 'codex', 'characters', 'creativeRules', 'worldRules', 'historical', 'locations', 'userStyleProfile'],
    }).then(assembled => {
      if (cancelled) return
      const charIdx = assembled.included.indexOf('characters')
      setWorldCtx(assembled.segments
        .filter((_, index) => assembled.included[index] !== 'characters')
        .map(segment => segment.content)
        .join('\n\n'))
      setCharCtx(charIdx >= 0 ? assembled.segments[charIdx]?.content ?? '' : '')
    })
    return () => { cancelled = true }
  }, [project.id, chapterWorldGroupId, outlineNode?.id, currentChapter?.id, aiConfig.provider, aiConfig.model])

  // A2: 按需召回 — 根据章节大纲+标题+已有文本筛选相关状态卡
  const selectiveState = useMemo(() => {
    if (!stateCards.length) return { text: '', matchedIds: [] as number[], allIds: [] as number[] }
    const refParts: string[] = []
    if (outlineNode?.title) refParts.push(outlineNode.title)
    if (outlineNode?.summary) refParts.push(outlineNode.summary)
    if (currentChapter?.title) refParts.push(currentChapter.title)
    if (plainText) refParts.push(plainText.slice(-2000))
    const ref = refParts.join(' ')
    if (!ref.trim()) return { text: buildStateContext(), matchedIds: stateCards.map(c => c.id!), allIds: stateCards.map(c => c.id!) }
    return buildSelectiveStateContext(ref, extraStateIds)
  }, [stateCards, outlineNode?.title, outlineNode?.summary, currentChapter?.title, plainText, extraStateIds, buildSelectiveStateContext, buildStateContext])

  const handleCreateFromOutline = async () => {
    if (!outlineNodeId) return
    const node = nodes.find(n => n.id === outlineNodeId)
    if (!node) return
    const chapter = await getOrCreateByOutlineNode(project.id!, outlineNodeId, {
      title: node.title,
      content: '', wordCount: 0, status: 'outline', order: chapters.length, notes: '',
    })
    if (chapter.id) selectChapter(chapter.id)
  }

  const handleOpenComparePolish = async () => {
    const saved = await persistCurrentEditorContent()
    if (!saved?.plain.trim()) {
      await dialog.alert({ title: '暂无正文可供对照', message: '请先写入或生成本章正文，再打开对照润色。' })
      return
    }
    setCompareSourceHtml(saved.html)
  }

  // AI 操作 —— 所有 AI 交互都基于纯文本
  // Phase A2: 使用三层记忆构建器生成完整上下文
  const rebuildChapterMemoryById = async (chapterId: number): Promise<void> => {
    if (memoryRebuildInFlightRef.current.has(chapterId)) return
    const chapter = await db.chapters.get(chapterId)
    if (!chapter?.content?.trim()) return
    const chapterTitle = nodes.find(node => node.id === chapter.outlineNodeId)?.title || chapter.title
    memoryRebuildInFlightRef.current.add(chapterId)
    try {
      const result = await runChapterMemoryTask({
        projectId: project.id!,
        chapterId,
        chapterTitle,
        chapterContent: chapter.content,
        call: messages => chat(messages, aiConfig, {
          category: 'chapter.memory',
          projectId: project.id!,
        }),
      })
      if (result.status === 'written') await refreshChapter(chapterId)
    } catch (error) {
      console.warn('[ChapterMemory] 惰性重建失败，继续使用 tail 降级:', error)
    } finally {
      memoryRebuildInFlightRef.current.delete(chapterId)
    }
  }

  const prepareContinuityBeforeGeneration = async (): Promise<number[]> => {
    if (!currentChapter?.id) return []
    const snapshot = await prepareContinuityContext({
      projectId: project.id!,
      chapterId: currentChapter.id,
    })
    if (snapshot.anomalies.length) {
      console.warn('[ChapterMemory] 规范章节序列 anomalies:', snapshot.anomalies)
    }
    const predecessorId = snapshot.predecessor?.chapter.id
    if (predecessorId != null && snapshot.memoryRebuildCandidateIds.includes(predecessorId)) {
      // 直接前驱优先且同步补建；失败仍由真实 tail 保底。
      await rebuildChapterMemoryById(predecessorId)
    }
    return snapshot.memoryRebuildCandidateIds
      .filter(id => id !== predecessorId)
      .slice(-4)
  }

  const scheduleRecentMemoryRebuild = (chapterIds: number[]) => {
    if (!chapterIds.length) return
    void (async () => {
      for (const chapterId of chapterIds) await rebuildChapterMemoryById(chapterId)
    })()
  }

  const buildFullWorldCtx = async (
    taskType: MemoryTaskType = 'write',
    options?: {
      includeChapterContent?: boolean
      manualSourceText?: string
      chapterContentOverride?: string
      preparedRequest: ResolvedRequestConfig
    },
  ) => {
    // 引用手法注入（Phase 20）
    let citedIds: number[] = []
    try {
      citedIds = JSON.parse(creativeRules?.citedReferenceIds || '[]')
    } catch { /* ignore */ }

    const stateRef = [
      outlineNode?.title,
      outlineNode?.summary,
      currentChapter?.title,
      (options?.chapterContentOverride ?? plainText).slice(-2000),
    ].filter(Boolean).join(' ')

    const sourceKeys = [
      ...(options?.manualSourceText ? ['manualText'] : []),
      ...(options?.includeChapterContent ? ['chapterContent'] : []),
      ...CHAPTER_AI_BASE_SOURCE_KEYS,
    ]
    const assembled = await assembleContext({
      projectId: project.id!,
      worldGroupId: chapterWorldGroupId ?? null,
      outlineNodeId: outlineNode?.id ?? null,
      chapterId: currentChapter?.id ?? null,
      currentChapterOrder: currentChapter?.order ?? 0,
      provider: options?.preparedRequest.config.provider,
      model: options?.preparedRequest.config.model,
      contextWindowTokens: options?.preparedRequest.config.contextWindow,
      maxOutputTokens: options?.preparedRequest.config.maxTokens,
      citedReferenceIds: citedIds,
      stateReferenceText: stateRef,
      extraStateIds,
      manualSourceText: options?.manualSourceText,
      sourceContentOverrides: options?.includeChapterContent
        ? { chapterContent: options.chapterContentOverride ?? plainText }
        : undefined,
      sourceKeys,
      // 章纲由业务层验证为硬前置；细纲可选，但存在时不得被静默截断或裁掉。
      protectedSourceKeys: CHAPTER_AI_PROTECTED_SOURCE_KEYS,
    })

    console.log(`[assembleContext] ${taskType} 模式 — included:${assembled.included.join(',')} trimmed:${assembled.trimmed.join(',') || 'none'} tokens:${assembled.totalInputTokens}`)

    // Phase E: 题材约束 + 写作风格注入
    const genreCtx = buildGenreConstraintContext(project.genres?.length ? project.genres : project.genre)
    const styleCtx = project.writingStyleId ? buildStylePromptInjection(project.writingStyleId) : ''

    const segmentFor = (key: string) => {
      const index = assembled.included.indexOf(key)
      return index >= 0 ? assembled.segments[index]?.content ?? '' : ''
    }
    const separatelyInjectedKeys = new Set([
      'manualText',
      'chapterContent',
      'characters',
      'chapterContinuityHandoff',
      'previousPlanReconciliation',
      'previousChapterEnding',
      'recentChapterSummaries',
    ])
    const assembledSegmentsWithoutContinuity = assembled.segments
      .filter((_, index) => !separatelyInjectedKeys.has(assembled.included[index]))
    const assembledWithoutContinuity = assembledSegmentsWithoutContinuity
      .map(segment => segment.content)
      .join('\n\n')
    const parts = [assembledWithoutContinuity]
    if (genreCtx) parts.push(genreCtx)
    if (styleCtx) parts.push(styleCtx)
    const worldRulesIdx = assembled.included.indexOf('worldRules')
    const effectiveConfig = options?.preparedRequest.config ?? aiConfig
    const maxContext = effectiveConfig.contextWindow && effectiveConfig.contextWindow > 0
      ? effectiveConfig.contextWindow
      : getModelPreset(effectiveConfig.provider, effectiveConfig.model).maxContext
    const continuityBudgetTokens = maxContext <= 8_192 ? 3000 : maxContext <= 32_768 ? 6000 : 10_000
    return {
      text: parts.filter(Boolean).join('\n\n'),
      segments: assembledSegmentsWithoutContinuity,
      included: assembled.included,
      sources: assembled.included.map((key, index) => ({
        key,
        tokens: assembled.segments[index]?.tokens ?? 0,
      })),
      omitted: assembled.omitted,
      trimmed: assembled.trimmed,
      compressed: assembled.compressed ?? [],
      sourceLimits: assembled.sourceLimits ?? [],
      inputBudgetTokens: assembled.inputBudget,
      totalInputTokens: assembled.totalInputTokens,
      manualText: segmentFor('manualText'),
      chapterContent: segmentFor('chapterContent'),
      characterContext: segmentFor('characters'),
      worldRulesContext: worldRulesIdx >= 0 ? assembled.segments[worldRulesIdx]?.content ?? '' : '',
      continuity: {
        handoff: segmentFor('chapterContinuityHandoff'),
        planReconciliation: segmentFor('previousPlanReconciliation'),
        previousTail: segmentFor('previousChapterEnding'),
        recentSummaries: segmentFor('recentChapterSummaries'),
      },
      continuityBudgetTokens,
    }
  }

  type FullWorldContext = Awaited<ReturnType<typeof buildFullWorldCtx>>

  const editContractFor = (mode: ChapterAssistantApplyMode): string => {
    if (mode === 'replace-selection') {
      return '只输出“本轮可写目标”内部的替换正文。完整正文和前后邻文仅供理解；不得回显、续写或改写任何选区外文字，也不得输出设定、解释、标题或 Markdown。'
    }
    if (mode === 'append-chapter') {
      return '只输出要追加在当前正文末尾的新正文，不得重复已有正文，不加解释或 Markdown。'
    }
    if (mode === 'replace-chapter') {
      return '只输出可直接替换整章的完整正文，不加解释、标题或 Markdown。'
    }
    return '以对话形式回答作者的问题，给出清晰判断和可执行建议；本轮不产出待写回正文。'
  }

  const buildRecipeContext = (
    action: ChapterAssistantAction,
    targetText: string,
    instruction: string,
    runOptions?: RunOptions,
  ): string => {
    let recipeMessages: ChatMessage[] = []
    if (action === 'polish' || action === 'condense' || action === 'rewrite') {
      recipeMessages = buildPolishPrompt(targetText, instruction, runOptions)
    } else if (action === 'expand') {
      recipeMessages = buildExpandPrompt(targetText, instruction, runOptions)
    } else if (action === 'deai') {
      recipeMessages = buildDeAIPrompt(targetText, runOptions)
    }
    return recipeMessages
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n\n')
  }

  const runAssistantTask = async (
    task: ChapterAssistantTask,
    instruction: string,
    customMessageBuilder?: (context: FullWorldContext) => ChatMessage[],
    options: {
      appendUserMessage?: boolean
      promptRunOptions?: RunOptions
      responseApplyMode?: ChapterAssistantApplyMode
      preserveSourceText?: boolean
    } = {},
  ) => {
    if (!outlineNode || ai.isStreaming) return
    setAssistantOpen(true)
    setAssistantTab('assistant')
    const requiresChapterOutline = task.action === 'generate'
      || task.action === 'continue'
      || (task.applyMode === 'replace-chapter' && !plainText.trim())
    if (requiresChapterOutline && !outlineNode.summary.trim()) {
      setShowOutlinePreview(true)
      await dialog.alert({
        title: '请先补齐本章章纲',
        message: '正文生成必须读取本章章纲。当前章节只有标题，没有章纲内容；请先在大纲预览中填写或生成章纲。',
      })
      return
    }
    const assistantStore = useChapterAssistantStore.getState()
    const priorMessages = assistantStore.sessions[assistantSessionKey]?.messages ?? []
    const iteration = task.iteration ?? 0
    const editorTextAtRequest = editorRef.current?.getPlainText() ?? plainText
    const editorHtmlAtRequest = editorRef.current?.getHTML() ?? content
    const chapterContentHash = await hashChapterContentState({
      html: editorHtmlAtRequest,
      plainText: editorTextAtRequest,
    })
    const effectiveTask: ChapterAssistantTask = {
      ...task,
      instruction,
      iteration,
      chapterId: currentChapter?.id,
      chapterContentHash,
      chapterTailAnchor: task.action === 'continue' ? editorTextAtRequest.slice(-256) : undefined,
      sourceText: task.sourceText
        ?? task.selection?.text
        ?? (task.applyMode === 'replace-chapter' ? editorTextAtRequest : ''),
      status: 'generating',
    }
    const responseApplyMode = options.responseApplyMode ?? effectiveTask.applyMode
    effectiveTask.lastResponseApplyMode = responseApplyMode
    if (!assistantStore.claimTaskRun(assistantSessionKey, effectiveTask)) return
    if (options.appendUserMessage !== false) {
      assistantStore.appendMessage(assistantSessionKey, {
        role: 'user',
        content: instruction,
        taskId: task.id,
      })
    }

    try {
    let backgroundMemoryIds: number[] = []
    if ((task.action === 'generate' || task.action === 'continue') && iteration === 0) {
      backgroundMemoryIds = await prepareContinuityBeforeGeneration()
    }

    const initialGenerate = task.action === 'generate' && iteration === 0
    const category = customMessageBuilder
      ? task.action === 'review' ? 'review.revise' : 'chapter.assistant'
      : initialGenerate
        ? 'chapter.content'
        : task.action === 'continue' && iteration === 0
          ? 'chapter.continue'
          : 'chapter.assistant'
    const requestMeta = { category, projectId: project.id! }
    const preparedRequest = resolveRequestConfig(aiConfig, requestMeta)
    assistantStore.setContextMeta(assistantSessionKey, {
      phase: 'preparing',
      planned: [
        ...(effectiveTask.selection ? ['manualText'] : []),
        ...(!initialGenerate || Boolean(editorTextAtRequest.trim()) ? ['chapterContent'] : []),
        ...CHAPTER_AI_BASE_SOURCE_KEYS,
      ],
      included: [],
      omitted: [],
      trimmed: [],
      protectedSources: CHAPTER_AI_PROTECTED_SOURCE_KEYS,
      totalInputTokens: 0,
      provider: preparedRequest.config.provider,
      model: preparedRequest.config.model,
      contextWindowTokens: preparedRequest.config.contextWindow,
      maxOutputTokens: preparedRequest.config.maxTokens,
    })
    const fullContext = await buildFullWorldCtx(
      task.action === 'check' ? 'review' : 'write',
      {
        includeChapterContent: !initialGenerate || Boolean(editorTextAtRequest.trim()),
        manualSourceText: effectiveTask.selection?.text,
        chapterContentOverride: editorTextAtRequest,
        preparedRequest,
      },
    )
    assistantStore.setContextMeta(assistantSessionKey, {
      phase: 'assembled',
      planned: [
        ...(effectiveTask.selection ? ['manualText'] : []),
        ...(!initialGenerate || Boolean(editorTextAtRequest.trim()) ? ['chapterContent'] : []),
        ...CHAPTER_AI_BASE_SOURCE_KEYS,
      ],
      included: fullContext.included,
      sources: fullContext.sources,
      omitted: fullContext.omitted,
      trimmed: fullContext.trimmed,
      compressed: fullContext.compressed,
      sourceLimits: fullContext.sourceLimits,
      protectedSources: CHAPTER_AI_PROTECTED_SOURCE_KEYS,
      totalInputTokens: fullContext.totalInputTokens,
      inputBudgetTokens: fullContext.inputBudgetTokens,
      provider: preparedRequest.config.provider,
      model: preparedRequest.config.model,
      contextWindowTokens: preparedRequest.config.contextWindow,
      maxOutputTokens: preparedRequest.config.maxTokens,
    })

    let messages: ChatMessage[]
    if (customMessageBuilder) {
      messages = customMessageBuilder(fullContext)
    } else if (task.action === 'generate' && iteration === 0) {
      const generationContext = [
        fullContext.text,
        fullContext.chapterContent
          ? `【当前章节完整正文（只读）】\n${fullContext.chapterContent}`
          : '',
      ].filter(Boolean).join('\n\n')
      messages = buildChapterContentPrompt(
        outlineNode.title,
        outlineNode.summary,
        generationContext,
        fullContext.characterContext,
        fullContext.continuity.previousTail,
        fullContext.worldRulesContext,
        instruction,
        {
          ...options.promptRunOptions,
          continuity: fullContext.continuity,
          continuityBudgetTokens: fullContext.continuityBudgetTokens,
        },
      )
    } else if (task.action === 'continue' && iteration === 0) {
      const contextWithCharacters = fullContext.characterContext
        ? `${fullContext.text}\n\n【角色设定】\n${fullContext.characterContext}`
        : fullContext.text
      messages = buildContinuePrompt(
        fullContext.chapterContent || plainText,
        outlineNode.summary,
        contextWithCharacters,
        instruction,
        {
          ...options.promptRunOptions,
          continuity: fullContext.continuity,
          continuityBudgetTokens: fullContext.continuityBudgetTokens,
        },
      )
    } else {
      const targetText = fullContext.manualText || effectiveTask.selection?.text || fullContext.chapterContent || plainText
      const currentChapterReference = fullContext.chapterContent
        ? `【当前章节完整正文（只读）】\n${fullContext.chapterContent}`
        : ''
      const readOnlyContext = [
        fullContext.text,
        fullContext.characterContext ? `【角色设定】\n${fullContext.characterContext}` : '',
        currentChapterReference,
      ].filter(Boolean).join('\n\n')
      messages = buildChapterAssistantPrompt({
        chapterTitle: outlineNode.title || currentChapter?.title || '未命名章节',
        chapterSummary: outlineNode.summary || '',
        instruction,
        editContract: editContractFor(responseApplyMode),
        readOnlyContext,
        targetText,
        beforeText: effectiveTask.selection?.beforeText,
        afterText: effectiveTask.selection?.afterText,
        currentCandidate: effectiveTask.candidate,
        conversationHistory: buildChapterAssistantConversationHistory(priorMessages),
        recipeContext: buildRecipeContext(effectiveTask.action, targetText, instruction, options.promptRunOptions),
      }, effectiveTask.action === 'ask' || iteration > 0 ? options.promptRunOptions : undefined)
    }

    ai.setOperation(effectiveTask.action)
    const outcome = await ai.startWithOutcome(
      messages,
      undefined,
      { category: category, projectId: project.id! },
      preparedRequest,
    )
    const latestStore = useChapterAssistantStore.getState()
    const candidate = outcome.output.trim()
    const latestTask = latestStore.sessions[assistantSessionKey]?.activeTask
    if (latestTask?.id !== effectiveTask.id) {
      scheduleRecentMemoryRebuild(backgroundMemoryIds)
      return
    }
    if (outcome.status === 'stopped') {
      const retainedPartialOutput = candidate || latestTask.partialOutput || effectiveTask.partialOutput
      if (!latestStore.settleTaskRun(assistantSessionKey, effectiveTask.id, {
        ...latestTask,
        candidate: latestTask.candidate ?? effectiveTask.candidate,
        partialOutput: retainedPartialOutput || undefined,
        status: 'stopped',
      })) return
      latestStore.appendMessage(assistantSessionKey, {
        role: 'status',
        content: candidate
          ? `生成已停止，保留了 ${countWords(candidate)} 字未完成输出；可使用“从保留内容继续”补齐。`
          : retainedPartialOutput
            ? `本轮生成已停止；此前保留的 ${countWords(retainedPartialOutput)} 字未完成输出仍然可继续。`
            : '生成已停止，本次没有产生可用输出。',
        taskId: task.id,
      })
      ai.reset()
      scheduleRecentMemoryRebuild(backgroundMemoryIds)
      return
    }
    if (outcome.status === 'failed' || !candidate) {
      const failureMessage = outcome.error === 'Failed to fetch'
        ? 'AI 连接在输出过程中中断'
        : outcome.error || 'AI 没有返回可用内容'
      const retainedPartialOutput = candidate || latestTask.partialOutput || effectiveTask.partialOutput
      if (!latestStore.settleTaskRun(assistantSessionKey, effectiveTask.id, {
        ...latestTask,
        candidate: latestTask.candidate ?? effectiveTask.candidate,
        partialOutput: retainedPartialOutput || undefined,
        failureMessage,
        status: 'failed',
      })) return
      latestStore.appendMessage(assistantSessionKey, {
        role: 'status',
        content: candidate
          ? `本轮生成中断：${failureMessage}。中断前的 ${countWords(candidate)} 字已经保留。`
          : retainedPartialOutput
            ? `本轮生成失败：${failureMessage}。此前保留的 ${countWords(retainedPartialOutput)} 字未完成输出仍然可继续。`
            : `本轮生成失败：${failureMessage}。原指令与已有候选均已保留。`,
        taskId: task.id,
      })
      ai.reset()
      scheduleRecentMemoryRebuild(backgroundMemoryIds)
      return
    }

    if (responseApplyMode !== 'none') {
      const inspection = inspectChapterCandidate(candidate, responseApplyMode)
      if (!inspection.ok) {
        latestStore.appendMessage(assistantSessionKey, {
          role: 'status',
          content: `${inspection.reason} 系统已保留输出，但不会提供采纳入口。`,
          taskId: task.id,
        })
        if (!latestStore.settleTaskRun(assistantSessionKey, effectiveTask.id, {
          ...latestTask,
          candidate,
          blockedReason: inspection.reason,
          status: 'blocked',
        })) return
        ai.reset()
        scheduleRecentMemoryRebuild(backgroundMemoryIds)
        return
      }
    }

    if (responseApplyMode === 'replace-selection' && effectiveTask.selection) {
      const inspection = inspectSelectionCandidate(candidate, effectiveTask.selection)
      if (!inspection.ok) {
        latestStore.appendMessage(assistantSessionKey, {
          role: 'status',
          content: `${inspection.reason} 系统已拦截写回，请调整指令或重新生成。`,
          taskId: task.id,
        })
        if (!latestStore.settleTaskRun(assistantSessionKey, effectiveTask.id, {
          ...latestTask,
          candidate,
          blockedReason: inspection.reason,
          status: 'blocked',
        })) return
        ai.reset()
        scheduleRecentMemoryRebuild(backgroundMemoryIds)
        return
      }
    }

    if (!latestStore.settleTaskRun(assistantSessionKey, effectiveTask.id, {
      ...latestTask,
      instruction,
      sourceText: options.preserveSourceText
        ? effectiveTask.sourceText
        : effectiveTask.candidate || effectiveTask.sourceText,
      candidate: responseApplyMode === 'none' ? effectiveTask.candidate : candidate,
      partialOutput: undefined,
      failureMessage: undefined,
      blockedReason: undefined,
      iteration: iteration + 1,
      status: 'completed',
    })) return
    latestStore.appendMessage(assistantSessionKey, {
      role: 'assistant',
      content: responseApplyMode === 'none'
        ? candidate
        : `AI 已生成第 ${iteration + 1} 版${effectiveTask.label}候选 · ${countWords(candidate)} 字`,
      taskId: task.id,
    })
    ai.reset()
    scheduleRecentMemoryRebuild(backgroundMemoryIds)
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : String(error)
      const latestStore = useChapterAssistantStore.getState()
      const latestTask = latestStore.sessions[assistantSessionKey]?.activeTask
      if (latestTask?.id !== effectiveTask.id) return
      if (!latestStore.settleTaskRun(assistantSessionKey, effectiveTask.id, {
        ...latestTask,
        candidate: latestTask.candidate ?? effectiveTask.candidate,
        partialOutput: latestTask.partialOutput || effectiveTask.partialOutput,
        failureMessage,
        status: 'failed',
      })) return
      latestStore.appendMessage(assistantSessionKey, {
        role: 'status',
        content: `本轮任务失败：${failureMessage}。原指令与已有候选均已保留。`,
        taskId: task.id,
      })
    }
  }

  const handleGenerate = async (
    instruction = '严格按照本章章纲与项目设定生成正文。',
    promptRunOptions?: RunOptions,
  ) => {
    if (!outlineNode) return
    await runAssistantTask(createChapterAssistantTask({
      action: 'generate',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction,
    }), instruction, undefined, { promptRunOptions })
  }

  const handleContinue = async (
    instruction = '从当前正文结尾自然续写，推进本章目标，不要重复已有内容。',
    promptRunOptions?: RunOptions,
  ) => {
    if (!plainText || !outlineNode) return
    await runAssistantTask(createChapterAssistantTask({
      action: 'continue',
      label: '正文末尾',
      applyMode: 'append-chapter',
      instruction,
    }), instruction, undefined, { promptRunOptions })
  }

  const runSelectionAction = async (
    action: SelectionAIAction,
    snapshot: EditorSelectionSnapshot,
  ) => {
    if (snapshot.text.length >= 5000) {
      await dialog.alert({
        title: '选区过长',
        message: `当前选区 ${snapshot.text.length.toLocaleString()} 字，超过局部修改上限。请缩小范围或切换为整章修改。`,
      })
      return
    }
    const assistantStore = useChapterAssistantStore.getState()
    const currentTask = assistantStore.sessions[assistantSessionKey]?.activeTask
    if (currentTask?.status === 'completed' && currentTask.candidate) {
      const replacePending = await dialog.confirm({
        title: '切换到新的选区？',
        message: '当前还有一份未采纳候选。切换选区会放弃这份候选，但不会修改正文。',
        confirmText: '切换选区',
      })
      if (!replacePending) return
    }
    const instructions: Record<SelectionAIAction, string> = {
      ask: '',
      polish: '优化选中段落的文笔与节奏，保持原意、人物口吻和事实不变。',
      expand: '扩写选中段落，补充有效动作、感官和心理细节，不改变情节走向。',
      condense: '精简选中段落到原长度的 60%—70%，保留关键动作、信息和人物口吻。',
      rewrite: '换一种更自然有力的表达改写选中段落，保持核心意思和连续性。',
      check: '检查选中段落的逻辑、用词、语法、角色状态和前后连续性，列出具体问题与建议。',
    }
    const task = createChapterAssistantTask({
      action,
      label: `选中段落 · ${countWords(snapshot.text)} 字`,
      applyMode: action === 'check' ? 'none' : 'replace-selection',
      instruction: instructions[action],
      selection: snapshot,
      sourceText: snapshot.text,
      sourceTextHash: await sha256Text(snapshot.text),
    })
    setAssistantOpen(true)
    setAssistantTab('assistant')
    // 浮动框只负责锁定范围和预填意图；实际发送统一由右侧协作区完成。
    assistantStore.setTask(assistantSessionKey, task)
    setAssistantSelectionValid(true)
  }

  const handleDeAI = async (
    instruction = '降低模板化和 AI 腔，改善句式、节奏与细节选择；保持篇幅、事实、情节和人物口吻基本不变。',
    promptRunOptions?: RunOptions,
  ) => {
    if (!plainText.trim()) return
    await runAssistantTask(createChapterAssistantTask({
      action: 'deai',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction,
    }), instruction, undefined, { promptRunOptions })
  }

  const handleSendAssistant = async (
    instruction: string,
    interactionMode: ChapterAssistantInteractionMode,
    promptRunOptions?: RunOptions,
  ) => {
    const resolvedMode = resolveChapterAssistantMode(interactionMode, instruction)
    const currentTask = useChapterAssistantStore.getState().sessions[assistantSessionKey]?.activeTask
    if (currentTask) {
      if (resolvedMode === 'discuss') {
        await runAssistantTask({
          ...currentTask,
          instruction,
          sourceText: currentTask.candidate || currentTask.sourceText,
          status: 'draft',
        }, instruction, undefined, { promptRunOptions, responseApplyMode: 'none' })
        return
      }
      const applyMode: ChapterAssistantApplyMode = currentTask.selection
          ? 'replace-selection'
          : currentTask.applyMode === 'append-chapter'
            ? 'append-chapter'
            : 'replace-chapter'
      await runAssistantTask({
        ...currentTask,
        applyMode,
        instruction,
        sourceText: currentTask.candidate || currentTask.sourceText,
        status: 'draft',
      }, instruction, undefined, { promptRunOptions })
      return
    }
    await runAssistantTask(createChapterAssistantTask({
      action: 'ask',
      label: resolvedMode === 'discuss' ? '本章讨论' : '整章正文',
      applyMode: resolvedMode === 'discuss' ? 'none' : 'replace-chapter',
      instruction,
      sourceText: plainText,
    }), instruction, undefined, { promptRunOptions })
  }

  const handleRetryAssistant = async (promptRunOptions?: RunOptions) => {
    const task = useChapterAssistantStore.getState().sessions[assistantSessionKey]?.activeTask
    if (!task?.instruction || ai.isStreaming) return
    await runAssistantTask(task, task.instruction, undefined, {
      appendUserMessage: false,
      promptRunOptions,
      responseApplyMode: task.lastResponseApplyMode,
    })
  }

  const handleResumePartialAssistant = async (promptRunOptions?: RunOptions) => {
    const task = useChapterAssistantStore.getState().sessions[assistantSessionKey]?.activeTask
    const partialOutput = task?.partialOutput?.trim()
    if (!task || !partialOutput || ai.isStreaming) return
    const resumeInstruction = [
      '上一轮生成因连接中断，只保留了未完成候选。',
      `原要求：${task.instruction}`,
      '请严格保留当前候选已经完成的内容与顺序，在其基础上补齐缺失部分，并输出一份从开头到结尾完整、可直接采纳的候选正文。不要解释中断，不要输出 Markdown。',
    ].join('\n')
    await runAssistantTask({
      ...task,
      candidate: partialOutput,
      partialOutput,
      failureMessage: undefined,
      iteration: Math.max(1, task.iteration),
      status: 'draft',
    }, resumeInstruction, undefined, {
      promptRunOptions,
      responseApplyMode: task.lastResponseApplyMode ?? task.applyMode,
      preserveSourceText: true,
    })
  }

  // G8：按审校报告让 AI 改全文，结果也进入统一协作区。
  const handleReviseByReport = async (report: ReviewResult) => {
    if (!plainText.trim()) return
    const ok = await dialog.confirm({
      title: '按审校报告让 AI 改全文？',
      message: `将依据本章审校报告修改整章正文（约 ${countWords(plainText)} 字）。结果会先在 AI 协作区预览，确认后才替换。`,
      confirmText: '开始修改',
    })
    if (!ok) return
    const instruction = '依据刚才的审校报告修改整章正文，逐项解决问题，同时保持人物、事实、情节和篇幅稳定。'
    await runAssistantTask(createChapterAssistantTask({
      action: 'review',
      label: '整章正文 · 按审校报告',
      applyMode: 'replace-chapter',
      instruction,
    }), instruction, context => buildReviewRevisePrompt(
      context.chapterContent || plainText,
      report,
      context.text,
      context.characterContext,
    ))
  }

  // ── 状态提取 ──
  const handleExtractState = async () => {
    if (!currentChapter || !plainText) return
    setExtracting(true)
    try {
      const stateCtx = buildSelectiveStateContext(plainText, extraStateIds).text
      const chapterTitle = outlineNode?.title || currentChapter.title || '未知章节'
      const characterNames = characters.map(character => character.name)
      const messages = buildStateExtractPrompt(stateCtx, chapterTitle, plainText, characterNames)
      console.log('[StateExtract] 开始提取，章节:', chapterTitle)
      const raw = await stateAI.start(messages, undefined, { category: 'state.extract', projectId: project.id! })
      const { diffs, error } = parseStateDiffs(raw, characterNames)
      if (error) {
        console.error('[StateExtract] 解析失败:', error)
      }
      setPendingDiffs(diffs as StateDiffItem[])
    } catch (err) {
      console.error('[StateExtract] 提取失败:', err)
    } finally {
      setExtracting(false)
    }
  }

  // NS-4：从本章正文抽取事实候选，走 fact-ledger 单一入口写回（不裸写）。
  const handleExtractFacts = async () => {
    if (!currentChapter?.id || !plainText) return
    setExtractingFacts(true)
    setFactInfo(null)
    try {
      const chapterContent = editorRef.current?.getPlainText() ?? plainText
      const chapterTitle = outlineNode?.title || currentChapter.title || '未知章节'
      const messages = buildFactExtractPrompt({ chapterTitle, chapterContent })
      const raw = await factAI.start(messages, undefined, { category: 'fact.extract', projectId: project.id! })
      const candidates = parseFactExtractResult({ raw, chapterContent })
      const result = await useFactLedgerStore.getState().adopt({
        projectId: project.id!,
        sourceChapterId: currentChapter.id,
        worldGroupId: chapterWorldGroupId ?? null,
        candidates,
      })
      console.log(`[FactExtract] 抽取 ${candidates.length} 条，写入候选 ${result.written} 条`)
      setFactBatchIds(result.writtenIds)
      setFactInfo(candidates.length === 0 ? '未发现新增事实' : `${result.written} 条待确认`)
      setAssistantOpen(true)
      setAssistantTab('links')
    } catch (err) {
      console.error('[FactExtract] 失败:', err)
      setFactInfo('抽取失败，请重试')
    } finally {
      factAI.reset()
      setExtractingFacts(false)
    }
  }

  // NS-6：改了历史章后，传播 stale（证据失效的确认事实标记为 stale）+ 列出受影响后续章，交作者复核。
  // 只读·只提示·不自动改任何正文；不删事实、不动 locked。
  const handleEditImpact = async () => {
    if (!currentChapter?.id || !project.id) return
    setAnalyzingImpact(true)
    try {
      // 先把当前正文真正落盘，再据落盘正文判断证据是否失效
      await persistCurrentEditorContent()
      const { demotedFacts } = await propagateChapterEditStale(project.id, currentChapter.id)
      const { factsFromChapter, downstreamChapterIds } = await analyzeEditImpact(project.id, currentChapter.id)
      const parts = [
        `源自本章事实 ${factsFromChapter.length} 条`,
        demotedFacts > 0 ? `其中 ${demotedFacts} 条证据已失效→标记 stale 待复核` : '证据均仍成立',
        `建议复核后续 ${downstreamChapterIds.length} 章`,
      ]
      setImpactInfo(parts.join('；'))
    } catch (err) {
      console.error('[EditImpact] 失败:', err)
      setImpactInfo('影响分析失败，请重试')
    } finally {
      setAnalyzingImpact(false)
    }
  }

  const handleAcceptDiffs = async (accepted: StateDiffItem[]) => {
    try {
      await applyDiffs(project.id!, accepted, currentChapter?.id)
      console.log(`[StateExtract] ${accepted.length} 条变更已写入状态表`)
    } catch (err) {
      console.error('[StateExtract] 写入状态表失败:', err)
    }
    setPendingDiffs(null)
    stateAI.reset()
  }

  // ── NS-1: 单次生成 summary + continuity handoff ──
  const handleChapterMemory = async (task: {
    chapterId: number
    chapterTitle: string
    chapterContent: string
  }) => {
    setAutoProcessing('memory')
    try {
      console.log('[ChapterMemory] 开始统一抽取:', task.chapterTitle)
      const result = await runChapterMemoryTask({
        projectId: project.id!,
        ...task,
        call: messages => memoryAI.start(messages, undefined, {
          category: 'chapter.memory',
          projectId: project.id!,
        }),
      })
      if (result.status === 'written') {
        await refreshChapter(task.chapterId)
        console.log('[ChapterMemory] summary + handoff 已原子写回')
      } else if (result.status === 'stale') {
        console.warn('[ChapterMemory] 正文已变化，旧任务结果已丢弃')
      } else {
        console.error('[ChapterMemory] 结构化输出解析失败，保留真实 tail 降级')
      }
    } catch (err) {
      console.error('[ChapterMemory] 统一抽取失败，保留真实 tail 降级:', err)
    } finally {
      setAutoProcessing('idle')
      memoryAI.reset()
    }
  }

  const handleManualMemory = async () => {
    if (!currentChapter?.id || !plainText.trim() || autoProcessing === 'memory') return
    const chapterId = currentChapter.id
    const chapterTitle = outlineNode?.title || currentChapter.title || '未知章节'
    const persisted = await persistCurrentEditorContent()
    if (!persisted) return
    await handleChapterMemory({ chapterId, chapterTitle, chapterContent: persisted.html })
  }

  const handleConfirmActualProgress = async () => {
    if (!currentChapter?.id || !currentChapter.planReconciliation) return
    const reconciliation = currentChapter.planReconciliation
    const confirmedActualProgress = [
      ...reconciliation.completedGoals.map(item => `已完成：${item.text}`),
      ...reconciliation.deviations.map(item => `实际偏移：${item.text}`),
      ...reconciliation.newConstraints.map(item => `新增约束：${item.text}`),
      ...reconciliation.unfinishedGoals.map(item => `仍未完成：${item.text}`),
    ].join('；')
    await updateChapter(currentChapter.id, {
      planReconciliation: {
        ...reconciliation,
        reviewStatus: 'confirmed-constraint',
        confirmedActualProgress,
        reviewedAt: Date.now(),
      },
    })
  }

  const handleApplyOutlineCandidate = async () => {
    const reconciliation = currentChapter?.planReconciliation
    if (!currentChapter?.id || !outlineNode?.id || !reconciliation?.proposedOutlineSummary) return
    await updateNode(outlineNode.id, { summary: reconciliation.proposedOutlineSummary })
    await updateChapter(currentChapter.id, {
      planReconciliation: {
        ...reconciliation,
        reviewStatus: 'applied-outline',
        reviewedAt: Date.now(),
      },
    })
  }

  // ── Phase A1: 生成正文完成后的自动流程 ──
  // 接受 AI 生成的文本后，自动触发状态提取 → 一次统一章节记忆抽取。
  const handleAutoPostGenerate = async (task: {
    chapterId: number
    chapterTitle: string
    chapterContent: string
    chapterPlainText: string
  }) => {
    // 0. NS-5：重建本章检索块（非 AI，hash 守卫，便宜；供「相关前文召回」用）
    try {
      if (currentChapter) {
        await rebuildChapterChunks({
          projectId: project.id!,
          chapter: { ...currentChapter, content: task.chapterContent },
          worldGroupId: chapterWorldGroupId ?? null,
          knownEntities: characters.map(c => c.name),
        })
        await rebuildProjectNarrativeSummaries({ projectId: project.id! })
        // NS-5：若启用 embedding，后台为新块补语义向量（best-effort，不阻塞、失败退回关键词）
        const embCfg = useAIConfigStore.getState().embedding
        if (isEmbeddingReady(embCfg)) {
          void ensureChunkEmbeddings({ projectId: project.id!, cfg: embCfg })
            .catch(e => console.warn('[AutoPost] 语义索引补建失败（不影响）:', e))
        }
      }
    } catch (e) { console.error('[AutoPost] 检索块重建失败:', e) }

    // 1. 自动提取状态
    setAutoProcessing('extracting')
    try {
      const stateCtx = buildSelectiveStateContext(task.chapterPlainText, extraStateIds).text
      const characterNames = characters.map(character => character.name)
      const messages = buildStateExtractPrompt(stateCtx, task.chapterTitle, task.chapterPlainText, characterNames)
      console.log('[AutoPost] 自动提取状态:', task.chapterTitle)
      const raw = await stateAI.start(messages, undefined, { category: 'state.extract', projectId: project.id! })
      const { diffs, error } = parseStateDiffs(raw, characterNames)
      if (error) {
        console.error('[AutoPost] 状态提取解析失败:', error)
      }
      if (diffs.length > 0) {
        setPendingDiffs(diffs as StateDiffItem[])
      } else {
        console.log('[AutoPost] 本章无状态变更')
      }
    } catch (err) {
      console.error('[AutoPost] 状态提取失败:', err)
    }

    // 2. summary + handoff 只发起这一轮统一调用，不增加第三次正文读取。
    await handleChapterMemory({
      chapterId: task.chapterId,
      chapterTitle: task.chapterTitle,
      chapterContent: task.chapterContent,
    })
  }

  const handleApplyAssistant = async () => {
    const editor = editorRef.current
    const task = useChapterAssistantStore.getState().sessions[assistantSessionKey]?.activeTask
    if (currentChapter?.id == null || !task?.candidate || task.status !== 'completed') {
      await dialog.alert({
        title: '候选暂不可采纳',
        message: '当前候选状态已经变化或章节尚未就绪，请保留候选并重新打开本章后再试。',
      })
      return
    }

    const effectiveMode: ChapterAssistantApplyMode = task.selection
      ? 'replace-selection'
      : task.applyMode
    if (effectiveMode === 'none') {
      await dialog.alert({ title: '这是讨论回复', message: '本轮没有可写回正文的候选。' })
      return
    }
    if (!editor && effectiveMode !== 'replace-chapter') {
      await dialog.alert({
        title: '正文编辑器尚未就绪',
        message: '选区替换或续写需要当前编辑器，请回到正文后重试；候选不会丢失。',
      })
      return
    }

    const normalizedCandidate = task.candidate.replace(/\r\n?/g, '\n')
    const candidateHtml = task.applyMode === 'replace-selection' && !task.selection?.text.includes('\n')
      ? plainTextToInlineHtml(normalizedCandidate)
      : plainTextToHtml(normalizedCandidate)
    let appliedSelection: EditorSelectionSnapshot | null = null
    const fallbackBaseline = { html: content, plainText }

    try {
      if (task.selection && task.sourceTextHash !== await sha256Text(task.selection.text)) {
        throw new ChapterCandidateConflictError('这条候选缺少可验证的原选区，请重新框选正文后再修改。')
      }

      const label = `正文 AI 采纳前 · ${outlineNode?.title || currentChapter.title || '未命名章节'}`
      const receipt = await applyChapterCandidate({
        projectId: project.id!,
        chapterId: currentChapter.id,
        expectedChapterId: task.chapterId,
        expectedChapterHash: task.chapterContentHash,
        expectedTailAnchor: task.chapterTailAnchor,
        mode: effectiveMode,
        label,
        readCurrent: () => readChapterContentState(editor, fallbackBaseline),
        persistBaseline: async baseline => {
          await updateChapter(currentChapter.id!, {
            content: baseline.html,
            wordCount: countWords(baseline.plainText),
          })
          setSavedContent(baseline.html)
        },
        createSnapshot: useBackupStore.getState().createSnapshot,
        buildNextContent: () => {
          if (task.selection && effectiveMode === 'replace-selection') {
            appliedSelection = editor!.applySelectionSnapshot(task.selection, candidateHtml, 'replace')
            if (!appliedSelection) {
              throw new ChapterCandidateConflictError('原选区或坐标已经变化，请重新框选后再生成。')
            }
          } else if (effectiveMode === 'append-chapter') {
            editor!.appendContent(candidateHtml)
          } else if (effectiveMode === 'replace-chapter') {
            return replaceWholeChapterContent(editor, {
              html: candidateHtml,
              plainText: normalizedCandidate,
            })
          }
          return { html: editor!.getHTML(), plainText: editor!.getPlainText() }
        },
        write: async ({ html, plainText: nextPlainText, expectedHash, textNormalizationVersion }) => adopt({
          projectId: project.id!,
          target: 'chapters',
          recordId: currentChapter.id!,
          mode: 'replace',
          compareAndSet: {
            kind: 'chapter-content-hash',
            expectedHash,
            textNormalizationVersion,
          },
          data: { content: html, wordCount: countWords(nextPlainText) },
        }),
        restoreEditor: baseline => {
          editor?.setContent(baseline.html)
          setContent(baseline.html)
          setPlainText(baseline.plainText)
          setSavedContent(baseline.html)
        },
      })

      const nextHtml = receipt.afterHtml
      const nextPlainText = htmlToPlainText(nextHtml)
      editor?.setContent(nextHtml)
      setContent(nextHtml)
      setPlainText(nextPlainText)
      setSavedContent(nextHtml)
      await refreshChapter(currentChapter.id)
      setLastAdoptionReceipt(receipt)
      useChapterAssistantStore.getState().clearSession(assistantSessionKey)
      ai.reset()
      editor?.clearSelection()
      setFloatingSelection(null)

      if (!appliedSelection) {
        void handleAutoPostGenerate({
          chapterId: currentChapter.id,
          chapterTitle: outlineNode?.title || currentChapter.title || '未知章节',
          chapterContent: nextHtml,
          chapterPlainText: nextPlainText,
        })
      }
    } catch (error) {
      await dialog.alert({
        title: error instanceof ChapterCandidateConflictError ? '正文版本冲突' : '正文写入失败',
        message: `${error instanceof Error ? error.message : String(error)} 候选和对话仍然保留。`,
      })
    }
  }

  const handleUpdateFactCandidate = async (factId: number, patch: FactCandidatePatch) => {
    if (!currentChapter?.id) return
    await useFactLedgerStore.getState().updateCandidate({
      projectId: project.id!,
      factId,
      sourceChapterId: currentChapter.id,
      chapterContent: editorRef.current?.getPlainText() ?? plainText,
      patch,
    })
  }

  const handleConfirmFactCandidates = async (factIds: number[]) => {
    await useFactLedgerStore.getState().confirmFacts(
      project.id!,
      factIds,
      editorRef.current?.getPlainText() ?? plainText,
    )
    setFactInfo(`${factIds.length} 条长期事实已确认`)
  }

  const handleRejectFactCandidates = async (factIds: number[]) => {
    await useFactLedgerStore.getState().rejectFacts(project.id!, factIds)
    setFactInfo(`${factIds.length} 条候选已放弃`)
  }

  const handleUndoAssistantAdoption = async () => {
    const editor = editorRef.current
    const receipt = lastAdoptionReceipt
    if (!editor || !currentChapter?.id || !receipt) return
    try {
      const restored = await undoChapterAdoption({
        receipt,
        chapterId: currentChapter.id,
        readCurrent: () => ({ html: editor.getHTML(), plainText: editor.getPlainText() }),
        write: async ({ html, plainText: restoredPlain, expectedHash, textNormalizationVersion }) => adopt({
          projectId: project.id!,
          target: 'chapters',
          recordId: currentChapter.id!,
          mode: 'replace',
          compareAndSet: {
            kind: 'chapter-content-hash',
            expectedHash,
            textNormalizationVersion,
          },
          data: { content: html, wordCount: countWords(restoredPlain) },
        }),
      })
      editor.setContent(restored.html)
      setContent(restored.html)
      setPlainText(restored.plainText)
      setSavedContent(restored.html)
      await refreshChapter(currentChapter.id)
      setLastAdoptionReceipt(null)
    } catch (error) {
      await dialog.alert({
        title: '无法直接撤销',
        message: `${error instanceof Error ? error.message : String(error)} 快照 #${receipt.snapshotId} 仍可用于完整恢复。`,
      })
    }
  }

  const handleClearAssistantSession = async () => {
    const store = useChapterAssistantStore.getState()
    const session = store.sessions[assistantSessionKey]
    const task = session?.activeTask
    const hasRiskyContent = Boolean(
      ai.isStreaming
      || task?.candidate
      || task?.partialOutput
      || (session?.messages.length ?? 0) > 1,
    )
    if (hasRiskyContent) {
      const confirmed = await dialog.confirm({
        title: '清空本章 AI 会话？',
        message: ai.isStreaming
          ? '当前任务仍在生成。清空会停止生成，并删除本次对话与未采纳输出；正文不会变化。'
          : '本次对话或未采纳输出会被删除；正文不会变化。',
        confirmText: '清空会话',
      })
      if (!confirmed) return
    }
    ai.reset()
    store.clearSession(assistantSessionKey)
    editorRef.current?.clearSelection()
    setFloatingSelection(null)
  }

  const handleUseWholeChapterScope = async () => {
    const assistantStore = useChapterAssistantStore.getState()
    const task = assistantStore.sessions[assistantSessionKey]?.activeTask
    if (!task?.selection) return
    if (task.status === 'completed' && task.candidate) {
      const confirmed = await dialog.confirm({
        title: '切换为整章范围？',
        message: '当前选区候选会被放弃，但正文不会发生变化。之后未框选的修改默认作用于整章。',
        confirmText: '切换为整章',
      })
      if (!confirmed) return
    }
    assistantStore.appendMessage(assistantSessionKey, {
      role: 'status',
      content: '已解除选区范围锁；后续修改默认作用于整章正文',
      taskId: task.id,
    })
    assistantStore.setTask(assistantSessionKey, null)
    editorRef.current?.clearSelection()
    setFloatingSelection(null)
    ai.reset()
  }

  const handleDiscardAssistant = () => {
    const assistantStore = useChapterAssistantStore.getState()
    const task = assistantStore.sessions[assistantSessionKey]?.activeTask
    if (task) {
      assistantStore.appendMessage(assistantSessionKey, {
        role: 'status',
        content: '已放弃当前候选，正文没有变化',
        taskId: task.id,
      })
    }
    assistantStore.setTask(assistantSessionKey, null)
    editorRef.current?.clearSelection()
    setFloatingSelection(null)
    setAssistantSelectionValid(true)
    ai.reset()
  }

  // 没有选中章节
  if (!currentChapter) {
    if (outlineNodeId) {
      const node = nodes.find(n => n.id === outlineNodeId)
      return (
        <div className="max-w-4xl flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-text-muted text-sm">章节「{node?.title}」还没有正文</p>
          <button onClick={handleCreateFromOutline}
            className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors">
            创建章节并开始写作
          </button>
        </div>
      )
    }
    return (
      <div className="max-w-4xl">
        <h2 className="text-xl font-bold text-text-primary mb-4">✍️ 写作</h2>
        <div className="space-y-1">
          {chapters.map(ch => (
            <button key={ch.id} onClick={() => selectChapter(ch.id!)}
              className="w-full text-left px-3 py-2 rounded-md text-sm bg-bg-surface hover:bg-bg-hover text-text-secondary transition-colors">
              <span className="text-text-primary">{ch.title}</span>
              <span className="ml-2 text-text-muted text-xs">{ch.wordCount} 字</span>
            </button>
          ))}
          {chapters.length === 0 && (
            <p className="text-text-muted text-sm text-center py-12">请先在「大纲」中创建章节，然后点击写作图标进入编辑</p>
          )}
        </div>
      </div>
    )
  }

  const centralReviewTask = assistantSession.activeTask?.status === 'completed'
    && assistantSession.activeTask.applyMode === 'replace-chapter'
    && assistantSession.activeTask.candidate
      ? assistantSession.activeTask
      : null

  return (
    <div className="relative flex h-full min-h-0 bg-bg-base">
      <section className="min-w-0 flex-1 overflow-y-auto">
      {/* 标题栏 —— sticky 固定在顶部，必须不透光，否则正文下滑时会从底下透出来 */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg-base">
        <ChapterEditorHeader
          title={chapterDisplay?.title ?? currentChapter.title}
          wordCount={wordCount}
          status={currentChapter.status}
          showContext={showContext}
          canCompare={!!plainText && compareSourceHtml == null}
          saveDisabled={compareSourceHtml != null}
          saving={manualSaving}
          saveError={manualSaveError}
          isSaved={content === savedContent}
          onStatusChange={status => {
            if (currentChapter.id) void updateChapter(currentChapter.id, { status })
          }}
          onToggleContext={() => setShowContext(!showContext)}
          onOpenCompare={() => { void handleOpenComparePolish() }}
          onSave={() => { void handleManualSave() }}
        />

      {showContext && (
        <ChapterContextPreview
          worldContext={worldCtx}
          characterContext={charCtx}
          outlineNode={outlineNode ?? undefined}
          stateCards={stateCards}
          matchedIds={selectiveState.matchedIds}
          allIds={selectiveState.allIds}
          extraIds={extraStateIds}
          stateListExpanded={showStatePreview}
          onToggleStateList={() => setShowStatePreview(!showStatePreview)}
          onToggleStateCard={cardId => {
            const isExtra = extraStateIds.includes(cardId)
            const isMatched = selectiveState.matchedIds.includes(cardId)
            if (isExtra) {
              setExtraStateIds(extraStateIds.filter(id => id !== cardId))
            } else if (!isMatched) {
              setExtraStateIds([...extraStateIds, cardId])
            }
          }}
        />
      )}

      {compareSourceHtml == null && (
        <div className="flex items-center gap-3 border-t border-border/60 bg-bg-surface px-4 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text-secondary">
              {outlineNode?.title || currentChapter.title}
              <span className="ml-2 font-normal text-text-muted">{outlineNode?.summary || '暂无章纲摘要'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setAssistantOpen(true); setAssistantTab('assistant') }}
            className={`inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium ${assistantOpen && assistantTab === 'assistant' ? 'border-accent/35 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}
          >
            <Sparkles className="h-3.5 w-3.5" />AI 协作
          </button>
          <button
            type="button"
            onClick={() => { setAssistantOpen(true); setAssistantTab('links') }}
            className={`inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium ${assistantOpen && assistantTab === 'links' ? 'border-accent/35 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}
          >
            <ListChecks className="h-3.5 w-3.5" />章节关联
          </button>
        </div>
      )}
      </div>

      <div className="mx-auto max-w-[1120px] space-y-4 px-4 py-5 sm:px-6 lg:py-7">

      {/* D3: 大纲预览 */}
      {showOutlinePreview && currentChapter.outlineNodeId && (
        <div className="mb-3">
          <OutlinePreview outlineNodeId={currentChapter.outlineNodeId} onClose={() => setShowOutlinePreview(false)} />
        </div>
      )}

      {/* F: 质量审校面板 */}
      {showReviewPanel && (
        <div className="mb-3">
          <ReviewPanel
            projectId={project.id!}
            chapterId={currentChapter.id!}
            outlineNodeId={currentChapter.outlineNodeId}
            worldGroupId={chapterWorldGroupId}
            chapterContent={plainText}
            chapterTitle={outlineNode?.title || currentChapter?.title || ''}
            worldContext={worldCtx}
            characterContext={charCtx}
            prevChapterSummary={(() => {
              const prev = findPreviousCanonicalChapter(nodes, chapters, currentChapter)
              return prev?.summary || ''
            })()}
            nextChapterSummary={(() => {
              const next = findNextCanonicalChapter(nodes, chapters, currentChapter)
              return next?.summary || ''
            })()}
            foreshadowContext={currentChapter?.id ? buildForeshadowContext(currentChapter.id, chapters, nodes) : ''}
            stateContext={stateCards.slice(0, 10).map(sc => `${sc.category}:${sc.entityName} — ${sc.fields?.slice(0, 50)}`).join('\n')}
            onClose={() => setShowReviewPanel(false)}
            onReviseByReport={handleReviseByReport}
          />
        </div>
      )}

      {/* H3: 便签面板 */}
      {showNotePanel && (
        <div className="mb-3">
          <NotePanel projectId={project.id!} chapterId={currentChapter?.id} onClose={() => setShowNotePanel(false)} />
        </div>
      )}

      {/* A3: 情感节拍卡 */}
      {showEmotionPanel && outlineNode && currentChapter?.id && (
        <EmotionBeatCard
          projectId={project.id!}
          chapterId={currentChapter.id}
          chapterTitle={outlineNode.title || currentChapter.title}
          chapterSummary={outlineNode.summary || ''}
          worldContext={worldCtx}
          characterContext={charCtx}
          prevChapterEnding={(() => {
            const prev = findPreviousCanonicalChapter(nodes, chapters, currentChapter)
            return htmlToPlainText(prev?.content || '').slice(-500)
          })()}
        />
      )}

      {lastAdoptionReceipt?.chapterId === currentChapter.id && (
        <div className="mb-3 flex items-center justify-between gap-3 border border-success/30 bg-success/10 px-3 py-2 text-xs text-text-secondary" role="status">
          <span>已采纳正文候选，并创建项目快照 #{lastAdoptionReceipt!.snapshotId}。</span>
          <button
            type="button"
            className="shrink-0 font-medium text-accent hover:text-accent-hover"
            onClick={() => { void handleUndoAssistantAdoption() }}
          >
            撤销本次采纳
          </button>
        </div>
      )}

      {/* TipTap 富文本编辑器 / 对照润色模式 */}
      {compareSourceHtml != null ? (
        <ComparePolishPanel
          key={currentChapter.id}
          projectId={project.id!}
          chapterId={currentChapter.id!}
          chapterTitle={chapterDisplay?.title ?? currentChapter.title}
          worldGroupId={chapterWorldGroupId}
          sourceHtml={compareSourceHtml}
          entityReferences={entityReferences}
          onSaved={result => {
            setContent(result.html)
            setPlainText(result.plainText)
            setSavedContent(result.html)
          }}
          onClose={() => setCompareSourceHtml(null)}
        />
      ) : centralReviewTask ? (
        <ChapterCandidateReview
          chapterTitle={chapterDisplay?.title ?? currentChapter.title}
          originalText={centralReviewTask.sourceText ?? plainText}
          candidateText={centralReviewTask.candidate!}
          onApply={() => { void handleApplyAssistant() }}
          onContinue={() => { setAssistantOpen(true); setAssistantTab('assistant') }}
          onRegenerate={() => { void handleRetryAssistant() }}
          onDiscard={handleDiscardAssistant}
        />
      ) : (
      <div className="mx-auto max-w-[76ch] border border-border bg-[var(--editor-page-bg)] px-5 py-6 sm:px-9 sm:py-8">
        <RichEditor
          ref={editorRef}
          value={content}
          onChange={(html, plain) => {
            setContent(html)
            setPlainText(plain)
            setManualSaveError('')
          }}
          placeholder="开始写作..."
          minHeight={560}
          className="sf-manuscript-editor border-0 bg-transparent shadow-none"
          entityReferences={entityReferences}
          onSelectionChange={setFloatingSelection}
          aiSelection={assistantSession.activeTask?.selection ?? null}
          aiSelectionState={!assistantSelectionValid
            ? 'invalid'
            : ai.isStreaming && assistantSession.activeTask?.selection
              ? 'generating'
              : 'active'}
          onAISelectionValidityChange={setAssistantSelectionValid}
          contentHeader={
            <div className="mb-8 mt-7 text-center">
              <p className="text-xs text-text-muted">
                {chapterDisplay?.ordinal != null ? `第 ${chapterDisplay.ordinal} 章` : '正文'}
              </p>
              <h1 className="mt-3 font-serif text-3xl font-semibold text-text-primary">
                {chapterDisplay?.title ?? currentChapter.title}
              </h1>
              <div className="mx-auto mt-5 h-px w-16 bg-border" />
            </div>
          }
        />
      </div>
      )}

      {/* Phase 24.3: 选中文本浮动工具栏 */}
      {compareSourceHtml == null && <FloatingToolbar
        selection={floatingSelection}
        onAction={(action, snapshot) => { void runSelectionAction(action, snapshot) }}
        disabled={ai.isStreaming}
        onUseWholeChapterScope={() => {
          editorRef.current?.clearSelection()
          setFloatingSelection(null)
          setAssistantOpen(true)
          setAssistantTab('assistant')
        }}
      />}

      </div>
      </section>

      {assistantOpen && compareSourceHtml == null && (
        <ChapterAIAssistantPanel
          key={assistantSessionKey}
          session={assistantSession}
          stream={ai}
          hasText={!!plainText.trim()}
          activeTab={assistantTab}
          selectionValid={assistantSelectionValid}
          centralReviewActive={Boolean(centralReviewTask)}
          onTabChange={setAssistantTab}
          linked={{
            goalTitle: outlineNode?.title || currentChapter.title || '未命名章节',
            goalSummary: outlineNode?.summary || '',
            memorySummary: currentChapter.summary,
            memoryBusy: autoProcessing === 'memory' || memoryAI.isStreaming,
            reconciliation: currentChapter.planReconciliation,
            reconciliationCurrent: planReconciliationCurrent,
            autoStatus: autoProcessing === 'extracting'
              ? '正在自动提取状态变更…'
              : autoProcessing === 'memory'
                ? '正在生成章节记忆与计划对账…'
                : undefined,
            pendingStateCount: pendingDiffs?.length ?? 0,
            stateBusy: extracting || stateAI.isStreaming,
            factBusy: extractingFacts || factAI.isStreaming,
            factInfo: factInfo || undefined,
            factCandidates: chapterFactCandidates,
            impactBusy: analyzingImpact,
            impactInfo: impactInfo || undefined,
            notes: currentChapter.notes || '',
            onNotesChange: value => {
              if (currentChapter.id) void updateChapter(currentChapter.id, { notes: value })
            },
            onGenerateMemory: () => { void handleManualMemory() },
            onConfirmProgress: () => { void handleConfirmActualProgress() },
            onApplyOutlineCandidate: () => { void handleApplyOutlineCandidate() },
            onExtractState: () => { void handleExtractState() },
            onExtractFacts: () => { void handleExtractFacts() },
            onUpdateFactCandidate: handleUpdateFactCandidate,
            onConfirmFactCandidates: handleConfirmFactCandidates,
            onRejectFactCandidates: handleRejectFactCandidates,
            onOpenFactLibrary: () => onOpenFactLibrary?.(),
            onAnalyzeImpact: () => { void handleEditImpact() },
            onOpenOutline: () => setShowOutlinePreview(value => !value),
            onOpenReview: () => setShowReviewPanel(value => !value),
            onOpenNotes: () => setShowNotePanel(value => !value),
            onOpenEmotion: () => setShowEmotionPanel(value => !value),
          }}
          onClose={() => setAssistantOpen(false)}
          onClear={() => { void handleClearAssistantSession() }}
          onQuickAction={(action, instruction, runOptions) => {
            if (action === 'generate') return handleGenerate(instruction, runOptions)
            if (action === 'continue') return handleContinue(instruction, runOptions)
            return handleDeAI(instruction, runOptions)
          }}
          onSend={(instruction, mode, runOptions) => handleSendAssistant(instruction, mode, runOptions)}
          onApply={() => { void handleApplyAssistant() }}
          onRetry={runOptions => handleRetryAssistant(runOptions)}
          onResumePartial={runOptions => handleResumePartialAssistant(runOptions)}
          onDiscard={handleDiscardAssistant}
          onUseWholeChapterScope={() => { void handleUseWholeChapterScope() }}
          onRevealSelection={() => {
            const snapshot = assistantSession.activeTask?.selection
            if (!snapshot) return
            const revealed = editorRef.current?.revealSelectionSnapshot(snapshot) ?? false
            if (!revealed) setAssistantSelectionValid(false)
          }}
        />
      )}

      {/* 状态变更审核弹窗 */}
      {pendingDiffs !== null && (
        <StateDiffModal
          diffs={pendingDiffs}
          chapterTitle={outlineNode?.title || currentChapter.title || ''}
          onConfirm={handleAcceptDiffs}
          onCancel={() => { setPendingDiffs(null); stateAI.reset() }}
          showSkip={autoProcessing !== 'idle'}
        />
      )}
    </div>
  )
}
