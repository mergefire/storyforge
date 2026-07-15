import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AIConfig, ChatMessage, EmbeddingConfig } from '../../src/lib/types'
import { AIError } from '../../src/lib/types'
import { chat, streamChat, type AIStreamChunk, type StreamResult } from '../../src/lib/ai/client'
import {
  embedTexts,
  isEmbeddingReady,
} from '../../src/lib/ai/adapters/embedding-adapter'
import { bindAiCredential } from '../../src/lib/ai/runtime-transport'
import {
  getRuntime,
  RuntimeError,
  setRuntimeAdapter,
  type AiTransportRequest,
  type AiTransportResponse,
} from '../../src/runtime'
import { createFakeRuntime } from '../../src/runtime/fake'
import { useAIConfigStore } from '../../src/stores/ai-config'

const { recordUsageMock } = vi.hoisted(() => ({
  recordUsageMock: vi.fn(async () => undefined),
}))

vi.mock('../../src/lib/ai/usage-log', () => ({
  recordUsage: recordUsageMock,
}))

const originalRuntime = getRuntime()
const encoder = new TextEncoder()

const chatConfig = (overrides: Partial<AIConfig> = {}): AIConfig => ({
  provider: 'custom',
  apiKey: 'sk-test',
  model: 'local-model',
  baseUrl: 'http://192.168.1.50:1234/v1',
  temperature: 0.7,
  maxTokens: 1024,
  ...overrides,
})

const embeddingConfig = (overrides: Partial<EmbeddingConfig> = {}): EmbeddingConfig => ({
  enabled: true,
  provider: 'custom',
  apiKey: '',
  baseUrl: 'http://192.168.1.50:1234/v1',
  model: 'bge-m3',
  ...overrides,
})

function responseFromChunks(status: number, chunks: readonly Uint8Array[]): AiTransportResponse {
  return {
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'ERROR',
    body: (async function* () {
      for (const chunk of chunks) yield chunk
    })(),
  }
}

function textResponse(status: number, text: string): AiTransportResponse {
  return responseFromChunks(status, [encoder.encode(text)])
}

function splitBytes(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
  const points = [...new Set(cuts)]
    .filter(point => point > 0 && point < bytes.length)
    .sort((a, b) => a - b)
  const chunks: Uint8Array[] = []
  let offset = 0
  for (const point of points) {
    chunks.push(bytes.slice(offset, point))
    offset = point
  }
  chunks.push(bytes.slice(offset))
  return chunks
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

async function collect(stream: AsyncGenerator<AIStreamChunk>): Promise<AIStreamChunk[]> {
  const chunks: AIStreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

afterEach(() => {
  setRuntimeAdapter(originalRuntime)
  vi.useRealTimers()
  vi.restoreAllMocks()
  recordUsageMock.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})

describe('AI callers use RuntimeAdapter without losing protocol semantics', () => {
  it('parses UTF-8/SSE chunks, reasoning, split think tags, usage and DONE', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"推理"}}]}\n',
      'data: {"choices":[{"delta":{"content":"开<t"}}]}\n',
      'data: {"choices":[{"delta":{"content":"hink>内</thi"}}]}\n',
      'data: {"choices":[{"delta":{"content":"nk>文"}}]}\n',
      'data: {"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}\n',
      'data: [DONE]\n\n',
    ].join('')
    const bytes = encoder.encode(sse)
    const chineseAt = indexOfBytes(bytes, encoder.encode('推'))
    expect(chineseAt).toBeGreaterThan(0)

    const runtime = createFakeRuntime()
    const execute = vi.spyOn(runtime.ai, 'execute').mockResolvedValue(responseFromChunks(
      200,
      splitBytes(bytes, [2, 9, chineseAt + 1, chineseAt + 2, chineseAt + 19, bytes.length - 3]),
    ))
    setRuntimeAdapter(runtime)

    const result: StreamResult = {}
    const chunks = await collect(streamChat(
      [{ role: 'user', content: '开始' }],
      chatConfig({ baseUrl: 'http://192.168.1.50:1234/v1/chat/completions' }),
      undefined,
      result,
      { category: 'chapter.content', projectId: 7 },
    ))

    expect(chunks.filter(chunk => chunk.kind === 'reasoning').map(chunk => chunk.text).join(''))
      .toBe('推理内')
    expect(chunks.filter(chunk => chunk.kind === 'content').map(chunk => chunk.text).join(''))
      .toBe('开文')
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 7, totalTokens: 18 })
    expect(recordUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'chapter.content',
      projectId: 7,
      inputTokens: 11,
      outputTokens: 7,
    }))

    const request = execute.mock.calls[0][0]
    expect(request.endpoint).toEqual({
      provider: 'custom',
      profileId: 'primary',
      operation: 'chat-completions',
      configuredBaseUrl: 'http://192.168.1.50:1234/v1',
    })
    expect(request.credentialId).toBeDefined()
    expect(request.body).toMatchObject({ model: 'local-model', stream: true })
  })

  it('keeps non-streaming JSON, usage, AbortSignal and raw HTTP errors', async () => {
    const runtime = createFakeRuntime()
    const execute = vi.spyOn(runtime.ai, 'execute')
      .mockResolvedValueOnce(textResponse(200, JSON.stringify({
        choices: [{ message: { content: '完成' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      })))
      .mockResolvedValueOnce(textResponse(401, '{"error":"bad key"}'))
    setRuntimeAdapter(runtime)

    const controller = new AbortController()
    const result: { usage?: { inputTokens: number; outputTokens: number; totalTokens: number } } = {}
    await expect(chat(
      [{ role: 'user', content: 'ping' }],
      chatConfig(),
      { category: 'test' },
      controller.signal,
      result,
    )).resolves.toBe('完成')
    expect(execute.mock.calls[0][0].signal).toBe(controller.signal)
    expect(execute.mock.calls[0][0].body).toMatchObject({ stream: false })
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 2, totalTokens: 5 })

    const rejected = chat([{ role: 'user', content: 'ping' }], chatConfig())
    await expect(rejected).rejects.toBeInstanceOf(AIError)
    await expect(rejected).rejects.toMatchObject({ status: 401, body: '{"error":"bad key"}' })
  })

  it('retries only 429/503 twice and makes backoff abortable', async () => {
    vi.useFakeTimers()
    const runtime = createFakeRuntime()
    const execute = vi.spyOn(runtime.ai, 'execute')
      .mockResolvedValueOnce(textResponse(429, 'rate limited'))
      .mockResolvedValueOnce(textResponse(503, 'unavailable'))
      .mockResolvedValueOnce(textResponse(200, 'data: [DONE]\n\n'))
    setRuntimeAdapter(runtime)

    const completed = collect(streamChat([{ role: 'user', content: 'ping' }], chatConfig()))
    await vi.runAllTimersAsync()
    await expect(completed).resolves.toEqual([])
    expect(execute).toHaveBeenCalledTimes(3)

    const abortRuntime = createFakeRuntime()
    const abortExecute = vi.spyOn(abortRuntime.ai, 'execute')
      .mockResolvedValue(textResponse(429, 'rate limited'))
    setRuntimeAdapter(abortRuntime)
    const controller = new AbortController()
    const aborted = collect(streamChat(
      [{ role: 'user', content: 'ping' }],
      chatConfig(),
      controller.signal,
    ))
    const abortedExpectation = expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(0)
    expect(abortExecute).toHaveBeenCalledOnce()
    controller.abort()
    await abortedExpectation
    expect(abortExecute).toHaveBeenCalledOnce()
  })

  it('preserves the provider-specific request body matrix', async () => {
    const runtime = createFakeRuntime()
    const requests: AiTransportRequest[] = []
    vi.spyOn(runtime.ai, 'execute').mockImplementation(async request => {
      requests.push(request)
      return textResponse(200, 'data: [DONE]\n\n')
    })
    setRuntimeAdapter(runtime)

    const cases: Array<{ config: AIConfig; messages?: ChatMessage[] }> = [
      { config: chatConfig({ provider: 'poe', model: 'Claude-Sonnet-4.6', temperature: 0.9, maxTokens: 3000 }) },
      {
        config: chatConfig({ provider: 'deepseek', model: 'deepseek-v4-pro', maxTokens: 4000 }),
        messages: [{ role: 'system', content: '思考深度：深入' }, { role: 'user', content: '写' }],
      },
      { config: chatConfig({ provider: 'glm', model: 'glm-5', temperature: 2 }) },
      { config: chatConfig({ provider: 'longcat', model: 'LongCat-2.0', temperature: 2 }) },
      {
        config: chatConfig({ provider: 'custom', model: 'claude-opus-custom' }),
        messages: [{ role: 'system', content: '思考深度：深入' }, { role: 'user', content: '写' }],
      },
      { config: chatConfig({ provider: 'custom', model: 'qwen3-thinking' }) },
    ]

    for (const item of cases) {
      await collect(streamChat(item.messages ?? [{ role: 'user', content: '写' }], item.config))
    }

    const bodies = requests.map(request => request.body as Record<string, unknown>)
    expect(Object.keys(bodies[0]).sort()).toEqual(['messages', 'model', 'stream'])
    expect(bodies[1]).toMatchObject({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
      max_tokens: 4000,
      stream_options: { include_usage: true },
    })
    expect(bodies[2]).toMatchObject({ temperature: 1, thinking: { type: 'enabled' } })
    expect(bodies[2]).not.toHaveProperty('stream_options')
    expect(bodies[3]).toMatchObject({ temperature: 1 })
    expect(bodies[3]).not.toHaveProperty('stream_options')
    expect(bodies[4]).toMatchObject({
      thinking: { type: 'enabled', budget_tokens: 16000 },
      stream_options: { include_usage: true },
    })
    expect(JSON.stringify(bodies[4].messages)).toContain('<think>')
    expect(bodies[5]).toMatchObject({ enable_thinking: true })
  })

  it('keeps anonymous requests from revoking an in-flight keyed request', async () => {
    const runtime = createFakeRuntime()
    setRuntimeAdapter(runtime)

    for (const key of ['storyforge.ai.primary', 'storyforge.ai.embedding'] as const) {
      const endpoint = {
        provider: 'custom' as const,
        profileId: key === 'storyforge.ai.primary' ? 'primary' : 'embedding',
        operation: key.endsWith('embedding') ? 'embeddings' as const : 'chat-completions' as const,
        configuredBaseUrl: 'http://localhost:11434/v1',
      }
      const keyedCredential = await bindAiCredential({ key, apiKey: 'secret', ...endpoint })
      expect(keyedCredential).toBeDefined()
      expect(await runtime.secrets.has(key)).toBe(true)
      expect(await bindAiCredential({ key, apiKey: '', ...endpoint })).toBeUndefined()
      expect(await runtime.secrets.has(key)).toBe(true)

      await expect(runtime.ai.execute({
        endpoint,
        credentialId: keyedCredential,
        body: {},
      })).resolves.toMatchObject({ status: 200 })

      await runtime.secrets.delete(key)
      await expect(runtime.ai.execute({
        endpoint,
        credentialId: keyedCredential,
        body: {},
      })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
    }

    const execute = vi.spyOn(runtime.ai, 'execute').mockResolvedValue(textResponse(200, JSON.stringify({
      choices: [{ message: { content: 'anonymous' } }],
    })))
    await expect(chat(
      [{ role: 'user', content: 'ping' }],
      chatConfig({ apiKey: '', provider: 'custom' }),
    )).resolves.toBe('anonymous')
    expect(execute.mock.calls[0][0].credentialId).toBeUndefined()
  })
})

describe('embedding caller uses the same typed runtime boundary', () => {
  it('requires a key except for custom/Ollama and preserves index ordering', async () => {
    expect(isEmbeddingReady(embeddingConfig({ provider: 'openai', apiKey: '' }))).toBe(false)
    expect(isEmbeddingReady(embeddingConfig({ provider: 'openai', apiKey: 'sk-openai' }))).toBe(true)
    expect(isEmbeddingReady(embeddingConfig({ provider: 'custom', apiKey: '' }))).toBe(true)
    expect(isEmbeddingReady(embeddingConfig({ provider: 'ollama', apiKey: '' }))).toBe(true)

    const runtime = createFakeRuntime()
    const execute = vi.spyOn(runtime.ai, 'execute').mockResolvedValue(textResponse(200, JSON.stringify({
      data: [
        { index: 1, embedding: [4, 5, 6] },
        { index: 0, embedding: [1, 2, 3] },
      ],
    })))
    setRuntimeAdapter(runtime)

    await expect(embedTexts(['甲', '乙'], embeddingConfig(), 9)).resolves.toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ])
    const request = execute.mock.calls[0][0]
    expect(request.endpoint).toEqual({
      provider: 'custom',
      profileId: 'embedding',
      operation: 'embeddings',
      configuredBaseUrl: 'http://192.168.1.50:1234/v1',
    })
    expect(request.credentialId).toBeUndefined()
    expect(request.body).toEqual({ model: 'bge-m3', input: ['甲', '乙'] })
  })

  it('honors an already-aborted signal and the 60 second timeout', async () => {
    const runtime = createFakeRuntime()
    setRuntimeAdapter(runtime)
    const preAborted = new AbortController()
    preAborted.abort()
    await expect(embedTexts(['甲'], embeddingConfig(), null, preAborted.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(runtime.state.aiRequests).toHaveLength(0)

    vi.useFakeTimers()
    const execute = vi.spyOn(runtime.ai, 'execute').mockImplementation(async request => {
      return await new Promise<AiTransportResponse>((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
          reject(new RuntimeError('ABORTED', '操作已中止', { operation: 'ai.execute' }))
        }, { once: true })
      })
    })
    const timedOut = embedTexts(['乙'], embeddingConfig())
    const timeoutExpectation = expect(timedOut).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(60_000)
    await timeoutExpectation
    expect(execute).toHaveBeenCalledOnce()
  })
})

describe('AI connection test keeps legacy result semantics', () => {
  it('normalizes LAN base URL, allows anonymous custom and treats 402 as connected', async () => {
    const runtime = createFakeRuntime()
    const execute = vi.spyOn(runtime.ai, 'execute').mockResolvedValue(textResponse(402, JSON.stringify({
      error: { message: 'insufficient balance' },
    })))
    setRuntimeAdapter(runtime)
    useAIConfigStore.setState({
      config: chatConfig({
        provider: 'custom',
        apiKey: '',
        baseUrl: 'http://192.168.1.50:1234/v1/chat/completions',
      }),
      rememberApiKey: false,
    })

    const result = await useAIConfigStore.getState().testConnection()
    expect(result).toMatchObject({ ok: true, statusCode: 402 })
    expect(result.message).toContain('连接成功')
    expect(result.message).toContain('账户余额不足')
    expect(useAIConfigStore.getState().config.baseUrl).toBe('http://192.168.1.50:1234/v1')
    expect(execute.mock.calls[0][0].endpoint.configuredBaseUrl)
      .toBe('http://192.168.1.50:1234/v1')
    expect(execute.mock.calls[0][0].credentialId).toBeUndefined()
  })

  it('keeps Chinese HTTP errors, network hints and the 15 second timeout', async () => {
    const runtime = createFakeRuntime()
    const execute = vi.spyOn(runtime.ai, 'execute')
      .mockResolvedValueOnce(textResponse(401, JSON.stringify({ error: { message: 'invalid api key' } })))
      .mockRejectedValueOnce(new RuntimeError('NETWORK', '运行时网络请求失败', {
        operation: 'ai.execute',
      }))
    setRuntimeAdapter(runtime)
    useAIConfigStore.setState({ config: chatConfig(), rememberApiKey: false })

    const unauthorized = await useAIConfigStore.getState().testConnection()
    expect(unauthorized).toMatchObject({ ok: false, statusCode: 401 })
    expect(unauthorized.message).toContain('API Key 无效或已过期')

    const network = await useAIConfigStore.getState().testConnection()
    expect(network.ok).toBe(false)
    expect(network.message).toContain('网络错误')

    vi.useFakeTimers()
    execute.mockImplementationOnce(async request => {
      return await new Promise<AiTransportResponse>((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
          reject(new RuntimeError('ABORTED', '操作已中止', { operation: 'ai.execute' }))
        }, { once: true })
      })
    })
    const timedOut = useAIConfigStore.getState().testConnection()
    const timeoutExpectation = expect(timedOut).resolves.toMatchObject({
      ok: false,
      message: '❌ 请求超时',
    })
    await vi.advanceTimersByTimeAsync(15_000)
    await timeoutExpectation
  })
})
