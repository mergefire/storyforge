import { createHash } from 'node:crypto'

import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'
import type { TableSpec } from '../../src/lib/registry/types'

export const D04_FIXTURE_SEED = 'storyforge-windows-d0.4-v1'
export const D04_FIXTURE_CLOCK_ISO = '2026-01-01T00:00:00.000Z'
export const D04_FIXTURE_CLOCK_MS = Date.parse(D04_FIXTURE_CLOCK_ISO)

const NUMERIC_ID_HEX_LENGTH = 13
const ORDINAL_WIDTH = 8
export const D04_CANONICAL_EXCLUDED_FIELDS = [
  'exportedAt',
  'createdAt',
  'updatedAt',
] as const
const DEFAULT_RUNTIME_FIELDS = new Set<string>(D04_CANONICAL_EXCLUDED_FIELDS)

export type FixtureTableClassification =
  | 'exportable'
  | 'local-only'
  | 'transient'
  | 'blob'
  | 'global'

export interface FixtureRegistryCoverageEntry {
  name: string
  owner: TableSpec['owner']
  exportable: boolean
  classification: FixtureTableClassification
}

function assertFixtureCoordinate(
  fixtureId: string,
  entityKind: string,
  ordinal: number,
): void {
  if (!fixtureId.trim()) throw new Error('fixtureId must not be empty')
  if (!entityKind.trim()) throw new Error('entityKind must not be empty')
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
    throw new Error('ordinal must be a non-negative safe integer')
  }
}

function fixtureCoordinate(
  fixtureId: string,
  entityKind: string,
  ordinal: number,
): string {
  assertFixtureCoordinate(fixtureId, entityKind, ordinal)
  return JSON.stringify([
    D04_FIXTURE_SEED,
    fixtureId,
    entityKind,
    String(ordinal).padStart(ORDINAL_WIDTH, '0'),
  ])
}

export function stableFixtureHexId(
  fixtureId: string,
  entityKind: string,
  ordinal: number,
): string {
  return createHash('sha256')
    .update(fixtureCoordinate(fixtureId, entityKind, ordinal), 'utf8')
    .digest('hex')
}

export function stableFixtureNumericId(
  fixtureId: string,
  entityKind: string,
  ordinal: number,
): number {
  const value = Number.parseInt(
    stableFixtureHexId(fixtureId, entityKind, ordinal).slice(0, NUMERIC_ID_HEX_LENGTH),
    16,
  )
  if (!Number.isSafeInteger(value)) throw new Error('fixture numeric ID is not safe')
  return value === 0 ? 1 : value
}

export function createFixtureText(
  fixtureId: string,
  entityKind: string,
  ordinal: number,
  nonWhitespaceCharacters: number,
): string {
  assertFixtureCoordinate(fixtureId, entityKind, ordinal)
  if (!Number.isSafeInteger(nonWhitespaceCharacters) || nonWhitespaceCharacters < 0) {
    throw new Error('nonWhitespaceCharacters must be a non-negative safe integer')
  }

  let text = ''
  let block = 0
  while (text.length < nonWhitespaceCharacters) {
    text += stableFixtureHexId(
      fixtureId,
      `${entityKind}:text:${ordinal}`,
      block,
    )
    block += 1
  }
  return text.slice(0, nonWhitespaceCharacters)
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function canonicalize(
  value: unknown,
  excludedFields: ReadonlySet<string>,
  stack: WeakSet<object>,
  path: string,
): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number at ${path}`)
    return value
  }
  if (typeof value === 'undefined') return undefined
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`unsupported canonical value at ${path}: ${typeof value}`)
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    throw new Error(`Blob must be hashed as bytes instead of canonical JSON at ${path}`)
  }
  if (value instanceof Date) return value.toISOString()
  if (!value || typeof value !== 'object') {
    throw new Error(`unsupported canonical value at ${path}`)
  }
  if (stack.has(value)) throw new Error(`cyclic canonical value at ${path}`)

  stack.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        const normalized = canonicalize(item, excludedFields, stack, `${path}[${index}]`)
        return normalized === undefined ? null : normalized
      })
    }
    if (!isPlainObject(value)) {
      throw new Error(`non-plain canonical object at ${path}`)
    }

    const normalized = Object.create(null) as Record<string, unknown>
    for (const key of Object.keys(value).sort()) {
      if (excludedFields.has(key)) continue
      const child = canonicalize(value[key], excludedFields, stack, `${path}.${key}`)
      if (child !== undefined) normalized[key] = child
    }
    return normalized
  } finally {
    stack.delete(value)
  }
}

export function canonicalizeFixtureValue(
  value: unknown,
  excludedFields: ReadonlySet<string> = DEFAULT_RUNTIME_FIELDS,
): unknown {
  return canonicalize(value, excludedFields, new WeakSet(), '$')
}

export function canonicalFixtureJson(
  value: unknown,
  excludedFields: ReadonlySet<string> = DEFAULT_RUNTIME_FIELDS,
): string {
  return JSON.stringify(canonicalizeFixtureValue(value, excludedFields))
}

export function fixtureSha256(
  value: unknown,
  excludedFields: ReadonlySet<string> = DEFAULT_RUNTIME_FIELDS,
): string {
  return createHash('sha256')
    .update(canonicalFixtureJson(value, excludedFields), 'utf8')
    .digest('hex')
}

function classifyTable(spec: TableSpec): FixtureTableClassification {
  if (spec.owner === 'transient') return 'transient'
  if (spec.owner === 'blob') return 'blob'
  if (spec.owner === 'global') return 'global'
  return spec.exportable ? 'exportable' : 'local-only'
}

export function buildRegistryCoverage(): FixtureRegistryCoverageEntry[] {
  return PROJECT_TABLES.map(spec => ({
    name: spec.name,
    owner: spec.owner,
    exportable: spec.exportable,
    classification: classifyTable(spec),
  }))
}

export function assertRegistryCoverage(
  coverage: readonly FixtureRegistryCoverageEntry[] = buildRegistryCoverage(),
): void {
  const expectedNames = PROJECT_TABLES.map(spec => spec.name).sort()
  const actualNames = coverage.map(entry => entry.name).sort()
  if (coverage.length !== PROJECT_TABLES.length) {
    throw new Error(
      `registry coverage count mismatch: expected ${PROJECT_TABLES.length}, got ${coverage.length}`,
    )
  }
  if (new Set(actualNames).size !== actualNames.length) {
    throw new Error('registry coverage contains duplicate table names')
  }
  if (actualNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error('registry coverage does not match PROJECT_TABLES')
  }

  const specs = new Map(PROJECT_TABLES.map(spec => [spec.name, spec] as const))
  for (const entry of coverage) {
    const spec = specs.get(entry.name)
    if (!spec
      || entry.owner !== spec.owner
      || entry.exportable !== spec.exportable
      || entry.classification !== classifyTable(spec)) {
      throw new Error(`registry coverage metadata is stale for ${entry.name}`)
    }
  }
}
