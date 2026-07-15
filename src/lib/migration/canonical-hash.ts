const encoder = new TextEncoder()

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function canonicalizeMigrationValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical value contains a non-finite number')
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) return value.map(canonicalizeMigrationValue)
  if (!isPlainObject(value)) throw new Error('canonical value must contain only plain objects')

  const result: Record<string, unknown> = Object.create(null)
  for (const key of Object.keys(value).sort()) {
    const child = value[key]
    if (child === undefined) throw new Error(`canonical value contains undefined at ${key}`)
    result[key] = canonicalizeMigrationValue(child)
  }
  return result
}

export function canonicalMigrationJson(value: unknown): string {
  return JSON.stringify(canonicalizeMigrationValue(value))
}

export function utf8Bytes(value: string): Uint8Array {
  return encoder.encode(value)
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(utf8Bytes(value))
}

export async function contentDigest(
  payloads: readonly { path: string; bytes: Uint8Array; sha256: string }[],
): Promise<string> {
  const lines = [...payloads]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(payload => `${payload.path}\t${payload.bytes.byteLength}\t${payload.sha256}`)
  return sha256Text(`${lines.join('\n')}\n`)
}
