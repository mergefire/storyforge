import { invoke } from '@tauri-apps/api/core'
import {
  bindAiCredential,
  executeAiRequest,
  isAiAbortError,
} from '../../lib/ai/runtime-transport'
import { getRuntime } from '..'

const DEV_SMOKE_MARKER = 'storyforge-m0-dev-smoke'

export interface StoryForgeDesktopDevSmoke {
  readonly marker: typeof DEV_SMOKE_MARKER
  readonly contractVersion: 'm1'
  extractSyntheticPdf(base64: string): Promise<{
    text: string
    rawChars: number
    pageCount?: number
  }>
  storeSyntheticDeviceCredential(baseUrl: string, value: string): Promise<string>
  credentialPresent(): Promise<boolean>
  runSyntheticAiStream(baseUrl: string): Promise<{
    status: number
    text: string
    chunkCount: number
  }>
  runSyntheticAiCancellation(baseUrl: string): Promise<{
    cancelled: boolean
    firstChunkBytes: number
  }>
  writeSyntheticBlob(sizeBytes: number, name?: string): Promise<{
    name: string
    sizeBytes: number
    sha256: string
  }>
  inspectSyntheticBlob(name?: string): Promise<{
    name: string
    sizeBytes: number
    sha256: string
  }>
  clearSyntheticDeviceCredential(): Promise<void>
  diagnosticsSnapshot(): Promise<{
    generatedAt: number
    events: readonly { kind: string; timestamp: number }[]
  }>
  resetSyntheticFixtures(): Promise<void>
}

declare global {
  interface Window {
    __STORYFORGE_DESKTOP_DEV_SMOKE__?: StoryForgeDesktopDevSmoke
  }
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function installDesktopDevSmoke(): void {
  if (window.__STORYFORGE_DESKTOP_DEV_SMOKE__) return

  Object.defineProperty(window, '__STORYFORGE_DESKTOP_DEV_SMOKE__', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze<StoryForgeDesktopDevSmoke>({
      marker: DEV_SMOKE_MARKER,
      contractVersion: 'm1',
      async extractSyntheticPdf(base64) {
        const { extractTextFromFile } = await import('../../lib/doc-parser')
        const bytes = decodeBase64(base64)
        const buffer = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(buffer).set(bytes)
        const file = new File([buffer], 'storyforge-m0-worker-smoke.pdf', {
          type: 'application/pdf',
        })
        return extractTextFromFile(file)
      },
      async storeSyntheticDeviceCredential(baseUrl, value) {
        localStorage.removeItem('storyforge-ai-active-preset')
        const credentialId = await bindAiCredential({
          key: 'storyforge.ai.primary',
          apiKey: value,
          provider: 'custom',
          profileId: 'primary',
          operation: 'chat-completions',
          configuredBaseUrl: baseUrl,
          persistence: 'device',
        })
        if (!credentialId) throw new Error('synthetic credential was not stored')
        return credentialId
      },
      async credentialPresent() {
        return getRuntime().secrets.has('storyforge.ai.primary')
      },
      async runSyntheticAiStream(baseUrl) {
        localStorage.removeItem('storyforge-ai-active-preset')
        const credentialId = await getRuntime().secrets.reference('storyforge.ai.primary') ?? undefined
        const response = await executeAiRequest({
          provider: 'custom',
          profileId: 'primary',
          operation: 'chat-completions',
          configuredBaseUrl: baseUrl,
          credentialId,
          body: {
            model: 'storyforge-m1-synthetic',
            stream: true,
            messages: [{ role: 'user', content: 'synthetic-only' }],
          },
        })
        const decoder = new TextDecoder()
        let text = ''
        let chunkCount = 0
        for await (const chunk of response.body) {
          chunkCount += 1
          text += decoder.decode(chunk, { stream: true })
        }
        text += decoder.decode()
        return { status: response.status, text, chunkCount }
      },
      async runSyntheticAiCancellation(baseUrl) {
        localStorage.removeItem('storyforge-ai-active-preset')
        const controller = new AbortController()
        const credentialId = await getRuntime().secrets.reference('storyforge.ai.primary') ?? undefined
        const response = await executeAiRequest({
          provider: 'custom',
          profileId: 'primary',
          operation: 'chat-completions',
          configuredBaseUrl: baseUrl,
          credentialId,
          body: {
            model: 'storyforge-m1-synthetic',
            stream: true,
            messages: [{ role: 'user', content: 'synthetic-cancel' }],
          },
          signal: controller.signal,
        })
        const iterator = response.body[Symbol.asyncIterator]()
        const first = await iterator.next()
        controller.abort()
        try {
          await iterator.next()
        } catch (error) {
          if (isAiAbortError(error)) {
            return { cancelled: true, firstChunkBytes: first.done ? 0 : first.value.byteLength }
          }
          throw error
        }
        throw new Error('synthetic AI stream did not abort')
      },
      async writeSyntheticBlob(sizeBytes, name = 'storyforge-m1-100mib.json') {
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 128 * 1024 * 1024) {
          throw new Error('synthetic blob size is outside the dev-smoke limit')
        }
        const binding = await invoke<{ bindingId: string }>('runtime_dev_prepare_synthetic_binding')
        const bytes = new Uint8Array(sizeBytes)
        bytes.fill(0x5a)
        await getRuntime().files.writeBackup({
          bindingId: binding.bindingId,
          purpose: 'project-backup',
          suggestedName: name,
          content: { kind: 'bytes', bytes },
        })
        return invoke('runtime_dev_synthetic_fixture_digest', { name })
      },
      async inspectSyntheticBlob(name = 'storyforge-m1-100mib.json') {
        return invoke('runtime_dev_synthetic_fixture_digest', { name })
      },
      async clearSyntheticDeviceCredential() {
        await getRuntime().secrets.delete('storyforge.ai.primary')
      },
      async diagnosticsSnapshot() {
        return getRuntime().diagnostics.snapshot()
      },
      async resetSyntheticFixtures() {
        await invoke('runtime_dev_reset_synthetic_fixtures')
      },
    }),
  })
}
