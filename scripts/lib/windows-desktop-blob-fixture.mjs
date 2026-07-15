import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const BLOB_CHUNK_BYTES = 1024 * 1024
export const BLOB_LADDER_SEED = 'storyforge-windows-d0.4-blob-ladder-v1'

export const BLOB_LADDER_SIZES = Object.freeze([
  Object.freeze({ id: 'blob-10m', bytes: 10 * BLOB_CHUNK_BYTES, explicitOptIn: false }),
  Object.freeze({ id: 'blob-100m', bytes: 100 * BLOB_CHUNK_BYTES, explicitOptIn: false }),
  Object.freeze({ id: 'blob-500m', bytes: 500 * BLOB_CHUNK_BYTES, explicitOptIn: false }),
  Object.freeze({ id: 'blob-1g', bytes: 1024 * BLOB_CHUNK_BYTES, explicitOptIn: true }),
])

const HASH_PATTERN = /^[a-f0-9]{64}$/
const PATTERN_BYTES = 64 * 1024

function requireSize(size) {
  if (!BLOB_LADDER_SIZES.some(candidate => candidate.id === size.id
    && candidate.bytes === size.bytes
    && candidate.explicitOptIn === size.explicitOptIn)) {
    throw new Error('blob size must be one of the frozen D0.4 ladder entries')
  }
}

function chunkSeed(sizeId, chunkIndex) {
  const digest = createHash('sha256')
    .update(`${BLOB_LADDER_SEED}\0${sizeId}\0${chunkIndex}`, 'utf8')
    .digest()
  const seed = digest.readUInt32LE(0)
  return seed === 0 ? 0x9e3779b9 : seed
}

function nextXorshift32(state) {
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return value >>> 0
}

/**
 * Build exactly one chunk. The 64 KiB deterministic pattern is copied into a
 * 1 MiB buffer, so even the 1 GiB fixture never requires a 1 GiB allocation.
 */
export function createDeterministicBlobChunk(size, chunkIndex) {
  requireSize(size)
  const chunkCount = size.bytes / BLOB_CHUNK_BYTES
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= chunkCount) {
    throw new Error('blob chunk index is outside the selected ladder entry')
  }

  const chunk = Buffer.allocUnsafe(BLOB_CHUNK_BYTES)
  let state = chunkSeed(size.id, chunkIndex)
  for (let offset = 0; offset < PATTERN_BYTES; offset += 4) {
    state = nextXorshift32(state)
    chunk.writeUInt32LE(state, offset)
  }

  for (let offset = PATTERN_BYTES; offset < chunk.length; offset += PATTERN_BYTES) {
    chunk.copy(chunk, offset, 0, PATTERN_BYTES)
  }
  return chunk
}

export function hashDeterministicBlob(size, { includeOneGiB = false } = {}) {
  requireSize(size)
  if (size.explicitOptIn && !includeOneGiB) {
    throw new Error('1 GiB blob hashing requires explicit includeOneGiB opt-in')
  }
  const hash = createHash('sha256')
  const chunkCount = size.bytes / BLOB_CHUNK_BYTES
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    hash.update(createDeterministicBlobChunk(size, chunkIndex))
  }
  return hash.digest('hex')
}

export function buildBlobLadderRecipe({ includeOneGiB, lockedOneGiBSha256 = null }) {
  if (typeof includeOneGiB !== 'boolean') throw new Error('includeOneGiB must be boolean')
  if (!includeOneGiB && !HASH_PATTERN.test(lockedOneGiBSha256 ?? '')) {
    throw new Error('ordinary blob recipe rebuild requires the locked 1 GiB SHA-256')
  }

  return {
    schemaVersion: '1.0.0',
    fixtureId: 'blob-ladder-v1',
    artifactKind: 'streamed-blob-recipe-v1',
    seed: BLOB_LADDER_SEED,
    chunkBytes: BLOB_CHUNK_BYTES,
    peakGeneratedBytes: BLOB_CHUNK_BYTES,
    ordinaryCiIncludesOneGiB: false,
    sizes: BLOB_LADDER_SIZES.map(size => ({
      id: size.id,
      bytes: size.bytes,
      chunkCount: size.bytes / BLOB_CHUNK_BYTES,
      explicitOptIn: size.explicitOptIn,
      sha256: size.explicitOptIn && !includeOneGiB
        ? lockedOneGiBSha256
        : hashDeterministicBlob(size, { includeOneGiB }),
    })),
  }
}

export function validateBlobLadderRecipe(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('blob ladder recipe must be an object')
  }
  const expectedRootKeys = [
    'artifactKind',
    'chunkBytes',
    'fixtureId',
    'ordinaryCiIncludesOneGiB',
    'peakGeneratedBytes',
    'schemaVersion',
    'seed',
    'sizes',
  ].sort()
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expectedRootKeys)) {
    throw new Error('blob ladder recipe root keys are not exact')
  }
  if (value.schemaVersion !== '1.0.0'
    || value.fixtureId !== 'blob-ladder-v1'
    || value.artifactKind !== 'streamed-blob-recipe-v1'
    || value.seed !== BLOB_LADDER_SEED
    || value.chunkBytes !== BLOB_CHUNK_BYTES
    || value.peakGeneratedBytes !== BLOB_CHUNK_BYTES
    || value.ordinaryCiIncludesOneGiB !== false) {
    throw new Error('blob ladder recipe frozen metadata is invalid')
  }
  if (!Array.isArray(value.sizes) || value.sizes.length !== BLOB_LADDER_SIZES.length) {
    throw new Error('blob ladder recipe sizes are incomplete')
  }
  for (const [index, expected] of BLOB_LADDER_SIZES.entries()) {
    const actual = value.sizes[index]
    const keys = actual && typeof actual === 'object' && !Array.isArray(actual)
      ? Object.keys(actual).sort()
      : []
    if (JSON.stringify(keys) !== JSON.stringify([
      'bytes',
      'chunkCount',
      'explicitOptIn',
      'id',
      'sha256',
    ].sort())
      || actual.id !== expected.id
      || actual.bytes !== expected.bytes
      || actual.chunkCount !== expected.bytes / BLOB_CHUNK_BYTES
      || actual.explicitOptIn !== expected.explicitOptIn
      || !HASH_PATTERN.test(actual.sha256)) {
      throw new Error(`blob ladder recipe entry ${expected.id} is invalid`)
    }
  }
  return value
}

export function materializeBlobLadder({ outputDirectory, includeOneGiB }) {
  if (!path.isAbsolute(outputDirectory)) throw new Error('blob output directory must be absolute')
  if (fs.existsSync(outputDirectory)) throw new Error('refusing to overwrite blob output directory')
  fs.mkdirSync(outputDirectory, { recursive: true })

  const selected = BLOB_LADDER_SIZES.filter(size => includeOneGiB || !size.explicitOptIn)
  const results = []
  try {
    for (const size of selected) {
      const filePath = path.join(outputDirectory, `${size.id}.bin`)
      const descriptor = fs.openSync(filePath, 'wx')
      const hash = createHash('sha256')
      try {
        for (let chunkIndex = 0; chunkIndex < size.bytes / BLOB_CHUNK_BYTES; chunkIndex += 1) {
          const chunk = createDeterministicBlobChunk(size, chunkIndex)
          fs.writeSync(descriptor, chunk)
          hash.update(chunk)
        }
      } finally {
        fs.closeSync(descriptor)
      }
      results.push({
        id: size.id,
        bytes: fs.statSync(filePath).size,
        path: filePath,
        sha256: hash.digest('hex'),
      })
    }
  } catch (error) {
    fs.rmSync(outputDirectory, { recursive: true, force: true })
    throw error
  }
  return results
}
