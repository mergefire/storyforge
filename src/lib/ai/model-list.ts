import { buildOpenAIEndpoint, normalizeOpenAIBaseUrl } from './openai-endpoint'
import type { CredentialId } from '../../runtime'
import type { AIProvider } from '../types'
import { executeAiRequest, readAiResponseText } from './runtime-transport'

const MODEL_LIST_CACHE_KEY = 'storyforge-ai-model-list-cache-v1'

interface ModelListCacheIdentity {
  baseUrl: string
  provider: AIProvider
}

interface ModelListCacheEntry {
  models: string[]
  updatedAt: number
}

function normalizeModelIds(models: readonly string[]): string[] {
  return [...new Set(models.map(model => model.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
}

function modelListCacheId({ baseUrl, provider }: ModelListCacheIdentity): string {
  return `${provider}|${normalizeOpenAIBaseUrl(baseUrl).baseUrl}`
}

function readModelListCache(): Record<string, ModelListCacheEntry> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(MODEL_LIST_CACHE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? parsed as Record<string, ModelListCacheEntry>
      : {}
  } catch {
    return {}
  }
}

export function loadCachedOpenAIModels(identity: ModelListCacheIdentity): string[] {
  const entry = readModelListCache()[modelListCacheId(identity)]
  return entry && Array.isArray(entry.models)
    ? normalizeModelIds(entry.models.filter(model => typeof model === 'string'))
    : []
}

export function saveCachedOpenAIModels(
  identity: ModelListCacheIdentity,
  models: readonly string[],
): void {
  if (typeof localStorage === 'undefined') return
  try {
    const cache = readModelListCache()
    cache[modelListCacheId(identity)] = {
      models: normalizeModelIds(models),
      updatedAt: Date.now(),
    }
    localStorage.setItem(MODEL_LIST_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // A storage quota/private-mode failure must not break model refresh itself.
  }
}

interface FetchOpenAIModelsOptions {
  baseUrl: string
  apiKey?: string
  provider?: AIProvider
  profileId?: string
  credentialId?: CredentialId
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

function parseModelList(body: unknown): string[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) {
    throw new Error('模型列表响应格式无效，服务需兼容 OpenAI /v1/models')
  }

  const models = (body as { data: unknown[] }).data
    .map(item => item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map(id => id.trim())

  return [...new Set(models)].sort((left, right) => left.localeCompare(right))
}

export async function fetchOpenAIModels({
  baseUrl,
  apiKey = '',
  provider = 'custom',
  profileId = 'primary',
  credentialId,
  timeoutMs = 10_000,
  fetchImpl,
}: FetchOpenAIModelsOptions): Promise<string[]> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = fetchImpl
      ? await fetchImpl(buildOpenAIEndpoint(baseUrl, 'models'), {
          method: 'GET',
          signal: controller.signal,
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        })
      : await executeAiRequest({
          provider,
          profileId,
          operation: 'models',
          configuredBaseUrl: baseUrl,
          credentialId,
          body: null,
          signal: controller.signal,
        })

    if ('ok' in response ? !response.ok : response.status < 200 || response.status >= 300) {
      throw new Error(`模型列表请求失败（HTTP ${response.status}）`)
    }

    const body: unknown = 'json' in response
      ? await response.json()
      : JSON.parse(await readAiResponseText(response.body))
    return parseModelList(body)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('刷新模型列表超时，请确认本地模型服务已启动')
    }
    if (error instanceof TypeError) {
      throw new Error('无法连接模型服务，请检查 Base URL、服务状态或 CORS 设置')
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

