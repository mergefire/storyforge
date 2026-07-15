import { afterEach, describe, expect, it, vi } from 'vitest'
import { getModelPreset } from '../../src/lib/ai/context-budget'
import { PROVIDER_MODELS, PROVIDER_PRESETS } from '../../src/lib/types'

const CONFIG_KEY = 'storyforge-ai-config'
const SESSION_KEY = 'storyforge-ai-api-key-session'
const REMEMBER_KEY = 'storyforge-ai-api-key-remember'

async function freshStore() {
  vi.resetModules()
  const runtimeApi = await import('../../src/runtime')
  const { createFakeRuntime } = await import('../../src/runtime/fake')
  runtimeApi.setRuntimeAdapter(createFakeRuntime())
  const mod = await import('../../src/stores/ai-config')
  return mod.useAIConfigStore
}

async function freshStoreWithFakeRuntime() {
  vi.resetModules()
  const runtimeApi = await import('../../src/runtime')
  const { createFakeRuntime } = await import('../../src/runtime/fake')
  const runtime = createFakeRuntime()
  runtimeApi.setRuntimeAdapter(runtime)
  const { useAIConfigStore } = await import('../../src/stores/ai-config')
  return { runtime, useAIConfigStore }
}

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()
})

describe('R-AI-CONFIG · API Key 存储策略', () => {
  it('默认只把 API Key 存入 sessionStorage,localStorage 配置不落 key', async () => {
    const useAIConfigStore = await freshStore()
    await useAIConfigStore.getState().setConfig({ apiKey: 'sk-session' })

    expect(useAIConfigStore.getState().rememberApiKey).toBe(false)
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('sk-session')
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}').apiKey).toBe('')
    expect(localStorage.getItem(REMEMBER_KEY)).toBe('false')
  })

  it('显式记住本机时才把 API Key 写入 localStorage', async () => {
    const useAIConfigStore = await freshStore()
    await useAIConfigStore.getState().setRememberApiKey(true)
    await useAIConfigStore.getState().setConfig({ apiKey: 'sk-local' })

    expect(useAIConfigStore.getState().rememberApiKey).toBe(true)
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}').apiKey).toBe('sk-local')
    expect(localStorage.getItem(REMEMBER_KEY)).toBe('true')
  })

  it('兼容旧版 localStorage 配置:已有 apiKey 初始化为已记住状态', async () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      provider: 'deepseek',
      apiKey: 'sk-legacy',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
      temperature: 0.7,
      maxTokens: 0,
    }))

    const useAIConfigStore = await freshStore()

    expect(useAIConfigStore.getState().rememberApiKey).toBe(true)
    expect(useAIConfigStore.getState().config.apiKey).toBe('sk-legacy')
  })

  it('session-only 模式保存预设时不把当前 API Key 写进预设 localStorage', async () => {
    const useAIConfigStore = await freshStore()
    await useAIConfigStore.getState().setConfig({ apiKey: 'sk-session' })
    useAIConfigStore.getState().saveAsPreset('会话预设')

    const presets = JSON.parse(localStorage.getItem('storyforge-ai-presets') || '[]')
    expect(presets[0].config.apiKey).toBe('')
  })

  it('应用预设后修改配置仍保留可覆盖的来源预设', async () => {
    const useAIConfigStore = await freshStore()
    const id = useAIConfigStore.getState().saveAsPreset('主力配置')
    useAIConfigStore.getState().applyPreset(id)
    useAIConfigStore.getState().setConfig({ baseUrl: 'https://example.com/v1', model: 'new-model' })

    expect(useAIConfigStore.getState().activePresetId).toBeNull()
    expect(useAIConfigStore.getState().editingPresetId).toBe(id)

    useAIConfigStore.getState().updatePresetFromCurrent(id)
    const preset = useAIConfigStore.getState().presets.find(p => p.id === id)
    expect(preset?.config.baseUrl).toBe('https://example.com/v1')
    expect(preset?.config.model).toBe('new-model')
    expect(useAIConfigStore.getState().activePresetId).toBe(id)
  })

  it('上下文窗口即时持久化，修改模型和切换 provider 不会静默清除', async () => {
    const useAIConfigStore = await freshStore()
    useAIConfigStore.getState().setConfig({ contextWindow: 2_100_000 })
    useAIConfigStore.getState().setConfig({ model: 'custom-model' })
    useAIConfigStore.getState().switchProvider('ollama')

    expect(useAIConfigStore.getState().config.contextWindow).toBe(2_100_000)
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}').contextWindow).toBe(2_100_000)

    const reloadedStore = await freshStore()
    expect(reloadedStore.getState().config.contextWindow).toBe(2_100_000)
  })

  it('保存和应用预设时明确采用预设中的上下文窗口', async () => {
    const useAIConfigStore = await freshStore()
    useAIConfigStore.getState().setConfig({ contextWindow: 131_072 })
    const id = useAIConfigStore.getState().saveAsPreset('128K 本地模型')
    useAIConfigStore.getState().setConfig({ contextWindow: 2_100_000 })
    useAIConfigStore.getState().applyPreset(id)

    expect(useAIConfigStore.getState().config.contextWindow).toBe(131_072)
    expect(useAIConfigStore.getState().presets.find(preset => preset.id === id)?.config.contextWindow).toBe(131_072)
  })

  it('LongCat provider 使用官方 OpenAI 兼容端点和 1M 上下文预设', async () => {
    expect(PROVIDER_PRESETS.longcat?.baseUrl).toBe('https://api.longcat.chat/openai/v1')
    expect(PROVIDER_PRESETS.longcat?.model).toBe('LongCat-2.0')
    expect(PROVIDER_MODELS.longcat?.[0]?.value).toBe('LongCat-2.0')

    const preset = getModelPreset('longcat', 'LongCat-2.0')
    expect(preset.maxContext).toBe(1_000_000)
    expect(preset.maxOutput).toBe(128_000)

    const useAIConfigStore = await freshStore()
    await useAIConfigStore.getState().switchProvider('longcat')
    expect(useAIConfigStore.getState().config.baseUrl).toBe('https://api.longcat.chat/openai/v1')
    expect(useAIConfigStore.getState().config.model).toBe('LongCat-2.0')
  })

  it('显式清空或取消记住会删除 vault secret 并使旧引用失效', async () => {
    const { runtime, useAIConfigStore } = await freshStoreWithFakeRuntime()
    await useAIConfigStore.getState().setConfig({ apiKey: 'sk-primary' })
    const primaryDescriptor = {
      key: 'storyforge.ai.primary' as const,
      persistence: 'device' as const,
      scope: {
        kind: 'ai' as const,
        provider: 'deepseek' as const,
        profileId: 'primary',
        operation: 'chat-completions' as const,
        configuredBaseUrl: 'https://api.deepseek.com/v1',
      },
    }
    const oldReference = await runtime.secrets.put(primaryDescriptor, 'sk-primary')

    await useAIConfigStore.getState().setConfig({ apiKey: '' })
    expect(await runtime.secrets.has(primaryDescriptor.key)).toBe(false)
    await expect(runtime.ai.execute({
      endpoint: primaryDescriptor.scope,
      credentialId: oldReference,
      body: {},
    })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })

    await useAIConfigStore.getState().setRememberApiKey(true)
    await runtime.secrets.put(primaryDescriptor, 'sk-primary')
    await runtime.secrets.put({
      key: 'storyforge.ai.embedding',
      persistence: 'device',
      scope: {
        kind: 'ai',
        provider: 'ollama',
        profileId: 'embedding',
        operation: 'embeddings',
        configuredBaseUrl: 'http://localhost:11434/v1',
      },
    }, 'sk-embedding')
    await useAIConfigStore.getState().setRememberApiKey(false)
    expect(await runtime.secrets.has('storyforge.ai.primary')).toBe(false)
    expect(await runtime.secrets.has('storyforge.ai.embedding')).toBe(false)
  })

  it('切换供应商或不同端点预设不会继承并重绑定旧供应商 key', async () => {
    const { runtime, useAIConfigStore } = await freshStoreWithFakeRuntime()
    await useAIConfigStore.getState().setConfig({ apiKey: 'sk-deepseek' })
    await runtime.secrets.put({
      key: 'storyforge.ai.primary',
      persistence: 'session',
      scope: {
        kind: 'ai',
        provider: 'deepseek',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://api.deepseek.com/v1',
      },
    }, 'sk-deepseek')

    await useAIConfigStore.getState().switchProvider('openai')
    expect(useAIConfigStore.getState().config.apiKey).toBe('')
    expect(await runtime.secrets.has('storyforge.ai.primary')).toBe(false)

    useAIConfigStore.setState({
      config: { ...useAIConfigStore.getState().config, provider: 'deepseek', apiKey: 'sk-deepseek' },
      presets: [{
        id: 'openai-preset',
        name: 'OpenAI',
        config: {
          provider: 'openai',
          apiKey: '',
          model: 'gpt-4o',
          baseUrl: 'https://api.openai.com/v1',
          temperature: 0.7,
          maxTokens: 1024,
        },
      }],
    })
    await useAIConfigStore.getState().applyPreset('openai-preset')
    expect(useAIConfigStore.getState().config.apiKey).toBe('')
  })
})
