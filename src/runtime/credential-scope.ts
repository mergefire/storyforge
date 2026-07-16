import type {
  AiEndpointDescriptor,
  CredentialScope,
  SecretDescriptor,
  SecretKey,
} from './contract'
import { RuntimeError } from './errors'

const AI_PROVIDERS = new Set([
  'deepseek', 'openai', 'qwen', 'doubao', 'minimax', 'glm', 'wenxin',
  'gemini', 'poe', 'kimi', 'claude', 'modelscope', 'nvidia', 'agnes',
  'longcat', 'opencode', 'ollama', 'custom',
])
const PRESET_KEY_PREFIX = 'storyforge.ai.preset.'
const SAFE_PROFILE = /^[a-zA-Z0-9._:-]{1,160}$/

export const GIST_CREDENTIAL_SCOPE = { kind: 'github-gist' } as const

export function aiCredentialScope(
  endpoint: AiEndpointDescriptor,
): Extract<CredentialScope, { kind: 'ai' }> {
  return {
    kind: 'ai',
    provider: endpoint.provider,
    profileId: endpoint.profileId,
    // Model listing authenticates with the chat credential instead of
    // creating a second stored copy of the same API key.
    operation: endpoint.operation === 'models' ? 'chat-completions' : endpoint.operation,
    configuredBaseUrl: endpoint.configuredBaseUrl,
  }
}

export function sameCredentialScope(left: CredentialScope, right: CredentialScope): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'github-gist' || right.kind === 'github-gist') return true
  return left.provider === right.provider
    && left.profileId === right.profileId
    && left.operation === right.operation
    && left.configuredBaseUrl === right.configuredBaseUrl
}

function isSecretKey(value: unknown): value is SecretKey {
  return value === 'storyforge.ai.primary'
    || value === 'storyforge.ai.embedding'
    || value === 'storyforge.github.gist'
    || (typeof value === 'string'
      && value.startsWith(PRESET_KEY_PREFIX)
      && /^[a-zA-Z0-9_-]{1,128}$/.test(value.slice(PRESET_KEY_PREFIX.length)))
}

function aiKeyMatchesScope(
  key: Exclude<SecretKey, 'storyforge.github.gist'>,
  scope: Extract<CredentialScope, { kind: 'ai' }>,
): boolean {
  if (key === 'storyforge.ai.primary') {
    return scope.profileId === 'primary' && scope.operation === 'chat-completions'
  }
  if (key === 'storyforge.ai.embedding') {
    return scope.profileId === 'embedding' && scope.operation === 'embeddings'
  }
  return scope.profileId === key.slice(PRESET_KEY_PREFIX.length)
    && scope.operation === 'chat-completions'
}

export function isSecretDescriptor(
  value: unknown,
  expectedKey?: unknown,
): value is SecretDescriptor {
  if (!value || typeof value !== 'object') return false
  const descriptor = value as Partial<SecretDescriptor>
  if (!isSecretKey(descriptor.key)) return false
  if (expectedKey !== undefined && descriptor.key !== expectedKey) return false
  if (descriptor.persistence !== 'session' && descriptor.persistence !== 'device') return false

  const scope = descriptor.scope as Partial<CredentialScope> | undefined
  if (descriptor.key === 'storyforge.github.gist') return scope?.kind === 'github-gist'
  if (
    scope?.kind !== 'ai'
    || !AI_PROVIDERS.has(String(scope.provider))
    || typeof scope.profileId !== 'string'
    || !SAFE_PROFILE.test(scope.profileId)
    || (scope.operation !== 'chat-completions' && scope.operation !== 'embeddings')
    || typeof scope.configuredBaseUrl !== 'string'
    || scope.configuredBaseUrl.length < 1
    || scope.configuredBaseUrl.length > 2048
    || scope.configuredBaseUrl !== scope.configuredBaseUrl.trim()
    || /[\u0000-\u001f\u007f]/.test(scope.configuredBaseUrl)
  ) return false
  return aiKeyMatchesScope(descriptor.key, scope as Extract<CredentialScope, { kind: 'ai' }>)
}

export function assertSecretDescriptor(value: unknown, operation: string): asserts value is SecretDescriptor {
  if (!isSecretDescriptor(value)) {
    throw new RuntimeError('INVALID_INPUT', '凭据描述与用途不匹配', { operation })
  }
}

export function cloneSecretDescriptor(descriptor: SecretDescriptor): SecretDescriptor {
  if (descriptor.key === 'storyforge.github.gist') {
    return { key: 'storyforge.github.gist', persistence: descriptor.persistence, scope: { kind: 'github-gist' } }
  }
  return {
    key: descriptor.key,
    persistence: descriptor.persistence,
    scope: { ...descriptor.scope },
  }
}
