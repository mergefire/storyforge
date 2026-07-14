import type { ArrayRef, JsonRef } from '../registry/types'

export type PortableUnmappedPolicy = 'require' | 'drop-item'

export interface PortableReferenceOptions {
  onUnmapped: PortableUnmappedPolicy
}

export type PortableReferenceRef = ArrayRef | JsonRef

export interface PortableReferenceRemapContext {
  operation: 'export' | 'import'
  table: string
  row?: number | string
}

type JsonPrimitive = null | boolean | number | string
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

type JsonPathToken =
  | { kind: 'array-items' }
  | { kind: 'object-values' }
  | { kind: 'property'; key: string }

const DROP = Symbol('portable-reference-drop')

export class PortableReferenceRemapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PortableReferenceRemapError'
  }
}

/** Resolve the target table declared by an array/json registry reference. */
export function portableRefTargetTable(ref: ArrayRef | JsonRef): string {
  if (ref.kind === 'array') {
    if (!isTableName(ref.itemTarget)) {
      throw new PortableReferenceRemapError(
        `Invalid portable array target: ${JSON.stringify(ref.itemTarget)}`,
      )
    }
    return ref.itemTarget
  }

  const match = /^([A-Za-z_$][\w$]*)\[id\]$/.exec(ref.target)
  if (!match) {
    throw new PortableReferenceRemapError(
      `Invalid portable JSON target: ${JSON.stringify(ref.target)}`,
    )
  }
  return match[1]
}

/**
 * Remap one registered array/JSON reference value for either export or import.
 *
 * The mapper is deliberately direction-agnostic: export supplies db id -> export
 * index, while import supplies export index -> new db id. String-backed values
 * stay strings and native arrays/objects stay native. The input is never mutated.
 */
export function remapPortableReferenceValue(
  value: unknown,
  ref: PortableReferenceRef,
  mapId: (id: number) => number | undefined,
  context: PortableReferenceRemapContext,
): unknown {
  assertContext(context)
  portableRefTargetTable(ref)
  assertPortablePolicy(ref, context)

  if (value == null) return value

  if (ref.kind === 'array') {
    return remapArrayReference(value, ref, mapId, context)
  }

  return remapJsonReference(value, ref, mapId, context)
}

function remapArrayReference(
  value: unknown,
  ref: PortableReferenceRef & ArrayRef,
  mapId: (id: number) => number | undefined,
  context: PortableReferenceRemapContext,
): number[] | string {
  if (typeof value === 'string') {
    const parsed = parseJson(value, ref, context)
    if (!Array.isArray(parsed)) {
      fail(ref, context, 'expected a JSON-string number[]')
    }
    const remapped = remapTerminalArray(parsed, ref, mapId, context, '$')
    return JSON.stringify(remapped)
  }

  if (!Array.isArray(value)) {
    fail(ref, context, 'expected a native number[] or JSON-string number[]')
  }

  const cloned = cloneJson(value, ref, context, '$')
  if (!Array.isArray(cloned)) {
    fail(ref, context, 'expected a native number[]')
  }
  return remapTerminalArray(cloned, ref, mapId, context, '$')
}

function remapJsonReference(
  value: unknown,
  ref: PortableReferenceRef & JsonRef,
  mapId: (id: number) => number | undefined,
  context: PortableReferenceRemapContext,
): JsonValue | string {
  const isStringBacked = typeof value === 'string'
  const parsed = isStringBacked
    ? parseJson(value, ref, context)
    : cloneJson(value, ref, context, '$')
  const tokens = parseJsonPath(ref.jsonPath, ref, context)
  const remapped = visitPath(parsed, tokens, 0, ref, mapId, context, '$')

  if (remapped === DROP) {
    fail(ref, context, 'the JSON path selected the whole field for removal')
  }
  return isStringBacked ? JSON.stringify(remapped) : remapped
}

function visitPath(
  value: JsonValue,
  tokens: JsonPathToken[],
  index: number,
  ref: PortableReferenceRef,
  mapId: (id: number) => number | undefined,
  context: PortableReferenceRemapContext,
  location: string,
): JsonValue | typeof DROP {
  if (index === tokens.length) {
    return remapTerminal(value, ref, mapId, context, location)
  }

  const token = tokens[index]
  if (token.kind === 'array-items') {
    if (!Array.isArray(value)) {
      fail(ref, context, `expected array at ${location}`)
    }
    const next: JsonValue[] = []
    value.forEach((item, itemIndex) => {
      const remapped = visitPath(
        item,
        tokens,
        index + 1,
        ref,
        mapId,
        context,
        `${location}[${itemIndex}]`,
      )
      if (remapped !== DROP) next.push(remapped)
    })
    return next
  }

  if (!isPlainJsonObject(value)) {
    fail(ref, context, `expected object at ${location}`)
  }

  if (token.kind === 'object-values') {
    const next = createJsonObject()
    for (const [key, item] of Object.entries(value)) {
      const remapped = visitPath(
        item,
        tokens,
        index + 1,
        ref,
        mapId,
        context,
        `${location}.${key}`,
      )
      if (remapped !== DROP) next[key] = remapped
    }
    return next
  }

  const next = copyJsonObject(value)
  if (!Object.prototype.hasOwnProperty.call(value, token.key)) return next
  const remapped = visitPath(
    value[token.key],
    tokens,
    index + 1,
    ref,
    mapId,
    context,
    `${location}.${token.key}`,
  )
  if (remapped === DROP) delete next[token.key]
  else next[token.key] = remapped
  return next
}

function remapTerminal(
  value: JsonValue,
  ref: PortableReferenceRef,
  mapId: (id: number) => number | undefined,
  context: PortableReferenceRemapContext,
  location: string,
): JsonValue | typeof DROP {
  if (Array.isArray(value)) {
    return remapTerminalArray(value, ref, mapId, context, location)
  }
  if (!isReferenceId(value)) {
    fail(ref, context, `expected a reference id or id array at ${location}`)
  }
  return remapId(value, ref, mapId, context, location)
}

function remapTerminalArray(
  values: JsonValue[],
  ref: PortableReferenceRef,
  mapId: (id: number) => number | undefined,
  context: PortableReferenceRemapContext,
  location: string,
): number[] {
  const next: number[] = []
  values.forEach((value, index) => {
    if (!isReferenceId(value)) {
      fail(ref, context, `expected a reference id at ${location}[${index}]`)
    }
    const remapped = remapId(value, ref, mapId, context, `${location}[${index}]`)
    if (remapped !== DROP) next.push(remapped)
  })
  return next
}

function remapId(
  id: number,
  ref: PortableReferenceRef,
  mapId: (id: number) => number | undefined,
  context: PortableReferenceRemapContext,
  location: string,
): number | typeof DROP {
  const mapped = mapId(id)
  if (mapped !== undefined) {
    if (!isReferenceId(mapped)) {
      fail(ref, context, `mapper returned an invalid id at ${location}`)
    }
    return mapped
  }

  if (ref.portable?.onUnmapped === 'drop-item') return DROP
  if (ref.portable?.onUnmapped !== 'require') {
    fail(ref, context, 'portable.onUnmapped must be require or drop-item')
  }
  fail(ref, context, `unmapped reference id ${id} at ${location}`)
}

function parseJson(
  value: string,
  ref: PortableReferenceRef,
  context: PortableReferenceRemapContext,
): JsonValue {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    fail(ref, context, 'invalid JSON string')
  }
  return cloneJson(parsed, ref, context, '$')
}

function cloneJson(
  value: unknown,
  ref: PortableReferenceRef,
  context: PortableReferenceRemapContext,
  location: string,
  ancestors: Set<object> = new Set(),
): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(ref, context, `non-finite number at ${location}`)
    return value
  }
  if (typeof value !== 'object') {
    fail(ref, context, `non-JSON value at ${location}`)
  }
  if (ancestors.has(value)) fail(ref, context, `cyclic value at ${location}`)

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => cloneJson(item, ref, context, `${location}[${index}]`, ancestors))
    }
    if (!isPlainObject(value)) fail(ref, context, `non-plain object at ${location}`)
    const next = createJsonObject()
    for (const [key, item] of Object.entries(value)) {
      next[key] = cloneJson(item, ref, context, `${location}.${key}`, ancestors)
    }
    return next
  } finally {
    ancestors.delete(value)
  }
}

function parseJsonPath(
  path: string,
  ref: PortableReferenceRef,
  context: PortableReferenceRemapContext,
): JsonPathToken[] {
  if (!path.startsWith('$')) fail(ref, context, `invalid JSON path ${JSON.stringify(path)}`)
  const tokens: JsonPathToken[] = []
  let cursor = 1

  while (cursor < path.length) {
    if (path.startsWith('[]', cursor)) {
      tokens.push({ kind: 'array-items' })
      cursor += 2
      continue
    }
    if (path.startsWith('.*', cursor)) {
      tokens.push({ kind: 'object-values' })
      cursor += 2
      continue
    }
    if (path[cursor] === '.') {
      const match = /^\.([A-Za-z_$][\w$]*)/.exec(path.slice(cursor))
      if (!match) fail(ref, context, `invalid JSON path ${JSON.stringify(path)}`)
      tokens.push({ kind: 'property', key: match[1] })
      cursor += match[0].length
      continue
    }
    fail(ref, context, `unsupported JSON path ${JSON.stringify(path)}`)
  }

  if (tokens.length === 0) fail(ref, context, `JSON path must select a nested value: ${JSON.stringify(path)}`)
  return tokens
}

function isReferenceId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isTableName(value: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(value)
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isPlainJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createJsonObject(): { [key: string]: JsonValue } {
  return Object.create(null) as { [key: string]: JsonValue }
}

function copyJsonObject(value: { [key: string]: JsonValue }): { [key: string]: JsonValue } {
  const copy = createJsonObject()
  for (const [key, item] of Object.entries(value)) copy[key] = item
  return copy
}

function assertContext(context: PortableReferenceRemapContext): void {
  if (!context || !context.operation || !context.table) {
    throw new PortableReferenceRemapError('Portable reference remap requires operation and table context')
  }
}

function assertPortablePolicy(
  ref: PortableReferenceRef,
  context: PortableReferenceRemapContext,
): void {
  const policy = ref.portable?.onUnmapped
  if (policy !== 'require' && policy !== 'drop-item') {
    fail(ref, context, 'portable.onUnmapped must be require or drop-item')
  }
}

function fail(
  ref: ArrayRef | JsonRef,
  context: PortableReferenceRemapContext,
  reason: string,
): never {
  const row = context.row === undefined ? '' : ` row=${String(context.row)}`
  throw new PortableReferenceRemapError(
    `[${context.operation}] ${context.table}.${ref.field}${row}: ${reason}`,
  )
}
