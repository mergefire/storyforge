import { buildOpenAIEndpoint } from '../../lib/ai/openai-endpoint'
import {
  clearFolderHandle,
  loadFolderHandle,
  saveFolderHandle,
} from '../../lib/storage/folder-handle-store'
import type {
  AiEndpointDescriptor,
  AiTransportResponse,
  BackupBinding,
  BackupFile,
  BackupReadRequest,
  BackupWriteRequest,
  ClipboardPurpose,
  CredentialId,
  DiagnosticEvent,
  DiagnosticsSnapshot,
  DistributionInfo,
  DurabilityStatus,
  ExternalDestination,
  FileContent,
  OpenFilePurpose,
  SaveFilePurpose,
  GistBackupMeta,
  GistRevisionMeta,
  OpenedFile,
  OpenFileRequest,
  RuntimeAdapter,
  RuntimeOutcome,
  SaveFileRequest,
  SecretDescriptor,
  SecretKey,
} from '../contract'
import { normalizeRuntimeError, RuntimeError, throwIfAborted } from '../errors'
import { shouldRegisterStoryForgeServiceWorker } from './service-worker-policy'

const GIST_API = 'https://api.github.com/gists'
const SECRET_PREFIX = 'storyforge-runtime-secret:'
const BINDING_PREFIX = 'runtime-binding:'
const MAX_DIAGNOSTIC_EVENTS = 200
const WEB_SERVICE_WORKER_SCRIPT = '/storyforge/sw.js'
const WEB_SERVICE_WORKER_SCOPE = '/storyforge/'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

export interface WebBindingStore {
  save(key: string, handle: FileSystemDirectoryHandle): Promise<void>
  load(key: string): Promise<FileSystemDirectoryHandle | null>
  delete(key: string): Promise<void>
}

export interface WebFileDelegates {
  save?(request: SaveFileRequest): Promise<RuntimeOutcome<{ displayName: string }>>
  open?(request: OpenFileRequest): Promise<RuntimeOutcome<OpenedFile>>
  pickDirectory?(): Promise<FileSystemDirectoryHandle>
  bindingStore?: WebBindingStore
}

export type WebServiceWorkerContainer = Pick<ServiceWorkerContainer, 'getRegistration' | 'register'>

export interface WebRuntimeOptions {
  fetch?: typeof globalThis.fetch
  files?: WebFileDelegates
  clipboardWriteText?: (purpose: ClipboardPurpose, text: string) => Promise<void>
  openExternal?: (url: string) => void | Promise<void>
  localStorage?: StorageLike
  sessionStorage?: StorageLike
  serviceWorker?: WebServiceWorkerContainer | null
  hostname?: string
  now?: () => number
  version?: string
}

const ALLOWED_PROXY_BASE_URLS: Readonly<
  Record<AiEndpointDescriptor['operation'], ReadonlySet<string>>
> = {
  'chat-completions': new Set([
    '/deepseek-proxy/v1',
    '/openai-proxy/v1',
    '/kimi-proxy/v1',
    '/claude-proxy/v1',
    '/nvidia-proxy/v1',
    '/doubao-proxy/api/v3',
    '/agnes-proxy/v1',
    '/longcat-proxy/openai/v1',
  ]),
  embeddings: new Set([
    '/siliconflow-proxy/v1',
    '/qwen-proxy/compatible-mode/v1',
    '/glm-proxy/api/paas/v4',
    '/openai-proxy/v1',
  ]),
}

export const WEB_SAVE_FILE_FORMATS: Readonly<Record<SaveFilePurpose, { mediaType: string; extensions: readonly string[] }>> = {
  'project-json': { mediaType: 'application/json;charset=utf-8', extensions: ['.json'] },
  'project-markdown': { mediaType: 'text/markdown;charset=utf-8', extensions: ['.md'] },
  'project-text': { mediaType: 'text/plain;charset=utf-8', extensions: ['.txt'] },
  'context-snapshot': { mediaType: 'text/markdown;charset=utf-8', extensions: ['.md'] },
  'pre-destructive-backup': { mediaType: 'application/json;charset=utf-8', extensions: ['.json'] },
  'fact-ledger': { mediaType: 'text/markdown;charset=utf-8', extensions: ['.md'] },
  'world-map-png': { mediaType: 'image/png', extensions: ['.png'] },
  'inspiration-markdown': { mediaType: 'text/markdown;charset=utf-8', extensions: ['.md'] },
  'state-cards-text': { mediaType: 'text/plain;charset=utf-8', extensions: ['.txt'] },
  'prompt-template-json': { mediaType: 'application/json;charset=utf-8', extensions: ['.json'] },
  'prompt-library-json': { mediaType: 'application/json;charset=utf-8', extensions: ['.json'] },
  'prompt-workflow-json': { mediaType: 'application/json;charset=utf-8', extensions: ['.json'] },
  'diagnostic-bundle': { mediaType: 'application/zip', extensions: ['.zip'] },
  'full-migration-archive': { mediaType: 'application/zip', extensions: ['.sfmigration'] },
}

export const WEB_OPEN_FILE_FORMATS: Readonly<
  Record<OpenFilePurpose, Readonly<Record<string, readonly string[]>>>
> = {
  'project-json': { 'application/json': ['.json'] },
  'full-migration-archive': { 'application/zip': ['.sfmigration', '.zip'] },
  'source-document': {
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'text/csv': ['.csv'],
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  },
  'reference-document': {
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'application/epub+zip': ['.epub'],
  },
  'prompt-template-json': { 'application/json': ['.json'] },
  'prompt-library-json': { 'application/json': ['.json'] },
  'prompt-workflow-json': { 'application/json': ['.json'] },
}

const EXTERNAL_URLS: Readonly<Record<ExternalDestination['kind'], string>> = {
  'github-gist-token': 'https://github.com/settings/tokens/new?scopes=gist&description=storyforge-backup',
  'project-repository': 'https://github.com/yuanbw2025/storyforge',
}

function optionalGlobalStorage(name: 'localStorage' | 'sessionStorage'): StorageLike | undefined {
  try {
    if (typeof window !== 'undefined') return window[name]
  } catch {
    // Storage can be blocked by browser privacy settings. Use an in-memory fallback.
  }
  return undefined
}

function optionalServiceWorker(): WebServiceWorkerContainer | undefined {
  try {
    if (typeof navigator !== 'undefined') return navigator.serviceWorker
  } catch {
    // Access can be denied in restricted WebViews/security contexts. Updates stay optional.
  }
  return undefined
}

class WebSecretVault {
  readonly publicStore: RuntimeAdapter['secrets']
  private readonly credentialKeys = new Map<CredentialId, SecretKey>()

  constructor(
    private readonly local: StorageLike,
    private readonly session: StorageLike,
  ) {
    this.publicStore = {
      put: (descriptor, value) => this.put(descriptor, value),
      has: key => this.has(key),
      reference: key => this.reference(key),
      delete: key => this.delete(key),
    }
  }

  private storageKey(key: SecretKey): string {
    return `${SECRET_PREFIX}${key}`
  }

  private credentialId(key: SecretKey): CredentialId {
    const id = `web-vault:${key}` as CredentialId
    this.credentialKeys.set(id, key)
    return id
  }

  private async put(descriptor: SecretDescriptor, value: string): Promise<CredentialId> {
    const target = descriptor.persistence === 'device' ? this.local : this.session
    const other = descriptor.persistence === 'device' ? this.session : this.local
    target.setItem(this.storageKey(descriptor.key), value)
    other.removeItem(this.storageKey(descriptor.key))
    return this.credentialId(descriptor.key)
  }

  private async has(key: SecretKey): Promise<boolean> {
    const storageKey = this.storageKey(key)
    return this.session.getItem(storageKey) !== null || this.local.getItem(storageKey) !== null
  }

  private async reference(key: SecretKey): Promise<CredentialId | null> {
    return await this.has(key) ? this.credentialId(key) : null
  }

  private async delete(key: SecretKey): Promise<void> {
    const storageKey = this.storageKey(key)
    this.session.removeItem(storageKey)
    this.local.removeItem(storageKey)
  }

  resolve(credentialId: CredentialId | undefined, operation: string): string | undefined {
    if (!credentialId) return undefined
    const key = this.credentialKeys.get(credentialId)
    if (!key) {
      throw new RuntimeError('PERMISSION_DENIED', '凭据引用不属于当前运行时', { operation })
    }
    const storageKey = this.storageKey(key)
    const value = this.session.getItem(storageKey) ?? this.local.getItem(storageKey)
    if (value === null) {
      throw new RuntimeError('NOT_FOUND', '所需凭据尚未配置', { operation })
    }
    return value
  }
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
}

function assertSafeToken(value: string, label: string, operation: string): void {
  if (!/^[a-zA-Z0-9._:-]{1,160}$/.test(value)) {
    throw new RuntimeError('INVALID_INPUT', `${label} 格式无效`, { operation })
  }
}

function assertSafeFilename(filename: string, operation: string): void {
  if (
    filename.length < 1
    || filename.length > 180
    || filename === '.'
    || filename === '..'
    || /[\\/:*?"<>|]/.test(filename)
  ) {
    throw new RuntimeError('INVALID_INPUT', '文件名格式无效', { operation })
  }
}

function assertFilenameExtension(
  filename: string,
  extensions: readonly string[],
  operation: string,
): void {
  const lower = filename.toLowerCase()
  if (!extensions.some(extension => lower.endsWith(extension))) {
    throw new RuntimeError('INVALID_INPUT', '文件扩展名与用途不匹配', { operation })
  }
}

function normalizeSuggestedFilename(
  filename: string,
  extensions: readonly string[],
  operation: string,
): string {
  if (!filename || filename === '.' || filename === '..' || /[\\/\0]/.test(filename)) {
    throw new RuntimeError('INVALID_INPUT', '文件名格式无效', { operation })
  }
  let safe = filename.trim().replace(/[<>:"|?*]/g, '-').replace(/[ .]+$/g, '')
  assertFilenameExtension(safe, extensions, operation)
  const extension = extensions.find(item => safe.toLowerCase().endsWith(item)) ?? ''
  if (safe.length > 180) safe = `${safe.slice(0, 180 - extension.length)}${extension}`
  const stem = safe.slice(0, safe.length - extension.length)
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) safe = `_${safe}`
  return safe
}

function fileContentBytes(content: FileContent): Uint8Array {
  return content.kind === 'bytes' ? content.bytes : new TextEncoder().encode(content.text)
}

function defaultBindingStore(): WebBindingStore {
  return {
    save: (key, handle) => saveFolderHandle(key, handle),
    load: key => loadFolderHandle(key),
    delete: key => clearFolderHandle(key),
  }
}

async function defaultPickDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as Window & {
    showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker
  if (!picker) {
    throw new RuntimeError('UNSUPPORTED', '当前浏览器不支持目录绑定', {
      operation: 'files.bindBackupDirectory',
    })
  }
  return picker({ mode: 'readwrite' })
}

async function defaultSaveFile(request: SaveFileRequest): Promise<RuntimeOutcome<{ displayName: string }>> {
  throwIfAborted(request.signal, 'files.save')
  const displayName = normalizeSuggestedFilename(
    request.suggestedName,
    WEB_SAVE_FILE_FORMATS[request.purpose].extensions,
    'files.save',
  )
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new RuntimeError('UNSUPPORTED', '当前环境不支持浏览器下载', { operation: 'files.save' })
  }

  const bytes = fileContentBytes(request.content)
  const blob = new Blob([bytes.slice().buffer], { type: WEB_SAVE_FILE_FORMATS[request.purpose].mediaType })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = displayName
    anchor.click()
    return { status: 'completed', value: { displayName } }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function openFileExtensions(purpose: OpenFilePurpose): readonly string[] {
  return Object.values(WEB_OPEN_FILE_FORMATS[purpose]).flat()
}

async function readOpenedFile(file: File, request: OpenFileRequest): Promise<OpenedFile> {
  const operation = 'files.open'
  assertFilenameExtension(file.name, openFileExtensions(request.purpose), operation)
  throwIfAborted(request.signal, operation)
  const buffer = await file.arrayBuffer()
  throwIfAborted(request.signal, operation)
  return {
    name: file.name,
    mediaType: file.type || 'application/octet-stream',
    bytes: new Uint8Array(buffer),
  }
}

function inputAccept(purpose: OpenFilePurpose): string {
  return Object.entries(WEB_OPEN_FILE_FORMATS[purpose])
    .flatMap(([mediaType, extensions]) => [mediaType, ...extensions])
    .join(',')
}

function openFileWithInput(request: OpenFileRequest): Promise<RuntimeOutcome<OpenedFile>> {
  const operation = 'files.open'
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new RuntimeError('UNSUPPORTED', '当前环境不支持文件选择', { operation })
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = false
    input.accept = inputAccept(request.purpose)
    input.style.display = 'none'
    let settled = false
    let focusTimer: number | undefined

    const cleanup = () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer)
      request.signal?.removeEventListener('abort', onAbort)
      input.removeEventListener('change', onChange)
      input.removeEventListener('cancel', onCancel)
      window.removeEventListener('focus', onFocus)
      input.remove()
    }
    const complete = (outcome: RuntimeOutcome<OpenedFile>) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(outcome)
    }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onAbort = () => {
      fail(new RuntimeError('ABORTED', '操作已中止', { operation }))
    }
    const onCancel = () => complete({ status: 'cancelled' })
    const onChange = () => {
      const file = input.files?.[0]
      if (!file) {
        onCancel()
        return
      }
      void readOpenedFile(file, request)
        .then(value => complete({ status: 'completed', value }))
        .catch(fail)
    }
    const onFocus = () => {
      focusTimer = window.setTimeout(() => {
        if (!settled && !input.files?.length) onCancel()
      }, 0)
    }

    if (request.signal?.aborted) {
      onAbort()
      return
    }
    request.signal?.addEventListener('abort', onAbort, { once: true })
    input.addEventListener('change', onChange)
    input.addEventListener('cancel', onCancel)
    window.addEventListener('focus', onFocus)
    const parent = document.body ?? document.documentElement
    parent.append(input)
    try {
      input.click()
    } catch (error) {
      fail(error)
    }
  })
}

async function defaultOpenFile(request: OpenFileRequest): Promise<RuntimeOutcome<OpenedFile>> {
  const operation = 'files.open'
  throwIfAborted(request.signal, operation)
  if (typeof window === 'undefined') {
    throw new RuntimeError('UNSUPPORTED', '当前环境不支持文件选择', { operation })
  }
  const picker = (window as Window & {
    showOpenFilePicker?: (options: {
      multiple: false
      types: { description: string; accept: Record<string, readonly string[]> }[]
    }) => Promise<FileSystemFileHandle[]>
  }).showOpenFilePicker
  if (!picker) return openFileWithInput(request)

  const handles = await picker({
    multiple: false,
    types: [{
      description: 'StoryForge data',
      accept: WEB_OPEN_FILE_FORMATS[request.purpose],
    }],
  })
  throwIfAborted(request.signal, operation)
  const file = await handles[0]?.getFile()
  throwIfAborted(request.signal, operation)
  if (!file) return { status: 'cancelled' }
  return { status: 'completed', value: await readOpenedFile(file, request) }
}

async function permissionState(
  handle: FileSystemDirectoryHandle,
  write: boolean,
): Promise<BackupBinding['permission']> {
  const query = (handle as unknown as {
    queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  }).queryPermission
  if (!query) return 'prompt'
  return query.call(handle, { mode: write ? 'readwrite' : 'read' })
}

async function requestPermission(
  handle: FileSystemDirectoryHandle,
  write: boolean,
): Promise<BackupBinding['permission']> {
  const permissionHandle = handle as unknown as {
    queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
    requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  }
  const options = { mode: write ? 'readwrite' as const : 'read' as const }
  const current = await permissionHandle.queryPermission?.(options)
  if (current === 'granted') return current
  return (await permissionHandle.requestPermission?.(options)) ?? 'denied'
}

function backupNameMatches(purpose: BackupReadRequest['purpose'], name: string): boolean {
  if (purpose === 'project-backup') return /^storyforge-.+\.json$/i.test(name)
  return /^storyforge-.+\.(?:sfmigration|zip)$/i.test(name)
}

async function writeAndCloseBackup(
  writable: Pick<FileSystemWritableFileStream, 'write' | 'close'>,
  bytes: ArrayBuffer,
  signal: AbortSignal | undefined,
  operation: string,
): Promise<void> {
  let hasPrimaryError = false
  let primaryError: unknown
  try {
    throwIfAborted(signal, operation)
    await writable.write(bytes)
    throwIfAborted(signal, operation)
  } catch (error) {
    hasPrimaryError = true
    primaryError = error
  }

  try {
    await writable.close()
  } catch (closeError) {
    if (!hasPrimaryError) {
      throwIfAborted(signal, operation)
      throw closeError
    }
  }
  if (hasPrimaryError) throw primaryError
  throwIfAborted(signal, operation)
}

async function* responseBody(
  response: Response,
  signal: AbortSignal | undefined,
  operation: string,
): AsyncIterable<Uint8Array> {
  if (!response.body) return
  const reader = response.body.getReader()
  let completed = false
  try {
    while (true) {
      throwIfAborted(signal, operation)
      const result = await reader.read()
      throwIfAborted(signal, operation)
      if (result.done) {
        completed = true
        return
      }
      yield result.value
    }
  } catch (error) {
    throw normalizeRuntimeError(error, operation)
  } finally {
    if (!completed) {
      try {
        await reader.cancel()
      } catch {
        // Best effort only: the primary stream error or consumer return wins.
      }
    }
    try {
      reader.releaseLock()
    } catch {
      // Preserve the primary stream outcome if the implementation cannot release.
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  return asRecord(await response.json())
}

function remoteErrorMessage(payload: Record<string, unknown>, fallback: string): string {
  return typeof payload.message === 'string' ? payload.message : fallback
}

function assertGistId(value: string, label: string): void {
  if (!/^[a-zA-Z0-9]{4,64}$/.test(value)) {
    throw new RuntimeError('INVALID_INPUT', `${label} 格式无效`, { operation: 'gist.request' })
  }
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function findBackupFile(filesValue: unknown): Record<string, unknown> | undefined {
  const files = asRecord(filesValue)
  return Object.values(files)
    .map(asRecord)
    .find(file => typeof file.filename === 'string' && /^storyforge-.*\.json$/i.test(file.filename))
}

function checkedRawGistUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') {
    throw new RuntimeError('REMOTE_ERROR', 'Gist 备份缺少原始文件地址', { operation: 'gist.readBackup' })
  }
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch (error) {
    throw new RuntimeError('INTEGRITY_ERROR', 'Gist 返回了无效的原始文件地址', {
      operation: 'gist.readBackup',
      cause: error,
    })
  }
  if (
    url.origin !== 'https://gist.githubusercontent.com'
    || url.username !== ''
    || url.password !== ''
  ) {
    throw new RuntimeError('INTEGRITY_ERROR', 'Gist 返回了未获允许的文件地址', {
      operation: 'gist.readBackup',
    })
  }
  return url.toString()
}

function checkedAiBaseUrl(endpoint: AiEndpointDescriptor): string {
  const value = endpoint.configuredBaseUrl.trim().replace(/\/+$/, '')
  if (value.startsWith('//')) {
    throw new RuntimeError('PERMISSION_DENIED', 'AI profile 不允许协议相对地址', {
      operation: 'ai.execute',
    })
  }
  if (value.startsWith('/') && !value.startsWith('//')) {
    if (!ALLOWED_PROXY_BASE_URLS[endpoint.operation].has(value)) {
      throw new RuntimeError('PERMISSION_DENIED', 'AI proxy alias 不在允许范围内', {
        operation: 'ai.execute',
      })
    }
    return value
  }
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw new RuntimeError('INVALID_INPUT', 'AI profile 地址无效', {
      operation: 'ai.execute',
      cause: error,
    })
  }
  if (
    url.username
    || url.password
    || (url.protocol !== 'http:' && url.protocol !== 'https:')
  ) {
    throw new RuntimeError('PERMISSION_DENIED', 'AI profile 地址不在允许范围内', {
      operation: 'ai.execute',
    })
  }
  return url.toString()
}

function assertDiagnosticEvent(event: DiagnosticEvent): void {
  const operation = 'diagnostics.record'
  const record = event as unknown as Record<string, unknown>
  const allowedByKind: Record<DiagnosticEvent['kind'], ReadonlySet<string>> = {
    'runtime-capability': new Set(['kind', 'timestamp', 'capability', 'outcome', 'errorCode', 'durationMs']),
    'network-attempt': new Set(['kind', 'timestamp', 'service', 'operation', 'outcome', 'status', 'durationMs', 'errorCode']),
    'file-operation': new Set(['kind', 'timestamp', 'operation', 'purpose', 'outcome', 'errorCode']),
    'migration-phase': new Set(['kind', 'timestamp', 'phase', 'outcome', 'tableCount', 'recordCount', 'errorCode']),
    'update-state': new Set(['kind', 'timestamp', 'state', 'version', 'errorCode']),
  }
  const allowed = allowedByKind[event.kind]
  if (!allowed || Object.keys(record).some(key => !allowed.has(key))) {
    throw new RuntimeError('INVALID_INPUT', '诊断事件包含未登记字段', { operation })
  }
  if (!Number.isFinite(event.timestamp) || event.timestamp < 0) {
    throw new RuntimeError('INVALID_INPUT', '诊断事件时间无效', { operation })
  }
  const numericKeys = ['durationMs', 'status', 'tableCount', 'recordCount'] as const
  for (const key of numericKeys) {
    const value = record[key]
    if (value !== undefined && (!Number.isFinite(value) || (value as number) < 0)) {
      throw new RuntimeError('INVALID_INPUT', '诊断事件数值无效', { operation })
    }
  }
  if (event.kind === 'update-state' && event.version !== undefined && !/^[a-zA-Z0-9.+-]{1,64}$/.test(event.version)) {
    throw new RuntimeError('INVALID_INPUT', '更新版本格式无效', { operation })
  }
}

export function createWebRuntime(options: WebRuntimeOptions = {}): RuntimeAdapter {
  const fetchImpl: typeof globalThis.fetch | undefined = options.fetch ?? (
    typeof globalThis.fetch === 'function'
      ? (input, init) => globalThis.fetch(input, init)
      : undefined
  )
  if (fetchImpl === undefined) {
    throw new RuntimeError('UNAVAILABLE', '当前环境没有 Fetch 实现', { operation: 'runtime.createWeb' })
  }

  const local = options.localStorage ?? optionalGlobalStorage('localStorage') ?? new MemoryStorage()
  const session = options.sessionStorage ?? optionalGlobalStorage('sessionStorage') ?? new MemoryStorage()
  const serviceWorker = options.serviceWorker === undefined
    ? optionalServiceWorker()
    : options.serviceWorker ?? undefined
  const serviceWorkerHostname = options.hostname
    ?? (typeof location !== 'undefined' ? location.hostname : '')
  const vault = new WebSecretVault(local, session)
  const bindingStore = options.files?.bindingStore ?? defaultBindingStore()
  const pickDirectory = options.files?.pickDirectory ?? defaultPickDirectory
  const now = options.now ?? Date.now
  const diagnosticsEvents: DiagnosticEvent[] = []

  const distributionInfo: DistributionInfo = {
    runtime: 'web',
    channel: 'web',
    packaged: false,
    ...(options.version ? { version: options.version } : {}),
  }

  const distribution: RuntimeAdapter['distribution'] = {
    getInfo: async () => ({ ...distributionInfo }),
  }

  const ai: RuntimeAdapter['ai'] = {
    async execute(request): Promise<AiTransportResponse> {
      const operation = 'ai.execute'
      throwIfAborted(request.signal, operation)
      try {
        const baseUrl = checkedAiBaseUrl(request.endpoint)
        const endpoint = buildOpenAIEndpoint(
          baseUrl,
          request.endpoint.operation === 'chat-completions' ? 'chat/completions' : 'embeddings',
        )
        const credential = vault.resolve(request.credentialId, operation)
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
          },
          body: JSON.stringify(request.body),
          signal: request.signal,
        })
        return {
          status: response.status,
          statusText: response.statusText,
          body: responseBody(response, request.signal, operation),
        }
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },
  }

  const gist: RuntimeAdapter['gist'] = {
    async validateCredential(credentialId, signal) {
      const operation = 'gist.validateCredential'
      throwIfAborted(signal, operation)
      try {
        const token = vault.resolve(credentialId, operation) ?? ''
        const response = await fetchImpl('https://api.github.com/user', {
          headers: githubHeaders(token),
          redirect: 'error',
          signal,
        })
        if (!response.ok) {
          throw new RuntimeError('PERMISSION_DENIED', 'GitHub 凭据无效或权限不足', { operation })
        }
        const payload = await jsonRecord(response)
        if (typeof payload.login !== 'string') {
          throw new RuntimeError('REMOTE_ERROR', 'GitHub 响应缺少登录名', { operation })
        }
        return { login: payload.login }
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async writeBackup(request) {
      const operation = 'gist.writeBackup'
      throwIfAborted(request.signal, operation)
      assertSafeFilename(request.filename, operation)
      if (request.gistId) assertGistId(request.gistId, 'Gist ID')
      try {
        const token = vault.resolve(request.credentialId, operation) ?? ''
        const response = await fetchImpl(
          request.gistId ? `${GIST_API}/${request.gistId}` : GIST_API,
          {
            method: request.gistId ? 'PATCH' : 'POST',
            redirect: 'error',
            headers: githubHeaders(token),
            body: JSON.stringify({
              description: request.description,
              public: false,
              files: { [request.filename]: { content: request.content } },
            }),
            signal: request.signal,
          },
        )
        const payload = await jsonRecord(response)
        if (!response.ok) {
          throw new RuntimeError('REMOTE_ERROR', remoteErrorMessage(payload, `GitHub API 错误 ${response.status}`), {
            operation,
            retryable: response.status === 429 || response.status >= 500,
          })
        }
        if (typeof payload.id !== 'string' || typeof payload.html_url !== 'string') {
          throw new RuntimeError('REMOTE_ERROR', 'GitHub 响应缺少 Gist 标识', { operation })
        }
        return { gistId: payload.id, url: payload.html_url }
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async listBackups(credentialId, signal): Promise<GistBackupMeta[]> {
      const operation = 'gist.listBackups'
      throwIfAborted(signal, operation)
      try {
        const token = vault.resolve(credentialId, operation) ?? ''
        const response = await fetchImpl(`${GIST_API}?per_page=100`, {
          headers: githubHeaders(token),
          redirect: 'error',
          signal,
        })
        if (!response.ok) {
          throw new RuntimeError('REMOTE_ERROR', `GitHub API 错误 ${response.status}`, { operation })
        }
        const payload = await response.json()
        if (!Array.isArray(payload)) {
          throw new RuntimeError('REMOTE_ERROR', 'GitHub 响应格式无效', { operation })
        }
        const backups: GistBackupMeta[] = []
        for (const rawGist of payload) {
          const gistRecord = asRecord(rawGist)
          const file = findBackupFile(gistRecord.files)
          if (
            !file
            || typeof gistRecord.id !== 'string'
            || typeof file.filename !== 'string'
            || typeof gistRecord.updated_at !== 'string'
          ) continue
          backups.push({
            gistId: gistRecord.id,
            filename: file.filename,
            description: typeof gistRecord.description === 'string' ? gistRecord.description : '',
            updatedAt: gistRecord.updated_at,
          })
        }
        return backups
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async readBackup(credentialId, gistId, revision, signal) {
      const operation = 'gist.readBackup'
      throwIfAborted(signal, operation)
      assertGistId(gistId, 'Gist ID')
      if (revision) assertGistId(revision, 'revision')
      try {
        const token = vault.resolve(credentialId, operation) ?? ''
        const url = revision ? `${GIST_API}/${gistId}/${revision}` : `${GIST_API}/${gistId}`
        const response = await fetchImpl(url, {
          headers: githubHeaders(token),
          redirect: 'error',
          signal,
        })
        const payload = await jsonRecord(response)
        if (!response.ok) {
          throw new RuntimeError('REMOTE_ERROR', remoteErrorMessage(payload, `GitHub API 错误 ${response.status}`), {
            operation,
          })
        }
        const file = findBackupFile(payload.files)
        if (!file || typeof file.filename !== 'string') {
          throw new RuntimeError('NOT_FOUND', '该 Gist 中没有 StoryForge 备份', { operation })
        }
        let content = typeof file.content === 'string' ? file.content : ''
        if (file.truncated === true) {
          const rawResponse = await fetchImpl(checkedRawGistUrl(file.raw_url), {
            redirect: 'error',
            signal,
          })
          if (!rawResponse.ok) {
            throw new RuntimeError('REMOTE_ERROR', `GitHub raw 文件错误 ${rawResponse.status}`, { operation })
          }
          content = await rawResponse.text()
        }
        return { filename: file.filename, content }
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async listRevisions(credentialId, gistId, signal): Promise<GistRevisionMeta[]> {
      const operation = 'gist.listRevisions'
      throwIfAborted(signal, operation)
      assertGistId(gistId, 'Gist ID')
      try {
        const token = vault.resolve(credentialId, operation) ?? ''
        const response = await fetchImpl(`${GIST_API}/${gistId}`, {
          headers: githubHeaders(token),
          redirect: 'error',
          signal,
        })
        const payload = await jsonRecord(response)
        if (!response.ok) {
          throw new RuntimeError('REMOTE_ERROR', remoteErrorMessage(payload, `GitHub API 错误 ${response.status}`), {
            operation,
          })
        }
        if (!Array.isArray(payload.history)) return []
        return payload.history.flatMap((entry): GistRevisionMeta[] => {
          const history = asRecord(entry)
          if (typeof history.version !== 'string' || typeof history.committed_at !== 'string') return []
          const change = asRecord(history.change_status)
          return [{
            version: history.version,
            committedAt: history.committed_at,
            ...(typeof change.additions === 'number' ? { additions: change.additions } : {}),
            ...(typeof change.deletions === 'number' ? { deletions: change.deletions } : {}),
          }]
        })
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },
  }

  function bindingKey(bindingId: string): string {
    assertSafeToken(bindingId, 'bindingId', 'files.binding')
    return `${BINDING_PREFIX}${bindingId}`
  }

  async function requireBinding(bindingId: string, operation: string): Promise<FileSystemDirectoryHandle> {
    const handle = await bindingStore.load(bindingKey(bindingId))
    if (!handle) throw new RuntimeError('NOT_FOUND', '备份目录尚未绑定', { operation })
    return handle
  }

  const files: RuntimeAdapter['files'] = {
    async save(request) {
      try {
        throwIfAborted(request.signal, 'files.save')
        const suggestedName = normalizeSuggestedFilename(
          request.suggestedName,
          WEB_SAVE_FILE_FORMATS[request.purpose].extensions,
          'files.save',
        )
        return await (options.files?.save ?? defaultSaveFile)({ ...request, suggestedName })
      } catch (error) {
        throwIfAborted(request.signal, 'files.save')
        if (isAbortError(error)) return { status: 'cancelled' }
        throw normalizeRuntimeError(error, 'files.save')
      }
    },

    async open(request) {
      try {
        return await (options.files?.open ?? defaultOpenFile)(request)
      } catch (error) {
        throwIfAborted(request.signal, 'files.open')
        if (isAbortError(error)) return { status: 'cancelled' }
        throw normalizeRuntimeError(error, 'files.open')
      }
    },

    async bindBackupDirectory(bindingId) {
      const operation = 'files.bindBackupDirectory'
      throwIfAborted(undefined, operation)
      try {
        const handle = await pickDirectory()
        await bindingStore.save(bindingKey(bindingId), handle)
        return {
          status: 'completed',
          value: {
            bindingId,
            label: handle.name,
            permission: await permissionState(handle, true),
          },
        }
      } catch (error) {
        if (isAbortError(error)) return { status: 'cancelled' }
        throw normalizeRuntimeError(error, operation)
      }
    },

    async inspectBackupBinding(bindingId) {
      const handle = await bindingStore.load(bindingKey(bindingId))
      if (!handle) return { bindingId, label: '', permission: 'missing' }
      return { bindingId, label: handle.name, permission: await permissionState(handle, true) }
    },

    async requestBackupPermission(bindingId, write) {
      const operation = 'files.requestBackupPermission'
      try {
        const handle = await requireBinding(bindingId, operation)
        return {
          bindingId,
          label: handle.name,
          permission: await requestPermission(handle, write),
        }
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async writeBackup(request: BackupWriteRequest) {
      const operation = 'files.writeBackup'
      throwIfAborted(request.signal, operation)
      const suggestedName = normalizeSuggestedFilename(
        request.suggestedName,
        request.purpose === 'project-backup' ? ['.json'] : ['.sfmigration', '.zip'],
        operation,
      )
      if (!backupNameMatches(request.purpose, suggestedName)) {
        throw new RuntimeError('INVALID_INPUT', '备份文件名必须使用 storyforge- 前缀并匹配用途扩展名', {
          operation,
        })
      }
      try {
        const handle = await requireBinding(request.bindingId, operation)
        throwIfAborted(request.signal, operation)
        const permission = await requestPermission(handle, true)
        throwIfAborted(request.signal, operation)
        if (permission !== 'granted') {
          throw new RuntimeError('PERMISSION_DENIED', '没有备份目录写入权限', { operation })
        }
        const file = await handle.getFileHandle(suggestedName, { create: true })
        throwIfAborted(request.signal, operation)
        const writable = await file.createWritable()
        await writeAndCloseBackup(
          writable,
          fileContentBytes(request.content).slice().buffer,
          request.signal,
          operation,
        )
        return { displayName: suggestedName }
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async readBackups(request: BackupReadRequest): Promise<BackupFile[]> {
      const operation = 'files.readBackups'
      throwIfAborted(request.signal, operation)
      try {
        const handle = await requireBinding(request.bindingId, operation)
        throwIfAborted(request.signal, operation)
        const permission = await requestPermission(handle, false)
        throwIfAborted(request.signal, operation)
        if (permission !== 'granted') {
          throw new RuntimeError('PERMISSION_DENIED', '没有备份目录读取权限', { operation })
        }
        const directory = handle as unknown as {
          entries(): AsyncIterableIterator<[string, FileSystemFileHandle]>
        }
        const result: BackupFile[] = []
        for await (const [name, entry] of directory.entries()) {
          throwIfAborted(request.signal, operation)
          if (entry.kind !== 'file' || !backupNameMatches(request.purpose, name)) continue
          const file = await entry.getFile()
          throwIfAborted(request.signal, operation)
          const buffer = await file.arrayBuffer()
          throwIfAborted(request.signal, operation)
          result.push({ name, bytes: new Uint8Array(buffer) })
        }
        return result
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async clearBackupBinding(bindingId) {
      try {
        await bindingStore.delete(bindingKey(bindingId))
      } catch (error) {
        throw normalizeRuntimeError(error, 'files.clearBackupBinding')
      }
    },
  }

  const clipboard: RuntimeAdapter['clipboard'] = {
    async writeText(purpose, text) {
      try {
        const writer = options.clipboardWriteText
          ?? (
            typeof navigator !== 'undefined' && navigator.clipboard
              ? (_purpose: ClipboardPurpose, value: string) => navigator.clipboard.writeText(value)
              : undefined
          )
        if (!writer) {
          throw new RuntimeError('UNSUPPORTED', '当前环境不支持剪贴板写入', {
            operation: 'clipboard.writeText',
          })
        }
        await writer(purpose, text)
      } catch (error) {
        throw normalizeRuntimeError(error, 'clipboard.writeText')
      }
    },
  }

  const external: RuntimeAdapter['external'] = {
    async open(destination) {
      const url = EXTERNAL_URLS[destination.kind]
      try {
        if (options.openExternal) {
          await options.openExternal(url)
          return
        }
        if (typeof window === 'undefined') {
          throw new RuntimeError('UNSUPPORTED', '当前环境不能打开外部链接', { operation: 'external.open' })
        }
        const opened = window.open(url, '_blank', 'noopener,noreferrer')
        if (!opened) {
          throw new RuntimeError('PERMISSION_DENIED', '外部链接被浏览器拦截', { operation: 'external.open' })
        }
        opened.opener = null
      } catch (error) {
        throw normalizeRuntimeError(error, 'external.open')
      }
    },
  }

  async function inspectDurability(): Promise<DurabilityStatus> {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    const persisted = await storage?.persisted?.() ?? false
    const estimate = await storage?.estimate?.()
    return {
      persisted,
      ...(typeof estimate?.usage === 'number' ? { usageBytes: estimate.usage } : {}),
      ...(typeof estimate?.quota === 'number' ? { quotaBytes: estimate.quota } : {}),
    }
  }

  const durability: RuntimeAdapter['durability'] = {
    inspect: inspectDurability,
    async requestPersistence() {
      const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
      await storage?.persist?.()
      return inspectDurability()
    },
  }

  const serviceWorkerEnabled = !!serviceWorker
    && shouldRegisterStoryForgeServiceWorker(serviceWorkerHostname)
  let managedServiceWorker: ServiceWorkerRegistration | undefined
  let serviceWorkerInitialization: Promise<void> | undefined

  async function registerManagedServiceWorker(): Promise<void> {
    if (!serviceWorkerEnabled || !serviceWorker) return
    try {
      managedServiceWorker = await serviceWorker.register(WEB_SERVICE_WORKER_SCRIPT, {
        scope: WEB_SERVICE_WORKER_SCOPE,
      })
    } catch (error) {
      throw normalizeRuntimeError(error, 'updates.initialize')
    }
  }

  function initializeServiceWorker(): Promise<void> {
    if (serviceWorkerInitialization) return serviceWorkerInitialization
    if (!serviceWorkerEnabled) {
      serviceWorkerInitialization = Promise.resolve()
      return serviceWorkerInitialization
    }
    if (
      typeof window === 'undefined'
      || typeof document === 'undefined'
      || document.readyState === 'complete'
    ) {
      serviceWorkerInitialization = registerManagedServiceWorker()
      return serviceWorkerInitialization
    }
    serviceWorkerInitialization = new Promise<void>((resolve, reject) => {
      window.addEventListener('load', () => {
        void registerManagedServiceWorker().then(resolve, reject)
      }, { once: true })
    })
    return serviceWorkerInitialization
  }

  async function getManagedServiceWorker(operation: string): Promise<ServiceWorkerRegistration | undefined> {
    await initializeServiceWorker()
    if (!serviceWorkerEnabled || !serviceWorker) return undefined
    if (managedServiceWorker) return managedServiceWorker
    try {
      managedServiceWorker = await serviceWorker.getRegistration()
      return managedServiceWorker
    } catch (error) {
      throw normalizeRuntimeError(error, operation)
    }
  }

  const updates: RuntimeAdapter['updates'] = {
    initialize: initializeServiceWorker,

    async check() {
      const operation = 'updates.check'
      try {
        const registration = await getManagedServiceWorker(operation)
        if (!registration) return null
        await registration.update()
        return registration.waiting
          ? { releaseId: 'web-service-worker', version: options.version ?? 'web-update' }
          : null
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },

    async install(releaseId, signal) {
      const operation = 'updates.install'
      throwIfAborted(signal, operation)
      if (releaseId !== 'web-service-worker') {
        throw new RuntimeError('INVALID_INPUT', '更新标识无效', { operation })
      }
      try {
        const registration = await getManagedServiceWorker(operation)
        throwIfAborted(signal, operation)
        if (!registration?.waiting) {
          throw new RuntimeError('NOT_FOUND', '没有待安装的 Web 更新', { operation })
        }
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      } catch (error) {
        throw normalizeRuntimeError(error, operation)
      }
    },
  }

  const diagnostics: RuntimeAdapter['diagnostics'] = {
    record(event) {
      assertDiagnosticEvent(event)
      diagnosticsEvents.push({ ...event })
      if (diagnosticsEvents.length > MAX_DIAGNOSTIC_EVENTS) diagnosticsEvents.shift()
    },

    async snapshot(): Promise<DiagnosticsSnapshot> {
      return {
        generatedAt: now(),
        distribution: await distribution.getInfo(),
        events: diagnosticsEvents.map(event => ({ ...event })),
      }
    },
  }

  return {
    kind: 'web',
    ai,
    gist,
    files,
    secrets: vault.publicStore,
    clipboard,
    external,
    durability,
    distribution,
    updates,
    diagnostics,
  }
}
