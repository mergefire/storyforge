import { describe, expect, it } from 'vitest'
import type { ArrayRef, JsonRef } from '../../src/lib/registry/types'
import {
  PortableReferenceRemapError,
  portableRefTargetTable,
  remapPortableReferenceValue,
} from '../../src/lib/export/registry-ref-remap'

const arrayRef: ArrayRef = {
  kind: 'array',
  field: 'appearingCharacterIds',
  itemTarget: 'characters',
  onDelete: 'removeItem',
  portable: { onUnmapped: 'require' },
}

const scenesRef: JsonRef = {
  kind: 'json',
  field: 'scenes',
  jsonPath: '$[].characterIds[]',
  target: 'characters[id]',
  onDelete: 'remap',
  portable: { onUnmapped: 'require' },
}

const codexRef: JsonRef = {
  kind: 'json',
  field: 'refs',
  jsonPath: '$.*',
  target: 'codexEntries[id]',
  onDelete: 'remap',
  portable: { onUnmapped: 'require' },
}

const context = {
  operation: 'export' as const,
  table: 'detailedOutlines',
  row: 0,
}

describe('AUDIT-1b portable nested reference remap helper', () => {
  it('maps native and JSON-string arrays without mutation, preserving order, duplicates and index zero', () => {
    const native = [42, 7, 42]
    const mapId = (id: number) => new Map([[42, 0], [7, 3]]).get(id)

    expect(remapPortableReferenceValue(native, arrayRef, mapId, context)).toEqual([0, 3, 0])
    expect(native).toEqual([42, 7, 42])
    expect(remapPortableReferenceValue('[42,7,42]', arrayRef, mapId, context)).toBe('[0,3,0]')
    expect(portableRefTargetTable(arrayRef)).toBe('characters')
  })

  it('maps nested scene arrays while preserving all non-reference business data', () => {
    const scenes = [
      { title: 'first', characterIds: [12, 9, 12], notes: { keep: true } },
      { title: 'second', characterIds: [] },
    ]
    const original = structuredClone(scenes)
    const remapped = remapPortableReferenceValue(
      scenes,
      scenesRef,
      id => new Map([[12, 0], [9, 5]]).get(id),
      context,
    )

    expect(remapped).toEqual([
      { title: 'first', characterIds: [0, 5, 0], notes: { keep: true } },
      { title: 'second', characterIds: [] },
    ])
    expect(scenes).toEqual(original)
    expect(portableRefTargetTable(scenesRef)).toBe('characters')
  })

  it('keeps JSON-string storage and safely preserves prototype-shaped own keys', () => {
    const encoded = '{"__proto__":[8],"constructor":[8,9],"prototype":[9]}'
    const remapped = remapPortableReferenceValue(
      encoded,
      codexRef,
      id => new Map([[8, 0], [9, 4]]).get(id),
      { ...context, table: 'codexEntries' },
    )

    expect(typeof remapped).toBe('string')
    const parsed = JSON.parse(remapped as string) as Record<string, number[]>
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true)
    expect(parsed.__proto__).toEqual([0])
    expect(parsed.constructor).toEqual([0, 4])
    expect(parsed.prototype).toEqual([4])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(portableRefTargetTable(codexRef)).toBe('codexEntries')
  })

  it('applies drop-item only to unmapped terminal items', () => {
    const droppingRef: ArrayRef = {
      ...arrayRef,
      portable: { onUnmapped: 'drop-item' },
    }
    expect(remapPortableReferenceValue(
      [1, 2, 3, 2],
      droppingRef,
      id => new Map([[1, 0], [3, 7]]).get(id),
      context,
    )).toEqual([0, 7])
  })

  it.each([
    {
      name: 'unmapped require reference',
      value: [404],
      mapper: () => undefined,
      message: 'unmapped reference id 404',
    },
    {
      name: 'negative input id',
      value: [-1],
      mapper: () => 0,
      message: 'expected a reference id',
    },
    {
      name: 'negative mapped id',
      value: [1],
      mapper: () => -1,
      message: 'mapper returned an invalid id',
    },
  ])('fails closed for $name', ({ value, mapper, message }) => {
    expect(() => remapPortableReferenceValue(value, arrayRef, mapper, context))
      .toThrowError(PortableReferenceRemapError)
    expect(() => remapPortableReferenceValue(value, arrayRef, mapper, context))
      .toThrow(message)
  })

  it('fails closed for malformed storage shapes and registry paths', () => {
    expect(() => remapPortableReferenceValue('{', arrayRef, () => 0, context))
      .toThrow('invalid JSON string')
    expect(() => remapPortableReferenceValue({}, arrayRef, () => 0, context))
      .toThrow('expected a native number[]')
    expect(() => remapPortableReferenceValue([], { ...scenesRef, jsonPath: '$..bad' }, () => 0, context))
      .toThrow('invalid JSON path')
    expect(() => portableRefTargetTable({ ...codexRef, target: 'not-a-target' }))
      .toThrow('Invalid portable JSON target')
    expect(() => portableRefTargetTable({ ...codexRef, target: 'codexEntries[name]' }))
      .toThrow('Invalid portable JSON target')
  })
})
