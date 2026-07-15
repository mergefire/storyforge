import { describe, expect, it, vi } from 'vitest'
import { initializeRuntimeCapabilities } from '../../src/runtime/bootstrap'
import { RuntimeError } from '../../src/runtime/errors'
import { createTauriRuntime } from '../../src/runtime/tauri'
import { selectRuntimeAdapter } from '../../src/runtime/target'

describe('D1.1 restricted Tauri runtime', () => {
  function createRuntime() {
    return createTauriRuntime({
      channel: 'dev',
      packaged: false,
      version: '3.7.5-test',
      identifier: 'io.github.yuanbw2025.storyforge.dev',
      now: () => 1234,
    })
  }

  it('registers as tauri and reports the isolated development identity', async () => {
    const runtime = selectRuntimeAdapter('tauri', { tauri: createRuntime })

    expect(runtime.kind).toBe('tauri')
    await expect(runtime.distribution.getInfo()).resolves.toEqual({
      runtime: 'tauri',
      channel: 'dev',
      packaged: false,
      version: '3.7.5-test',
      identifier: 'io.github.yuanbw2025.storyforge.dev',
    })
  })

  it('boots without Web fallbacks while durability remains explicitly unavailable', async () => {
    const logger = { info: vi.fn(), warn: vi.fn() }
    await expect(initializeRuntimeCapabilities(createRuntime(), logger)).resolves.toBeUndefined()

    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledOnce()
    expect(logger.warn.mock.calls[0][1]).toMatchObject<Partial<RuntimeError>>({
      code: 'UNAVAILABLE',
      operation: 'durability.inspect',
    })
  })

  it('fails closed for native capabilities not implemented in D1.1', async () => {
    const runtime = createRuntime()

    await expect(runtime.files.save({
      purpose: 'project-json',
      suggestedName: 'synthetic.json',
      content: { kind: 'text', text: '{}' },
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'UNAVAILABLE', operation: 'files.save' })
    await expect(runtime.secrets.put({
      key: 'storyforge.github.gist',
      persistence: 'session',
      scope: { kind: 'github-gist' },
    }, 'must-not-be-stored')).rejects.toMatchObject<Partial<RuntimeError>>({
      code: 'UNAVAILABLE',
      operation: 'secrets.put',
    })
    await expect(runtime.ai.execute({
      endpoint: {
        provider: 'deepseek',
        profileId: 'synthetic',
        operation: 'chat-completions',
        configuredBaseUrl: '/deepseek-proxy/v1',
      },
      body: {},
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'UNAVAILABLE', operation: 'ai.execute' })
  })

  it('keeps empty pre-native state safe to inspect and clear', async () => {
    const runtime = createRuntime()

    await expect(runtime.secrets.has('storyforge.github.gist')).resolves.toBe(false)
    await expect(runtime.secrets.reference('storyforge.github.gist')).resolves.toBeNull()
    await expect(runtime.secrets.delete('storyforge.github.gist')).resolves.toBeUndefined()
    await expect(runtime.files.inspectBackupBinding('synthetic-project')).resolves.toEqual({
      bindingId: 'synthetic-project',
      label: '',
      permission: 'missing',
    })
    await expect(runtime.files.clearBackupBinding('synthetic-project')).resolves.toBeUndefined()
    await expect(runtime.updates.initialize()).resolves.toBeUndefined()
    await expect(runtime.updates.check()).resolves.toBeNull()
  })

  it('preserves AbortSignal semantics before reporting unavailable capability', async () => {
    const runtime = createRuntime()
    const controller = new AbortController()
    controller.abort()

    await expect(runtime.ai.execute({
      endpoint: {
        provider: 'openai',
        profileId: 'synthetic',
        operation: 'chat-completions',
        configuredBaseUrl: '/openai-proxy/v1',
      },
      body: {},
      signal: controller.signal,
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED', operation: 'ai.execute' })
  })

  it('keeps diagnostics bounded and tied to tauri distribution metadata', async () => {
    const runtime = createRuntime()
    runtime.diagnostics.record({
      kind: 'runtime-capability',
      timestamp: 1,
      capability: 'distribution',
      outcome: 'completed',
    })

    await expect(runtime.diagnostics.snapshot()).resolves.toMatchObject({
      generatedAt: 1234,
      distribution: { runtime: 'tauri', channel: 'dev' },
      events: [{ kind: 'runtime-capability', capability: 'distribution' }],
    })
  })
})
