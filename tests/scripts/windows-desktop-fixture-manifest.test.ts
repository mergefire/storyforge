import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  buildFixtureManifest,
  canonicalFixtureArtifactJson,
  canonicalFixtureManifestJson,
  validateFixtureManifest,
  verifyFixtureManifest,
} from '../../scripts/lib/windows-desktop-fixture-manifest.mjs'

const temporaryDirectories: string[] = []

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'storyforge-d04-manifest-'))
  temporaryDirectories.push(root)
  const emptyText = canonicalFixtureManifestJson({
    artifactKind: 'empty-database-recipe-v1',
    fixtureId: 'empty-v1',
    tableCounts: { projects: 0 },
  })
  const smallText = canonicalFixtureManifestJson({
    nestedRefEncoding: 'export-index-v1',
    project: { name: 'fixture' },
    version: 4,
  })
  fs.writeFileSync(path.join(root, 'empty-v1.json'), emptyText, 'utf8')
  fs.writeFileSync(path.join(root, 'small-v1.storyforge.json'), smallText, 'utf8')
  const fixtures = [
    {
      id: 'empty-v1',
      required: true,
      status: 'GENERATED_VALID',
      artifactKind: 'empty-database-recipe-v1',
      artifactPath: 'empty-v1.json',
      byteLength: Buffer.byteLength(emptyText),
      sha256: sha256(emptyText),
      businessSha256: sha256(emptyText),
      logicalCounts: { projects: 0 },
      assertions: [{ id: 'EMPTY-ALL-ZERO', status: 'PASS' }],
    },
    {
      id: 'small-v1',
      required: true,
      status: 'GENERATED_VALID',
      artifactKind: 'project-export-v4',
      artifactPath: 'small-v1.storyforge.json',
      byteLength: Buffer.byteLength(smallText),
      sha256: sha256(smallText),
      businessSha256: sha256(smallText),
      logicalCounts: { projects: 1 },
      assertions: [{ id: 'SMALL-ROUNDTRIP', status: 'PASS' }],
    },
  ]
  const manifest = buildFixtureManifest({
    dataSourceCommit: 'a'.repeat(40),
    generatorSourceSha256: 'd'.repeat(64),
    registry: {
      count: 42,
      sourceSha256: 'b'.repeat(64),
      nameSetSha256: 'c'.repeat(64),
    },
    fixtures,
  })
  return { root, manifest }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('D0.4 fixture manifest', () => {
  it('verifies the exact allow-listed artifacts, hashes and semantic markers', () => {
    const { root, manifest } = makeFixtureRoot()
    expect(() => validateFixtureManifest(manifest)).not.toThrow()
    expect(() => verifyFixtureManifest({ manifest, fixtureRoot: root })).not.toThrow()
  })

  it('fails closed on unknown fields, traversal and non-PASS assertions', () => {
    const { manifest } = makeFixtureRoot()
    expect(() => validateFixtureManifest({ ...manifest, surprise: true })).toThrow('keys must be exactly')

    const traversal = structuredClone(manifest)
    traversal.fixtures[0].artifactPath = '../empty-v1.json'
    expect(() => validateFixtureManifest(traversal)).toThrow('artifactPath is not allow-listed')

    const failedAssertion = structuredClone(manifest)
    failedAssertion.fixtures[1].assertions[0].status = 'FAIL'
    expect(() => validateFixtureManifest(failedAssertion)).toThrow('PASS status')
  })

  it('detects artifact tampering, BOM and non-canonical JSON', () => {
    const tampered = makeFixtureRoot()
    fs.appendFileSync(path.join(tampered.root, 'small-v1.storyforge.json'), ' ')
    expect(() => verifyFixtureManifest({
      manifest: tampered.manifest,
      fixtureRoot: tampered.root,
    })).toThrow()

    const bom = makeFixtureRoot()
    const emptyPath = path.join(bom.root, 'empty-v1.json')
    fs.writeFileSync(emptyPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(emptyPath)]))
    expect(() => verifyFixtureManifest({
      manifest: bom.manifest,
      fixtureRoot: bom.root,
    })).toThrow('must not contain a UTF-8 BOM')

    const crlf = makeFixtureRoot()
    const smallPath = path.join(crlf.root, 'small-v1.storyforge.json')
    fs.writeFileSync(smallPath, fs.readFileSync(smallPath, 'utf8').replace(/\n/g, '\r\n'))
    expect(() => verifyFixtureManifest({
      manifest: crlf.manifest,
      fixtureRoot: crlf.root,
    })).toThrow('must use LF')
  })

  it('fails before serialization on values that JSON would silently corrupt', () => {
    expect(() => canonicalFixtureArtifactJson({ payload: new Blob(['bytes']) })).toThrow(
      'unsupported Blob',
    )
    expect(() => canonicalFixtureArtifactJson({ payload: Number.NaN })).toThrow(
      'unsupported Number',
    )
    expect(() => canonicalFixtureArtifactJson({ payload: [undefined] })).toThrow(
      'contains undefined',
    )
    expect(() => canonicalFixtureArtifactJson({ payload: 1n })).toThrow(
      'unsupported BigInt',
    )
    expect(canonicalFixtureArtifactJson({ optional: undefined, value: 1 })).toBe(
      '{\n  "value": 1\n}\n',
    )
  })
})
