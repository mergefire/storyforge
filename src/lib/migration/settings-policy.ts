const MAX_SETTING_BYTES = 4 * 1024 * 1024
const MAX_SETTINGS_BYTES = 32 * 1024 * 1024

export interface StorageReader {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
}

export interface StorageWriter extends StorageReader {
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type SettingSanitizer = (value: string) => string

interface SettingPolicy {
  key: string
  sanitize?: SettingSanitizer
}

const SECRET_FIELD = /^(?:apiKey|credentialId|approvalId|token|pat|secret)$/i

function scrubSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSecrets)
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = Object.create(null)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SECRET_FIELD.test(key) ? '' : scrubSecrets(child)
  }
  return output
}

function sanitizedJson(value: string): string {
  const parsed = JSON.parse(value) as unknown
  return JSON.stringify(scrubSecrets(parsed))
}

const STATIC_SETTINGS: readonly SettingPolicy[] = [
  { key: 'sf_lang' },
  { key: 'storyforge-theme' },
  { key: 'storyforge-editor-typography', sanitize: sanitizedJson },
  { key: 'storyforge_guide_completed' },
  { key: 'sf-genre-pack' },
  { key: 'sf-usd-cny-rate' },
  { key: 'storyforge-ai-config', sanitize: sanitizedJson },
  { key: 'storyforge-embedding-config', sanitize: sanitizedJson },
  { key: 'storyforge-ai-presets', sanitize: sanitizedJson },
  { key: 'storyforge-ai-active-preset' },
  { key: 'sf-gist-user' },
  { key: 'sf-gist-auto' },
]

const PROJECT_SETTING_PREFIXES = [
  'sf-inspiration-draft-',
  'sf-scene-verify-',
  'storyforge-context-memo-',
  'sf-gist-proj-',
] as const

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function projectSettingKey(key: string, projectIds: ReadonlySet<number>): boolean {
  return PROJECT_SETTING_PREFIXES.some(prefix => {
    if (!key.startsWith(prefix)) return false
    const suffix = key.slice(prefix.length)
    return /^\d+$/.test(suffix) && projectIds.has(Number(suffix))
  })
}

export function collectMigrationSettings(
  storage: StorageReader,
  projectIds: ReadonlySet<number>,
): Record<string, string> {
  const settings: Record<string, string> = Object.create(null)
  const staticPolicies = new Map(STATIC_SETTINGS.map(policy => [policy.key, policy] as const))
  let totalBytes = 0

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key) continue
    const policy = staticPolicies.get(key)
    if (!policy && !projectSettingKey(key, projectIds)) continue
    const raw = storage.getItem(key)
    if (raw === null) continue
    const value = policy?.sanitize ? policy.sanitize(raw) : raw
    const bytes = utf8Length(key) + utf8Length(value)
    if (bytes > MAX_SETTING_BYTES) throw new Error(`migration setting is too large: ${key}`)
    totalBytes += bytes
    if (totalBytes > MAX_SETTINGS_BYTES) throw new Error('migration settings exceed the safety limit')
    settings[key] = value
  }

  return Object.fromEntries(Object.entries(settings).sort(([left], [right]) => left.localeCompare(right)))
}

export function assertSafeMigrationSettings(settings: Readonly<Record<string, string>>): void {
  const projectIds = new Set<number>()
  for (const key of Object.keys(settings)) {
    for (const prefix of PROJECT_SETTING_PREFIXES) {
      if (key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length))) {
        projectIds.add(Number(key.slice(prefix.length)))
      }
    }
  }
  const storage = new MapStorage(settings)
  const sanitized = collectMigrationSettings(storage, projectIds)
  if (Object.keys(sanitized).length !== Object.keys(settings).length) {
    throw new Error('migration archive contains a setting outside the allowlist')
  }
  for (const [key, value] of Object.entries(settings)) {
    if (sanitized[key] !== value) throw new Error(`migration setting is not sanitized: ${key}`)
  }
}

export function applyMigrationSettings(
  storage: StorageWriter,
  settings: Readonly<Record<string, string>>,
): string[] {
  assertSafeMigrationSettings(settings)
  const written: string[] = []
  for (const [key, value] of Object.entries(settings)) {
    if (storage.getItem(key) !== null) throw new Error(`target setting is not empty: ${key}`)
    storage.setItem(key, value)
    written.push(key)
  }
  return written
}

export function rollbackMigrationSettings(storage: StorageWriter, keys: readonly string[]): void {
  for (const key of keys) storage.removeItem(key)
}

export function clearAllMigrationSettings(storage: StorageWriter): void {
  const staticKeys = new Set(STATIC_SETTINGS.map(policy => policy.key))
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && (staticKeys.has(key)
      || PROJECT_SETTING_PREFIXES.some(prefix => key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length))))) {
      keys.push(key)
    }
  }
  rollbackMigrationSettings(storage, keys)
}

class MapStorage implements StorageReader {
  private readonly entries: [string, string][]

  constructor(settings: Readonly<Record<string, string>>) {
    this.entries = Object.entries(settings)
  }

  get length(): number {
    return this.entries.length
  }

  key(index: number): string | null {
    return this.entries[index]?.[0] ?? null
  }

  getItem(key: string): string | null {
    return this.entries.find(([candidate]) => candidate === key)?.[1] ?? null
  }
}

export const STATIC_MIGRATION_OMISSIONS = [
  { resource: 'browser-backup-directory-handle', reason: 'device-bound', recoveryAction: 'reauthorize-backup-directory' },
  { resource: 'storyforge.ai.primary', reason: 'secret', recoveryAction: 'reauthorize-primary-ai-key' },
  { resource: 'storyforge.ai.embedding', reason: 'secret', recoveryAction: 'reauthorize-embedding-key' },
  { resource: 'storyforge.github.gist', reason: 'secret', recoveryAction: 'reauthorize-github-pat' },
] as const
