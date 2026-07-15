import { describe, expect, it } from 'vitest'

import { canonicalMigrationJson } from '../../src/lib/migration/canonical-hash'
import { decodeMigrationValue, encodeMigrationValue } from '../../src/lib/migration/value-codec'

describe('M2 deterministic migration value codec', () => {
  it('round-trips browser-native values and externalizes Blob bytes', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 255])], { type: 'application/octet-stream' })
    const value = {
      z: undefined,
      date: new Date('2026-01-02T03:04:05.000Z'),
      numbers: [NaN, Infinity, -Infinity, -0],
      buffer: new Uint8Array([4, 5, 6]).buffer,
      typed: new Int16Array([7, -8]),
      blob,
    }
    const blobs = new Map<string, Blob>()
    const encodeBlob = async (candidate: Blob) => {
      blobs.set('blobs/fixture.bin', candidate)
      return { file: 'blobs/fixture.bin', size: candidate.size, mimeType: candidate.type }
    }

    const first = await encodeMigrationValue(value, encodeBlob)
    const second = await encodeMigrationValue(value, encodeBlob)
    expect(canonicalMigrationJson(first)).toBe(canonicalMigrationJson(second))

    const decoded = decodeMigrationValue(first, (file, size, mimeType) => {
      const candidate = blobs.get(file)
      if (!candidate || candidate.size !== size || candidate.type !== mimeType) throw new Error('bad Blob ref')
      return candidate
    }) as typeof value
    expect(decoded.date.toISOString()).toBe(value.date.toISOString())
    expect(decoded.z).toBeUndefined()
    expect(Number.isNaN(decoded.numbers[0])).toBe(true)
    expect(decoded.numbers.slice(1, 3)).toEqual([Infinity, -Infinity])
    expect(Object.is(decoded.numbers[3], -0)).toBe(true)
    expect([...new Uint8Array(decoded.buffer)]).toEqual([4, 5, 6])
    expect([...decoded.typed]).toEqual([7, -8])
    expect([...new Uint8Array(await decoded.blob.arrayBuffer())]).toEqual([1, 2, 3, 255])
  })

  it('rejects cyclic, sparse and executable values', async () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const noBlob = async () => ({ file: '', size: 0, mimeType: '' })
    const sparse = new Array<unknown>(2)
    sparse[1] = 1

    await expect(encodeMigrationValue(cyclic, noBlob)).rejects.toThrow('cyclic')
    await expect(encodeMigrationValue(sparse, noBlob)).rejects.toThrow('sparse')
    await expect(encodeMigrationValue({ callback: () => undefined }, noBlob)).rejects.toThrow('function')
  })
})
