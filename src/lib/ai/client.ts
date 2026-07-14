import type { AIConfig, ChatMessage } from '../types'
import { AIError } from '../types'
import type { AiTransportResponse, JsonValue } from '../../runtime'
import { createLog, updateLog, type TokenUsage } from './logger'
import { recordUsage } from './usage-log'
import { trimMessagesToFit } from './context-budget'
import { buildOpenAIEndpoint } from './openai-endpoint'
import {
  bindAiCredential,
  executeAiRequest,
  isSuccessfulAiResponse,
  normalizeAiTransportError,
  readAiResponseText,
  waitForAiRetry,
} from './runtime-transport'

/** 调用元信息（用于消耗统计分类） */
export interface AICallMeta {
  /** 消耗类型标识（moduleKey 或显式 category，如 'chapter.content'） */
  category?: string
  projectId?: number | null
}

/** 可变容器，streamChat 写入 usage，调用方读取 */
export interface StreamResult {
  usage?: TokenUsage
}

/** 流式 chunk 标记：思考过程 vs 正文内容 */
export type AIStreamChunk =
  | { kind: 'reasoning'; text: string }
  | { kind: 'content'; text: string }

/** 可变容器，chat 写入非流式调用返回的真实 token 用量。 */
export interface ChatResult {
  usage?: TokenUsage
}

/**
 * 从 system prompt 中提取用户选择的思考深度（快速/标准/深入）。
 * thinkingDepth 参数由 prompt 模板渲染进 system message,此处解析出来映射到 API 参数。
 */
function extractThinkingDepth(messages: ChatMessage[]): '快速' | '标准' | '深入' | null {
  const sys = messages.find(m => m.role === 'system')?.content
  if (!sys) return null
  const match = sys.match(/思考深度[：:]\s*(快速|标准|深入)/)
  return (match?.[1] as '快速' | '标准' | '深入') ?? null
}

/** 深度映射到 DeepSeek 的 reasoning_effort */
function mapDepthToReasoningEffort(depth: string | null): 'low' | 'medium' | 'high' {
  if (depth === '快速') return 'low'
  if (depth === '深入') return 'high'
  return 'medium' // 默认 / 标准
}

/** 深度映射到 Claude 的 budget_tokens（extended thinking 预算） */
function mapDepthToBudgetTokens(depth: string | null): number {
  if (depth === '快速') return 2000
  if (depth === '深入') return 16000
  return 6000 // 默认 / 标准
}

function jsonMessages(messages: ChatMessage[]): JsonValue[] {
  return messages.map(message => ({ role: message.role, content: message.content }))
}

/** 根据 provider 构造共享 TS 请求体；URL/凭据由 RuntimeAdapter 接管。 */
function buildRequest(config: AIConfig, messages: ChatMessage[], stream: boolean) {
  // 基础请求体：所有 provider 都需要的字段
  const body: Record<string, JsonValue> = {
    model: config.model,
    messages: jsonMessages(messages),
    stream,
  }

  // 流式请求时要求返回 token 用量
  // stream_options 仅 OpenAI / DeepSeek / Qwen 等兼容 provider 支持
  // 智谱 GLM / 文心 / Poe / Gemini 等不支持，传了会报参数错误
  const NO_STREAM_OPTIONS: Set<string> = new Set(['glm', 'wenxin', 'poe', 'gemini', 'ollama', 'longcat'])
  if (stream && !NO_STREAM_OPTIONS.has(config.provider)) {
    body.stream_options = { include_usage: true }
  }

  // Poe 官方文档明确只需 model + messages，不要传额外参数
  // （Claude 模型在 Poe 上自动启用 thinking，传 max_tokens/temperature 会冲突报 400）
  if (config.provider === 'poe') {
    // Poe: 不传额外参数
  } else if (config.provider === 'deepseek') {
    const isThinkingModel = config.model.includes('v4-pro')
    if (isThinkingModel) {
      // thinkingDepth 从 system prompt 里解析（用户在模板参数里选的）,映射到 reasoning_effort
      const depth = extractThinkingDepth(messages)
      body.thinking = { type: 'enabled' }
      body.reasoning_effort = mapDepthToReasoningEffort(depth)
    } else {
      if (config.temperature !== undefined) body.temperature = config.temperature
    }
    // maxTokens > 0 才传，0 = 不限制（由模型自身决定）
    if (config.maxTokens && config.maxTokens > 0) body.max_tokens = config.maxTokens
  } else if (config.provider === 'glm') {
    // 智谱 GLM：temperature 范围 (0, 1]，超出会报 1210
    if (config.temperature !== undefined) {
      body.temperature = Math.min(Math.max(config.temperature, 0.01), 1.0)
    }
    // GLM-4.5+ 支持 thinking 参数（智谱官方开放平台）。深度靠 system prompt 里的指令传达
    // （GLM 官方 API 无 reasoning_effort 等原生深度档位）。
    if (/glm-(4\.[56]|5|6)/i.test(config.model)) {
      body.thinking = { type: 'enabled' }
    }
    if (config.maxTokens && config.maxTokens > 0) body.max_tokens = config.maxTokens
  } else if (config.provider === 'longcat') {
    // LongCat OpenAI 兼容端点：temperature 范围 0~1，且不声明 stream_options。
    if (config.temperature !== undefined) {
      body.temperature = Math.min(Math.max(config.temperature, 0), 1.0)
    }
    if (config.maxTokens && config.maxTokens > 0) body.max_tokens = config.maxTokens
  } else {
    // 自定义 / OpenAI 兼容 provider（含 New API 等中转,可能挂载多种上游模型）
    // 按模型名分派各家的思考参数,让中转站尽可能透传到上游。
    // 同时对 Claude 系保留 system prompt <think> 兜底,防中转站不分流响应。
    const modelLower = config.model.toLowerCase()
    const depth = extractThinkingDepth(messages)

    if (/claude|opus|sonnet|haiku/.test(modelLower)) {
      // Claude 系:
      // 1. 传 thinking + budget_tokens（Anthropic 官方 extended thinking 参数）
      //    如果中转站透传,会在上游生效控制思考深度
      // 2. 同时保留 <think> 系统指令兜底
      //    - 若中转站不分流 reasoning_content 而是把思考裸拼进 content → 靠模型自觉输出 <think> 标签,前端解析器分离
      //    - 若中转站正确分流 → <think> 指令通常会被模型忽略（extended thinking 走 API 通道）
      body.thinking = { type: 'enabled', budget_tokens: mapDepthToBudgetTokens(depth) }

      const thinkInstruction = '[重要格式约束·必须遵守] 你的每次回复必须严格按以下格式输出：先输出 <think> 标签，在标签内用中文写出思考分析，再输出 </think> 标签，最后才是正式回复。示例：<think>我的分析...</think>正式内容。标签不可省略。\n\n'
      const sysIdx = messages.findIndex(m => m.role === 'system')
      if (sysIdx !== -1) {
        messages = [...messages]
        messages[sysIdx] = { ...messages[sysIdx], content: thinkInstruction + messages[sysIdx].content }
      } else {
        messages = [{ role: 'system', content: thinkInstruction.trim() }, ...messages]
      }
      body.messages = jsonMessages(messages)
    } else if (/deepseek.*(reasoner|r1|v4-pro|thinking)/.test(modelLower)) {
      // DeepSeek 思考系模型（如 deepseek-reasoner、deepseek-r1、v4-pro、-thinking）
      body.thinking = { type: 'enabled' }
      body.reasoning_effort = mapDepthToReasoningEffort(depth)
    } else if (/glm-(4\.[56]|5|6)/.test(modelLower)) {
      // GLM-4.5+ / 5.x / 6.x 思考系
      body.thinking = { type: 'enabled' }
    } else if (/qwq|qwen.*(thinking|reasoner|3)/.test(modelLower)) {
      // Qwen 思考系（qwq / qwen3-thinking / qwen-reasoner 等）——阿里用 enable_thinking
      body.enable_thinking = true
    }
    // 其他模型（gpt / gemini / 通用等）不传思考参数

    if (config.temperature !== undefined) body.temperature = config.temperature
    // maxTokens > 0 才传，0 = 不限制（由模型自身决定）
    if (config.maxTokens && config.maxTokens > 0) body.max_tokens = config.maxTokens
  }

  return {
    configuredBaseUrl: config.baseUrl,
    logUrl: buildOpenAIEndpoint(config.baseUrl, 'chat/completions'),
    body,
  }
}

function sseData(line: string): string | null {
  const normalized = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!normalized.startsWith('data:')) return null
  return normalized.slice(5).trim()
}

/** Yield complete SSE data fields while preserving UTF-8 and lines split across chunks. */
async function* readSseData(body: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for await (const chunk of body) {
      buffer += decoder.decode(chunk, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const data = sseData(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        if (data !== null) yield data
        newline = buffer.indexOf('\n')
      }
    }
    buffer += decoder.decode()
    if (buffer) {
      const data = sseData(buffer)
      if (data !== null) yield data
    }
  } catch (error) {
    throw normalizeAiTransportError(error)
  }
}

interface OpenAIUsagePayload {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface OpenAIStreamPayload {
  choices?: Array<{
    delta?: {
      reasoning_content?: string
      thinking?: string
      reasoning?: string
      content?: string
    }
  }>
  usage?: OpenAIUsagePayload
}

interface OpenAIChatPayload {
  choices?: Array<{ message?: { content?: string } }>
  usage?: OpenAIUsagePayload
}

function toTokenUsage(usage: OpenAIUsagePayload): TokenUsage {
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  }
}

/**
 * 统一的流式聊天接口
 * 使用 AsyncGenerator 逐块 yield 带类型标记的 chunk（reasoning 或 content）
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
  signal?: AbortSignal,
  result?: StreamResult,
  meta?: AICallMeta,
): AsyncGenerator<AIStreamChunk> {
  const trimmed = trimMessagesToFit(messages, config.provider, config.model, config.maxTokens, config.contextWindow)
  if (trimmed.trimmed) {
    console.warn(`[AI] request messages trimmed to fit context window: ${trimmed.totalInputTokens}/${trimmed.inputBudget} tokens`)
  }
  if (!trimmed.protectedEnvelopePreserved) {
    throw new Error('当前模型上下文窗口无法容纳最低连续性保护块；请降低输出长度或改用更大上下文模型。')
  }
  const req = buildRequest(config, trimmed.messages, true)

  const log = createLog({
    type: 'stream',
    provider: config.provider,
    url: req.logUrl,
    model: config.model,
    status: 'pending',
  })

  const startTime = Date.now()

  try {
    const credentialId = await bindAiCredential({
      key: 'storyforge.ai.primary',
      apiKey: config.apiKey,
      provider: config.provider,
      profileId: 'primary',
      operation: 'chat-completions',
      configuredBaseUrl: req.configuredBaseUrl,
    })

    // 自动重试：遇到 429（频率限制）或 503（服务不可用）时，最多重试 2 次
    let response: AiTransportResponse | undefined
    const MAX_RETRIES = 2
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await executeAiRequest({
        provider: config.provider,
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: req.configuredBaseUrl,
        credentialId,
        body: req.body,
        signal,
      })

      if (isSuccessfulAiResponse(response)) break

      // 429/503 可重试
      if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
        const wait = (attempt + 1) * 2000 // 2s, 4s
        console.warn(`[AI] HTTP ${response.status}，${wait / 1000}s 后重试（${attempt + 1}/${MAX_RETRIES}）`)
        // 消费错误响应，确保 Web reader / Native channel 在下一次尝试前释放。
        await readAiResponseText(response.body)
        await waitForAiRetry(wait, signal)
        continue
      }

      break
    }

    if (!response) throw new Error('AI transport 未返回响应')

    if (!isSuccessfulAiResponse(response)) {
      const errorText = await readAiResponseText(response.body)
      const duration = Date.now() - startTime
      updateLog(log.id, { status: 'error', statusCode: response.status, duration, errorMessage: errorText.slice(0, 200) })
      throw new AIError(response.status, errorText)
    }

    let usage: TokenUsage | undefined

    // <think> 标签解析状态（兼容中转将思考包裹在 content 的 <think>...</think> 中）
    let insideThinkTag = false
    let contentTagBuffer = ''

    const complete = () => {
      const logUpdate: Record<string, unknown> = {
        status: 'success',
        statusCode: response.status,
        duration: Date.now() - startTime,
      }
      if (usage) logUpdate.usage = usage
      if (result && usage) result.usage = usage
      updateLog(log.id, logUpdate)
      if (usage) {
        void recordUsage({
          projectId: meta?.projectId ?? null,
          timestamp: Date.now(),
          category: meta?.category ?? '',
          model: config.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        })
      }
    }

    for await (const data of readSseData(response.body)) {
      if (data === '[DONE]') {
        // 冲刷标签缓冲区残留
        if (contentTagBuffer) {
          yield { kind: insideThinkTag ? 'reasoning' : 'content', text: contentTagBuffer }
          contentTagBuffer = ''
        }
        complete()
        return
      }
      try {
        const json = JSON.parse(data) as OpenAIStreamPayload
        const delta = json.choices?.[0]?.delta
        if (delta) {
          const reasoning = delta.reasoning_content ?? delta.thinking ?? delta.reasoning
          if (reasoning) yield { kind: 'reasoning', text: reasoning }
          const content = delta.content
          if (content) {
            // <think> 标签解析：中转可能将思考包裹在 content 的 <think>...</think> 中
            contentTagBuffer += content
            while (contentTagBuffer.length > 0) {
              if (!insideThinkTag) {
                const idx = contentTagBuffer.indexOf('<think>')
                if (idx !== -1) {
                  const before = contentTagBuffer.slice(0, idx)
                  if (before) yield { kind: 'content', text: before }
                  contentTagBuffer = contentTagBuffer.slice(idx + 7)
                  insideThinkTag = true
                } else {
                  // 检查末尾是否可能是 <think> 的不完整前缀（最多 6 字符）
                  let holdback = 0
                  for (let i = 1; i < 7 && i <= contentTagBuffer.length; i++) {
                    if ('<think>'.startsWith(contentTagBuffer.slice(-i))) { holdback = i; break }
                  }
                  const safe = contentTagBuffer.slice(0, contentTagBuffer.length - holdback)
                  if (safe) yield { kind: 'content', text: safe }
                  contentTagBuffer = holdback ? contentTagBuffer.slice(-holdback) : ''
                  break
                }
              } else {
                const idx = contentTagBuffer.indexOf('</think>')
                if (idx !== -1) {
                  const before = contentTagBuffer.slice(0, idx)
                  if (before) yield { kind: 'reasoning', text: before }
                  contentTagBuffer = contentTagBuffer.slice(idx + 8)
                  insideThinkTag = false
                } else {
                  let holdback = 0
                  for (let i = 1; i < 8 && i <= contentTagBuffer.length; i++) {
                    if ('</think>'.startsWith(contentTagBuffer.slice(-i))) { holdback = i; break }
                  }
                  const safe = contentTagBuffer.slice(0, contentTagBuffer.length - holdback)
                  if (safe) yield { kind: 'reasoning', text: safe }
                  contentTagBuffer = holdback ? contentTagBuffer.slice(-holdback) : ''
                  break
                }
              }
            }
          }
        }
        // 提取 token 用量（通常在最后一个 chunk 中）
        if (json.usage) usage = toTokenUsage(json.usage)
      } catch {
        // 与旧实现一致：忽略单个不可解析的 SSE data，不中断整个生成。
      }
    }

    // 流结束：冲刷标签缓冲区残留
    if (contentTagBuffer) {
      yield { kind: insideThinkTag ? 'reasoning' : 'content', text: contentTagBuffer }
      contentTagBuffer = ''
    }

    complete()
  } catch (err) {
    if (err instanceof AIError) throw err
    const normalizedError = normalizeAiTransportError(err)
    const duration = Date.now() - startTime
    updateLog(log.id, {
      status: 'error',
      duration,
      errorMessage: normalizedError instanceof Error ? normalizedError.message : String(normalizedError),
    })
    throw normalizedError
  }
}

/**
 * 非流式聊天（用于简单调用如测试连接）
 */
export async function chat(
  messages: ChatMessage[],
  config: AIConfig,
  meta?: AICallMeta,
  signal?: AbortSignal,
  result?: ChatResult,
): Promise<string> {
  const trimmed = trimMessagesToFit(messages, config.provider, config.model, config.maxTokens, config.contextWindow)
  if (trimmed.trimmed) {
    console.warn(`[AI] request messages trimmed to fit context window: ${trimmed.totalInputTokens}/${trimmed.inputBudget} tokens`)
  }
  if (!trimmed.protectedEnvelopePreserved) {
    throw new Error('当前模型上下文窗口无法容纳最低连续性保护块；请降低输出长度或改用更大上下文模型。')
  }
  const req = buildRequest(config, trimmed.messages, false)

  const credentialId = await bindAiCredential({
    key: 'storyforge.ai.primary',
    apiKey: config.apiKey,
    provider: config.provider,
    profileId: 'primary',
    operation: 'chat-completions',
    configuredBaseUrl: req.configuredBaseUrl,
  })
  const response = await executeAiRequest({
    provider: config.provider,
    profileId: 'primary',
    operation: 'chat-completions',
    configuredBaseUrl: req.configuredBaseUrl,
    credentialId,
    body: req.body,
    signal,
  })

  if (!isSuccessfulAiResponse(response)) {
    const errorText = await readAiResponseText(response.body)
    throw new AIError(response.status, errorText)
  }

  const json = JSON.parse(await readAiResponseText(response.body)) as OpenAIChatPayload
  if (json.usage) {
    const usage = toTokenUsage(json.usage)
    if (result) result.usage = usage
    void recordUsage({
      projectId: meta?.projectId ?? null,
      timestamp: Date.now(),
      category: meta?.category ?? '',
      model: config.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    })
  }
  return json.choices?.[0]?.message?.content || ''
}
