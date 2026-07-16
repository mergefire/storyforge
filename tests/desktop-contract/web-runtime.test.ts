import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { DiagnosticEvent, SaveFileRequest } from '../../src/runtime/contract'
import { RuntimeError } from '../../src/runtime/errors'
import {
  createWebRuntime,
  WEB_OPEN_FILE_FORMATS,
} from '../../src/runtime/web'

async function consume(body: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of body) chunks.push(chunk)
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const joined = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.length
  }
  return new TextDecoder().decode(joined)
}

function disableOpenFilePicker(): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker')
  Object.defineProperty(window, 'showOpenFilePicker', {
    configurable: true,
    value: undefined,
  })
  return () => {
    if (descriptor) Object.defineProperty(window, 'showOpenFilePicker', descriptor)
    else Reflect.deleteProperty(window, 'showOpenFilePicker')
  }
}

function runtimeWithDirectory(handle: FileSystemDirectoryHandle) {
  return createWebRuntime({
    files: {
      bindingStore: {
        save: async () => undefined,
        load: async () => handle,
        delete: async () => undefined,
      },
    },
  })
}

describe('D0.3 Web RuntimeAdapter', () => {
  it('preserves relative Vite proxy aliases and sends only a vault credential id', async () => {
    const fetchMock = vi.fn(async () => new Response('data: [DONE]\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }))
    const runtime = createWebRuntime({ fetch: fetchMock })
    const credentialId = await runtime.secrets.put(
      {
        key: 'storyforge.ai.primary',
        persistence: 'session',
        scope: {
          kind: 'ai',
          provider: 'deepseek',
          profileId: 'primary',
          operation: 'chat-completions',
          configuredBaseUrl: '/deepseek-proxy/v1',
        },
      },
      'sk-private',
    )

    const response = await runtime.ai.execute({
      endpoint: {
        provider: 'deepseek',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: '/deepseek-proxy/v1',
      },
      credentialId,
      body: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/deepseek-proxy/v1/chat/completions')
    expect(init?.method).toBe('POST')
    expect(init?.redirect).toBe('error')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk-private' })
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'deepseek-chat' })
    expect(await consume(response.body)).toContain('[DONE]')

    const embeddingCredentialId = await runtime.secrets.put(
      {
        key: 'storyforge.ai.embedding',
        persistence: 'session',
        scope: {
          kind: 'ai',
          provider: 'glm',
          profileId: 'embedding',
          operation: 'embeddings',
          configuredBaseUrl: '/glm-proxy/api/paas/v4',
        },
      },
      'sk-private',
    )
    await runtime.ai.execute({
      endpoint: {
        provider: 'glm',
        profileId: 'embedding',
        operation: 'embeddings',
        configuredBaseUrl: '/glm-proxy/api/paas/v4',
      },
      credentialId: embeddingCredentialId,
      body: { model: 'embedding-3', input: ['text'] },
    })
    expect(fetchMock.mock.calls[1][0]).toBe('/glm-proxy/api/paas/v4/embeddings')
    await runtime.ai.execute({
      endpoint: {
        provider: 'deepseek',
        profileId: 'primary',
        operation: 'models',
        configuredBaseUrl: '/deepseek-proxy/v1',
      },
      credentialId,
      body: null,
    })
    expect(fetchMock.mock.calls[2][0]).toBe('/deepseek-proxy/v1/models')
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer sk-private' },
    })
    expect(fetchMock.mock.calls[2][1]?.body).toBeUndefined()
    await expect(runtime.secrets.reveal('storyforge.ai.primary')).resolves.toBe('sk-private')
    expect('get' in runtime.secrets).toBe(false)
  })

  it('binds each credential id to the exact secret value across rotations', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    const runtime = createWebRuntime({ fetch: fetchMock })
    const descriptor = {
      key: 'storyforge.ai.preset.credential-rotation' as const,
      persistence: 'session' as const,
      scope: {
        kind: 'ai' as const,
        provider: 'custom' as const,
        profileId: 'credential-rotation',
        operation: 'chat-completions' as const,
        configuredBaseUrl: '/openai-proxy/v1',
      },
    }
    const firstCredential = await runtime.secrets.put(descriptor, 'sk-first')
    const secondCredential = await runtime.secrets.put(descriptor, 'sk-second')

    expect(firstCredential).not.toBe(secondCredential)
    expect(await runtime.secrets.reference(descriptor.key)).toBe(secondCredential)

    const execute = (credentialId: typeof firstCredential) => runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'credential-rotation',
        operation: 'chat-completions',
        configuredBaseUrl: '/openai-proxy/v1',
      },
      credentialId,
      body: {},
    })
    await execute(firstCredential)
    await execute(secondCredential)

    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer sk-first' })
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer sk-second' })

    await runtime.secrets.delete(descriptor.key)
    await expect(execute(firstCredential))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
  })

  it('rejects cross-service, cross-profile and cross-origin credential reuse', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    const runtime = createWebRuntime({ fetch: fetchMock })
    const aiCredential = await runtime.secrets.put({
      key: 'storyforge.ai.primary',
      persistence: 'session',
      scope: {
        kind: 'ai',
        provider: 'custom',
        profileId: 'primary',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://trusted.example/v1',
      },
    }, 'sk-ai')
    const gistCredential = await runtime.secrets.put({
      key: 'storyforge.github.gist',
      persistence: 'session',
      scope: { kind: 'github-gist' },
    }, 'ghp_gist')

    const executeAi = (credentialId: typeof aiCredential, profileId: string, configuredBaseUrl: string) => (
      runtime.ai.execute({
        endpoint: {
          provider: 'custom',
          profileId,
          operation: 'chat-completions',
          configuredBaseUrl,
        },
        credentialId,
        body: {},
      })
    )

    await expect(executeAi(gistCredential, 'primary', 'https://trusted.example/v1'))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
    await expect(runtime.gist.validateCredential(aiCredential))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
    await expect(executeAi(aiCredential, 'other-profile', 'https://trusted.example/v1'))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
    await expect(executeAi(aiCredential, 'primary', 'https://attacker.example/v1'))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['chat-completions', '/deepseek-proxy/v1'],
    ['chat-completions', '/openai-proxy/v1'],
    ['chat-completions', '/kimi-proxy/v1'],
    ['chat-completions', '/claude-proxy/v1'],
    ['chat-completions', '/nvidia-proxy/v1'],
    ['chat-completions', '/doubao-proxy/api/v3'],
    ['chat-completions', '/agnes-proxy/v1'],
    ['chat-completions', '/longcat-proxy/openai/v1'],
    ['chat-completions', '/opencode-proxy/v1'],
    ['models', '/deepseek-proxy/v1'],
    ['embeddings', '/siliconflow-proxy/v1'],
    ['embeddings', '/qwen-proxy/compatible-mode/v1'],
    ['embeddings', '/glm-proxy/api/paas/v4'],
    ['embeddings', '/openai-proxy/v1'],
  ] as const)('accepts exact %s Web proxy base %s', async (operation, configuredBaseUrl) => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    const runtime = createWebRuntime({ fetch: fetchMock })
    await runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'proxy-test',
        operation,
        configuredBaseUrl,
      },
      body: {},
    })
    const suffix = operation === 'chat-completions' ? 'chat/completions' : operation
    expect(fetchMock.mock.calls[0][0]).toBe(`${configuredBaseUrl}/${suffix}`)
  })

  it('preserves configured HTTP/HTTPS endpoints, including LAN, and rejects unsafe schemes/aliases', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    const runtime = createWebRuntime({ fetch: fetchMock })

    await runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'remote-custom',
        operation: 'embeddings',
        configuredBaseUrl: 'https://gateway.example.com/custom/v1/',
      },
      body: { model: 'embedding', input: ['a'] },
    })
    await runtime.ai.execute({
      endpoint: {
        provider: 'ollama',
        profileId: 'local',
        operation: 'chat-completions',
        configuredBaseUrl: 'http://127.0.0.1:11434/v1',
      },
      body: {},
    })
    await runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'lan-existing-config',
        operation: 'chat-completions',
        configuredBaseUrl: 'http://192.168.110.51:1234/v1',
      },
      body: {},
    })
    expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.example.com/custom/v1/embeddings')
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:11434/v1/chat/completions')
    expect(fetchMock.mock.calls[2][0]).toBe('http://192.168.110.51:1234/v1/chat/completions')

    for (const configuredBaseUrl of [
      '/unknown-proxy/v1',
      '/deepseek-proxy/api/v3',
      '/deepseek-proxy/v1/admin',
      '/siliconflow-proxy/v1',
      '/deepseek-proxy/../admin',
      '//gateway.example.com/v1',
      'ftp://gateway.example.com/v1',
      'https://user:password@gateway.example.com/v1',
    ]) {
      await expect(runtime.ai.execute({
        endpoint: {
          provider: 'custom',
          profileId: 'unsafe',
          operation: 'chat-completions',
          configuredBaseUrl,
        },
        body: {},
      })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'PERMISSION_DENIED' })
    }
  })

  it('freezes PDF/DOCX/EPUB accept maps and rejects an extension outside save purpose', async () => {
    const sourceAccept = Object.values(WEB_OPEN_FILE_FORMATS['source-document']).flat()
    const referenceAccept = Object.values(WEB_OPEN_FILE_FORMATS['reference-document']).flat()
    const promptLibraryAccept = Object.values(WEB_OPEN_FILE_FORMATS['prompt-library-json']).flat()
    expect(sourceAccept).toEqual(expect.arrayContaining(['.txt', '.md', '.csv', '.pdf', '.docx']))
    expect(referenceAccept).toEqual(expect.arrayContaining(['.txt', '.md', '.epub']))
    expect(promptLibraryAccept).toEqual(['.json'])
    expect([...sourceAccept, ...referenceAccept]).not.toContain('.exe')

    const save = vi.fn(async (request: SaveFileRequest) => ({
      status: 'completed' as const,
      value: { displayName: request.suggestedName },
    }))
    const runtime = createWebRuntime({ files: { save } })
    await expect(runtime.files.save({
      purpose: 'project-json',
      suggestedName: 'storyforge-project.exe',
      content: { kind: 'text', text: '{}' },
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'INVALID_INPUT' })
    expect(save).not.toHaveBeenCalled()

    expectTypeOf<Parameters<typeof runtime.files.open>[0]>()
      .not.toHaveProperty('extensions')
    expectTypeOf<Parameters<typeof runtime.files.save>[0]>()
      .not.toHaveProperty('mediaType')
  })

  it('delegates file, clipboard and closed external-link capabilities with purposes', async () => {
    const save = vi.fn(async (request: SaveFileRequest) => ({
      status: 'completed' as const,
      value: { displayName: request.suggestedName },
    }))
    const clipboard = vi.fn(async () => undefined)
    const external = vi.fn(async () => undefined)
    const runtime = createWebRuntime({
      files: { save },
      clipboardWriteText: clipboard,
      openExternal: external,
    })

    await runtime.files.save({
      purpose: 'context-snapshot',
      suggestedName: 'snapshot:chapter.md',
      content: { kind: 'text', text: '# snapshot' },
    })
    await runtime.clipboard.writeText('ai-image-prompt', 'draw a map')
    await runtime.external.open({ kind: 'github-gist-token' })

    expect(save.mock.calls[0][0]).toMatchObject({
      purpose: 'context-snapshot',
      suggestedName: 'snapshot-chapter.md',
    })
    expect(save.mock.calls[0][0]).not.toHaveProperty('mediaType')
    expect(clipboard).toHaveBeenCalledWith('ai-image-prompt', 'draw a map')
    expect(external).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/github\.com\/settings\/tokens/))
  })

  it('does not misclassify local TypeErrors as retryable network failures', async () => {
    const runtime = createWebRuntime({
      files: {
        save: async () => { throw new TypeError('local file delegate failed') },
      },
      clipboardWriteText: async () => { throw new TypeError('clipboard delegate failed') },
    })

    await expect(runtime.files.save({
      purpose: 'project-json',
      suggestedName: 'storyforge-project.json',
      content: { kind: 'text', text: '{}' },
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'UNKNOWN', retryable: false })
    await expect(runtime.clipboard.writeText('workflow-output', 'result'))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'UNKNOWN', retryable: false })
  })

  it('does not report a safe noopener window as blocked when open returns null', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await expect(createWebRuntime().external.open({ kind: 'project-repository' }))
        .resolves.toBeUndefined()
      expect(open).toHaveBeenCalledWith(
        'https://github.com/yuanbw2025/storyforge',
        '_blank',
        'noopener,noreferrer',
      )
    } finally {
      open.mockRestore()
    }
  })

  it('uses fixed Gist endpoints and rejects arbitrary diagnostic fields', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/user')) {
        return new Response(JSON.stringify({ login: 'author' }), { status: 200 })
      }
      return new Response(JSON.stringify({ id: 'gist123', html_url: 'https://gist.github.com/gist123' }), {
        status: 200,
      })
    })
    const runtime = createWebRuntime({ fetch: fetchMock })
    const credentialId = await runtime.secrets.put(
      { key: 'storyforge.github.gist', persistence: 'session', scope: { kind: 'github-gist' } },
      'github-pat',
    )
    expect(await runtime.gist.validateCredential(credentialId)).toEqual({ login: 'author' })
    await runtime.gist.writeBackup({
      credentialId,
      filename: 'storyforge-book.json',
      description: 'backup',
      content: '{}',
    })
    expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual([
      'https://api.github.com/user',
      'https://api.github.com/gists',
    ])
    expect(fetchMock.mock.calls.every(call => call[1]?.redirect === 'error')).toBe(true)

    const invalidEvent = {
      kind: 'network-attempt',
      timestamp: 1,
      service: 'ai',
      operation: 'chat-completions',
      outcome: 'completed',
      fields: { manuscript: 'must not be accepted' },
    } as unknown as DiagnosticEvent
    expect(() => runtime.diagnostics.record(invalidEvent))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }))

    const invalidEnum = {
      kind: 'network-attempt',
      timestamp: 1,
      service: 'manuscript-secret',
      operation: 'chat-completions',
      outcome: 'completed',
    } as unknown as DiagnosticEvent
    expect(() => runtime.diagnostics.record(invalidEnum))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }))
  })

  it('preserves status, retryability and plain-text details for Gist gateway errors', async () => {
    const runtime = createWebRuntime({
      fetch: vi.fn(async () => new Response('upstream temporarily unavailable', { status: 503 })),
    })
    const credentialId = await runtime.secrets.put(
      { key: 'storyforge.github.gist', persistence: 'session', scope: { kind: 'github-gist' } },
      'github-pat',
    )

    await expect(runtime.gist.writeBackup({
      credentialId,
      filename: 'storyforge-book.json',
      description: 'backup',
      content: '{}',
    })).rejects.toMatchObject<Partial<RuntimeError>>({
      code: 'REMOTE_ERROR',
      retryable: true,
      message: 'upstream temporarily unavailable',
    })
  })

  it.each([307, 308])('blocks %i redirects before an AI request body can reach another origin', async status => {
    const evilOrigin = 'https://evil.example/collect'
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.redirect !== 'error') {
        throw new Error(`would follow ${status} to ${evilOrigin}`)
      }
      throw new TypeError(`redirect ${status} blocked`)
    })
    const runtime = createWebRuntime({ fetch: fetchMock })

    await expect(runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: `redirect-${status}`,
        operation: 'chat-completions',
        configuredBaseUrl: 'https://gateway.example.com/v1',
      },
      body: { messages: [{ role: 'user', content: 'private manuscript' }] },
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'NETWORK' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://gateway.example.com/v1/chat/completions')
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('error')
    expect(fetchMock.mock.calls.some(call => String(call[0]).startsWith(evilOrigin))).toBe(false)
  })

  it('cancels the response reader when the AI body consumer returns early', async () => {
    const cancel = vi.fn(async () => undefined)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('first'))
      },
      cancel,
    })
    const runtime = createWebRuntime({ fetch: vi.fn(async () => new Response(stream)) })
    const response = await runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'early-return',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://gateway.example.com/v1',
      },
      body: {},
    })
    const iterator = response.body[Symbol.asyncIterator]()

    expect(new TextDecoder().decode((await iterator.next()).value)).toBe('first')
    await iterator.return?.()

    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('checks AbortSignal between streamed AI chunks and cancels the reader', async () => {
    const cancel = vi.fn(async () => undefined)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('first'))
      },
      cancel,
    })
    const controller = new AbortController()
    const runtime = createWebRuntime({ fetch: vi.fn(async () => new Response(stream)) })
    const response = await runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'stream-abort',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://gateway.example.com/v1',
      },
      body: {},
      signal: controller.signal,
    })
    const iterator = response.body[Symbol.asyncIterator]()
    await iterator.next()
    controller.abort()

    await expect(iterator.next()).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED' })
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['AbortError', 'ABORTED', () => new DOMException('stream stopped', 'AbortError')],
    ['TypeError', 'NETWORK', () => new TypeError('stream socket failed')],
  ] as const)('normalizes a streamed %s into RuntimeError(%s)', async (_name, code, makeError) => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(makeError())
      },
    })
    const runtime = createWebRuntime({ fetch: vi.fn(async () => new Response(stream)) })
    const response = await runtime.ai.execute({
      endpoint: {
        provider: 'custom',
        profileId: 'stream-error',
        operation: 'chat-completions',
        configuredBaseUrl: 'https://gateway.example.com/v1',
      },
      body: {},
    })

    await expect(consume(response.body)).rejects.toMatchObject<Partial<RuntimeError>>({ code })
  })

  it.each([
    'https://gist.githubusercontent.com:444/user/id/raw/storyforge-book.json',
    'https://user@gist.githubusercontent.com/user/id/raw/storyforge-book.json',
  ])('rejects an unsafe raw Gist URL before a second fetch: %s', async rawUrl => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      files: {
        'storyforge-book.json': {
          filename: 'storyforge-book.json',
          truncated: true,
          raw_url: rawUrl,
        },
      },
    }), { status: 200 }))
    const runtime = createWebRuntime({ fetch: fetchMock })
    const credentialId = await runtime.secrets.put(
      { key: 'storyforge.github.gist', persistence: 'session', scope: { kind: 'github-gist' } },
      'github-pat',
    )

    await expect(runtime.gist.readBackup(credentialId, 'gist123'))
      .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'INTEGRITY_ERROR' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('error')
  })

  it('fetches an allowed raw Gist only with redirects disabled', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://api.github.com/')) {
        return new Response(JSON.stringify({
          files: {
            'storyforge-book.json': {
              filename: 'storyforge-book.json',
              truncated: true,
              raw_url: 'https://gist.githubusercontent.com/user/id/raw/storyforge-book.json',
            },
          },
        }), { status: 200 })
      }
      return new Response('raw backup', { status: 200 })
    })
    const runtime = createWebRuntime({ fetch: fetchMock })
    const credentialId = await runtime.secrets.put(
      { key: 'storyforge.github.gist', persistence: 'session', scope: { kind: 'github-gist' } },
      'github-pat',
    )

    expect(await runtime.gist.readBackup(credentialId, 'gist123')).toMatchObject({ content: 'raw backup' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(call => call[1]?.redirect === 'error')).toBe(true)
  })

  it('falls back to a fixed-accept file input and validates the selected extension', async () => {
    const restorePicker = disableOpenFilePicker()
    let observedAccept = ''
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(function (this: HTMLInputElement) {
        observedAccept = this.accept
        Object.defineProperty(this, 'files', {
          configurable: true,
          value: [new File(['[{"name":"template"}]'], 'prompt-library.json', { type: 'application/json' })],
        })
        this.dispatchEvent(new Event('change'))
      })
    try {
      const runtime = createWebRuntime()
      const outcome = await runtime.files.open({ purpose: 'prompt-library-json' })

      expect(observedAccept).toBe('application/json,.json')
      expect(outcome.status).toBe('completed')
      if (outcome.status === 'completed') {
        expect(outcome.value.name).toBe('prompt-library.json')
        expect(new TextDecoder().decode(outcome.value.bytes)).toContain('template')
      }
    } finally {
      click.mockRestore()
      restorePicker()
    }

    const restoreInvalidPicker = disableOpenFilePicker()
    const invalidClick = vi.spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(function (this: HTMLInputElement) {
        Object.defineProperty(this, 'files', {
          configurable: true,
          value: [new File(['bad'], 'prompt-library.exe', { type: 'application/octet-stream' })],
        })
        this.dispatchEvent(new Event('change'))
      })
    try {
      await expect(createWebRuntime().files.open({ purpose: 'prompt-library-json' }))
        .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'INVALID_INPUT' })
    } finally {
      invalidClick.mockRestore()
      restoreInvalidPicker()
    }
  })

  it('rejects an oversized source document before reading it into memory', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker')
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0))
    const oversizedPdf = {
      name: 'large.pdf',
      type: 'application/pdf',
      size: 20 * 1024 * 1024 + 1,
      arrayBuffer,
    } as unknown as File
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [{ getFile: async () => oversizedPdf }],
    })
    try {
      await expect(createWebRuntime().files.open({ purpose: 'source-document' }))
        .rejects.toMatchObject<Partial<RuntimeError>>({ code: 'INVALID_INPUT' })
      expect(arrayBuffer).not.toHaveBeenCalled()
    } finally {
      if (descriptor) Object.defineProperty(window, 'showOpenFilePicker', descriptor)
      else Reflect.deleteProperty(window, 'showOpenFilePicker')
    }
  })

  it('maps fallback input cancellation to cancelled and AbortSignal to ABORTED', async () => {
    const restoreCancelPicker = disableOpenFilePicker()
    const cancelClick = vi.spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(function (this: HTMLInputElement) {
        this.dispatchEvent(new Event('cancel'))
      })
    try {
      await expect(createWebRuntime().files.open({ purpose: 'project-json' }))
        .resolves.toEqual({ status: 'cancelled' })
    } finally {
      cancelClick.mockRestore()
      restoreCancelPicker()
    }

    const restoreAbortPicker = disableOpenFilePicker()
    const controller = new AbortController()
    const abortClick = vi.spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => controller.abort())
    try {
      await expect(createWebRuntime().files.open({
        purpose: 'project-json',
        signal: controller.signal,
      })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED' })
    } finally {
      abortClick.mockRestore()
      restoreAbortPicker()
    }
  })

  it('lets a delayed fallback file selection win after window focus returns', async () => {
    const restorePicker = disableOpenFilePicker()
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(function (this: HTMLInputElement) {
        window.dispatchEvent(new Event('focus'))
        window.setTimeout(() => {
          Object.defineProperty(this, 'files', {
            configurable: true,
            value: [new File(['{}'], 'storyforge-project.json', { type: 'application/json' })],
          })
          this.dispatchEvent(new Event('change'))
        }, 10)
      })
    try {
      const outcome = await createWebRuntime().files.open({ purpose: 'project-json' })
      expect(outcome).toMatchObject({
        status: 'completed',
        value: { name: 'storyforge-project.json' },
      })
    } finally {
      click.mockRestore()
      restorePicker()
    }
  })

  it('does not misclassify signal-driven save/open AbortError as user cancellation', async () => {
    const saveController = new AbortController()
    const openController = new AbortController()
    const runtime = createWebRuntime({
      files: {
        save: async () => {
          saveController.abort()
          throw new DOMException('stopped', 'AbortError')
        },
        open: async () => {
          openController.abort()
          throw new DOMException('stopped', 'AbortError')
        },
      },
    })

    await expect(runtime.files.save({
      purpose: 'project-json',
      suggestedName: 'storyforge-project.json',
      content: { kind: 'text', text: '{}' },
      signal: saveController.signal,
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED' })
    await expect(runtime.files.open({
      purpose: 'project-json',
      signal: openController.signal,
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED' })

    const userCancelRuntime = createWebRuntime({
      files: {
        save: async () => { throw new DOMException('cancelled', 'AbortError') },
        open: async () => { throw new DOMException('cancelled', 'AbortError') },
      },
    })
    await expect(userCancelRuntime.files.save({
      purpose: 'project-json',
      suggestedName: 'storyforge-project.json',
      content: { kind: 'text', text: '{}' },
    })).resolves.toEqual({ status: 'cancelled' })
    await expect(userCancelRuntime.files.open({ purpose: 'project-json' }))
      .resolves.toEqual({ status: 'cancelled' })
  })

  it('migrates legacy project/last directory handles without forcing a rebind', async () => {
    const legacyProject = {
      kind: 'directory' as const,
      name: 'legacy-project',
      queryPermission: async () => 'granted' as PermissionState,
    } as unknown as FileSystemDirectoryHandle
    const legacyLast = {
      kind: 'directory' as const,
      name: 'legacy-last',
      queryPermission: async () => 'granted' as PermissionState,
    } as unknown as FileSystemDirectoryHandle
    const newlyPicked = {
      kind: 'directory' as const,
      name: 'new-project',
      queryPermission: async () => 'granted' as PermissionState,
    } as unknown as FileSystemDirectoryHandle
    const handles = new Map<string, FileSystemDirectoryHandle>([
      ['proj-17', legacyProject],
      ['last', legacyLast],
    ])
    const save = vi.fn(async (key: string, handle: FileSystemDirectoryHandle) => {
      handles.set(key, handle)
    })
    const runtime = createWebRuntime({
      files: {
        pickDirectory: async () => newlyPicked,
        bindingStore: {
          save,
          load: async key => handles.get(key) ?? null,
          delete: async key => { handles.delete(key) },
        },
      },
    })

    await expect(runtime.files.inspectBackupBinding('project-backup-17'))
      .resolves.toMatchObject({ label: 'legacy-project', permission: 'granted' })
    await expect(runtime.files.inspectBackupBinding('home-project-restore'))
      .resolves.toMatchObject({ label: 'legacy-last', permission: 'granted' })
    expect(handles.get('runtime-binding:project-backup-17')).toBe(legacyProject)
    expect(handles.get('runtime-binding:home-project-restore')).toBe(legacyLast)

    await expect(runtime.files.bindBackupDirectory('project-backup-8'))
      .resolves.toMatchObject({ status: 'completed' })
    expect(handles.get('runtime-binding:project-backup-8')).toBe(newlyPicked)
    expect(handles.get('proj-8')).toBe(newlyPicked)
    expect(handles.get('last')).toBe(newlyPicked)
  })

  it('enforces backup names and aborts instead of committing after a write failure', async () => {
    const primaryError = new RuntimeError('DISK_FULL', 'primary write failed', {
      operation: 'files.writeBackup',
    })
    const writable = {
      write: vi.fn(async () => { throw primaryError }),
      close: vi.fn(async () => { throw new TypeError('secondary close failed') }),
      abort: vi.fn(async () => { throw new TypeError('secondary abort failed') }),
    }
    const getFileHandle = vi.fn(async () => ({
      kind: 'file' as const,
      name: 'storyforge-book.json',
      createWritable: async () => writable,
    } as unknown as FileSystemFileHandle))
    const directory = {
      kind: 'directory' as const,
      name: 'backups',
      queryPermission: async () => 'granted' as PermissionState,
      getFileHandle,
    } as unknown as FileSystemDirectoryHandle
    const runtime = runtimeWithDirectory(directory)

    await expect(runtime.files.writeBackup({
      bindingId: 'project-1',
      purpose: 'project-backup',
      suggestedName: 'backup.json',
      content: { kind: 'text', text: '{}' },
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'INVALID_INPUT' })
    expect(getFileHandle).not.toHaveBeenCalled()

    await expect(runtime.files.writeBackup({
      bindingId: 'project-1',
      purpose: 'project-backup',
      suggestedName: 'storyforge-book.json',
      content: { kind: 'text', text: '{}' },
    })).rejects.toBe(primaryError)
    expect(writable.abort).toHaveBeenCalledTimes(1)
    expect(writable.close).not.toHaveBeenCalled()
  })

  it('rolls back when AbortSignal fires after write and before the commit close', async () => {
    const controller = new AbortController()
    const writable = {
      write: vi.fn(async () => { controller.abort() }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    }
    const directory = {
      kind: 'directory' as const,
      name: 'backups',
      queryPermission: async () => 'granted' as PermissionState,
      getFileHandle: async () => ({
        kind: 'file' as const,
        name: 'storyforge-book.json',
        createWritable: async () => writable,
      } as unknown as FileSystemFileHandle),
    } as unknown as FileSystemDirectoryHandle

    await expect(runtimeWithDirectory(directory).files.writeBackup({
      bindingId: 'project-1',
      purpose: 'project-backup',
      suggestedName: 'storyforge-book.json',
      content: { kind: 'text', text: '{}' },
      signal: controller.signal,
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED' })
    expect(writable.abort).toHaveBeenCalledTimes(1)
    expect(writable.close).not.toHaveBeenCalled()
  })

  it('checks backup AbortSignal after binding and file reads', async () => {
    const writeController = new AbortController()
    const queryPermission = vi.fn(async () => 'granted' as PermissionState)
    const writeDirectory = {
      kind: 'directory' as const,
      name: 'backups',
      queryPermission,
    } as unknown as FileSystemDirectoryHandle
    const writeRuntime = createWebRuntime({
      files: {
        bindingStore: {
          save: async () => undefined,
          load: async () => {
            writeController.abort()
            return writeDirectory
          },
          delete: async () => undefined,
        },
      },
    })

    await expect(writeRuntime.files.writeBackup({
      bindingId: 'project-1',
      purpose: 'project-backup',
      suggestedName: 'storyforge-book.json',
      content: { kind: 'text', text: '{}' },
      signal: writeController.signal,
    })).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED' })
    expect(queryPermission).not.toHaveBeenCalled()

    const readController = new AbortController()
    const fileHandle = {
      kind: 'file' as const,
      name: 'storyforge-book.json',
      getFile: async () => ({
        arrayBuffer: async () => {
          readController.abort()
          return new ArrayBuffer(4)
        },
      } as File),
    } as unknown as FileSystemFileHandle
    const readDirectory = {
      kind: 'directory' as const,
      name: 'backups',
      queryPermission: async () => 'granted' as PermissionState,
      async *entries() {
        yield ['storyforge-book.json', fileHandle] as [string, FileSystemFileHandle]
      },
    } as unknown as FileSystemDirectoryHandle

    const backups = await runtimeWithDirectory(readDirectory).files.readBackups({
      bindingId: 'project-1',
      purpose: 'project-backup',
      signal: readController.signal,
    })
    await expect((async () => {
      for await (const backup of backups) void backup
    })()).rejects.toMatchObject<Partial<RuntimeError>>({ code: 'ABORTED' })
  })

  it('streams backup files lazily and skips an unreadable candidate', async () => {
    const unreadable = {
      kind: 'file' as const,
      name: 'storyforge-bad.json',
      getFile: async () => { throw new DOMException('disk error', 'NotReadableError') },
    } as unknown as FileSystemFileHandle
    const firstRead = vi.fn(async () => new TextEncoder().encode('{"id":1}').buffer)
    const secondRead = vi.fn(async () => new TextEncoder().encode('{"id":2}').buffer)
    const readable = (name: string, arrayBuffer: () => Promise<ArrayBuffer>) => ({
      kind: 'file' as const,
      name,
      getFile: async () => ({ arrayBuffer } as unknown as File),
    }) as unknown as FileSystemFileHandle
    const directory = {
      kind: 'directory' as const,
      name: 'backups',
      queryPermission: async () => 'granted' as PermissionState,
      async *entries() {
        yield ['storyforge-bad.json', unreadable] as [string, FileSystemFileHandle]
        yield ['storyforge-one.json', readable('storyforge-one.json', firstRead)] as [string, FileSystemFileHandle]
        yield ['storyforge-two.json', readable('storyforge-two.json', secondRead)] as [string, FileSystemFileHandle]
      },
    } as unknown as FileSystemDirectoryHandle

    const backups = await runtimeWithDirectory(directory).files.readBackups({
      bindingId: 'project-1',
      purpose: 'project-backup',
    })
    expect(firstRead).not.toHaveBeenCalled()
    expect(secondRead).not.toHaveBeenCalled()

    const iterator = backups[Symbol.asyncIterator]()
    const first = await iterator.next()
    expect(first.value?.name).toBe('storyforge-one.json')
    expect(firstRead).toHaveBeenCalledOnce()
    expect(secondRead).not.toHaveBeenCalled()

    const second = await iterator.next()
    expect(second.value?.name).toBe('storyforge-two.json')
    expect(secondRead).toHaveBeenCalledOnce()
    expect((await iterator.next()).done).toBe(true)
  })
})
