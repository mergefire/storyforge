import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchOpenAIModels,
  loadCachedOpenAIModels,
  saveCachedOpenAIModels,
} from '../../src/lib/ai/model-list'
import { setRuntimeAdapter } from '../../src/runtime'
import { createFakeRuntime } from '../../src/runtime/fake'

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

afterEach(() => {
  localStorage.clear()
})

describe('CF-20260702-11 · OpenAI-compatible 模型列表刷新', () => {
  it('按 provider 和标准化 Base URL 持久化最后一次成功的模型列表', () => {
    saveCachedOpenAIModels({
      provider: 'custom',
      baseUrl: 'https://models.example/v1/models/',
    }, ['model-z', 'model-a', 'model-z'])

    expect(loadCachedOpenAIModels({
      provider: 'custom',
      baseUrl: 'https://models.example/v1',
    })).toEqual(['model-a', 'model-z'])
  })

  it('不同服务的模型列表互不覆盖，同一服务刷新才替换旧缓存', () => {
    const custom = { provider: 'custom' as const, baseUrl: 'https://models.example/v1' }
    const ollama = { provider: 'ollama' as const, baseUrl: 'http://localhost:11434/v1' }

    saveCachedOpenAIModels(custom, ['old-model'])
    saveCachedOpenAIModels(ollama, ['local-model'])
    saveCachedOpenAIModels(custom, ['new-model'])

    expect(loadCachedOpenAIModels(custom)).toEqual(['new-model'])
    expect(loadCachedOpenAIModels(ollama)).toEqual(['local-model'])
  })

  it('标准化 Base URL，去重排序模型，并在无 Key 时不发送鉴权头', async () => {
    const fetchImpl = vi.fn(async () => response({
      data: [{ id: 'qwen3' }, { id: 'deepseek-r1' }, { id: 'qwen3' }, { id: '' }],
    }))

    const models = await fetchOpenAIModels({
      baseUrl: 'http://localhost:1234/v1/models',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(models).toEqual(['deepseek-r1', 'qwen3'])
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:1234/v1/models', expect.objectContaining({
      method: 'GET',
      headers: undefined,
    }))
  })

  it('有 Key 时沿用 Bearer 鉴权', async () => {
    const fetchImpl = vi.fn(async () => response({ data: [{ id: 'private-model' }] }))

    await fetchOpenAIModels({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/v1/models', expect.objectContaining({
      headers: { Authorization: 'Bearer sk-test' },
    }))
  })

  it('拒绝非 OpenAI 格式响应并保留手动输入回退', async () => {
    const fetchImpl = vi.fn(async () => response({ models: ['wrong-shape'] }))

    await expect(fetchOpenAIModels({
      baseUrl: 'http://localhost:11434/v1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toThrow('模型列表响应格式无效')
  })

  it('默认经 RuntimeAdapter 请求固定 models 操作并复用聊天凭据', async () => {
    const runtime = createFakeRuntime({
      aiChunks: [new TextEncoder().encode(JSON.stringify({ data: [{ id: 'runtime-model' }] }))],
    })
    setRuntimeAdapter(runtime)
    const credentialId = await runtime.secrets.put({
      key: 'storyforge.ai.primary',
      persistence: 'session',
      scope: {
        kind: 'ai',
        provider: 'custom',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://models.example/v1',
      },
    }, 'sk-runtime')

    await expect(fetchOpenAIModels({
      baseUrl: 'https://models.example/v1',
      provider: 'custom',
      profileId: 'primary',
      credentialId,
    })).resolves.toEqual(['runtime-model'])
    expect(runtime.state.aiRequests).toHaveLength(1)
    expect(runtime.state.aiRequests[0]).toMatchObject({
      endpoint: { operation: 'models', configuredBaseUrl: 'https://models.example/v1' },
      credentialId,
      body: null,
    })
  })
})

