export type RuntimeErrorCode =
  | 'ABORTED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'DISK_FULL'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'BUSY'
  | 'NETWORK'
  | 'REMOTE_ERROR'
  | 'INTEGRITY_ERROR'
  | 'UNKNOWN'

export interface RuntimeErrorInit {
  operation: string
  retryable?: boolean
  cause?: unknown
}

/**
 * Runtime boundary failures are deliberately small and serializable.
 * Do not place prompts, manuscript text, API keys, PATs, or local paths in
 * `message`/`operation`: diagnostics may retain those fields.
 */
export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode
  readonly operation: string
  readonly retryable: boolean
  readonly originalCause?: unknown

  constructor(code: RuntimeErrorCode, message: string, init: RuntimeErrorInit) {
    super(message)
    this.name = 'RuntimeError'
    this.code = code
    this.operation = init.operation
    this.retryable = init.retryable ?? false
    this.originalCause = init.cause
  }
}

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('name' in error)) return undefined
  return typeof error.name === 'string' ? error.name : undefined
}

export interface NormalizeRuntimeErrorOptions {
  typeErrorIsNetwork?: boolean
}

export function normalizeRuntimeError(
  error: unknown,
  operation: string,
  options: NormalizeRuntimeErrorOptions = {},
): RuntimeError {
  if (error instanceof RuntimeError) return error

  const name = errorName(error)
  if (name === 'AbortError') {
    return new RuntimeError('ABORTED', '操作已中止', { operation, cause: error })
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new RuntimeError('PERMISSION_DENIED', '没有执行该操作的权限', { operation, cause: error })
  }
  if (name === 'QuotaExceededError') {
    return new RuntimeError('DISK_FULL', '可用存储空间不足', { operation, cause: error })
  }
  if (error instanceof TypeError && options.typeErrorIsNetwork) {
    return new RuntimeError('NETWORK', '运行时网络请求失败', {
      operation,
      retryable: true,
      cause: error,
    })
  }

  return new RuntimeError('UNKNOWN', '运行时操作失败', { operation, cause: error })
}

export function throwIfAborted(signal: AbortSignal | undefined, operation: string): void {
  if (!signal?.aborted) return
  throw new RuntimeError('ABORTED', '操作已中止', { operation })
}
