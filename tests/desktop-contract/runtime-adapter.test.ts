import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  AiTransportRequest,
  ClipboardPurpose,
  CredentialId,
  DiagnosticEvent,
  OpenFileRequest,
  RuntimeAdapter,
  SaveFileRequest,
} from '../../src/runtime/contract'
import { createFakeRuntime } from '../../src/runtime/fake'
import { RuntimeError } from '../../src/runtime/errors'

async function collectBytes(body: AsyncIterable<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of body) text += decoder.decode(chunk, { stream: true })
  return text + decoder.decode()
}

describe('D0.3 RuntimeAdapter contract', () => {
  it('exposes every frozen capability without a plaintext secret getter', () => {
    const runtime = createFakeRuntime()
    for (const capability of [
      'ai',
      'clipboard',
      'diagnostics',
      'distribution',
      'durability',
      'external',
      'files',
      'gist',
      'secrets',
      'updates',
    ] as const) expect(runtime[capability]).toBeDefined()
    expect('get' in runtime.secrets).toBe(false)

    expectTypeOf<keyof OpenFileRequest>().toEqualTypeOf<'purpose' | 'signal'>()
    expectTypeOf<keyof SaveFileRequest>().toEqualTypeOf<'purpose' | 'suggestedName' | 'content' | 'signal'>()
    expectTypeOf<Parameters<RuntimeAdapter['clipboard']['writeText']>[0]>()
      .toEqualTypeOf<ClipboardPurpose>()
    expectTypeOf<AiTransportRequest['credentialId']>().toEqualTypeOf<CredentialId | undefined>()
    expectTypeOf<Extract<DiagnosticEvent, { kind: 'network-attempt' }>['service']>()
      .toEqualTypeOf<'ai' | 'github-gist'>()
  })

  it('covers successful AI, Gist, file/binding, secret and system capabilities', async () => {
    const runtime = createFakeRuntime({
      aiChunks: [new TextEncoder().encode('data: {"ok":true}\n\n')],
    })
    const gistCredentialId = await runtime.secrets.put(
      { key: 'storyforge.github.gist', persistence: 'session', scope: { kind: 'github-gist' } },
      'secret-that-must-not-leave-the-vault',
    )
    expect(await runtime.secrets.has('storyforge.github.gist')).toBe(true)
    expect(await runtime.secrets.reference('storyforge.github.gist')).toBe(gistCredentialId)

    const aiCredentialId = await runtime.secrets.put({
      key: 'storyforge.ai.primary',
      persistence: 'session',
      scope: {
        kind: 'ai',
        provider: 'deepseek',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: '/deepseek-proxy/api/v1',
      },
    }, 'sk-deepseek')

    const aiResponse = await runtime.ai.execute({
      endpoint: {
        provider: 'deepseek',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: '/deepseek-proxy/api/v1',
      },
      credentialId: aiCredentialId,
      body: { model: 'deepseek-chat', messages: [] },
    })
    expect(await collectBytes(aiResponse.body)).toContain('"ok":true')
    expect(runtime.state.aiRequests[0]).not.toHaveProperty('credential')

    const gist = await runtime.gist.writeBackup({
      credentialId: gistCredentialId,
      filename: 'storyforge-test.json',
      description: 'backup',
      content: '{"version":3}',
    })
    expect((await runtime.gist.listBackups(gistCredentialId))[0].gistId).toBe(gist.gistId)
    expect((await runtime.gist.readBackup(gistCredentialId, gist.gistId)).content).toBe('{"version":3}')

    const save = await runtime.files.save({
      purpose: 'project-json',
      suggestedName: 'storyforge-test.json',
      content: { kind: 'text', text: '{"version":3}' },
    })
    expect(save.status).toBe('completed')
    expect((await runtime.files.open({ purpose: 'source-document' })).status).toBe('completed')
    expect((await runtime.files.open({ purpose: 'prompt-library-json' })).status).toBe('completed')

    const binding = await runtime.files.bindBackupDirectory('project-7')
    expect(binding.status).toBe('completed')
    await runtime.files.writeBackup({
      bindingId: 'project-7',
      purpose: 'project-backup',
      suggestedName: 'storyforge-test.json',
      content: { kind: 'text', text: '{"version":3}' },
    })
    const backups = await runtime.files.readBackups({
      bindingId: 'project-7',
      purpose: 'project-backup',
    })
    const restored = []
    for await (const backup of backups) restored.push(backup)
    expect(new TextDecoder().decode(restored[0].bytes)).toBe('{"version":3}')

    await runtime.clipboard.writeText('workflow-output', 'result')
    await runtime.external.open({ kind: 'project-repository' })
    expect(runtime.state.clipboardWrites).toEqual([{ purpose: 'workflow-output', text: 'result' }])
    expect((await runtime.durability.inspect()).persisted).toBe(true)
    expect((await runtime.distribution.getInfo()).channel).toBe('dev')
    await runtime.updates.initialize()
    expect(runtime.state.updatesInitialized).toBe(true)
  })

  it('versions fake credential references and invalidates them on delete', async () => {
    const runtime = createFakeRuntime()
    const descriptor = {
      key: 'storyforge.ai.preset.rotated' as const,
      persistence: 'session' as const,
      scope: {
        kind: 'ai' as const,
        provider: 'custom' as const,
        profileId: 'rotated',
        operation: 'chat-completions' as const,
        configuredBaseUrl: 'https://example.com/v1',
      },
    }
    const first = await runtime.secrets.put(descriptor, 'sk-first')
    const second = await runtime.secrets.put(descriptor, 'sk-second')

    expect(first).not.toBe(second)
    expect(await runtime.secrets.reference(descriptor.key)).toBe(second)

    const gistCredential = await runtime.secrets.put({
      key: 'storyforge.github.gist',
      persistence: 'session',
      scope: { kind: 'github-gist' },
    }, 'ghp-test')
    await expect(runtime.ai.execute({
      endpoint: descriptor.scope,
      credentialId: gistCredential,
      body: {},
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
    await expect(runtime.gist.validateCredential(first))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })

    await runtime.secrets.delete(descriptor.key)
    await expect(runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'rotated',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://example.com/v1',
      },
      credentialId: first,
      body: {},
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
  })

  it('distinguishes user cancellation from AbortSignal cancellation', async () => {
    const runtime = createFakeRuntime()
    runtime.cancelNext('files.save')
    await expect(runtime.files.save({
      purpose: 'project-json',
      suggestedName: 'storyforge-test.json',
      content: { kind: 'text', text: '{}' },
    })).resolves.toEqual({ status: 'cancelled' })

    const controller = new AbortController()
    controller.abort()
    await expect(runtime.ai.execute({
      endpoint: {
        provider: 'deepseek',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: '/deepseek-proxy/api/v1',
      },
      body: {},
      signal: controller.signal,
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED', operation: 'ai.execute' })
  })

  it.each([
    ['ai.execute', 'TIMEOUT'],
    ['clipboard.writeText', 'PERMISSION_DENIED'],
    ['files.save', 'DISK_FULL'],
  ] as const)('injects typed %s / %s failures', async (operation, code) => {
    const runtime = createFakeRuntime()
    runtime.failNext(operation, code)

    const call = operation === 'ai.execute'
      ? runtime.ai.execute({
        endpoint: {
          provider: 'openai',
          profileId: 'primary',
          operation: 'chat-completions',
          configuredBaseUrl: '/openai-proxy/v1',
        },
        body: {},
      })
      : operation === 'clipboard.writeText'
        ? runtime.clipboard.writeText('workflow-output', 'text')
        : runtime.files.save({
          purpose: 'project-json',
          suggestedName: 'storyforge-test.json',
          content: { kind: 'text', text: '{}' },
        })

    await expect(call).rejects.toMatchObject<Partial<RuntimeError>>({ code, operation })
  })
})
