import type {
  BackupBinding,
  DiagnosticEvent,
  DistributionInfo,
  RuntimeAdapter,
  RuntimeCapabilityName,
} from '../contract'
import { RuntimeError, throwIfAborted } from '../errors'

const MAX_DIAGNOSTIC_EVENTS = 200

export interface TauriRuntimeOptions {
  channel?: Extract<DistributionInfo['channel'], 'dev' | 'beta' | 'stable'>
  packaged?: boolean
  version?: string
  identifier?: string
  now?: () => number
}

function unavailable(operation: string, capability: RuntimeCapabilityName): never {
  throw new RuntimeError('UNAVAILABLE', `${capability} 原生能力尚未在当前桌面阶段启用`, {
    operation,
  })
}

function missingBinding(bindingId: string): BackupBinding {
  return { bindingId, label: '', permission: 'missing' }
}

function resolveChannel(value: string | undefined): NonNullable<TauriRuntimeOptions['channel']> {
  if (value === 'beta' || value === 'stable') return value
  return 'dev'
}

/**
 * D1.1 shell adapter. It is deliberately fail-closed: bootstrap-safe metadata
 * works, while native network/file/secret capabilities remain unavailable
 * until their scoped IPC implementations land in D1.4/D3.
 */
export function createTauriRuntime(options: TauriRuntimeOptions = {}): RuntimeAdapter {
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

  return {
    kind: 'tauri',
    ai: {
      async execute(request) {
        throwIfAborted(request.signal, 'ai.execute')
        return unavailable('ai.execute', 'ai')
      },
    },
    gist: {
      async validateCredential(_credentialId, signal) {
        throwIfAborted(signal, 'gist.validateCredential')
        return unavailable('gist.validateCredential', 'gist')
      },
      async writeBackup(request) {
        throwIfAborted(request.signal, 'gist.writeBackup')
        return unavailable('gist.writeBackup', 'gist')
      },
      async listBackups(_credentialId, signal) {
        throwIfAborted(signal, 'gist.listBackups')
        return unavailable('gist.listBackups', 'gist')
      },
      async readBackup(_credentialId, _gistId, _revision, signal) {
        throwIfAborted(signal, 'gist.readBackup')
        return unavailable('gist.readBackup', 'gist')
      },
      async listRevisions(_credentialId, _gistId, signal) {
        throwIfAborted(signal, 'gist.listRevisions')
        return unavailable('gist.listRevisions', 'gist')
      },
    },
    files: {
      async save(request) {
        throwIfAborted(request.signal, 'files.save')
        return unavailable('files.save', 'files')
      },
      async open(request) {
        throwIfAborted(request.signal, 'files.open')
        return unavailable('files.open', 'files')
      },
      async bindBackupDirectory(_bindingId) {
        return unavailable('files.bindBackupDirectory', 'files')
      },
      async inspectBackupBinding(bindingId) {
        return missingBinding(bindingId)
      },
      async requestBackupPermission(_bindingId, _write) {
        return unavailable('files.requestBackupPermission', 'files')
      },
      async writeBackup(request) {
        throwIfAborted(request.signal, 'files.writeBackup')
        return unavailable('files.writeBackup', 'files')
      },
      async readBackups(request) {
        throwIfAborted(request.signal, 'files.readBackups')
        return unavailable('files.readBackups', 'files')
      },
      async clearBackupBinding(_bindingId) {
        // No native binding can exist before D3.3, so clearing is idempotent.
      },
    },
    secrets: {
      async put(_descriptor, _value) {
        return unavailable('secrets.put', 'secrets')
      },
      async has(_key) {
        return false
      },
      async reference(_key) {
        return null
      },
      async delete(_key) {
        // No native secret can exist before D3.2, so deletion is idempotent.
      },
    },
    clipboard: {
      async writeText(_purpose, _text) {
        return unavailable('clipboard.writeText', 'clipboard')
      },
    },
    external: {
      async open(_destination) {
        return unavailable('external.open', 'external')
      },
    },
    durability: {
      async inspect() {
        return unavailable('durability.inspect', 'durability')
      },
      async requestPersistence() {
        return unavailable('durability.requestPersistence', 'durability')
      },
    },
    distribution,
    updates: {
      async initialize() {
        // Native updater is intentionally absent from the self-use shell.
      },
      async check() {
        return null
      },
      async install(_releaseId, signal) {
        throwIfAborted(signal, 'updates.install')
        return unavailable('updates.install', 'updates')
      },
    },
    diagnostics: {
      record(event) {
        events.push({ ...event })
        if (events.length > MAX_DIAGNOSTIC_EVENTS) events.shift()
      },
      async snapshot() {
        return {
          generatedAt: now(),
          distribution: await distribution.getInfo(),
          events: events.map(event => ({ ...event })),
        }
      },
    },
  }
}
