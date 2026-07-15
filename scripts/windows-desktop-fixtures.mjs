#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

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
  'fixture-manifest.json',
])
const generatorSourceFiles = Object.freeze([
  'scripts/lib/windows-desktop-fixture-manifest.mjs',
  'scripts/windows-desktop-fixtures-runtime.ts',
  'scripts/windows-desktop-fixtures.mjs',
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

function buildFiles(runtime, dataSourceCommit) {
  const registry = readRegistryFacts()
  const artifactEntries = [runtime.empty, runtime.small].map(artifact => ({
    id: artifact.artifactPath === 'empty-v1.json' ? 'empty-v1' : 'small-v1',
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
  if (!['generate', 'check'].includes(command)) {
    throw new Error('usage: windows-desktop-fixtures.mjs <generate --data-source-commit 40hex|check>')
  }
  if (command === 'check') {
    if (rest.length !== 0) throw new Error('check does not accept arguments')
    return { command, dataSourceCommit: null }
  }
  if (rest.length !== 2
    || rest[0] !== '--data-source-commit'
    || !/^[a-f0-9]{40}$/.test(rest[1])) {
    throw new Error('generate requires --data-source-commit followed by a full lowercase Git SHA-1')
  }
  return { command, dataSourceCommit: rest[1] }
}

async function generate(dataSourceCommit) {
  if (fs.existsSync(fixtureRoot)) {
    throw new Error(`refusing to overwrite existing fixture version: ${fixtureRoot}`)
  }
  const runtime = await loadRuntime()
  const files = buildFiles(runtime, dataSourceCommit)
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
    fs.renameSync(temporary, fixtureRoot)
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true })
    throw error
  }
  console.log(`Generated deterministic D0.4 fixtures at ${fixtureRoot}`)
}

async function check() {
  const manifestPath = path.join(fixtureRoot, 'fixture-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  validateFixtureManifest(manifest)
  verifyFixtureManifest({ manifest, fixtureRoot })
  const runtime = await loadRuntime()
  const expected = buildFiles(runtime, manifest.dataSourceCommit)
  compareCommittedFiles(expected)
  console.log('D0.4 committed fixture artifacts are valid and reproducible')
}

const { command, dataSourceCommit } = parseArguments(process.argv.slice(2))
if (command === 'generate') await generate(dataSourceCommit)
else await check()
