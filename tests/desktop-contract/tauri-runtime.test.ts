import { describe, expect, it, vi } from 'vitest'
import { initializeRuntimeCapabilities } from '../../src/runtime/bootstrap'
import type { TauriIpcBridge } from '../../src/runtime/tauri'
import { createTauriRuntime } from '../../src/runtime/tauri'
import { selectRuntimeAdapter } from '../../src/runtime/target'

class SyntheticM1Bridge implements TauriIpcBridge {
  readonly calls: Array<{ command: string; args: Record<string, unknown> }> = []
  readonly fileChunks: number[][] = []
  private credential: string | null = null
  private credentialValue: string | null = null

  createChannel<T>(onmessage: (message: T) => void): { onmessage: (message: T) => void } {
    return { onmessage }
  }

  async invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ command, args })
    switch (command) {
      case 'runtime_durability_status':
        return { persisted: true } as T
      case 'runtime_diagnostics_snapshot':
        return [] as T
      case 'runtime_secret_put':
        this.credential = 'cred_synthetic'
        this.credentialValue = (args.request as { value?: string }).value ?? null
        return this.credential as T
      case 'runtime_secret_has':
        return (this.credential !== null) as T
      case 'runtime_secret_reference':
        return this.credential as T
      case 'runtime_ai_secret_reveal':
        return this.credentialValue as T
      case 'runtime_secret_delete':
        this.credential = null
        this.credentialValue = null
        return undefined as T
      case 'runtime_ai_approve_endpoint':
        return null as T
      case 'runtime_ai_execute': {
        const channel = args.channel as { onmessage: (event: unknown) => void }
        channel.onmessage({ event: 'started', data: { status: 200, statusText: 'OK' } })
        channel.onmessage({ event: 'chunk', data: { bytes: [0xe4, 0xbd] } })
        channel.onmessage({ event: 'chunk', data: { bytes: [0xa0, 0xe5, 0xa5, 0xbd] } })
        channel.onmessage({ event: 'done' })
        return undefined as T
      }
      case 'runtime_cancel_request':
        return true as T
      case 'runtime_file_begin_save':
        return {
          status: 'completed',
          value: { sessionId: 'write_synthetic', displayName: 'synthetic.json' },
        } as T
      case 'runtime_file_write_chunk':
        this.fileChunks.push(args.bytes as number[])
        return undefined as T
      case 'runtime_file_finish_write':
        return { displayName: 'synthetic.json' } as T
      case 'runtime_file_abort_write':
        return undefined as T
      case 'runtime_backup_inspect':
        return { bindingId: args.bindingId, label: '', permission: 'missing' } as T
      case 'runtime_backup_clear':
        return undefined as T
      default:
        throw { code: 'UNAVAILABLE', message: 'synthetic unavailable', operation: command }
    }
  }
}

describe('M1 native Tauri runtime', () => {
  function createRuntime(bridge = new SyntheticM1Bridge()) {
    return {
      bridge,
      runtime: createTauriRuntime({
        channel: 'dev',
        packaged: false,
        version: '3.7.5-test',
        identifier: 'io.github.yuanbw2025.storyforge.dev',
        now: () => 1234,
        ipc: bridge,
      }),
    }
  }

  it('registers as tauri and reports the isolated development identity', async () => {
    const { runtime } = createRuntime()
    const selected = selectRuntimeAdapter('tauri', { tauri: () => runtime })

    expect(selected.kind).toBe('tauri')
    await expect(selected.distribution.getInfo()).resolves.toEqual({
      runtime: 'tauri',
      channel: 'dev',
      packaged: false,
      version: '3.7.5-test',
      identifier: 'io.github.yuanbw2025.storyforge.dev',
    })
  })

  it('boots with native durability and without a Web fallback', async () => {
    const { runtime } = createRuntime()
    const logger = { info: vi.fn(), warn: vi.fn() }

    await expect(initializeRuntimeCapabilities(runtime, logger)).resolves.toBeUndefined()

    expect(logger.warn).not.toHaveBeenCalled()
    await expect(runtime.durability.inspect()).resolves.toEqual({ persisted: true })
  })

  it('keeps references opaque and exposes only an explicit AI-key reveal path', async () => {
    const { runtime, bridge } = createRuntime()
    const credential = await runtime.secrets.put({
      key: 'storyforge.github.gist',
      persistence: 'device',
      scope: { kind: 'github-gist' },
    }, 'synthetic-secret')

    expect(credential).toBe('cred_synthetic')
    await expect(runtime.secrets.reference('storyforge.github.gist')).resolves.toBe(credential)
    expect(Object.keys(runtime.secrets).sort()).toEqual(['delete', 'has', 'policy', 'put', 'reference', 'reveal'])
    expect(runtime.secrets.policy).toMatchObject({
      storesPlaintextConfiguration: false,
      reuseReferenceWhenPlaintextOmitted: true,
      migrateLegacyPlaintext: true,
      storageLabel: 'Windows 凭据管理器',
    })
    expect(bridge.calls.some(call => call.command === 'runtime_secret_put')).toBe(true)

    await runtime.secrets.put({
      key: 'storyforge.ai.primary',
      persistence: 'device',
      scope: {
        kind: 'ai',
        provider: 'openai',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://api.openai.com/v1',
      },
    }, 'sk-visible-after-confirmation')
    await expect(runtime.secrets.reveal('storyforge.ai.primary'))
      .resolves.toBe('sk-visible-after-confirmation')
    expect(bridge.calls.some(call => call.command === 'runtime_ai_secret_reveal')).toBe(true)
  })

  it('preserves split UTF-8 bytes across the native AI channel', async () => {
    const { runtime } = createRuntime()
    const response = await runtime.ai.execute({
      endpoint: {
        provider: 'openai',
        profileId: 'synthetic',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://api.openai.com/v1',
      },
      body: { model: 'synthetic' },
    })
    const decoder = new TextDecoder()
    let text = ''
    for await (const chunk of response.body) text += decoder.decode(chunk, { stream: true })
    text += decoder.decode()

    expect(response.status).toBe(200)
    expect(text).toBe('你好')
  })

  it('writes large payloads through bounded 1 MiB IPC chunks', async () => {
    const { runtime, bridge } = createRuntime()
    const bytes = new Uint8Array(2 * 1024 * 1024 + 7).fill(42)

    await expect(runtime.files.save({
      purpose: 'project-json',
      suggestedName: 'synthetic.json',
      content: { kind: 'bytes', bytes },
    })).resolves.toEqual({ status: 'completed', value: { displayName: 'synthetic.json' } })

    expect(bridge.fileChunks.map(chunk => chunk.length)).toEqual([1024 * 1024, 1024 * 1024, 7])
  })

  it('keeps diagnostics bounded and merges sanitized native events', async () => {
    const { runtime } = createRuntime()
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
