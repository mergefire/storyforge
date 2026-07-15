#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

import {
  buildBlobLadderRecipe,
  materializeBlobLadder,
  validateBlobLadderRecipe,
} from './lib/windows-desktop-blob-fixture.mjs'
import {
  buildFixtureManifest,
  validateFixtureManifest,
  verifyFixtureManifest,
} from './lib/windows-desktop-fixture-manifest.mjs'
import { readRegistryFacts } from './windows-desktop-baseline.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const fixtureRoot = path.join(
  repoRoot,
  'tests',
  'fixtures',
  'windows-desktop',
  'd0.4-v1',
)
const artifactNames = Object.freeze([
  'empty-v1.json',
  'small-v1.storyforge.json',
  'large-synthetic-v1.storyforge.json',
  'blob-ladder-v1.json',
  'legacy-matrix-v1.json',
  'fixture-manifest.json',
])
const generatorSourceFiles = Object.freeze([
  'scripts/lib/windows-desktop-blob-fixture.mjs',
  'scripts/lib/windows-desktop-fixture-manifest.mjs',
  'scripts/windows-desktop-fixtures-runtime.ts',
  'scripts/windows-desktop-fixtures.mjs',
  'tests/helpers/d04-fixture-kit.ts',
  'tests/helpers/d04-reference-integrity.ts',
  'tests/helpers/seed-full-project.ts',
  'tests/helpers/seed-large-synthetic-project.ts',
])

function sha256Utf8(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function generatorSourceSha256() {
  const hash = createHash('sha256')
  for (const relativePath of generatorSourceFiles) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
      .replace(/\r\n?/g, '\n')
    hash.update(relativePath, 'utf8')
    hash.update('\0', 'utf8')
    hash.update(source, 'utf8')
    hash.update('\0', 'utf8')
  }
  return hash.digest('hex')
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalize(value[key])]),
    )
  }
  return value
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value), null, 2) + '\n'
}

async function loadRuntime() {
  const vite = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
    root: repoRoot,
    server: { middlewareMode: true },
  })
  try {
    const module = await vite.ssrLoadModule('/scripts/windows-desktop-fixtures-runtime.ts')
    return await module.buildD04FixtureRuntimeBundle()
  } finally {
    await vite.close()
  }
}

function buildFiles(runtime, dataSourceCommit, { includeOneGiB, lockedOneGiBSha256 = null }) {
  const registry = readRegistryFacts()
  const runtimeArtifacts = [
    ['empty-v1', runtime.empty],
    ['small-v1', runtime.small],
    ['large-synthetic-v1', runtime.large],
    ['legacy-matrix-v1', runtime.legacy],
  ]
  const artifactEntries = runtimeArtifacts.map(([id, artifact]) => ({
    id,
    required: true,
    status: 'GENERATED_VALID',
    artifactKind: artifact.artifactKind,
    artifactPath: artifact.artifactPath,
    byteLength: Buffer.byteLength(artifact.text, 'utf8'),
    sha256: sha256Utf8(artifact.text),
    businessSha256: artifact.businessSha256,
    logicalCounts: artifact.logicalCounts,
    assertions: artifact.assertions,
  }))
  const blobRecipe = buildBlobLadderRecipe({ includeOneGiB, lockedOneGiBSha256 })
  validateBlobLadderRecipe(blobRecipe)
  const blobText = canonicalJson(blobRecipe)
  artifactEntries.splice(3, 0, {
    id: 'blob-ladder-v1',
    required: true,
    status: 'GENERATED_VALID',
    artifactKind: 'streamed-blob-recipe-v1',
    artifactPath: 'blob-ladder-v1.json',
    byteLength: Buffer.byteLength(blobText, 'utf8'),
    sha256: sha256Utf8(blobText),
    businessSha256: sha256Utf8(canonicalJson(blobRecipe.sizes)),
    logicalCounts: {
      sizes: blobRecipe.sizes.length,
      chunks: blobRecipe.sizes.reduce((total, entry) => total + entry.chunkCount, 0),
      totalBytes: blobRecipe.sizes.reduce((total, entry) => total + entry.bytes, 0),
    },
    assertions: [
      { id: 'BLOB-ONE-MIB-STREAMING-CHUNKS', status: 'PASS' },
      { id: 'BLOB-RAW-BYTE-HASHES-LOCKED', status: 'PASS' },
      { id: 'BLOB-ONE-GIB-EXPLICIT-OPT-IN', status: 'PASS' },
    ],
  })
  const manifest = buildFixtureManifest({
    dataSourceCommit,
    generatorSourceSha256: generatorSourceSha256(),
    registry,
    fixtures: artifactEntries,
  })
  validateFixtureManifest(manifest)
  return new Map([
    ['empty-v1.json', runtime.empty.text],
    ['small-v1.storyforge.json', runtime.small.text],
    ['large-synthetic-v1.storyforge.json', runtime.large.text],
    ['blob-ladder-v1.json', blobText],
    ['legacy-matrix-v1.json', runtime.legacy.text],
    ['fixture-manifest.json', canonicalJson(manifest)],
  ])
}

function assertExactFiles(directory, expectedFiles) {
  const actual = fs.readdirSync(directory, { withFileTypes: true })
  if (actual.some(entry => !entry.isFile())) {
    throw new Error('fixture directory may contain regular files only')
  }
  const actualNames = actual.map(entry => entry.name).sort()
  const expectedNames = [...expectedFiles].sort()
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `fixture directory file set is stale: expected ${expectedNames.join(', ')}, got ${actualNames.join(', ')}`,
    )
  }
}

function compareCommittedFiles(expected) {
  assertExactFiles(fixtureRoot, artifactNames)
  for (const [name, expectedText] of expected) {
    const actual = fs.readFileSync(path.join(fixtureRoot, name), 'utf8')
    if (actual !== expectedText) throw new Error(`${name} is stale; regenerate D0.4 fixtures`)
  }
}

function parseArguments(argv) {
  const [command, ...rest] = argv
  if (command === 'check') {
    if (rest.length !== 0) throw new Error('check does not accept arguments')
    return { command }
  }
  if (command === 'generate' || command === 'refresh') {
    if (rest.length !== 3
      || rest[0] !== '--data-source-commit'
      || !/^[a-f0-9]{40}$/.test(rest[1])
      || rest[2] !== '--include-1g') {
      throw new Error(`${command} requires --data-source-commit 40hex --include-1g`)
    }
    return { command, dataSourceCommit: rest[1], includeOneGiB: true }
  }
  if (command === 'verify-blobs') {
    if (rest.length !== 1 || rest[0] !== '--include-1g') {
      throw new Error('verify-blobs requires the explicit --include-1g opt-in')
    }
    return { command, includeOneGiB: true }
  }
  if (command === 'materialize-blobs') {
    if ((rest.length !== 2 && rest.length !== 3)
      || rest[0] !== '--output'
      || (rest.length === 3 && rest[2] !== '--include-1g')) {
      throw new Error('materialize-blobs requires --output ABSOLUTE_PATH [--include-1g]')
    }
    return { command, outputDirectory: rest[1], includeOneGiB: rest.length === 3 }
  }
  throw new Error(
    'usage: windows-desktop-fixtures.mjs <check|generate|refresh|verify-blobs|materialize-blobs>',
  )
}

function committedBlobRecipe() {
  const value = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'blob-ladder-v1.json'), 'utf8'))
  return validateBlobLadderRecipe(value)
}

function committedOneGiBSha256() {
  const entry = committedBlobRecipe().sizes.find(size => size.id === 'blob-1g')
  if (!entry) throw new Error('blob-ladder-v1 is missing the 1 GiB entry')
  return entry.sha256
}

async function writeFixtureSet(dataSourceCommit, { refresh }) {
  if (!refresh && fs.existsSync(fixtureRoot)) {
    throw new Error(`refusing to overwrite existing fixture version: ${fixtureRoot}`)
  }
  if (refresh) {
    const current = fs.readdirSync(fixtureRoot).sort()
    const prior = ['empty-v1.json', 'fixture-manifest.json', 'small-v1.storyforge.json'].sort()
    const complete = [...artifactNames].sort()
    if (JSON.stringify(current) !== JSON.stringify(prior)
      && JSON.stringify(current) !== JSON.stringify(complete)) {
      throw new Error('refusing to refresh an unexpected fixture directory file set')
    }
  }
  const runtime = await loadRuntime()
  const files = buildFiles(runtime, dataSourceCommit, { includeOneGiB: true })
  const parent = path.dirname(fixtureRoot)
  fs.mkdirSync(parent, { recursive: true })
  const temporary = fs.mkdtempSync(path.join(parent, '.d0.4-v1-'))
  try {
    for (const [name, text] of files) {
      fs.writeFileSync(path.join(temporary, name), text, { encoding: 'utf8', flag: 'wx' })
    }
    assertExactFiles(temporary, artifactNames)
    const manifest = JSON.parse(fs.readFileSync(path.join(temporary, 'fixture-manifest.json'), 'utf8'))
    verifyFixtureManifest({ manifest, fixtureRoot: temporary })
    if (refresh) {
      for (const name of artifactNames) {
        fs.copyFileSync(path.join(temporary, name), path.join(fixtureRoot, name))
      }
      assertExactFiles(fixtureRoot, artifactNames)
      fs.rmSync(temporary, { recursive: true, force: true })
    } else {
      fs.renameSync(temporary, fixtureRoot)
    }
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true })
    throw error
  }
  console.log(`${refresh ? 'Refreshed' : 'Generated'} deterministic D0.4 fixtures at ${fixtureRoot}`)
}

async function check() {
  const manifestPath = path.join(fixtureRoot, 'fixture-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  validateFixtureManifest(manifest)
  verifyFixtureManifest({ manifest, fixtureRoot })
  const runtime = await loadRuntime()
  const expected = buildFiles(runtime, manifest.dataSourceCommit, {
    includeOneGiB: false,
    lockedOneGiBSha256: committedOneGiBSha256(),
  })
  compareCommittedFiles(expected)
  console.log('D0.4 committed fixture artifacts are valid and reproducible')
}

function verifyBlobs() {
  const committed = committedBlobRecipe()
  const rebuilt = buildBlobLadderRecipe({ includeOneGiB: true })
  if (canonicalJson(committed) !== canonicalJson(rebuilt)) {
    throw new Error('blob-ladder-v1 differs from explicit full-ladder reconstruction')
  }
  console.log('D0.4 full blob ladder, including 1 GiB, is reproducible')
}

function materializeBlobs(outputDirectory, includeOneGiB) {
  const committed = committedBlobRecipe()
  const expected = new Map(committed.sizes.map(size => [size.id, size.sha256]))
  const results = materializeBlobLadder({
    outputDirectory: path.resolve(outputDirectory),
    includeOneGiB,
  })
  for (const result of results) {
    if (result.sha256 !== expected.get(result.id)) {
      throw new Error(`${result.id} materialized hash differs from blob-ladder-v1`)
    }
  }
  console.log(JSON.stringify(results, null, 2))
}

const parsed = parseArguments(process.argv.slice(2))
if (parsed.command === 'generate') {
  await writeFixtureSet(parsed.dataSourceCommit, { refresh: false })
} else if (parsed.command === 'refresh') {
  await writeFixtureSet(parsed.dataSourceCommit, { refresh: true })
} else if (parsed.command === 'check') {
  await check()
} else if (parsed.command === 'verify-blobs') {
  verifyBlobs()
} else {
  materializeBlobs(parsed.outputDirectory, parsed.includeOneGiB)
}
