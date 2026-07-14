import {
  getRuntime,
  RuntimeError,
  type AiOperation,
  type AiTransportResponse,
  type CredentialId,
  type JsonValue,
  type SecretDescriptor,
  type SecretKey,
} from '../../runtime'
import type { AIProvider } from '../types'
import { normalizeOpenAIBaseUrl } from './openai-endpoint'

export interface BindAiCredentialOptions {
  key: Extract<SecretKey, `storyforge.ai.${string}`>
  apiKey: string
  persistence?: SecretDescriptor['persistence']
}

export interface ExecuteAiRequestOptions {
  provider: AIProvider
  profileId: string
  operation: AiOperation
  configuredBaseUrl: string
  credentialId?: CredentialId
  body: JsonValue
  signal?: AbortSignal
}

/**
 * Plaintext credentials cross the runtime boundary only through SecretStore.put.
 * An empty key means this request uses an anonymous OpenAI-compatible endpoint.
 * It must not mutate the vault: another in-flight request may still hold a
 * value-bound reference for the same logical profile. Explicit configuration
 * removal owns SecretStore.delete and its documented reference invalidation.
 */
export async function bindAiCredential({
  key,
  apiKey,
  persistence = 'session',
}: BindAiCredentialOptions): Promise<CredentialId | undefined> {
  if (!apiKey) return undefined
  return await getRuntime().secrets.put({ key, persistence }, apiKey)
}

/** Performs one transport attempt. Retry policy belongs to the TypeScript caller. */
export async function executeAiRequest({
  provider,
  profileId,
  operation,
  configuredBaseUrl,
  credentialId,
  body,
  signal,
}: ExecuteAiRequestOptions): Promise<AiTransportResponse> {
  try {
    return await getRuntime().ai.execute({
      endpoint: {
        provider,
        profileId,
        operation,
        configuredBaseUrl: normalizeOpenAIBaseUrl(configuredBaseUrl).baseUrl,
      },
      credentialId,
      body,
      signal,
    })
  } catch (error) {
    throw normalizeAiTransportError(error)
  }
}

/** Reads a raw runtime byte stream without corrupting UTF-8 split across chunks. */
export async function readAiResponseText(body: AsyncIterable<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder()
  let text = ''
  try {
    for await (const chunk of body) {
      text += decoder.decode(chunk, { stream: true })
    }
    text += decoder.decode()
    return text
  } catch (error) {
    throw normalizeAiTransportError(error)
  }
}

export function isSuccessfulAiResponse(response: Pick<AiTransportResponse, 'status'>): boolean {
  return response.status >= 200 && response.status < 300
}

export function isAiAbortError(error: unknown): boolean {
  if (error instanceof RuntimeError) {
    return error.code === 'ABORTED' || error.code === 'CANCELLED'
  }
  if (!error || typeof error !== 'object') return false
  const record = error as { name?: unknown; code?: unknown }
  return record.name === 'AbortError' || record.code === 'ABORTED' || record.code === 'CANCELLED'
}

export function isAiNetworkError(error: unknown): boolean {
  if (error instanceof RuntimeError) return error.code === 'NETWORK'
  if (!error || typeof error !== 'object') return false
  const record = error as { name?: unknown; message?: unknown; code?: unknown }
  return record.code === 'NETWORK'
    || (record.name === 'TypeError'
      && typeof record.message === 'string'
      && record.message.includes('Failed to fetch'))
}

/** Keeps the browser-era AbortError/network semantics used by existing callers. */
export function normalizeAiTransportError(error: unknown): unknown {
  if (isAiAbortError(error)) return createAbortError()
  if (isAiNetworkError(error)) {
    if (error instanceof RuntimeError && error.originalCause instanceof TypeError) {
      return error.originalCause
    }
    return new TypeError('Failed to fetch')
  }
  return error
}

export function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('操作已中止', 'AbortError')
  }
  const error = new Error('操作已中止')
  error.name = 'AbortError'
  return error
}

/** Abort-aware retry delay so Stop cancels both requests and backoff immediately. */
export function waitForAiRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(createAbortError())
  return new Promise((resolve, reject) => {
    let settled = false
    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
      reject(createAbortError())
    }
    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', onAbort, { once: true })
    // Close the check/add race if abort happened between the first check and
    // listener registration.
    if (signal?.aborted) onAbort()
  })
}
