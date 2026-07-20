/**
 * assembleContext(Phase 1.3a) · 统一上下文装配入口。
 *
 * 1.3a 只新增入口。1.3b 再把 ai.start/chat 调用迁移到这里。
 */
import { estimateTokens, getModelPreset, type ContextLayer, type ContextSegment } from '../ai/context-budget'
import { CONTEXT_SOURCES, CONTEXT_SOURCE_BY_KEY } from './context-sources'
import type { AssembleContextInput, AssembleContextResult, ContextSource } from './types'
import { prepareContinuityContext } from '../ai/chapter-memory/continuity-context'

/** 拿不到模型时的保守默认输入预算(原固定 24K 偏紧,放宽避免内部提前裁) */
const FALLBACK_INPUT_BUDGET = 48_000
const LAYERS_BY_TRIM_PRIORITY: ContextLayer[] = ['L3', 'L2', 'L1']

/**
 * 输入预算 = 所选模型的上下文窗口(减输出预留与安全边际)。
 * 这样上下文只在「真的接近模型窗口」时才按优先级软裁,而不是被固定小预算提前砍。
 */
function deriveInputBudget(input: AssembleContextInput): number {
  if (input.inputBudgetTokens && input.inputBudgetTokens > 0) return input.inputBudgetTokens
  if (input.provider && input.model) {
    const preset = getModelPreset(input.provider, input.model)
    const maxContext = input.contextWindowTokens && input.contextWindowTokens > 0
      ? input.contextWindowTokens
      : preset.maxContext
    const maxOutput = input.maxOutputTokens && input.maxOutputTokens > 0
      ? input.maxOutputTokens
      : Math.min(preset.maxOutput, Math.floor(maxContext * 0.5))
    const budget = maxContext - maxOutput - Math.round(maxContext * 0.05)
    return Math.max(0, budget)
  }
  return FALLBACK_INPUT_BUDGET
}

export async function assembleContext(input: AssembleContextInput): Promise<AssembleContextResult> {
  const selected = selectSources(input)
  const protectedSourceKeys = new Set([
    ...(input.requiredSourceKeys ?? []),
    ...(input.protectedSourceKeys ?? []),
  ])
  const needsContinuity = selected.some(source => (
    source.key === 'previousChapterEnding'
    || source.key === 'chapterContinuityHandoff'
    || source.key === 'previousPlanReconciliation'
    || source.key === 'recentChapterSummaries'
  ))
  const resolvedInput: AssembleContextInput = needsContinuity && input.chapterId != null
    ? {
        ...input,
        continuitySnapshot: input.continuitySnapshot ?? await prepareContinuityContext({
          projectId: input.projectId,
          chapterId: input.chapterId,
        }),
      }
    : input
  const omitted: string[] = []
  const keyedSegments: { key: string; segment: ContextSegment }[] = []
  const sourceLimits: NonNullable<AssembleContextResult['sourceLimits']> = []
  const inputBudget = deriveInputBudget(input)

  for (const source of selected) {
    if (!requirementsMet(source, resolvedInput)) {
      omitted.push(source.key)
      continue
    }
    if (source.enabled && !await source.enabled(resolvedInput)) {
      omitted.push(source.key)
      continue
    }
    const override = resolvedInput.sourceContentOverrides
    const content = override && Object.prototype.hasOwnProperty.call(override, source.key)
      ? override[source.key]
      : await source.read(resolvedInput)
    if (!content.trim()) {
      omitted.push(source.key)
      continue
    }
    const protectedSource = protectedSourceKeys.has(source.key)
    const effectiveSourceBudget = dynamicSourceBudget(source.budgetTokens, inputBudget)
    const capResult = protectedSource
      ? { content, applied: false }
      : capBySourceBudget(content, effectiveSourceBudget)
    sourceLimits.push({
      key: source.key,
      configuredTokens: source.budgetTokens,
      effectiveTokens: protectedSource ? 0 : effectiveSourceBudget,
      applied: capResult.applied,
    })
    keyedSegments.push({
      key: source.key,
      segment: {
        label: source.label,
        layer: source.layer,
        content: capResult.content,
        tokens: estimateTokens(capResult.content),
        trimmable: source.layer !== 'L0' && !source.protectedFromTrim && !protectedSource,
      },
    })
  }

  const totalBeforeTrim = keyedSegments.reduce((sum, s) => sum + s.segment.tokens, 0)
  const contentBudget = input.contentBudgetTokens && input.contentBudgetTokens > 0
    ? Math.min(inputBudget, input.contentBudgetTokens)
    : inputBudget
  const overBudgetBeforeTrim = totalBeforeTrim > contentBudget
  const compressed = input.semanticCompressedSourceKeys
    ?? Object.keys(input.sourceContentOverrides ?? {})
      .filter(key => protectedSourceKeys.has(key))

  const { kept, trimmed } = trimToFit(keyedSegments, contentBudget)
  const segments = kept.map(s => s.segment)
  const totalInputTokens = segments.reduce((sum, s) => sum + s.tokens, 0)

  return {
    text: segments.map(s => s.content).join('\n\n'),
    segments,
    included: kept.map(s => s.key),
    omitted,
    trimmed,
    compressed,
    sourceLimits,
    totalInputTokens,
    inputBudget,
    overBudgetBeforeTrim,
    overBudgetAfterTrim: totalInputTokens > contentBudget,
  }
}

function selectSources(input: AssembleContextInput): ContextSource[] {
  if (!input.sourceKeys?.length) return CONTEXT_SOURCES
  return input.sourceKeys
    .map(key => CONTEXT_SOURCE_BY_KEY.get(key))
    .filter((source): source is ContextSource => !!source)
}

function requirementsMet(source: ContextSource, input: AssembleContextInput): boolean {
  if (source.requiresWorldGroupId && !Object.prototype.hasOwnProperty.call(input, 'worldGroupId')) return false
  if (source.requiresOutlineNodeId && input.outlineNodeId == null && input.chapterId == null) return false
  if (source.requiresChapterId && input.chapterId == null) return false
  return true
}

function dynamicSourceBudget(configuredTokens: number, inputBudget: number): number {
  if (!configuredTokens) return configuredTokens
  if (inputBudget >= 750_000) return Math.max(configuredTokens, Math.min(configuredTokens * 12, 60_000))
  if (inputBudget >= 180_000) return Math.max(configuredTokens, Math.min(configuredTokens * 6, 30_000))
  if (inputBudget >= 64_000) return Math.max(configuredTokens, Math.min(configuredTokens * 3, 15_000))
  return configuredTokens
}

function capBySourceBudget(content: string, budgetTokens: number): { content: string; applied: boolean } {
  if (!budgetTokens || estimateTokens(content) <= budgetTokens) return { content, applied: false }
  const approxChars = Math.max(100, Math.floor(budgetTokens * 1.4))
  return {
    content: `${content.slice(0, approxChars)}\n…（该上下文源已按自身限额截断）`,
    applied: true,
  }
}

function trimToFit(
  segments: { key: string; segment: ContextSegment }[],
  inputBudget: number,
): { kept: { key: string; segment: ContextSegment }[]; trimmed: string[] } {
  let kept = [...segments]
  const trimmed: string[] = []
  let total = kept.reduce((sum, s) => sum + s.segment.tokens, 0)
  if (total <= inputBudget) return { kept, trimmed }

  for (const layer of LAYERS_BY_TRIM_PRIORITY) {
    if (total <= inputBudget) break
    const removed = kept.filter(s => s.segment.layer === layer && s.segment.trimmable)
    if (!removed.length) continue
    kept = kept.filter(s => s.segment.layer !== layer || !s.segment.trimmable)
    total = kept.reduce((sum, s) => sum + s.segment.tokens, 0)
    trimmed.push(...removed.map(s => s.key))
  }

  return { kept, trimmed }
}
