import type { AIConfig, AIConfigPreset, AIProvider, EmbeddingConfig } from '../lib/types'
import { normalizeOpenAIBaseUrl } from '../lib/ai/openai-endpoint'
import type { RuntimeAdapter, SecretDescriptor } from './contract'

const AI_CONFIG_KEY = 'storyforge-ai-config'
const AI_PRESETS_KEY = 'storyforge-ai-presets'
const AI_SESSION_KEY = 'storyforge-ai-api-key-session'
const AI_REMEMBER_KEY = 'storyforge-ai-api-key-remember'
const EMBEDDING_CONFIG_KEY = 'storyforge-embedding-config'
const EMBEDDING_SESSION_KEY = 'storyforge-embedding-key-session'
const GIST_PAT_KEY = 'sf-gist-pat'
const GIST_PERSISTENCE_KEY = 'sf-gist-credential-persistence'

function parseObject<T>(raw: string | null): Partial<T> {
  if (!raw) return {}
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function aiDescriptor(
  key: SecretDescriptor['key'],
  persistence: 'session' | 'device',
  config: Pick<AIConfig, 'provider' | 'baseUrl'>,
  profileId: string,
  operation: 'chat-completions' | 'embeddings',
): SecretDescriptor {
  return {
    key: key as Extract<SecretDescriptor, { scope: { kind: 'ai' } }>['key'],
    persistence,
    scope: {
      kind: 'ai',
      provider: config.provider,
      profileId,
      operation,
      configuredBaseUrl: normalizeOpenAIBaseUrl(config.baseUrl).baseUrl,
    },
  }
}

async function migratePrimary(runtime: RuntimeAdapter): Promise<void> {
  const config = parseObject<AIConfig>(localStorage.getItem(AI_CONFIG_KEY))
  const remember = localStorage.getItem(AI_REMEMBER_KEY) === 'true'
  const localValue = typeof config.apiKey === 'string' ? config.apiKey : ''
  const sessionValue = sessionStorage.getItem(AI_SESSION_KEY) || ''
  const value = remember ? localValue || sessionValue : sessionValue || localValue
  if (value && typeof config.provider === 'string' && typeof config.baseUrl === 'string') {
    await runtime.secrets.put(
      aiDescriptor(
        'storyforge.ai.primary',
        remember ? 'device' : 'session',
        config as Pick<AIConfig, 'provider' | 'baseUrl'>,
        'primary',
        'chat-completions',
      ),
      value,
    )
  }
  if ('apiKey' in config) {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ ...config, apiKey: '' }))
  }
  sessionStorage.removeItem(AI_SESSION_KEY)
}

async function migrateEmbedding(runtime: RuntimeAdapter): Promise<void> {
  const config = parseObject<EmbeddingConfig>(localStorage.getItem(EMBEDDING_CONFIG_KEY))
  const remember = localStorage.getItem(AI_REMEMBER_KEY) === 'true'
  const localValue = typeof config.apiKey === 'string' ? config.apiKey : ''
  const sessionValue = sessionStorage.getItem(EMBEDDING_SESSION_KEY) || ''
  const value = remember ? localValue || sessionValue : sessionValue || localValue
  if (value && typeof config.provider === 'string' && typeof config.baseUrl === 'string') {
    await runtime.secrets.put(
      aiDescriptor(
        'storyforge.ai.embedding',
        remember ? 'device' : 'session',
        config as Pick<EmbeddingConfig, 'provider' | 'baseUrl'> & { provider: AIProvider },
        'embedding',
        'embeddings',
      ),
      value,
    )
  }
  if ('apiKey' in config) {
    localStorage.setItem(EMBEDDING_CONFIG_KEY, JSON.stringify({ ...config, apiKey: '' }))
  }
  sessionStorage.removeItem(EMBEDDING_SESSION_KEY)
}

async function migratePresets(runtime: RuntimeAdapter): Promise<void> {
  const raw = localStorage.getItem(AI_PRESETS_KEY)
  if (!raw) return
  let presets: AIConfigPreset[]
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    presets = parsed
  } catch {
    return
  }
  let changed = false
  for (const preset of presets) {
    const value = preset?.config?.apiKey
    if (!value || !preset.id || !preset.config.provider || !preset.config.baseUrl) continue
    await runtime.secrets.put(
      aiDescriptor(
        `storyforge.ai.preset.${preset.id}`,
        'device',
        preset.config,
        preset.id,
        'chat-completions',
      ),
      value,
    )
    preset.config = { ...preset.config, apiKey: '' }
    changed = true
  }
  if (changed) localStorage.setItem(AI_PRESETS_KEY, JSON.stringify(presets))
}

async function migrateGist(runtime: RuntimeAdapter): Promise<void> {
  const sessionPat = sessionStorage.getItem(GIST_PAT_KEY)
  const localPat = localStorage.getItem(GIST_PAT_KEY)
  const value = sessionPat || localPat
  if (value) {
    const persistence = localPat ? 'device' : 'session'
    await runtime.secrets.put(
      {
        key: 'storyforge.github.gist',
        persistence,
        scope: { kind: 'github-gist' },
      },
      value,
    )
    localStorage.setItem(GIST_PERSISTENCE_KEY, persistence)
  }
  localStorage.removeItem(GIST_PAT_KEY)
  sessionStorage.removeItem(GIST_PAT_KEY)
}

/**
 * One-shot idempotent migration. Each family is fail-safe: plaintext is
 * scrubbed only after its runtime write succeeds.
 */
export async function migrateLegacyRuntimeCredentials(runtime: RuntimeAdapter): Promise<void> {
  if (!runtime.secrets.policy.migrateLegacyPlaintext) return
  await migratePrimary(runtime)
  await migrateEmbedding(runtime)
  await migratePresets(runtime)
  await migrateGist(runtime)
}

export function desktopPlaintextCredentialCanaries(): string[] {
  const findings: string[] = []
  for (const [storageName, storage] of [['local', localStorage], ['session', sessionStorage]] as const) {
    for (const key of [AI_SESSION_KEY, EMBEDDING_SESSION_KEY, GIST_PAT_KEY]) {
      if (storage.getItem(key)) findings.push(`${storageName}:${key}`)
    }
  }
  for (const key of [AI_CONFIG_KEY, EMBEDDING_CONFIG_KEY]) {
    const value = parseObject<{ apiKey: string }>(localStorage.getItem(key)).apiKey
    if (value) findings.push(`local:${key}.apiKey`)
  }
  const presets = localStorage.getItem(AI_PRESETS_KEY)
  if (presets) {
    try {
      if ((JSON.parse(presets) as AIConfigPreset[]).some(preset => !!preset?.config?.apiKey)) {
        findings.push(`local:${AI_PRESETS_KEY}.*.apiKey`)
      }
    } catch {
      findings.push(`local:${AI_PRESETS_KEY}.invalid`)
    }
  }
  return findings
}
