import { db } from '../../src/lib/db/schema'
import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'

type Row = Record<string, unknown>

function parseTarget(target: string): { table: string; field: string } {
  const match = /^([A-Za-z][A-Za-z0-9]*)\[([A-Za-z][A-Za-z0-9]*)\]$/.exec(target)
  if (!match) throw new Error(`registered reference target is malformed: ${target}`)
  return { table: match[1], field: match[2] }
}

function parseJsonField(value: unknown, label: string): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label} contains invalid JSON`)
  }
}

function valuesAtRegisteredPath(value: unknown, path: string, label: string): unknown[] {
  const root = parseJsonField(value, label)
  if (path === '$[].targetWorldId') {
    if (!Array.isArray(root)) throw new Error(`${label} must be an array for ${path}`)
    return root.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`${label}[${index}] must be an object`)
      }
      return (entry as Row).targetWorldId
    })
  }
  if (path === '$[].characterIds[]') {
    if (!Array.isArray(root)) throw new Error(`${label} must be an array for ${path}`)
    return root.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`${label}[${index}] must be an object`)
      }
      const ids = (entry as Row).characterIds
      if (!Array.isArray(ids)) throw new Error(`${label}[${index}].characterIds must be an array`)
      return ids
    })
  }
  if (path === '$.*') {
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
      throw new Error(`${label} must be an object for ${path}`)
    }
    return Object.values(root).flatMap(entry => Array.isArray(entry) ? entry : [entry])
  }
  throw new Error(`reference validator does not understand registered JSON path ${path}`)
}

function requireExisting(
  value: unknown,
  allowed: ReadonlySet<unknown>,
  label: string,
): void {
  if (value === undefined || value === null) return
  if (!allowed.has(value)) throw new Error(`${label} has dangling reference ${String(value)}`)
}

/**
 * Validate every reference shape declared by PROJECT_TABLES against the live
 * fixture database. The validator intentionally has no maintained table list.
 */
export async function assertRegisteredReferenceIntegrity(): Promise<void> {
  const rowsByTable = new Map<string, Row[]>()
  for (const spec of PROJECT_TABLES) {
    rowsByTable.set(spec.name, await db.table(spec.name).toArray() as Row[])
  }

  const valuesFor = (table: string, field: string): Set<unknown> => {
    const rows = rowsByTable.get(table)
    if (!rows) throw new Error(`registered reference uses unknown table ${table}`)
    return new Set(rows.map(row => row[field]).filter(value => value !== undefined && value !== null))
  }

  for (const spec of PROJECT_TABLES) {
    const sourceRows = rowsByTable.get(spec.name) ?? []

    for (const remap of spec.exportRemap ?? []) {
      const allowed = valuesFor(remap.remapVia, 'id')
      for (const [index, row] of sourceRows.entries()) {
        requireExisting(row[remap.field], allowed, `${spec.name}[${index}].${remap.field}`)
      }
    }

    for (const ref of spec.refs ?? []) {
      if (ref.kind === 'simple') {
        const target = parseTarget(ref.target)
        const allowed = valuesFor(spec.name, ref.field)
        for (const [index, row] of (rowsByTable.get(target.table) ?? []).entries()) {
          requireExisting(row[target.field], allowed, `${target.table}[${index}].${target.field}`)
        }
      } else if (ref.kind === 'array') {
        const allowed = valuesFor(ref.itemTarget, 'id')
        for (const [index, row] of sourceRows.entries()) {
          const parsed = parseJsonField(row[ref.field], `${spec.name}[${index}].${ref.field}`)
          if (parsed === undefined || parsed === null) continue
          if (!Array.isArray(parsed)) {
            throw new Error(`${spec.name}[${index}].${ref.field} must be an array`)
          }
          parsed.forEach((value, itemIndex) => requireExisting(
            value,
            allowed,
            `${spec.name}[${index}].${ref.field}[${itemIndex}]`,
          ))
        }
      } else if (ref.kind === 'json') {
        const target = parseTarget(ref.target)
        const allowed = valuesFor(target.table, target.field)
        for (const [index, row] of sourceRows.entries()) {
          const fieldValue = row[ref.field]
          if (fieldValue === undefined || fieldValue === null || fieldValue === '') continue
          valuesAtRegisteredPath(
            fieldValue,
            ref.jsonPath,
            `${spec.name}[${index}].${ref.field}`,
          ).forEach((value, valueIndex) => requireExisting(
            value,
            allowed,
            `${spec.name}[${index}].${ref.field}#${valueIndex}`,
          ))
        }
      } else if (ref.kind === 'indirect') {
        const allowed = valuesFor(ref.via.table, 'id')
        for (const [index, row] of sourceRows.entries()) {
          requireExisting(row[ref.via.field], allowed, `${spec.name}[${index}].${ref.via.field}`)
        }
      } else if (ref.kind === 'blob-owner') {
        throw new Error(`fixture reference validator does not support blob-owner on ${spec.name}`)
      }
    }
  }
}
