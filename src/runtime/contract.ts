import type { AIProvider } from '../lib/types/ai'
import type { RuntimeErrorCode } from './errors'

export type RuntimeKind = 'web' | 'tauri'

export type JsonPrimitive = boolean | number | string | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/**
 * `cancelled` means the user dismissed native UI without choosing a value.
 * A caller-driven AbortSignal always rejects with RuntimeError code ABORTED so
 * orchestration can distinguish its own cancellation from a user decision.
 */
export type RuntimeOutcome<T> =
  | { status: 'completed'; value: T }
  | { status: 'cancelled' }

export type AiSecretKey =
  | 'storyforge.ai.primary'
  | 'storyforge.ai.embedding'
  | `storyforge.ai.preset.${string}`
export type SecretKey = AiSecretKey | 'storyforge.github.gist'

declare const credentialIdBrand: unique symbol
export type CredentialId = string & { readonly [credentialIdBrand]: true }

declare const endpointApprovalIdBrand: unique symbol
export type EndpointApprovalId = string & { readonly [endpointApprovalIdBrand]: true }

export type AiOperation = 'chat-completions' | 'embeddings'

/**
 * A credential is usable only for the exact capability request it was bound
 * to. This prevents an opaque reference obtained for Gist/profile A from being
 * used as a confused deputy for AI/profile B or an attacker-controlled origin.
 */
export type CredentialScope =
  | {
    kind: 'ai'
    provider: AIProvider
    profileId: string
    operation: AiOperation
    configuredBaseUrl: string
  }
  | { kind: 'github-gist' }

export type SecretDescriptor =
  | {
    key: AiSecretKey
    persistence: 'session' | 'device'
    scope: Extract<CredentialScope, { kind: 'ai' }>
  }
  | {
    key: 'storyforge.github.gist'
    persistence: 'session' | 'device'
    scope: Extract<CredentialScope, { kind: 'github-gist' }>
  }

export interface SecretStore {
  /** Writes a secret and returns an opaque reference bound to that exact value. */
  put(descriptor: SecretDescriptor, value: string): Promise<CredentialId>
  has(key: SecretKey): Promise<boolean>
  /** Returns an opaque vault reference, never the underlying plaintext. */
  reference(key: SecretKey): Promise<CredentialId | null>
  /** Deletes the logical secret and invalidates every reference issued for it. */
  delete(key: SecretKey): Promise<void>
}

/**
 * AI is the sole network capability that carries a configured base URL so Web
 * keeps custom endpoints and Vite proxy aliases exactly. The operation is a
 * closed union: callers cannot choose a method, arbitrary path, or headers.
 */
export interface AiEndpointDescriptor {
  provider: AIProvider
  profileId: string
  operation: AiOperation
  /** Exact user configuration, including supported relative Vite proxy aliases. */
  configuredBaseUrl: string
  /** Native runtime approval for a custom origin; Web does not require it. */
  approvalId?: EndpointApprovalId
}

export interface AiTransportRequest {
  endpoint: AiEndpointDescriptor
  credentialId?: CredentialId
  /** Prompt/messages/provider body are assembled by the shared TypeScript layer. */
  body: JsonValue
  signal?: AbortSignal
}

export interface AiTransportResponse {
  status: number
  statusText: string
  /** Raw response bytes only; SSE parsing and usage accounting stay in TypeScript. */
  body: AsyncIterable<Uint8Array>
}

export interface AiTransport {
  /** Performs exactly one attempt. Retry/backoff policy stays in TypeScript. */
  execute(request: AiTransportRequest): Promise<AiTransportResponse>
}

export interface GistBackupMeta {
  gistId: string
  filename: string
  description: string
  updatedAt: string
}

export interface GistRevisionMeta {
  version: string
  committedAt: string
  additions?: number
  deletions?: number
}

export interface GistWriteRequest {
  credentialId: CredentialId
  gistId?: string
  filename: string
  description: string
  content: string
  signal?: AbortSignal
}

export interface GistTransport {
  validateCredential(credentialId: CredentialId, signal?: AbortSignal): Promise<{ login: string }>
  writeBackup(request: GistWriteRequest): Promise<{ gistId: string; url: string }>
  listBackups(credentialId: CredentialId, signal?: AbortSignal): Promise<GistBackupMeta[]>
  readBackup(
    credentialId: CredentialId,
    gistId: string,
    revision?: string,
    signal?: AbortSignal,
  ): Promise<{ filename: string; content: string }>
  listRevisions(
    credentialId: CredentialId,
    gistId: string,
    signal?: AbortSignal,
  ): Promise<GistRevisionMeta[]>
}

export type OpenFilePurpose =
  | 'project-json'
  | 'full-migration-archive'
  | 'source-document'
  | 'reference-document'
  | 'prompt-template-json'
  | 'prompt-library-json'
  | 'prompt-workflow-json'

export type SaveFilePurpose =
  | 'project-json'
  | 'project-markdown'
  | 'project-text'
  | 'context-snapshot'
  | 'pre-destructive-backup'
  | 'fact-ledger'
  | 'world-map-png'
  | 'inspiration-markdown'
  | 'state-cards-text'
  | 'prompt-template-json'
  | 'prompt-library-json'
  | 'prompt-workflow-json'
  | 'diagnostic-bundle'
  | 'full-migration-archive'

export type BackupFilePurpose = 'project-backup' | 'full-migration-archive'
export type FileOperationPurpose = OpenFilePurpose | SaveFilePurpose | BackupFilePurpose

export type FileContent =
  | { kind: 'text'; text: string }
  | { kind: 'bytes'; bytes: Uint8Array }

export interface SaveFileRequest {
  purpose: SaveFilePurpose
  suggestedName: string
  content: FileContent
  signal?: AbortSignal
}

export interface OpenFileRequest {
  purpose: OpenFilePurpose
  signal?: AbortSignal
}

export interface OpenedFile {
  name: string
  mediaType: string
  bytes: Uint8Array
}

export interface BackupBinding {
  /** Opaque identifier chosen by StoryForge, never an operating-system path. */
  bindingId: string
  label: string
  permission: 'granted' | 'prompt' | 'denied' | 'missing'
}

export interface BackupWriteRequest {
  bindingId: string
  purpose: BackupFilePurpose
  suggestedName: string
  content: FileContent
  signal?: AbortSignal
}

export interface BackupReadRequest {
  bindingId: string
  purpose: BackupFilePurpose
  signal?: AbortSignal
}

export interface BackupFile {
  name: string
  bytes: Uint8Array
}

export interface FileTransport {
  save(request: SaveFileRequest): Promise<RuntimeOutcome<{ displayName: string }>>
  open(request: OpenFileRequest): Promise<RuntimeOutcome<OpenedFile>>
  bindBackupDirectory(bindingId: string): Promise<RuntimeOutcome<BackupBinding>>
  inspectBackupBinding(bindingId: string): Promise<BackupBinding>
  requestBackupPermission(bindingId: string, write: boolean): Promise<BackupBinding>
  writeBackup(request: BackupWriteRequest): Promise<{ displayName: string }>
  readBackups(request: BackupReadRequest): Promise<AsyncIterable<BackupFile>>
  clearBackupBinding(bindingId: string): Promise<void>
}

export interface ClipboardTransport {
  writeText(purpose: ClipboardPurpose, text: string): Promise<void>
}

export type ClipboardPurpose = 'ai-image-prompt' | 'workflow-output'

export type ExternalDestination =
  | { kind: 'github-gist-token' }
  | { kind: 'project-repository' }

export interface ExternalLink {
  open(destination: ExternalDestination): Promise<void>
}

export interface DurabilityStatus {
  persisted: boolean
  usageBytes?: number
  quotaBytes?: number
}

export interface Durability {
  inspect(): Promise<DurabilityStatus>
  requestPersistence(): Promise<DurabilityStatus>
}

export interface DistributionInfo {
  runtime: RuntimeKind
  channel: 'web' | 'dev' | 'beta' | 'stable'
  packaged: boolean
  version?: string
  identifier?: string
}

export interface Distribution {
  getInfo(): Promise<DistributionInfo>
}

export interface AvailableUpdate {
  releaseId: string
  version: string
  notes?: string
}

export interface AppUpdate {
  /** One idempotent startup lifecycle for Web Service Worker or native updater setup. */
  initialize(): Promise<void>
  check(): Promise<AvailableUpdate | null>
  install(releaseId: string, signal?: AbortSignal): Promise<void>
}

interface DiagnosticEventBase {
  timestamp: number
}

export type RuntimeCapabilityName =
  | 'ai'
  | 'gist'
  | 'files'
  | 'secrets'
  | 'clipboard'
  | 'external'
  | 'durability'
  | 'distribution'
  | 'updates'

export type DiagnosticEvent =
  | (DiagnosticEventBase & {
    kind: 'runtime-capability'
    capability: RuntimeCapabilityName
    outcome: 'started' | 'completed' | 'failed'
    errorCode?: RuntimeErrorCode
    durationMs?: number
  })
  | (DiagnosticEventBase & {
    kind: 'network-attempt'
    service: 'ai' | 'github-gist'
    operation: AiOperation | 'validate' | 'write' | 'list' | 'read' | 'revisions'
    outcome: 'completed' | 'failed' | 'aborted'
    status?: number
    durationMs?: number
    errorCode?: RuntimeErrorCode
  })
  | (DiagnosticEventBase & {
    kind: 'file-operation'
    operation: 'save' | 'open' | 'bind' | 'write-backup' | 'read-backups'
    purpose: FileOperationPurpose
    outcome: 'completed' | 'cancelled' | 'failed'
    errorCode?: RuntimeErrorCode
  })
  | (DiagnosticEventBase & {
    kind: 'migration-phase'
    phase: 'preflight' | 'export' | 'import' | 'verify' | 'activate' | 'rollback'
    outcome: 'started' | 'completed' | 'failed'
    tableCount?: number
    recordCount?: number
    errorCode?: RuntimeErrorCode
  })
  | (DiagnosticEventBase & {
    kind: 'update-state'
    state: 'available' | 'downloading' | 'ready' | 'installing' | 'completed' | 'failed'
    version?: string
    errorCode?: RuntimeErrorCode
  })

export interface DiagnosticsSnapshot {
  generatedAt: number
  distribution: DistributionInfo
  events: readonly DiagnosticEvent[]
}

export interface Diagnostics {
  record(event: DiagnosticEvent): void
  snapshot(): Promise<DiagnosticsSnapshot>
}

export interface RuntimeAdapter {
  readonly kind: RuntimeKind
  readonly ai: AiTransport
  readonly gist: GistTransport
  readonly files: FileTransport
  readonly secrets: SecretStore
  readonly clipboard: ClipboardTransport
  readonly external: ExternalLink
  readonly durability: Durability
  readonly distribution: Distribution
  readonly updates: AppUpdate
  readonly diagnostics: Diagnostics
}
