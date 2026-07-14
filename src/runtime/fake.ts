import type {
  AiTransportRequest,
  AvailableUpdate,
  BackupBinding,
  ClipboardPurpose,
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
  SecretKey,
} from './contract'
import { RuntimeError, type RuntimeErrorCode, throwIfAborted } from './errors'

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
  private readonly secretValues = new Map<SecretKey, string>()
  private readonly credentialKeys = new Map<CredentialId, SecretKey>()
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

  private credentialId(key: SecretKey): CredentialId {
    const id = `fake-vault:${key}` as CredentialId
    this.credentialKeys.set(id, key)
    return id
  }

  private assertCredential(credentialId: CredentialId, operation: FakeRuntimeOperation): void {
    const key = this.credentialKeys.get(credentialId)
    if (!key || !this.secretValues.has(key)) throw runtimeFailure('PERMISSION_DENIED', operation)
  }

  readonly ai: RuntimeAdapter['ai'] = {
    execute: async request => {
      this.assertNoFailure('ai.execute', request.signal)
      if (request.credentialId) this.assertCredential(request.credentialId, 'ai.execute')
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
      this.assertCredential(credentialId, 'gist.validateCredential')
      return { login: 'fake-user' }
    },

    writeBackup: async request => {
      this.assertNoFailure('gist.writeBackup', request.signal)
      this.assertCredential(request.credentialId, 'gist.writeBackup')
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
      this.assertCredential(credentialId, 'gist.listBackups')
      return [...this.state.gistBackups].map(([gistId, backup]) => ({
        gistId,
        filename: backup.filename,
        description: backup.description,
        updatedAt: backup.updatedAt,
      }))
    },

    readBackup: async (credentialId, gistId, _revision, signal) => {
      this.assertNoFailure('gist.readBackup', signal)
      this.assertCredential(credentialId, 'gist.readBackup')
      const backup = this.state.gistBackups.get(gistId)
      if (!backup) throw runtimeFailure('NOT_FOUND', 'gist.readBackup')
      return { filename: backup.filename, content: backup.content }
    },

    listRevisions: async (credentialId, gistId, signal) => {
      this.assertNoFailure('gist.listRevisions', signal)
      this.assertCredential(credentialId, 'gist.listRevisions')
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
      return [...files].map(([name, bytes]) => ({ name, bytes: bytes.slice() }))
    },

    clearBackupBinding: async bindingId => {
      this.assertNoFailure('files.clearBackupBinding')
      this.state.bindings.delete(bindingId)
      this.state.bindingFiles.delete(bindingId)
    },
  }

  readonly secrets: RuntimeAdapter['secrets'] = {
    put: async (descriptor, value) => {
      this.assertNoFailure('secrets.put')
      this.secretValues.set(descriptor.key, value)
      this.state.secretKeys.add(descriptor.key)
      return this.credentialId(descriptor.key)
    },
    has: async key => {
      this.assertNoFailure('secrets.has')
      return this.secretValues.has(key)
    },
    reference: async key => {
      this.assertNoFailure('secrets.has')
      return this.secretValues.has(key) ? this.credentialId(key) : null
    },
    delete: async key => {
      this.assertNoFailure('secrets.delete')
      this.secretValues.delete(key)
      this.state.secretKeys.delete(key)
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
}

export function createFakeRuntime(options?: FakeRuntimeOptions): FakeRuntimeAdapter {
  return new FakeRuntimeAdapter(options)
}
