import type { AIConfig, ChatMessage } from '../types'
import { chat, resolveRequestConfig, type AICallMeta } from './client'
import { estimateTokens, trimMessagesToFit } from './context-budget'
import { extractJSON } from './adapters/import-adapter'

const MIN_SUMMARY_CHARS = 12
const MAX_SUMMARY_CHARS = 240
const MAX_BATCH_ATTEMPTS = 2

export interface CompleteCodexEntry {
  id: number
  category: string
  name: string
  details: string
}

interface CompressionItem {
  key: string
  entryId: number
  category: string
  name: string
  details: string
  maxChars: number
}

type CompressionCall = (
  messages: ChatMessage[],
  config: AIConfig,
  meta?: AICallMeta,
  signal?: AbortSignal,
) => Promise<string>

export interface CompressCodexContextOptions {
  content: string
  targetTokens: number
  config: AIConfig
  projectId: number
  signal?: AbortSignal
  call?: CompressionCall
}

export function parseCompleteCodexContext(content: string): CompleteCodexEntry[] {
  const declared = /【设定词条 · 全量\s+(\d+)\/(\d+)\s+条】/.exec(content)
  if (!declared || declared[1] !== declared[2]) {
    throw new Error('词条完整上下文缺少可校验的全量计数。')
  }

  const entries: CompleteCodexEntry[] = []
  const seen = new Set<number>()
  let category = ''
  let current: CompleteCodexEntry | null = null

  for (const line of content.split(/\r?\n/)) {
    const categoryMatch = /^\[([^\]]+)]$/.exec(line)
    if (categoryMatch) {
      category = categoryMatch[1].trim()
      current = null
      continue
    }
    const entryMatch = /^- \[词条#(\d+)]\s+(.+)$/.exec(line)
    if (entryMatch) {
      const id = Number(entryMatch[1])
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) {
        throw new Error(`词条编号无效或重复：${entryMatch[1]}`)
      }
      current = { id, category, name: entryMatch[2].trim(), details: '' }
      entries.push(current)
      seen.add(id)
      continue
    }
    if (current && line.startsWith('  详情：')) {
      const details = line.slice('  详情：'.length).trim()
      current.details = details === '（未填写）' ? '' : details
    }
  }

  const expectedCount = Number(declared[1])
  if (entries.length !== expectedCount) {
    throw new Error(`词条完整性校验失败：读取到 ${entries.length}/${expectedCount} 条。`)
  }
  for (let id = 1; id <= expectedCount; id++) {
    if (!seen.has(id)) throw new Error(`词条完整性校验失败：缺少词条#${id}。`)
  }
  return entries
}

function renderSemanticCodex(
  entries: CompleteCodexEntry[],
  summaries: Map<number, string>,
): string {
  const lines = [
    `【设定词条 · AI语义压缩 ${entries.length}/${entries.length} 条】（作者设定，写作时须遵守，勿自创冲突设定）`,
  ]
  let category = ''
  for (const entry of entries) {
    if (entry.category !== category) {
      category = entry.category
      lines.push(`[${category || '未分类'}]`)
    }
    lines.push(`- [词条#${entry.id}] ${entry.name}：${summaries.get(entry.id) || '未填写详情'}`)
  }
  lines.push(`【词条完整性】${entries.length}/${entries.length} 条均已通过编号校验；详情由 AI 语义摘要，未删除任何词条。`)
  return lines.join('\n')
}

function chooseSummaryChars(entries: CompleteCodexEntry[], targetTokens: number): number {
  const renderAt = (chars: number) => renderSemanticCodex(
    entries,
    new Map(entries.map(entry => [entry.id, '要'.repeat(chars)])),
  )
  if (estimateTokens(renderAt(MIN_SUMMARY_CHARS)) > targetTokens) {
    throw new Error(
      `当前预算 ${targetTokens} tokens 连每条 ${MIN_SUMMARY_CHARS} 字的 AI 摘要都无法容纳；` +
      '请增大模型上下文窗口，不能靠删除词条解决。',
    )
  }
  let low = MIN_SUMMARY_CHARS
  let high = MAX_SUMMARY_CHARS
  let best = MIN_SUMMARY_CHARS
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (estimateTokens(renderAt(mid)) <= targetTokens) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return best
}

function buildCompressionMessages(items: CompressionItem[], attempt: number): ChatMessage[] {
  const source = items.map(item => ({
    key: item.key,
    entryId: item.entryId,
    category: item.category,
    name: item.name,
    maxChars: item.maxChars,
    details: item.details,
  }))
  return [
    {
      role: 'system',
      content: [
        '你是小说设定压缩器。把每项原始详情压缩为可直接约束大纲创作的中文摘要。',
        '必须保留身份定位、不可违背的规则、人物/地点/事件关系、时间与数字、因果和禁忌；不得补写原文没有的事实。',
        '每个输入 key 必须且只能输出一次，summary 不得为空，且不得超过该项 maxChars 个字符。',
        '只输出 JSON：{"items":[{"key":"原key","summary":"摘要"}]}。不要 Markdown，不要解释。',
        attempt > 0 ? '上次输出未通过程序校验；本次尤其注意 key 完整、唯一和字数上限。' : '',
      ].filter(Boolean).join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(source),
    },
  ]
}

function parseBatchOutput(raw: string, expected: CompressionItem[]): Map<string, string> {
  const parsed = extractJSON(raw) as { items?: unknown } | unknown[]
  const values = Array.isArray(parsed) ? parsed : parsed?.items
  if (!Array.isArray(values)) throw new Error('AI 词条摘要输出不是 items 数组。')

  const limits = new Map(expected.map(item => [item.key, item.maxChars]))
  const output = new Map<string, string>()
  for (const value of values) {
    if (!value || typeof value !== 'object') throw new Error('AI 词条摘要包含无效项目。')
    const item = value as Record<string, unknown>
    const key = typeof item.key === 'string' ? item.key.trim() : ''
    const summary = typeof item.summary === 'string' ? item.summary.trim() : ''
    const limit = limits.get(key)
    if (!limit) throw new Error(`AI 词条摘要返回了未知 key：${key || '空值'}。`)
    if (output.has(key)) throw new Error(`AI 词条摘要重复返回 key：${key}。`)
    if (!summary) throw new Error(`AI 词条摘要为空：${key}。`)
    if (summary.length > limit) {
      throw new Error(`AI 词条摘要超过 ${limit} 字：${key}。`)
    }
    output.set(key, summary)
  }
  const missing = expected.filter(item => !output.has(item.key)).map(item => item.key)
  if (missing.length) throw new Error(`AI 词条摘要遗漏 key：${missing.join('、')}。`)
  return output
}

function requestFits(messages: ChatMessage[], config: AIConfig): boolean {
  const checked = trimMessagesToFit(
    messages,
    config.provider,
    config.model,
    config.maxTokens,
    config.contextWindow,
  )
  const inputTokens = messages.reduce((sum, message) => sum + estimateTokens(message.content), 0)
  return inputTokens <= checked.inputBudget
}

function batchOutputFits(items: CompressionItem[], config: AIConfig): boolean {
  if (!config.maxTokens || config.maxTokens <= 0) return true
  const worstCase = JSON.stringify({
    items: items.map(item => ({ key: item.key, summary: '要'.repeat(item.maxChars) })),
  })
  return estimateTokens(worstCase) <= Math.floor(config.maxTokens * 0.9)
}

function compressionBatchFits(items: CompressionItem[], config: AIConfig): boolean {
  return batchOutputFits(items, config)
    && requestFits(buildCompressionMessages(items, 0), config)
}

function splitDetailsToFit(
  entry: CompleteCodexEntry,
  maxChars: number,
  config: AIConfig,
): CompressionItem[] {
  if (!entry.details) return []
  const pieces: CompressionItem[] = []
  let offset = 0
  let part = 1
  while (offset < entry.details.length) {
    let low = 1
    let high = entry.details.length - offset
    let best = 0
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const candidate: CompressionItem = {
        key: `${entry.id}.${part}`,
        entryId: entry.id,
        category: entry.category,
        name: entry.name,
        details: entry.details.slice(offset, offset + mid),
        maxChars,
      }
      if (requestFits(buildCompressionMessages([candidate], 0), config)) {
        best = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    if (best <= 0) {
      throw new Error(`单条词条“${entry.name}”的名称和压缩指令已超过压缩模型窗口。`)
    }
    pieces.push({
      key: `${entry.id}.${part}`,
      entryId: entry.id,
      category: entry.category,
      name: entry.name,
      details: entry.details.slice(offset, offset + best),
      maxChars,
    })
    offset += best
    part += 1
  }
  return pieces
}

function packBatches(items: CompressionItem[], config: AIConfig): CompressionItem[][] {
  const batches: CompressionItem[][] = []
  let current: CompressionItem[] = []
  for (const item of items) {
    const candidate = [...current, item]
    if (compressionBatchFits(candidate, config)) {
      current = candidate
      continue
    }
    if (!current.length) throw new Error(`词条摘要项目 ${item.key} 超过压缩模型窗口。`)
    batches.push(current)
    if (!compressionBatchFits([item], config)) {
      throw new Error(`词条摘要项目 ${item.key} 超过压缩模型窗口。`)
    }
    current = [item]
  }
  if (current.length) batches.push(current)
  return batches
}

async function summarizeItems(
  items: CompressionItem[],
  config: AIConfig,
  projectId: number,
  call: CompressionCall,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const summaries = new Map<string, string>()
  for (const batch of packBatches(items, config)) {
    let lastError: unknown = null
    for (let attempt = 0; attempt < MAX_BATCH_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw new DOMException('已取消', 'AbortError')
      try {
        const raw = await call(
          buildCompressionMessages(batch, attempt),
          config,
          {
            category: 'outline.context-compress',
            projectId,
            configOverrides: { maxTokens: config.maxTokens, temperature: 0.1 },
          },
          signal,
        )
        for (const [key, summary] of parseBatchOutput(raw, batch)) summaries.set(key, summary)
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) {
      throw new Error(`AI 词条摘要连续 ${MAX_BATCH_ATTEMPTS} 次未通过完整性校验：${lastError instanceof Error ? lastError.message : '未知错误'}`)
    }
  }
  return summaries
}

export async function compressCodexContextWithAI(
  options: CompressCodexContextOptions,
): Promise<string> {
  const entries = parseCompleteCodexContext(options.content)
  if (!entries.length || estimateTokens(options.content) <= options.targetTokens) return options.content

  const finalChars = chooseSummaryChars(entries, options.targetTokens)
  const routedBase = resolveRequestConfig(options.config, {
    category: 'outline.context-compress',
    projectId: options.projectId,
  }).config
  const desiredOutput = Math.min(
    4096,
    Math.max(1024, Math.ceil(entries.length * finalChars * 1.5 + 256)),
  )
  const requestedOutput = routedBase.maxTokens > 0
    ? Math.max(256, Math.min(routedBase.maxTokens, desiredOutput))
    : desiredOutput
  const meta: AICallMeta = {
    category: 'outline.context-compress',
    projectId: options.projectId,
    configOverrides: { maxTokens: requestedOutput, temperature: 0.1 },
  }
  const effectiveConfig = resolveRequestConfig(options.config, meta).config
  const intermediateChars = Math.min(MAX_SUMMARY_CHARS, Math.max(96, finalChars * 2))
  const pieces = entries.flatMap(entry => splitDetailsToFit(entry, intermediateChars, effectiveConfig))
  const call = options.call ?? chat
  const pieceSummaries = await summarizeItems(
    pieces,
    effectiveConfig,
    options.projectId,
    call,
    options.signal,
  )

  const mergeItems: CompressionItem[] = []
  const finalSummaries = new Map<number, string>()
  for (const entry of entries) {
    const entryPieces = pieces.filter(piece => piece.entryId === entry.id)
    if (!entryPieces.length) {
      finalSummaries.set(entry.id, '未填写详情')
      continue
    }
    if (entryPieces.length === 1 && intermediateChars === finalChars) {
      finalSummaries.set(entry.id, pieceSummaries.get(entryPieces[0].key)!)
      continue
    }
    mergeItems.push({
      key: `merge.${entry.id}`,
      entryId: entry.id,
      category: entry.category,
      name: entry.name,
      details: entryPieces.map(piece => pieceSummaries.get(piece.key)!).join('；'),
      maxChars: finalChars,
    })
  }

  const merged = await summarizeItems(
    mergeItems,
    effectiveConfig,
    options.projectId,
    call,
    options.signal,
  )
  for (const item of mergeItems) finalSummaries.set(item.entryId, merged.get(item.key)!)

  if (finalSummaries.size !== entries.length) {
    throw new Error(`AI 词条摘要完整性校验失败：${finalSummaries.size}/${entries.length} 条。`)
  }
  const result = renderSemanticCodex(entries, finalSummaries)
  if (estimateTokens(result) > options.targetTokens) {
    throw new Error('AI 词条摘要虽通过逐条校验，但仍超过目标上下文预算；本次不发送残缺词条。')
  }
  return result
}
