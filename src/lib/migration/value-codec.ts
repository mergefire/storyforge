const TAG = '$storyforgeType'

type EncodedValue =
  | null
  | boolean
  | string
  | number
  | { [TAG]: 'Undefined' }
  | { [TAG]: 'Number'; value: 'NaN' | 'Infinity' | '-Infinity' | '-0' }
  | { [TAG]: 'Date'; value: string }
  | { [TAG]: 'Array'; value: EncodedValue[] }
  | { [TAG]: 'Object'; value: Record<string, EncodedValue> }
  | { [TAG]: 'ArrayBuffer'; base64: string }
  | { [TAG]: 'TypedArray'; name: string; base64: string }
  | { [TAG]: 'Blob'; file: string; size: number; mimeType: string }

export interface EncodedBlobReference {
  file: string
  size: number
  mimeType: string
}

export type BlobEncoder = (blob: Blob, path: readonly (string | number)[]) => Promise<EncodedBlobReference>
export type BlobDecoder = (file: string, size: number, mimeType: string) => Blob

const TYPED_ARRAYS: Readonly<Record<string, (bytes: Uint8Array) => ArrayBufferView>> = {
  Int8Array: bytes => new Int8Array(bytes.slice().buffer),
  Uint8Array: bytes => bytes.slice(),
  Uint8ClampedArray: bytes => new Uint8ClampedArray(bytes.slice().buffer),
  Int16Array: bytes => new Int16Array(copyAligned(bytes, 2)),
  Uint16Array: bytes => new Uint16Array(copyAligned(bytes, 2)),
  Int32Array: bytes => new Int32Array(copyAligned(bytes, 4)),
  Uint32Array: bytes => new Uint32Array(copyAligned(bytes, 4)),
  Float32Array: bytes => new Float32Array(copyAligned(bytes, 4)),
  Float64Array: bytes => new Float64Array(copyAligned(bytes, 8)),
  BigInt64Array: bytes => new BigInt64Array(copyAligned(bytes, 8)),
  BigUint64Array: bytes => new BigUint64Array(copyAligned(bytes, 8)),
  DataView: bytes => new DataView(bytes.slice().buffer),
}

function copyAligned(bytes: Uint8Array, alignment: number): ArrayBuffer {
  if (bytes.byteLength % alignment !== 0) throw new Error('typed array byte length is misaligned')
  return bytes.slice().buffer
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('invalid base64 payload')
  }
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function encodeInner(
  value: unknown,
  encodeBlob: BlobEncoder,
  path: readonly (string | number)[],
  stack: WeakSet<object>,
): Promise<EncodedValue> {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'undefined') return { [TAG]: 'Undefined' }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { [TAG]: 'Number', value: 'NaN' }
    if (value === Infinity) return { [TAG]: 'Number', value: 'Infinity' }
    if (value === -Infinity) return { [TAG]: 'Number', value: '-Infinity' }
    if (Object.is(value, -0)) return { [TAG]: 'Number', value: '-0' }
    return value
  }
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`unsupported migration value: ${typeof value}`)
  }
  if (!value || typeof value !== 'object') throw new Error('unsupported migration value')
  if (stack.has(value)) throw new Error('cyclic migration value')

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('invalid Date migration value')
    return { [TAG]: 'Date', value: value.toISOString() }
  }
  if (value instanceof Blob) {
    const reference = await encodeBlob(value, path)
    if (reference.size !== value.size) throw new Error('Blob encoder changed byte length')
    return { [TAG]: 'Blob', ...reference }
  }
  if (value instanceof ArrayBuffer) {
    return { [TAG]: 'ArrayBuffer', base64: bytesToBase64(new Uint8Array(value)) }
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    return {
      [TAG]: 'TypedArray',
      name: value.constructor.name,
      base64: bytesToBase64(bytes),
    }
  }

  stack.add(value)
  try {
    if (Array.isArray(value)) {
      const items: EncodedValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new Error(`sparse array at ${path.join('.')}`)
        }
        items.push(await encodeInner(value[index], encodeBlob, [...path, index], stack))
      }
      return { [TAG]: 'Array', value: items }
    }
    if (!isPlainObject(value)) throw new Error('migration value contains a non-plain object')
    const encoded: Record<string, EncodedValue> = Object.create(null)
    for (const key of Object.keys(value).sort()) {
      encoded[key] = await encodeInner(value[key], encodeBlob, [...path, key], stack)
    }
    return { [TAG]: 'Object', value: encoded }
  } finally {
    stack.delete(value)
  }
}

export function encodeMigrationValue(value: unknown, encodeBlob: BlobEncoder): Promise<EncodedValue> {
  return encodeInner(value, encodeBlob, [], new WeakSet())
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) throw new Error('encoded migration value must be an object')
  return value
}

export function decodeMigrationValue(value: unknown, decodeBlob: BlobDecoder): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('raw non-finite number is forbidden')
    return value
  }
  const record = requireRecord(value)
  const tag = record[TAG]
  if (typeof tag !== 'string') throw new Error('encoded migration object is missing a type tag')
  switch (tag) {
    case 'Undefined':
      return undefined
    case 'Number':
      if (record.value === 'NaN') return NaN
      if (record.value === 'Infinity') return Infinity
      if (record.value === '-Infinity') return -Infinity
      if (record.value === '-0') return -0
      throw new Error('invalid encoded number')
    case 'Date': {
      if (typeof record.value !== 'string') throw new Error('invalid encoded Date')
      const date = new Date(record.value)
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== record.value) {
        throw new Error('invalid encoded Date')
      }
      return date
    }
    case 'Array':
      if (!Array.isArray(record.value)) throw new Error('invalid encoded array')
      return record.value.map(item => decodeMigrationValue(item, decodeBlob))
    case 'Object': {
      const source = requireRecord(record.value)
      const decoded: Record<string, unknown> = Object.create(null)
      for (const key of Object.keys(source)) decoded[key] = decodeMigrationValue(source[key], decodeBlob)
      return decoded
    }
    case 'ArrayBuffer':
      if (typeof record.base64 !== 'string') throw new Error('invalid encoded ArrayBuffer')
      return base64ToBytes(record.base64).buffer
    case 'TypedArray': {
      if (typeof record.name !== 'string' || typeof record.base64 !== 'string') {
        throw new Error('invalid encoded typed array')
      }
      const constructor = TYPED_ARRAYS[record.name]
      if (!constructor) throw new Error(`unsupported typed array: ${record.name}`)
      return constructor(base64ToBytes(record.base64))
    }
    case 'Blob':
      if (typeof record.file !== 'string'
        || !Number.isSafeInteger(record.size)
        || (record.size as number) < 0
        || typeof record.mimeType !== 'string') {
        throw new Error('invalid encoded Blob')
      }
      return decodeBlob(record.file, record.size as number, record.mimeType)
    default:
      throw new Error(`unknown encoded migration type: ${tag}`)
  }
}
