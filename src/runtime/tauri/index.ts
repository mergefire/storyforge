import { Channel, invoke } from '@tauri-apps/api/core'
import type { AiStreamEvent } from './types'
import type {
  BackupBinding,
  BackupFile,
  CredentialId,
  DiagnosticEvent,
  DistributionInfo,
  DurabilityStatus,
  FileContent,
  RuntimeAdapter,
  RuntimeCapabilityName,
  RuntimeOutcome,
} from '../contract'
import { RuntimeError, type RuntimeErrorCode, throwIfAborted } from '../errors'
import type { MigrationJournal, MigrationReceipt } from '../../lib/migration/archive-types'

const MAX_DIAGNOSTIC_EVENTS = 200
const FILE_CHUNK_BYTES = 1024 * 1024

type InvokeArgs = Record<string, unknown>

interface ChannelLike<T> {
  onmessage: (message: T) => void
}

export interface TauriIpcBridge {
  invoke<T>(command: string, args?: InvokeArgs): Promise<T>
  createChannel<T>(onmessage: (message: T) => void): ChannelLike<T>
}

export interface TauriRuntimeOptions {
  channel?: Extract<DistributionInfo['channel'], 'dev' | 'beta' | 'stable'>
  packaged?: boolean
  version?: string
  identifier?: string
  now?: () => number
  ipc?: TauriIpcBridge
}

type NativeError = {
  code?: unknown
  message?: unknown
  operation?: unknown
  retryable?: unknown
}

type NativeAiEvent = AiStreamEvent

interface NativeWriteSession {
  sessionId: string
  displayName: string
}

interface NativeBackupEntry {
  name: string
}

const ERROR_CODES = new Set<RuntimeErrorCode>([
  'ABORTED', 'CANCELLED', 'TIMEOUT', 'PERMISSION_DENIED', 'DISK_FULL', 'UNAVAILABLE',
  'UNSUPPORTED', 'INVALID_INPUT', 'NOT_FOUND', 'BUSY', 'NETWORK', 'REMOTE_ERROR',
  'INTEGRITY_ERROR', 'UNKNOWN',
])

const defaultIpc: TauriIpcBridge = {
  invoke: (command, args) => invoke(command, args),
  createChannel: onmessage => new Channel(onmessage),
}

function resolveChannel(value: string | undefined): NonNullable<TauriRuntimeOptions['channel']> {
  if (value === 'beta' || value === 'stable') return value
  return 'dev'
}

function requestId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}

function ipcError(error: unknown, operation: string): RuntimeError {
  if (error instanceof RuntimeError) return error
  if (error && typeof error === 'object') {
    const native = error as NativeError
    const code = typeof native.code === 'string' && ERROR_CODES.has(native.code as RuntimeErrorCode)
      ? native.code as RuntimeErrorCode
      : 'UNKNOWN'
    return new RuntimeError(
      code,
      typeof native.message === 'string' ? native.message : '桌面运行时操作失败',
      {
        operation: typeof native.operation === 'string' ? native.operation : operation,
        retryable: native.retryable === true,
        cause: error,
      },
    )
  }
  return new RuntimeError('UNKNOWN', '桌面运行时操作失败', { operation, cause: error })
}

function abortError(operation: string): RuntimeError {
  return new RuntimeError('ABORTED', '操作已中止', { operation })
}

async function cancelRequest(ipc: TauriIpcBridge, id: string): Promise<void> {
  try {
    await ipc.invoke('runtime_cancel_request', { requestId: id })
  } catch {
    // The original operation owns user-visible error reporting.
  }
}

async function invokeAbortable<T>(
  ipc: TauriIpcBridge,
  command: string,
  operation: string,
  id: string,
  args: InvokeArgs,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal, operation)
  const onAbort = () => { void cancelRequest(ipc, id) }
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const result = await ipc.invoke<T>(command, args)
    if (signal?.aborted) throw abortError(operation)
    return result
  } catch (error) {
    if (signal?.aborted) throw abortError(operation)
    throw ipcError(error, operation)
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

class AsyncByteQueue {
  private readonly values: Uint8Array[] = []
  private readonly waiters: Array<{
    resolve: (value: IteratorResult<Uint8Array>) => void
    reject: (error: unknown) => void
  }> = []
  private ended = false
  private failure: unknown

  push(value: Uint8Array): void {
    if (this.ended || this.failure) return
    const waiter = this.waiters.shift()
    if (waiter) waiter.resolve({ value, done: false })
    else this.values.push(value)
  }

  close(): void {
    if (this.ended || this.failure) return
    this.ended = true
    for (const waiter of this.waiters.splice(0)) waiter.resolve({ value: undefined, done: true })
  }

  fail(error: unknown): void {
    if (this.ended || this.failure) return
    this.failure = error
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
  }

  next(): Promise<IteratorResult<Uint8Array>> {
    if (this.values.length > 0) return Promise.resolve({ value: this.values.shift()!, done: false })
    if (this.failure) return Promise.reject(this.failure)
    if (this.ended) return Promise.resolve({ value: undefined, done: true })
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }
}

function contentBytes(content: FileContent): Uint8Array {
  return content.kind === 'bytes' ? content.bytes : new TextEncoder().encode(content.text)
}

async function writeContent(
  ipc: TauriIpcBridge,
  session: NativeWriteSession,
  content: FileContent,
  signal: AbortSignal | undefined,
  operation: string,
): Promise<{ displayName: string }> {
  const bytes = contentBytes(content)
  const abort = () => { void ipc.invoke('runtime_file_abort_write', { sessionId: session.sessionId }) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    for (let offset = 0; offset < bytes.byteLength; offset += FILE_CHUNK_BYTES) {
      if (signal?.aborted) throw abortError(operation)
      const chunk = bytes.slice(offset, Math.min(bytes.byteLength, offset + FILE_CHUNK_BYTES))
      await ipc.invoke('runtime_file_write_chunk', {
        sessionId: session.sessionId,
        bytes: Array.from(chunk),
      }).catch(error => { throw ipcError(error, operation) })
    }
    if (signal?.aborted) throw abortError(operation)
    return await ipc.invoke<{ displayName: string }>('runtime_file_finish_write', {
      sessionId: session.sessionId,
    }).catch(error => { throw ipcError(error, operation) })
  } catch (error) {
    await ipc.invoke('runtime_file_abort_write', { sessionId: session.sessionId }).catch(() => undefined)
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

function destinationKind(destination: Parameters<RuntimeAdapter['external']['open']>[0]): string {
  return destination.kind
}

export function createTauriRuntime(options: TauriRuntimeOptions = {}): RuntimeAdapter {
  const ipc = options.ipc ?? defaultIpc
  const now = options.now ?? Date.now
  const distributionInfo: DistributionInfo = {
    runtime: 'tauri',
    channel: options.channel ?? resolveChannel(import.meta.env.VITE_DESKTOP_CHANNEL),
    packaged: options.packaged ?? !import.meta.env.DEV,
    version: options.version ?? import.meta.env.VITE_DESKTOP_VERSION,
    identifier: options.identifier ?? import.meta.env.VITE_DESKTOP_IDENTIFIER,
  }
  const events: DiagnosticEvent[] = []

  const distribution: RuntimeAdapter['distribution'] = {
    getInfo: async () => ({ ...distributionInfo }),
  }

  const adapter: RuntimeAdapter = {
    kind: 'tauri',
    ai: {
      async execute(request) {
        const operation = 'ai.execute'
        throwIfAborted(request.signal, operation)
        const approvalId = request.endpoint.approvalId ?? await ipc.invoke<string | null>(
          'runtime_ai_approve_endpoint',
          { endpoint: request.endpoint },
        ).catch(error => { throw ipcError(error, 'ai.endpoint.approve') }) ?? undefined
        throwIfAborted(request.signal, operation)
        const id = requestId('ai')
        const queue = new AsyncByteQueue()
        let started = false
        let settled = false
        let resolveStarted!: (value: { status: number; statusText: string }) => void
        let rejectStarted!: (error: unknown) => void
        const startedPromise = new Promise<{ status: number; statusText: string }>((resolve, reject) => {
          resolveStarted = resolve
          rejectStarted = reject
        })
        const fail = (error: unknown) => {
          if (!started && !settled) {
            settled = true
            rejectStarted(error)
          }
          queue.fail(error)
        }
        const channel = ipc.createChannel<NativeAiEvent>(event => {
          if (event.event === 'started') {
            if (settled) return
            started = true
            settled = true
            resolveStarted(event.data)
          } else if (event.event === 'chunk') {
            queue.push(Uint8Array.from(event.data.bytes))
          } else if (event.event === 'done') {
            queue.close()
          } else if (event.event === 'error') {
            fail(ipcError(event.data.error as NativeError, operation))
          }
        })
        const onAbort = () => {
          void cancelRequest(ipc, id)
          fail(abortError(operation))
        }
        request.signal?.addEventListener('abort', onAbort, { once: true })
        void ipc.invoke<void>('runtime_ai_execute', {
          request: {
            requestId: id,
            endpoint: { ...request.endpoint, ...(approvalId ? { approvalId } : {}) },
            credentialId: request.credentialId,
            body: request.body,
          },
          channel,
        }).catch(error => fail(ipcError(error, operation))).finally(() => {
          request.signal?.removeEventListener('abort', onAbort)
          if (!started && !settled) fail(new RuntimeError('NETWORK', 'AI 响应未开始', { operation }))
        })
        const response = await startedPromise
        const signal = request.signal
        return {
          ...response,
          body: {
            async *[Symbol.asyncIterator]() {
              try {
                while (true) {
                  const next = await queue.next()
                  if (next.done) return
                  yield next.value
                }
              } finally {
                if (!signal?.aborted) void cancelRequest(ipc, id)
              }
            },
          },
        }
      },
    },
    gist: {
      async validateCredential(credentialId, signal) {
        const id = requestId('gist-validate')
        return invokeAbortable(ipc, 'runtime_gist_validate', 'gist.validateCredential', id, {
          request: { requestId: id, credentialId },
        }, signal)
      },
      async writeBackup(request) {
        const id = requestId('gist-write')
        return invokeAbortable(ipc, 'runtime_gist_write', 'gist.writeBackup', id, {
          request: {
            requestId: id,
            credentialId: request.credentialId,
            gistId: request.gistId,
            filename: request.filename,
            description: request.description,
            content: request.content,
          },
        }, request.signal)
      },
      async listBackups(credentialId, signal) {
        const id = requestId('gist-list')
        return invokeAbortable(ipc, 'runtime_gist_list', 'gist.listBackups', id, {
          request: { requestId: id, credentialId },
        }, signal)
      },
      async readBackup(credentialId, gistId, revision, signal) {
        const id = requestId('gist-read')
        return invokeAbortable(ipc, 'runtime_gist_read', 'gist.readBackup', id, {
          request: { requestId: id, credentialId, gistId, revision },
        }, signal)
      },
      async listRevisions(credentialId, gistId, signal) {
        const id = requestId('gist-revisions')
        return invokeAbortable(ipc, 'runtime_gist_revisions', 'gist.listRevisions', id, {
          request: { requestId: id, credentialId, gistId },
        }, signal)
      },
    },
    files: {
      async save(request) {
        const operation = 'files.save'
        throwIfAborted(request.signal, operation)
        const outcome = await ipc.invoke<RuntimeOutcome<NativeWriteSession>>('runtime_file_begin_save', {
          purpose: request.purpose,
          suggestedName: request.suggestedName,
        }).catch(error => { throw ipcError(error, operation) })
        if (outcome.status === 'cancelled') return outcome
        return {
          status: 'completed',
          value: await writeContent(ipc, outcome.value, request.content, request.signal, operation),
        }
      },
      async open(request) {
        throwIfAborted(request.signal, 'files.open')
        const outcome = await ipc.invoke<RuntimeOutcome<{ name: string; mediaType: string; bytes: number[] }>>(
          'runtime_file_open',
          { purpose: request.purpose },
        ).catch(error => { throw ipcError(error, 'files.open') })
        if (request.signal?.aborted) throw abortError('files.open')
        if (outcome.status === 'cancelled') return outcome
        return {
          status: 'completed',
          value: { ...outcome.value, bytes: Uint8Array.from(outcome.value.bytes) },
        }
      },
      async bindBackupDirectory(bindingId) {
        return ipc.invoke<RuntimeOutcome<BackupBinding>>('runtime_backup_bind', { bindingId })
          .catch(error => { throw ipcError(error, 'files.bindBackupDirectory') })
      },
      async inspectBackupBinding(bindingId) {
        return ipc.invoke<BackupBinding>('runtime_backup_inspect', { bindingId })
          .catch(error => { throw ipcError(error, 'files.inspectBackupBinding') })
      },
      async requestBackupPermission(bindingId, _write) {
        return adapter.files.inspectBackupBinding(bindingId)
      },
      async writeBackup(request) {
        throwIfAborted(request.signal, 'files.writeBackup')
        const session = await ipc.invoke<NativeWriteSession>('runtime_backup_begin_write', {
          bindingId: request.bindingId,
          purpose: request.purpose,
          suggestedName: request.suggestedName,
        }).catch(error => { throw ipcError(error, 'files.writeBackup') })
        return writeContent(ipc, session, request.content, request.signal, 'files.writeBackup')
      },
      async readBackups(request) {
        throwIfAborted(request.signal, 'files.readBackups')
        const entries = await ipc.invoke<NativeBackupEntry[]>('runtime_backup_list', {
          bindingId: request.bindingId,
          purpose: request.purpose,
        }).catch(error => { throw ipcError(error, 'files.readBackups') })
        const signal = request.signal
        const bindingId = request.bindingId
        const purpose = request.purpose
        return {
          async *[Symbol.asyncIterator](): AsyncIterableIterator<BackupFile> {
            for (const entry of entries) {
              throwIfAborted(signal, 'files.readBackups')
              const file = await ipc.invoke<{ name: string; bytes: number[] }>('runtime_backup_read', {
                bindingId,
                purpose,
                name: entry.name,
              }).catch(error => { throw ipcError(error, 'files.readBackups') })
              yield { name: file.name, bytes: Uint8Array.from(file.bytes) }
            }
          },
        }
      },
      async clearBackupBinding(bindingId) {
        await ipc.invoke('runtime_backup_clear', { bindingId })
          .catch(error => { throw ipcError(error, 'files.clearBackupBinding') })
      },
    },
    secrets: {
      policy: {
        storesPlaintextConfiguration: false,
        reuseReferenceWhenPlaintextOmitted: true,
        migrateLegacyPlaintext: true,
        storageLabel: 'Windows 凭据管理器',
      },
      async put(descriptor, value) {
        return ipc.invoke<string>('runtime_secret_put', { request: { descriptor, value } })
          .then(value => value as CredentialId)
          .catch(error => { throw ipcError(error, 'secrets.put') })
      },
      async has(key) {
        return ipc.invoke<boolean>('runtime_secret_has', { key })
          .catch(error => { throw ipcError(error, 'secrets.has') })
      },
      async reference(key) {
        return ipc.invoke<string | null>('runtime_secret_reference', { key })
          .then(value => value as CredentialId | null)
          .catch(error => { throw ipcError(error, 'secrets.reference') })
      },
      async reveal(key) {
        return ipc.invoke<string | null>('runtime_ai_secret_reveal', { key })
          .catch(error => { throw ipcError(error, 'secrets.reveal') })
      },
      async delete(key) {
        await ipc.invoke('runtime_secret_delete', { key })
          .catch(error => { throw ipcError(error, 'secrets.delete') })
      },
    },
    clipboard: {
      async writeText(purpose, text) {
        await ipc.invoke('runtime_clipboard_write', { purpose, text })
          .catch(error => { throw ipcError(error, 'clipboard.writeText') })
      },
    },
    external: {
      async open(destination) {
        await ipc.invoke('runtime_external_open', { destination: destinationKind(destination) })
          .catch(error => { throw ipcError(error, 'external.open') })
      },
    },
    durability: {
      async inspect() {
        return ipc.invoke<DurabilityStatus>('runtime_durability_status')
          .catch(error => { throw ipcError(error, 'durability.inspect') })
      },
      async requestPersistence() {
        return ipc.invoke<DurabilityStatus>('runtime_durability_status')
          .catch(error => { throw ipcError(error, 'durability.requestPersistence') })
      },
    },
    distribution,
    updates: {
      async initialize() {
        // M1 self-use builds intentionally have no updater authority.
      },
      async check() {
        return null
      },
      async install(_releaseId, signal) {
        throwIfAborted(signal, 'updates.install')
        throw new RuntimeError('UNAVAILABLE', '当前桌面分发通道未启用自动更新', {
          operation: 'updates.install',
        })
      },
    },
    diagnostics: {
      record(event) {
        events.push({ ...event })
        if (events.length > MAX_DIAGNOSTIC_EVENTS) events.shift()
      },
      async snapshot() {
        const nativeEvents = await ipc.invoke<DiagnosticEvent[]>('runtime_diagnostics_snapshot')
          .catch(error => { throw ipcError(error, 'diagnostics.snapshot') })
        return {
          generatedAt: now(),
          distribution: await distribution.getInfo(),
          events: [...events, ...nativeEvents].slice(-MAX_DIAGNOSTIC_EVENTS),
        }
      },
    },
    migration: {
      policy: {
        canExportProfile: false,
        requiresFirstRunChoice: true,
        journalOutsideBusinessDatabase: true,
      },
      async readJournal() {
        return ipc.invoke<MigrationJournal | null>('runtime_migration_read_journal')
          .catch(error => { throw ipcError(error, 'migration.readJournal') })
      },
      async writeJournal(journal, expectedPhase) {
        await ipc.invoke('runtime_migration_write_journal', {
          request: {
            journal,
            ...(expectedPhase !== undefined
              ? { expectedPhase: expectedPhase === null ? 'none' : expectedPhase }
              : {}),
          },
        }).catch(error => { throw ipcError(error, 'migration.writeJournal') })
      },
      async clearJournal() {
        await ipc.invoke('runtime_migration_clear_journal')
          .catch(error => { throw ipcError(error, 'migration.clearJournal') })
      },
      async readReceipt(exportId) {
        return ipc.invoke<MigrationReceipt | null>('runtime_migration_read_receipt', { exportId })
          .catch(error => { throw ipcError(error, 'migration.readReceipt') })
      },
      async writeReceipt(receipt) {
        await ipc.invoke('runtime_migration_write_receipt', { receipt })
          .catch(error => { throw ipcError(error, 'migration.writeReceipt') })
      },
      async deleteReceipt(exportId) {
        await ipc.invoke('runtime_migration_delete_receipt', { exportId })
          .catch(error => { throw ipcError(error, 'migration.deleteReceipt') })
      },
    },
  }

  return adapter
}

// Kept as a type-level exhaustiveness anchor for capability names in this
// adapter; it emits no runtime data and therefore cannot expand authority.
const _capabilityNames: readonly RuntimeCapabilityName[] = [
  'ai', 'gist', 'files', 'secrets', 'clipboard', 'external', 'durability',
  'distribution', 'updates', 'migration',
]
void _capabilityNames
