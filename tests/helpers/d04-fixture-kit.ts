import { createHash } from 'node:crypto'

import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'
import type { TableSpec } from '../../src/lib/registry/types'

export const D04_FIXTURE_SEED = 'storyforge-windows-d0.4-v1'
export const D04_FIXTURE_CLOCK_ISO = '2026-01-01T00:00:00.000Z'
export const D04_FIXTURE_CLOCK_MS = Date.parse(D04_FIXTURE_CLOCK_ISO)
export const D04_IMPORT_PROJECT_NAME_SUFFIX = '（导入）'

const NUMERIC_ID_HEX_LENGTH = 13
const ORDINAL_WIDTH = 8
export const D04_SINGLE_STATE_EXCLUDED_PATHS = ['$.exportedAt'] as const
export const D04_ROUNDTRIP_EXCLUDED_PATHS = [
  '$.exportedAt',
  '$.project.createdAt',
  '$.project.updatedAt',
  '$.<exportableTable>[*].createdAt',
  '$.<exportableTable>[*].updatedAt',
] as const

type CanonicalPathSegment = string | number
type CanonicalExclusionPolicy = (path: readonly CanonicalPathSegment[]) => boolean

const EXPORTABLE_TABLE_NAMES = new Set(
  PROJECT_TABLES.filter(spec => spec.exportable && spec.name !== 'projects').map(spec => spec.name),
)

function isRootExportedAt(path: readonly CanonicalPathSegment[]): boolean {
  return path.length === 1 && path[0] === 'exportedAt'
}

function excludeSingleStateEnvelope(path: readonly CanonicalPathSegment[]): boolean {
  return isRootExportedAt(path)
}

function excludeRoundtripRuntimeMetadata(path: readonly CanonicalPathSegment[]): boolean {
  if (isRootExportedAt(path)) return true
  if (path.length === 2 && path[0] === 'project') {
    return path[1] === 'createdAt' || path[1] === 'updatedAt'
  }
  return path.length === 3
    && typeof path[0] === 'string'
    && EXPORTABLE_TABLE_NAMES.has(path[0])
    && typeof path[1] === 'number'
    && (path[2] === 'createdAt' || path[2] === 'updatedAt')
}

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

/**
 * Validate the complete input graph before any runtime-path exclusion is applied.
 * Otherwise an excluded timestamp could hide a Blob, unsupported primitive or cycle.
 */
function validateCanonicalValue(
  value: unknown,
  stack: WeakSet<object>,
  path: string,
): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number at ${path}`)
    return
  }
  if (typeof value === 'undefined'
    || typeof value === 'bigint'
    || typeof value === 'function'
    || typeof value === 'symbol') {
    throw new Error(`unsupported canonical value at ${path}: ${typeof value}`)
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    throw new Error(`Blob must be hashed as bytes instead of canonical JSON at ${path}`)
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error(`invalid Date at ${path}`)
    return
  }
  if (!value || typeof value !== 'object') {
    throw new Error(`unsupported canonical value at ${path}`)
  }
  if (stack.has(value)) throw new Error(`cyclic canonical value at ${path}`)

  stack.add(value)
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new Error(`unsupported canonical value at ${path}[${index}]: undefined`)
        }
        validateCanonicalValue(value[index], stack, `${path}[${index}]`)
      }
      return
    }
    if (!isPlainObject(value)) {
      throw new Error(`non-plain canonical object at ${path}`)
    }
    for (const key of Object.keys(value).sort()) {
      validateCanonicalValue(value[key], stack, `${path}.${key}`)
    }
  } finally {
    stack.delete(value)
  }
}

function canonicalize(
  value: unknown,
  exclusionPolicy: CanonicalExclusionPolicy,
  stack: WeakSet<object>,
  path: string,
  pathSegments: readonly CanonicalPathSegment[],
): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number at ${path}`)
    return value
  }
  if (typeof value === 'undefined'
    || typeof value === 'bigint'
    || typeof value === 'function'
    || typeof value === 'symbol') {
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
        const normalized = canonicalize(
          item,
          exclusionPolicy,
          stack,
          `${path}[${index}]`,
          [...pathSegments, index],
        )
        return normalized === undefined ? null : normalized
      })
    }
    if (!isPlainObject(value)) {
      throw new Error(`non-plain canonical object at ${path}`)
    }

    const normalized = Object.create(null) as Record<string, unknown>
    for (const key of Object.keys(value).sort()) {
      const childPath = [...pathSegments, key]
      if (exclusionPolicy(childPath)) continue
      const child = canonicalize(value[key], exclusionPolicy, stack, `${path}.${key}`, childPath)
      if (child !== undefined) normalized[key] = child
    }
    return normalized
  } finally {
    stack.delete(value)
  }
}

export function canonicalizeFixtureValue(
  value: unknown,
  exclusionPolicy: CanonicalExclusionPolicy = excludeSingleStateEnvelope,
): unknown {
  validateCanonicalValue(value, new WeakSet(), '$')
  return canonicalize(value, exclusionPolicy, new WeakSet(), '$', [])
}

export function canonicalFixtureJson(
  value: unknown,
  exclusionPolicy: CanonicalExclusionPolicy = excludeSingleStateEnvelope,
): string {
  return JSON.stringify(canonicalizeFixtureValue(value, exclusionPolicy))
}

export function fixtureSha256(
  value: unknown,
  exclusionPolicy: CanonicalExclusionPolicy = excludeSingleStateEnvelope,
): string {
  return createHash('sha256')
    .update(canonicalFixtureJson(value, exclusionPolicy), 'utf8')
    .digest('hex')
}

export interface FixtureRoundtripBusinessPair {
  source: unknown
  reExported: unknown
}

export interface FixtureRoundtripBusinessHashes {
  sourceSha256: string
  reExportedSha256: string
  equal: boolean
}

function requireCanonicalRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !isPlainObject(value)) {
    throw new Error(`expected canonical object at ${path}`)
  }
  return value
}

/**
 * Normalize the one intentional business-visible change made by project import.
 *
 * The imported name is checked as an exact relation before replacement. This is
 * pairwise on purpose: blindly trimming a suffix would hide real names that
 * already end in “（导入）”. No other field or array ordering is normalized.
 */
export function normalizeFixtureRoundtripBusinessPair(
  sourceExport: unknown,
  reExported: unknown,
): FixtureRoundtripBusinessPair {
  const source = canonicalizeFixtureValue(sourceExport, excludeRoundtripRuntimeMetadata)
  const target = canonicalizeFixtureValue(reExported, excludeRoundtripRuntimeMetadata)
  const sourceRoot = requireCanonicalRecord(source, '$source')
  const targetRoot = requireCanonicalRecord(target, '$reExported')
  const sourceProject = requireCanonicalRecord(sourceRoot.project, '$source.project')
  const targetProject = requireCanonicalRecord(targetRoot.project, '$reExported.project')
  const sourceName = sourceProject.name
  const targetName = targetProject.name

  if (typeof sourceName !== 'string' || typeof targetName !== 'string') {
    throw new Error('roundtrip project names must be strings')
  }
  const expectedTargetName = `${sourceName}${D04_IMPORT_PROJECT_NAME_SUFFIX}`
  if (targetName !== expectedTargetName) {
    throw new Error(
      `unexpected imported project name: expected ${JSON.stringify(expectedTargetName)}, got ${JSON.stringify(targetName)}`,
    )
  }

  targetProject.name = sourceName
  return { source, reExported: target }
}

export function fixtureRoundtripBusinessHashes(
  sourceExport: unknown,
  reExported: unknown,
): FixtureRoundtripBusinessHashes {
  const normalized = normalizeFixtureRoundtripBusinessPair(sourceExport, reExported)
  const sourceSha256 = fixtureSha256(normalized.source)
  const reExportedSha256 = fixtureSha256(normalized.reExported)
  return {
    sourceSha256,
    reExportedSha256,
    equal: sourceSha256 === reExportedSha256,
  }
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
