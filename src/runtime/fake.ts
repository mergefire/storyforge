import type {
  AiTransportRequest,
  AvailableUpdate,
  BackupBinding,
  BackupFile,
  ClipboardPurpose,
  CredentialScope,
  CredentialId,
  DiagnosticEvent,
  ExternalDestination,
  FileContent,
  GistBackupMeta,
  GistRevisionMeta,
  OpenedFile,
  RuntimeAdapter,
  RuntimeOutcome,
  SaveFileRequest,
  SecretDescriptor,
  SecretKey,
} from './contract'
import {
  aiCredentialScope,
  assertSecretDescriptor,
  cloneSecretDescriptor,
  GIST_CREDENTIAL_SCOPE,
  sameCredentialScope,
} from './credential-scope'
import { RuntimeError, type RuntimeErrorCode, throwIfAborted } from './errors'
import type { MigrationJournal, MigrationReceipt } from '../lib/migration/archive-types'

export type FakeRuntimeOperation =
  | 'ai.execute'
  | 'gist.validateCredential'
  | 'gist.writeBackup'
  | 'gist.listBackups'
  | 'gist.readBackup'
  | 'gist.listRevisions'
  | 'files.save'
  | 'files.open'
  | 'files.bindBackupDirectory'
  | 'files.inspectBackupBinding'
  | 'files.requestBackupPermission'
  | 'files.writeBackup'
  | 'files.readBackups'
  | 'files.clearBackupBinding'
  | 'secrets.put'
  | 'secrets.has'
  | 'secrets.delete'
  | 'clipboard.writeText'
  | 'external.open'
  | 'durability.inspect'
  | 'durability.requestPersistence'
  | 'distribution.getInfo'
  | 'updates.initialize'
  | 'updates.check'
  | 'updates.install'
  | 'diagnostics.snapshot'
  | 'migration.readJournal'
  | 'migration.writeJournal'
  | 'migration.writeReceipt'
  | 'migration.deleteReceipt'

export interface FakeRuntimeState {
  aiRequests: AiTransportRequest[]
  savedFiles: SaveFileRequest[]
  openedFile: OpenedFile
  clipboardWrites: { purpose: ClipboardPurpose; text: string }[]
  externalDestinations: ExternalDestination[]
  secretKeys: Set<SecretKey>
  gistBackups: Map<string, { filename: string; description: string; content: string; updatedAt: string }>
  gistRevisions: Map<string, GistRevisionMeta[]>
  bindings: Map<string, BackupBinding>
  bindingFiles: Map<string, Map<string, Uint8Array>>
  diagnosticEvents: DiagnosticEvent[]
  updatesInitialized: boolean
  update: AvailableUpdate | null
  migrationJournal: MigrationJournal | null
  migrationReceipts: Map<string, MigrationReceipt>
}

export interface FakeRuntimeOptions {
  now?: () => number
  aiChunks?: readonly Uint8Array[]
  aiStatus?: number
}

function runtimeFailure(code: RuntimeErrorCode, operation: string): RuntimeError {
  const messages: Record<RuntimeErrorCode, string> = {
    ABORTED: '操作已中止',
    CANCELLED: '用户取消了操作',
    TIMEOUT: '操作超时',
    PERMISSION_DENIED: '权限被拒绝',
    DISK_FULL: '磁盘空间不足',
    UNAVAILABLE: '运行时能力不可用',
    UNSUPPORTED: '运行时能力不受支持',
    INVALID_INPUT: '输入无效',
    NOT_FOUND: '目标不存在',
    BUSY: '运行时正忙',
    NETWORK: '网络失败',
    REMOTE_ERROR: '远端服务失败',
    INTEGRITY_ERROR: '完整性校验失败',
    UNKNOWN: '未知运行时错误',
  }
  return new RuntimeError(code, messages[code], {
    operation,
    retryable: code === 'TIMEOUT' || code === 'NETWORK' || code === 'REMOTE_ERROR',
  })
}

function contentBytes(content: FileContent): Uint8Array {
  return content.kind === 'bytes' ? content.bytes.slice() : new TextEncoder().encode(content.text)
}

function completed<T>(value: T): RuntimeOutcome<T> {
  return { status: 'completed', value }
}

export class FakeRuntimeAdapter implements RuntimeAdapter {
  readonly kind = 'web' as const
  readonly state: FakeRuntimeState

  private readonly faults = new Map<FakeRuntimeOperation, RuntimeErrorCode>()
  private readonly secretValues = new Map<SecretKey, { descriptor: SecretDescriptor; value: string }>()
  private readonly credentials = new Map<CredentialId, { descriptor: SecretDescriptor; value: string }>()
  private readonly currentCredentials = new Map<SecretKey, CredentialId>()
  private credentialSequence = 0
  private readonly now: () => number
  private readonly aiChunks: readonly Uint8Array[]
  private readonly aiStatus: number

  constructor(options: FakeRuntimeOptions = {}) {
    this.now = options.now ?? (() => 1_700_000_000_000)
    this.aiChunks = options.aiChunks ?? [new TextEncoder().encode('data: [DONE]\n\n')]
    this.aiStatus = options.aiStatus ?? 200
    this.state = {
      aiRequests: [],
      savedFiles: [],
      openedFile: {
        name: 'storyforge-import.json',
        mediaType: 'application/json',
        bytes: new TextEncoder().encode('{}'),
      },
      clipboardWrites: [],
      externalDestinations: [],
      secretKeys: new Set(),
      gistBackups: new Map(),
      gistRevisions: new Map(),
      bindings: new Map(),
      bindingFiles: new Map(),
      diagnosticEvents: [],
      updatesInitialized: false,
      update: null,
      migrationJournal: null,
      migrationReceipts: new Map(),
    }
  }

  /** Injects one failure; it is consumed by the next matching operation. */
  failNext(operation: FakeRuntimeOperation, code: RuntimeErrorCode): void {
    this.faults.set(operation, code)
  }

  cancelNext(operation: FakeRuntimeOperation): void {
    this.failNext(operation, 'CANCELLED')
  }

  private before(operation: FakeRuntimeOperation, signal?: AbortSignal): RuntimeErrorCode | undefined {
    throwIfAborted(signal, operation)
    const code = this.faults.get(operation)
    if (code) this.faults.delete(operation)
    return code
  }

  private assertNoFailure(operation: FakeRuntimeOperation, signal?: AbortSignal): void {
    const code = this.before(operation, signal)
    if (code) throw runtimeFailure(code, operation)
  }

  private credentialId(descriptor: SecretDescriptor, value: string): CredentialId {
    const currentId = this.currentCredentials.get(descriptor.key)
    const current = currentId ? this.credentials.get(currentId) : undefined
    if (current && current.value === value && sameCredentialScope(current.descriptor.scope, descriptor.scope)) {
      return currentId!
    }

    this.credentialSequence += 1
    const id = `fake-vault:${this.credentialSequence}:${descriptor.key}` as CredentialId
    this.credentials.set(id, { descriptor, value })
    this.currentCredentials.set(descriptor.key, id)
    return id
  }

  private assertCredential(
    credentialId: CredentialId,
    operation: FakeRuntimeOperation,
    expectedScope: CredentialScope,
  ): void {
    const credential = this.credentials.get(credentialId)
    if (!credential || !sameCredentialScope(credential.descriptor.scope, expectedScope)) {
      throw runtimeFailure('PERMISSION_DENIED', operation)
    }
  }

  readonly ai: RuntimeAdapter['ai'] = {
    execute: async request => {
      this.assertNoFailure('ai.execute', request.signal)
      if (request.credentialId) {
        this.assertCredential(request.credentialId, 'ai.execute', aiCredentialScope(request.endpoint))
      }
      this.state.aiRequests.push(request)
      const chunks = this.aiChunks
      const signal = request.signal
      return {
        status: this.aiStatus,
        statusText: this.aiStatus >= 200 && this.aiStatus < 300 ? 'OK' : 'ERROR',
        body: (async function* () {
          for (const chunk of chunks) {
            throwIfAborted(signal, 'ai.execute')
            yield chunk.slice()
          }
        })(),
      }
    },
  }

  readonly gist: RuntimeAdapter['gist'] = {
    validateCredential: async (credentialId, signal) => {
      this.assertNoFailure('gist.validateCredential', signal)
      this.assertCredential(credentialId, 'gist.validateCredential', GIST_CREDENTIAL_SCOPE)
      return { login: 'fake-user' }
    },

    writeBackup: async request => {
      this.assertNoFailure('gist.writeBackup', request.signal)
      this.assertCredential(request.credentialId, 'gist.writeBackup', GIST_CREDENTIAL_SCOPE)
      const gistId = request.gistId ?? `f${this.state.gistBackups.size + 10000}`
      this.state.gistBackups.set(gistId, {
        filename: request.filename,
        description: request.description,
        content: request.content,
        updatedAt: new Date(this.now()).toISOString(),
      })
      return { gistId, url: `https://gist.github.com/fake/${gistId}` }
    },

    listBackups: async (credentialId, signal): Promise<GistBackupMeta[]> => {
      this.assertNoFailure('gist.listBackups', signal)
      this.assertCredential(credentialId, 'gist.listBackups', GIST_CREDENTIAL_SCOPE)
      return [...this.state.gistBackups].map(([gistId, backup]) => ({
        gistId,
        filename: backup.filename,
        description: backup.description,
        updatedAt: backup.updatedAt,
      }))
    },

    readBackup: async (credentialId, gistId, _revision, signal) => {
      this.assertNoFailure('gist.readBackup', signal)
      this.assertCredential(credentialId, 'gist.readBackup', GIST_CREDENTIAL_SCOPE)
      const backup = this.state.gistBackups.get(gistId)
      if (!backup) throw runtimeFailure('NOT_FOUND', 'gist.readBackup')
      return { filename: backup.filename, content: backup.content }
    },

    listRevisions: async (credentialId, gistId, signal) => {
      this.assertNoFailure('gist.listRevisions', signal)
      this.assertCredential(credentialId, 'gist.listRevisions', GIST_CREDENTIAL_SCOPE)
      return this.state.gistRevisions.get(gistId)?.map(item => ({ ...item })) ?? []
    },
  }

  readonly files: RuntimeAdapter['files'] = {
    save: async request => {
      const fault = this.before('files.save', request.signal)
      if (fault === 'CANCELLED') return { status: 'cancelled' }
      if (fault) throw runtimeFailure(fault, 'files.save')
      this.state.savedFiles.push(request)
      return completed({ displayName: request.suggestedName })
    },

    open: async request => {
      const fault = this.before('files.open', request.signal)
      if (fault === 'CANCELLED') return { status: 'cancelled' }
      if (fault) throw runtimeFailure(fault, 'files.open')
      return completed({ ...this.state.openedFile, bytes: this.state.openedFile.bytes.slice() })
    },

    bindBackupDirectory: async bindingId => {
      const fault = this.before('files.bindBackupDirectory')
      if (fault === 'CANCELLED') return { status: 'cancelled' }
      if (fault) throw runtimeFailure(fault, 'files.bindBackupDirectory')
      const binding: BackupBinding = {
        bindingId,
        label: `Fake backup (${bindingId})`,
        permission: 'granted',
      }
      this.state.bindings.set(bindingId, binding)
      this.state.bindingFiles.set(bindingId, new Map())
      return completed({ ...binding })
    },

    inspectBackupBinding: async bindingId => {
      this.assertNoFailure('files.inspectBackupBinding')
      return this.state.bindings.get(bindingId)
        ? { ...this.state.bindings.get(bindingId)! }
        : { bindingId, label: '', permission: 'missing' }
    },

    requestBackupPermission: async (bindingId, _write) => {
      this.assertNoFailure('files.requestBackupPermission')
      const binding = this.state.bindings.get(bindingId)
      if (!binding) throw runtimeFailure('NOT_FOUND', 'files.requestBackupPermission')
      binding.permission = 'granted'
      return { ...binding }
    },

    writeBackup: async request => {
      this.assertNoFailure('files.writeBackup', request.signal)
      const files = this.state.bindingFiles.get(request.bindingId)
      if (!files) throw runtimeFailure('NOT_FOUND', 'files.writeBackup')
      files.set(request.suggestedName, contentBytes(request.content))
      return { displayName: request.suggestedName }
    },

    readBackups: async request => {
      this.assertNoFailure('files.readBackups', request.signal)
      const files = this.state.bindingFiles.get(request.bindingId)
      if (!files) throw runtimeFailure('NOT_FOUND', 'files.readBackups')
      const entries = [...files]
      const assertReadable = () => this.assertNoFailure('files.readBackups', request.signal)
      return (async function* (): AsyncIterable<BackupFile> {
        for (const [name, bytes] of entries) {
          assertReadable()
          yield { name, bytes: bytes.slice() }
        }
      })()
    },

    clearBackupBinding: async bindingId => {
      this.assertNoFailure('files.clearBackupBinding')
      this.state.bindings.delete(bindingId)
      this.state.bindingFiles.delete(bindingId)
    },
  }

  readonly secrets: RuntimeAdapter['secrets'] = {
    policy: {
      storesPlaintextConfiguration: true,
      reuseReferenceWhenPlaintextOmitted: false,
      migrateLegacyPlaintext: false,
      storageLabel: '测试凭据存储',
    },
    put: async (descriptor, value) => {
      this.assertNoFailure('secrets.put')
      assertSecretDescriptor(descriptor, 'secrets.put')
      const stableDescriptor = cloneSecretDescriptor(descriptor)
      this.secretValues.set(stableDescriptor.key, { descriptor: stableDescriptor, value })
      this.state.secretKeys.add(stableDescriptor.key)
      return this.credentialId(stableDescriptor, value)
    },
    has: async key => {
      this.assertNoFailure('secrets.has')
      return this.secretValues.has(key)
    },
    reference: async key => {
      this.assertNoFailure('secrets.has')
      const secret = this.secretValues.get(key)
      return secret === undefined ? null : this.credentialId(secret.descriptor, secret.value)
    },
    delete: async key => {
      this.assertNoFailure('secrets.delete')
      this.secretValues.delete(key)
      this.state.secretKeys.delete(key)
      this.currentCredentials.delete(key)
      for (const [credentialId, credential] of this.credentials) {
        if (credential.descriptor.key === key) this.credentials.delete(credentialId)
      }
    },
  }

  readonly clipboard: RuntimeAdapter['clipboard'] = {
    writeText: async (purpose, text) => {
      this.assertNoFailure('clipboard.writeText')
      this.state.clipboardWrites.push({ purpose, text })
    },
  }

  readonly external: RuntimeAdapter['external'] = {
    open: async destination => {
      this.assertNoFailure('external.open')
      this.state.externalDestinations.push(destination)
    },
  }

  readonly durability: RuntimeAdapter['durability'] = {
    inspect: async () => {
      this.assertNoFailure('durability.inspect')
      return { persisted: true, usageBytes: 1024, quotaBytes: 1024 * 1024 }
    },
    requestPersistence: async () => {
      this.assertNoFailure('durability.requestPersistence')
      return { persisted: true, usageBytes: 1024, quotaBytes: 1024 * 1024 }
    },
  }

  readonly distribution: RuntimeAdapter['distribution'] = {
    getInfo: async () => {
      this.assertNoFailure('distribution.getInfo')
      return { runtime: 'web', channel: 'dev', packaged: false, version: '0.0.0-fake' }
    },
  }

  readonly updates: RuntimeAdapter['updates'] = {
    initialize: async () => {
      this.assertNoFailure('updates.initialize')
      this.state.updatesInitialized = true
    },
    check: async () => {
      this.assertNoFailure('updates.check')
      return this.state.update ? { ...this.state.update } : null
    },
    install: async (_releaseId, signal) => {
      this.assertNoFailure('updates.install', signal)
    },
  }

  readonly diagnostics: RuntimeAdapter['diagnostics'] = {
    record: event => {
      this.state.diagnosticEvents.push({ ...event })
    },
    snapshot: async () => {
      this.assertNoFailure('diagnostics.snapshot')
      return {
        generatedAt: this.now(),
        distribution: await this.distribution.getInfo(),
        events: this.state.diagnosticEvents.map(event => ({ ...event })),
      }
    },
  }

  readonly migration: RuntimeAdapter['migration'] = {
    policy: {
      canExportProfile: true,
      requiresFirstRunChoice: true,
      journalOutsideBusinessDatabase: true,
    },
    readJournal: async () => {
      this.assertNoFailure('migration.readJournal')
      return this.state.migrationJournal ? { ...this.state.migrationJournal } : null
    },
    writeJournal: async (journal, expectedPhase) => {
      this.assertNoFailure('migration.writeJournal')
      const currentPhase = this.state.migrationJournal?.phase ?? null
      if (expectedPhase !== undefined && currentPhase !== expectedPhase) {
        throw runtimeFailure('BUSY', 'migration.writeJournal')
      }
      this.state.migrationJournal = { ...journal }
    },
    clearJournal: async () => {
      this.state.migrationJournal = null
    },
    readReceipt: async exportId => {
      const receipt = this.state.migrationReceipts.get(exportId)
      return receipt ? structuredClone(receipt) : null
    },
    writeReceipt: async receipt => {
      this.assertNoFailure('migration.writeReceipt')
      this.state.migrationReceipts.set(receipt.exportId, structuredClone(receipt))
    },
    deleteReceipt: async exportId => {
      this.assertNoFailure('migration.deleteReceipt')
      this.state.migrationReceipts.delete(exportId)
    },
  }
}

export function createFakeRuntime(options?: FakeRuntimeOptions): FakeRuntimeAdapter {
  return new FakeRuntimeAdapter(options)
}
