import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'

const HASH_PATTERN = /^[a-f0-9]{64}$/
const COMMIT_PATTERN = /^[a-f0-9]{40}$/
const FIXTURE_DEFINITIONS = Object.freeze({
  'empty-v1': Object.freeze({
    artifactKind: 'empty-database-recipe-v1',
    artifactPath: 'empty-v1.json',
  }),
  'small-v1': Object.freeze({
    artifactKind: 'project-export-v4',
    artifactPath: 'small-v1.storyforge.json',
  }),
})

function fail(message) {
  throw new Error(`invalid D0.4 fixture manifest: ${message}`)
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`)
  return value
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(requireRecord(value, label)).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys must be exactly ${wanted.join(', ')}`)
  }
}

function requireHash(value, label) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) fail(`${label} must be lowercase SHA-256`)
}

function canonicalize(
  value,
  { omitUndefinedObjectProperties },
  seen = new WeakSet(),
  currentPath = '$',
) {
  if (Array.isArray(value)) {
    if (seen.has(value)) fail(`canonical JSON contains a cycle at ${currentPath}`)
    seen.add(value)
    const result = value.map((item, index) => {
      if (item === undefined) fail(`canonical JSON contains undefined at ${currentPath}[${index}]`)
      return canonicalize(
        item,
        { omitUndefinedObjectProperties },
        seen,
        `${currentPath}[${index}]`,
      )
    })
    seen.delete(value)
    return result
  }
  if (isRecord(value)) {
    if (seen.has(value)) fail(`canonical JSON contains a cycle at ${currentPath}`)
    seen.add(value)
    const result = {}
    for (const key of Object.keys(value).sort()) {
      const child = value[key]
      if (child === undefined && omitUndefinedObjectProperties) continue
      if (child === undefined) fail(`canonical JSON contains undefined at ${currentPath}.${key}`)
      result[key] = canonicalize(
        child,
        { omitUndefinedObjectProperties },
        seen,
        `${currentPath}.${key}`,
      )
    }
    seen.delete(value)
    return result
  }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  fail(`canonical JSON contains unsupported ${value?.constructor?.name ?? typeof value} at ${currentPath}`)
}

export function canonicalFixtureManifestJson(value) {
  return `${JSON.stringify(canonicalize(
    value,
    { omitUndefinedObjectProperties: false },
  ), null, 2)}\n`
}

/**
 * Match the real JSON export boundary while failing closed on values JSON would
 * otherwise corrupt (Blob/non-plain objects, non-finite numbers and array
 * holes/undefined). Optional object properties with value undefined are the
 * one deliberate omission, matching ProjectExportData JSON serialization.
 */
export function canonicalFixtureArtifactJson(value) {
  return `${JSON.stringify(canonicalize(
    value,
    { omitUndefinedObjectProperties: true },
  ), null, 2)}\n`
}

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function buildFixtureManifest({ dataSourceCommit, generatorSourceSha256, registry, fixtures }) {
  const manifest = {
    schemaVersion: '1.0.0',
    protocolVersion: 'd0.4-v2',
    fixtureSpecVersion: 'd0.4-fixtures-v1',
    generator: {
      id: 'storyforge-d04-fixtures',
      sourceSha256: generatorSourceSha256,
      version: '1.0.0',
    },
    dataSourceCommit,
    generatedAt: '2026-01-01T00:00:00.000Z',
    registry: {
      count: registry.count,
      sourceSha256: registry.sourceSha256,
      nameSetSha256: registry.nameSetSha256,
    },
    fixtures,
  }
  validateFixtureManifest(manifest)
  return manifest
}

export function validateFixtureManifest(value) {
  const manifest = requireRecord(value, '$')
  requireExactKeys(manifest, [
    'schemaVersion',
    'protocolVersion',
    'fixtureSpecVersion',
    'generator',
    'dataSourceCommit',
    'generatedAt',
    'registry',
    'fixtures',
  ], '$')
  if (manifest.schemaVersion !== '1.0.0') fail('schemaVersion must be 1.0.0')
  if (manifest.protocolVersion !== 'd0.4-v2') fail('protocolVersion must be d0.4-v2')
  if (manifest.fixtureSpecVersion !== 'd0.4-fixtures-v1') {
    fail('fixtureSpecVersion must be d0.4-fixtures-v1')
  }
  if (manifest.generatedAt !== '2026-01-01T00:00:00.000Z') fail('generatedAt must use the frozen clock')
  if (typeof manifest.dataSourceCommit !== 'string'
    || !COMMIT_PATTERN.test(manifest.dataSourceCommit)) {
    fail('dataSourceCommit must be a full lowercase Git SHA-1')
  }

  requireExactKeys(manifest.generator, ['id', 'sourceSha256', 'version'], '$.generator')
  if (manifest.generator.id !== 'storyforge-d04-fixtures' || manifest.generator.version !== '1.0.0') {
    fail('generator identity/version is unsupported')
  }
  requireHash(manifest.generator.sourceSha256, 'generator.sourceSha256')
  requireExactKeys(manifest.registry, ['count', 'sourceSha256', 'nameSetSha256'], '$.registry')
  if (!Number.isSafeInteger(manifest.registry.count) || manifest.registry.count < 1) {
    fail('registry.count must be a positive safe integer')
  }
  requireHash(manifest.registry.sourceSha256, 'registry.sourceSha256')
  requireHash(manifest.registry.nameSetSha256, 'registry.nameSetSha256')

  if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length !== 2) {
    fail('fixtures must contain exactly empty-v1 and small-v1')
  }
  const seen = new Set()
  for (const [index, fixtureValue] of manifest.fixtures.entries()) {
    const label = `$.fixtures[${index}]`
    const fixture = requireRecord(fixtureValue, label)
    requireExactKeys(fixture, [
      'id',
      'required',
      'status',
      'artifactKind',
      'artifactPath',
      'byteLength',
      'sha256',
      'businessSha256',
      'logicalCounts',
      'assertions',
    ], label)
    const definition = FIXTURE_DEFINITIONS[fixture.id]
    if (!definition || seen.has(fixture.id)) fail(`${label}.id is unknown or duplicated`)
    seen.add(fixture.id)
    if (fixture.required !== true || fixture.status !== 'GENERATED_VALID') {
      fail(`${label} must be required and GENERATED_VALID`)
    }
    if (fixture.artifactKind !== definition.artifactKind) fail(`${label}.artifactKind is invalid`)
    if (fixture.artifactPath !== definition.artifactPath
      || path.isAbsolute(fixture.artifactPath)
      || fixture.artifactPath.includes('\\')
      || fixture.artifactPath.includes('..')) {
      fail(`${label}.artifactPath is not allow-listed`)
    }
    if (!Number.isSafeInteger(fixture.byteLength) || fixture.byteLength < 1) {
      fail(`${label}.byteLength must be a positive safe integer`)
    }
    requireHash(fixture.sha256, `${label}.sha256`)
    requireHash(fixture.businessSha256, `${label}.businessSha256`)
    const logicalCounts = requireRecord(fixture.logicalCounts, `${label}.logicalCounts`)
    if (Object.keys(logicalCounts).length < 1) fail(`${label}.logicalCounts must not be empty`)
    for (const [name, count] of Object.entries(logicalCounts)) {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)
        || !Number.isSafeInteger(count)
        || count < 0) {
        fail(`${label}.logicalCounts contains an invalid entry`)
      }
    }
    if (!Array.isArray(fixture.assertions) || fixture.assertions.length < 1) {
      fail(`${label}.assertions must not be empty`)
    }
    const assertionIds = new Set()
    for (const [assertionIndex, assertionValue] of fixture.assertions.entries()) {
      const assertionLabel = `${label}.assertions[${assertionIndex}]`
      const assertion = requireRecord(assertionValue, assertionLabel)
      requireExactKeys(assertion, ['id', 'status'], assertionLabel)
      if (typeof assertion.id !== 'string'
        || !/^[A-Z][A-Z0-9-]+$/.test(assertion.id)
        || assertionIds.has(assertion.id)
        || assertion.status !== 'PASS') {
        fail(`${assertionLabel} must have a unique ID and PASS status`)
      }
      assertionIds.add(assertion.id)
    }
  }
  if (seen.size !== Object.keys(FIXTURE_DEFINITIONS).length) fail('fixture coverage is incomplete')
  return manifest
}

function readCanonicalArtifact(filePath) {
  const stat = fs.lstatSync(filePath)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${path.basename(filePath)} must be a regular file`)
  const bytes = fs.readFileSync(filePath)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    fail(`${path.basename(filePath)} must not contain a UTF-8 BOM`)
  }
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    fail(`${path.basename(filePath)} is not valid UTF-8`)
  }
  if (text.includes('\r') || !text.endsWith('\n') || text.endsWith('\n\n')) {
    fail(`${path.basename(filePath)} must use LF and exactly one trailing newline`)
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    fail(`${path.basename(filePath)} is not valid JSON`)
  }
  if (canonicalFixtureManifestJson(parsed) !== text) {
    fail(`${path.basename(filePath)} is not canonical JSON`)
  }
  return { bytes, parsed }
}

export function verifyFixtureManifest({ manifest: value, fixtureRoot }) {
  const manifest = validateFixtureManifest(value)
  const resolvedRoot = path.resolve(fixtureRoot)
  if (!fs.statSync(resolvedRoot).isDirectory()) fail('fixtureRoot must be a directory')
  for (const fixture of manifest.fixtures) {
    const filePath = path.resolve(resolvedRoot, fixture.artifactPath)
    if (path.dirname(filePath) !== resolvedRoot) fail(`${fixture.id} escaped fixtureRoot`)
    const { bytes, parsed } = readCanonicalArtifact(filePath)
    if (bytes.length !== fixture.byteLength) fail(`${fixture.id} byteLength mismatch`)
    if (sha256Bytes(bytes) !== fixture.sha256) fail(`${fixture.id} SHA-256 mismatch`)
    if (fixture.id === 'empty-v1') {
      if (parsed.fixtureId !== 'empty-v1'
        || parsed.artifactKind !== 'empty-database-recipe-v1'
        || Object.values(parsed.tableCounts ?? {}).some(count => count !== 0)) {
        fail('empty-v1 artifact semantics are invalid')
      }
    } else if (parsed.version !== 4 || parsed.nestedRefEncoding !== 'export-index-v1') {
      fail('small-v1 must be project export v4 with export-index-v1')
    }
  }
  return manifest
}
