/**
 * 注册表派生的项目导入引擎(AUDIT-1)
 *
 * 取代 json-export.ts 中手写的逐表导入:按表依赖拓扑排序(被引用表先于引用方)遍历
 * exportable 表,树表内再按 _parentExportId 拓扑排序,逐行把导出序号外键重映射回新 db id。
 * 加新表只需在注册表登记一行,自动进出导入。
 *
 * 必填外键(onUnmapped: 'require')缺失映射 → 抛错整体回滚(完整性保护);孤儿(onUnmapped:
 * 'drop')跳过该行;portals 等 JSON 自引用走两阶段(先建全表映射,再回填重映射)。
 */
import { db } from '../db/schema'
import { PROJECT_TABLES } from '../registry/project-tables'
import { remapWorldPortalTargets } from '../utils/world-portals'
import { transactionTablesFor } from '../registry/lifecycle'
import { importLegacyArraysToCodex } from '../migrations/legacy-to-codex-upgrade'
import { migrateStateCardsToTemporalFactCandidates } from '../migrations/state-cards-to-temporal-facts'
import type { TableSpec } from '../registry/types'
import type { ProjectExportData } from './json-export'
import { normalizeCharacterAxes } from '../character/character-axes'
import { usesPortableNestedReferences } from './export-format'
import {
  portableRefTargetTable,
  remapPortableReferenceValue,
} from './registry-ref-remap'
import type { PortableReferenceRef } from './registry-ref-remap'

interface PendingPortableRefRemap {
  spec: TableSpec
  newId: number
  refs: PortableReferenceRef[]
  stashed: Record<string, unknown>
}

function portableRefsFor(spec: TableSpec): PortableReferenceRef[] {
  return (spec.refs ?? []).filter((ref): ref is PortableReferenceRef =>
    (ref.kind === 'array' || ref.kind === 'json') && ref.portable !== undefined)
}

function isImportRow(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

/**
 * Validate every transport-level table ID and foreign export index before the
 * transaction writes its first row. A string `"0"` and number `0` are distinct
 * Map keys; accepting both can otherwise turn a present optional reference into
 * null without failing the import.
 *
 * Legacy v1-v3 character relations may use -1 for an orphan endpoint declared
 * with onUnmapped:'drop'. Preserve that exact sentinel; all other values must be
 * non-negative safe integers in the target table's exported index domain.
 */
function validateImportTransport(
  data: ProjectExportData,
  specs: readonly TableSpec[],
): Map<string, any[]> {
  const rowsByTable = new Map<string, any[]>()
  const indexDomains = new Map<string, Set<number>>()

  for (const spec of specs) {
    const raw = (data as unknown as Record<string, unknown>)[spec.name]
    if (raw != null && !Array.isArray(raw)) {
      throw new Error(`[deriveImport] ${spec.name} must be an array`)
    }
    const rows = (raw ?? []) as unknown[]
    const domain = new Set<number>()
    rows.forEach((row, rowIndex) => {
      if (!isImportRow(row)) {
        throw new Error(`[deriveImport] ${spec.name}[${rowIndex}] must be an object`)
      }
      if (spec.exportIdField) {
        const exportId = row._exportId
        if (!isNonNegativeSafeInteger(exportId)) {
          throw new Error(`[deriveImport] ${spec.name}[${rowIndex}]._exportId must be a non-negative safe integer`)
        }
        if (domain.has(exportId)) {
          throw new Error(`[deriveImport] ${spec.name} contains duplicate _exportId ${exportId}`)
        }
        domain.add(exportId)
      } else {
        domain.add(rowIndex)
      }
    })
    rowsByTable.set(spec.name, rows as any[])
    indexDomains.set(spec.name, domain)
  }

  for (const spec of specs) {
    const rows = rowsByTable.get(spec.name) ?? []
    rows.forEach((row, rowIndex) => {
      for (const remap of spec.exportRemap ?? []) {
        const exportIndex = row[remap.exportAs]
        if (exportIndex == null) continue
        if (remap.onUnmapped === 'drop' && exportIndex === -1) continue
        if (!isNonNegativeSafeInteger(exportIndex)) {
          throw new Error(
            `[deriveImport] ${spec.name}[${rowIndex}].${remap.exportAs} must be a non-negative safe integer`,
          )
        }
        const targetDomain = indexDomains.get(remap.remapVia)
        if (!targetDomain?.has(exportIndex) && remap.onUnmapped !== 'drop') {
          if (remap.onUnmapped === 'require') {
            throw new Error(`[deriveImport] 缺失必填外键映射:${spec.name}.${remap.field}=${exportIndex}`)
          }
          throw new Error(
            `[deriveImport] ${spec.name}[${rowIndex}].${remap.exportAs} references missing export index ${exportIndex}`,
          )
        }
      }
    })
  }

  return rowsByTable
}

/** 表级拓扑排序:被 remapVia 指向的表必须先导入(selfTree 不算表间依赖) */
function deriveImportOrder(specs: TableSpec[]): TableSpec[] {
  const done = new Set<string>()
  const order: TableSpec[] = []
  let guard = 0
  while (order.length < specs.length) {
    if (guard++ > specs.length + 2) throw new Error('[deriveImport] 表依赖存在环,无法拓扑排序')
    for (const spec of specs) {
      if (done.has(spec.name)) continue
      const fieldDeps = (spec.exportRemap ?? [])
        .filter(rm => !rm.selfTree && rm.remapVia !== spec.name)
        .map(rm => rm.remapVia)
      const refDeps = (spec.exportRefRemap ?? [])
        .filter(ref => ref.remapVia !== spec.name)
        .map(ref => ref.remapVia)
      const deps = [...new Set([...fieldDeps, ...refDeps])]
      if (deps.every(d => done.has(d))) {
        order.push(spec)
        done.add(spec.name)
      }
    }
  }
  return order
}

/**
 * 树表行级拓扑排序：父引用为空或父已就位的行优先，保证 parent 先于 child 落库。
 *
 * 不允许环、重复/缺失导出 ID 或悬空父引用。旧实现遇环会把剩余行按原顺序兜底，
 * 随后的 selfTree remap 会把尚未导入的父引用静默置 null；这会让“导入成功”掩盖数据损坏。
 */
function topoSortTreeRows(spec: TableSpec, rows: any[]): any[] {
  if (!spec.tree || rows.length === 0) return rows

  const parentRemaps = (spec.exportRemap ?? []).filter(
    rm => rm.selfTree && rm.field === spec.tree!.parentField,
  )
  if (parentRemaps.length !== 1 || !spec.exportIdField) {
    throw new Error(`[deriveImport] ${spec.name} tree registry metadata is invalid`)
  }
  const parentExportField = parentRemaps[0].exportAs

  const rowIds = new Set<unknown>()
  for (const row of rows) {
    const exportId = row._exportId
    if (exportId == null) {
      throw new Error(`[deriveImport] ${spec.name} tree row is missing _exportId`)
    }
    if (rowIds.has(exportId)) {
      throw new Error(`[deriveImport] ${spec.name} tree contains duplicate _exportId ${String(exportId)}`)
    }
    rowIds.add(exportId)
  }

  const sorted: any[] = []
  const placed = new Set<unknown>()
  let remaining = rows.slice()
  while (remaining.length > 0) {
    const ready: any[] = []
    const blocked: any[] = []
    for (const row of remaining) {
      const parentExportId = row[parentExportField]
      if (parentExportId == null || placed.has(parentExportId)) {
        ready.push(row)
      } else {
        if (!rowIds.has(parentExportId)) {
          throw new Error(
            `[deriveImport] ${spec.name} tree row ${String(row._exportId)} has missing parent ${String(parentExportId)}`,
          )
        }
        blocked.push(row)
      }
    }
    if (ready.length === 0) {
      throw new Error(
        `[deriveImport] ${spec.name} tree contains a parent cycle: ${blocked.map(row => String(row._exportId)).join(',')}`,
      )
    }
    for (const row of ready) {
      sorted.push(row)
      placed.add(row._exportId)
    }
    remaining = blocked
  }
  return sorted
}

function patchSelfIdPaths(obj: Record<string, any>, paths: string[], newId: number): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const path of paths) {
    const [root, ...rest] = path.split('.')
    if (!root || rest.length === 0 || obj[root] == null || typeof obj[root] !== 'object') continue
    // 导入输入本就是 JSON 契约，按 JSON 语义深拷贝可避免修改原始备份对象。
    const rootCopy = JSON.parse(JSON.stringify(obj[root]))
    let cursor: Record<string, any> = rootCopy
    for (const part of rest.slice(0, -1)) {
      if (cursor[part] == null || typeof cursor[part] !== 'object') cursor[part] = {}
      cursor = cursor[part]
    }
    cursor[rest[rest.length - 1]] = newId
    patch[root] = rootCopy
  }
  return patch
}

/**
 * 派生导入:把 ProjectExportData 写成一个新项目,返回新项目 id。
 * 与手写 importProjectJSON 行为一致(往返完整性由 R-export-fullcoverage 锁死)。
 */
export async function deriveImportProjectJSON(data: ProjectExportData): Promise<number> {
  if (!data.version || !data.project) throw new Error('无效的导出文件格式')
  const remapPortableRefs = usesPortableNestedReferences(data)
  const now = Date.now()
  const specs = PROJECT_TABLES.filter(s => s.exportable && s.name !== 'projects')
  const order = deriveImportOrder(specs)
  const rowsByTable = validateImportTransport(data, specs)

  return await db.transaction('rw', transactionTablesFor('importProject'), async () => {
    const newProjectId = await db.projects.add({
      ...data.project,
      name: `${data.project.name}（导入）`,
      createdAt: now,
      updatedAt: now,
    } as any) as number

    // 旧版备份兼容:factions/itemSystems 表已删除 → 并入「势力」/「人工器物」词条
    const legacyFactions = (data as any).factions as any[] | undefined
    const legacyItemSystems = (data as any).itemSystems as any[] | undefined
    if (legacyFactions?.length || legacyItemSystems?.length) {
      await importLegacyArraysToCodex(db, newProjectId, { factions: legacyFactions, itemSystems: legacyItemSystems })
    }

    const newIdMaps = new Map<string, Map<number, number>>()
    const pendingPortableRefRemaps: PendingPortableRefRemap[] = []

    for (const spec of order) {
      const rawRows = rowsByTable.get(spec.name) ?? []
      const rows = spec.tree ? topoSortTreeRows(spec, rawRows) : rawRows
      const newIdMap = new Map<number, number>()
      const pendingRefRemap: Array<{ newId: number; stashed: Record<string, any> }> = []

      let exportIndex = -1
      for (const row of rows) {
        exportIndex++
        // 注册表声明的兜底默认值先铺底，再用 row 覆盖：老数据/跨版本导入缺某非可选字段时，
        // 落库仍满足类型不变量（如 outlineNodes.summary 恒为 string，杜绝「导入后大纲崩」）。
        const obj: any = { ...spec.defaults, ...row }
        const exportId = obj._exportId
        delete obj._exportId

        // 外键:_exportAs → 真实 db id
        let dropRow = false
        for (const rm of spec.exportRemap ?? []) {
          const exportVal = obj[rm.exportAs]
          delete obj[rm.exportAs]
          let mappedId: number | null = null
          if (exportVal != null) {
            const m = rm.selfTree ? newIdMap : newIdMaps.get(rm.remapVia)
            const got = m?.get(exportVal)
            if (got == null) {
              if (rm.onUnmapped === 'drop') { dropRow = true; break }
              if (rm.onUnmapped === 'require') {
                throw new Error(`[deriveImport] 缺失必填外键映射:${spec.name}.${rm.field}=${exportVal}`)
              }
            }
            mappedId = got ?? null
          }
          obj[rm.field] = mappedId
        }
        if (dropRow) continue

        if (spec.owner === 'project') obj.projectId = newProjectId
        if (spec.name === 'characters') {
          Object.assign(obj, normalizeCharacterAxes(obj))
        }

        const portableRefs = remapPortableRefs ? portableRefsFor(spec) : []
        const portableStashed: Record<string, unknown> = {}
        for (const ref of portableRefs) {
          if (!Object.prototype.hasOwnProperty.call(obj, ref.field)) continue
          portableStashed[ref.field] = obj[ref.field]
          delete obj[ref.field]
        }

        // JSON 引用字段(portals)先剥离,待全表映射建好后两阶段回填
        let stashed: Record<string, any> | null = null
        if ((spec.exportRefRemap ?? []).length > 0) {
          stashed = {}
          for (const rr of spec.exportRefRemap!) {
            if (rr.kind === 'portals') {
              stashed[rr.field] = obj[rr.field]
              delete obj[rr.field]
            } else {
              stashed[rr.exportAs] = obj[rr.exportAs]
              delete obj[rr.exportAs]
            }
          }
        }

        const newId = await (db as any)[spec.name].add(obj) as number
        if (spec.selfIdPaths?.length) {
          const selfPatch = patchSelfIdPaths(obj, spec.selfIdPaths, newId)
          if (Object.keys(selfPatch).length > 0) {
            await (db as any)[spec.name].update(newId, selfPatch)
          }
        }
        const key = spec.exportIdField ? exportId : exportIndex
        if (key != null) newIdMap.set(key, newId)
        if (stashed) pendingRefRemap.push({ newId, stashed })
        if (Object.keys(portableStashed).length > 0) {
          pendingPortableRefRemaps.push({
            spec,
            newId,
            refs: portableRefs,
            stashed: portableStashed,
          })
        }
      }

      // 两阶段:JSON 引用重映射(portals 自引用,需本表 newIdMap 已全)
      for (const rr of spec.exportRefRemap ?? []) {
        if (rr.kind === 'portals') {
          const refMap = rr.remapVia === spec.name ? newIdMap : (newIdMaps.get(rr.remapVia) ?? newIdMap)
          for (const p of pendingRefRemap) {
            const remapped = remapWorldPortalTargets(p.stashed[rr.field], (exportId: number) => refMap.get(exportId))
            if (remapped) await (db as any)[spec.name].update(p.newId, { [rr.field]: remapped, updatedAt: now })
          }
        } else {
          const refMap = newIdMaps.get(rr.remapVia)
          if (!refMap) continue
          for (const pending of pendingRefRemap) {
            const portableRefs = pending.stashed[rr.exportAs]
            if (portableRefs == null) continue // 旧备份没有影子字段：保留原值，不猜测旧 db id。
            const patch = rr.kind === 'id-array'
              ? remapPortableIdArray(portableRefs, refMap, rr.storage === 'json-string')
              : await remapSceneCharacterIndexes((db as any)[spec.name], pending.newId, rr.field, portableRefs, refMap)
            if (patch !== undefined) {
              await (db as any)[spec.name].update(pending.newId, { [rr.field]: patch, updatedAt: now })
            }
          }
        }
      }

      newIdMaps.set(spec.name, newIdMap)
    }

    // v4 portable nested refs use export indexes. Resolve only after every table map exists,
    // so forward references, self references and cycles never affect table import order.
    for (const pending of pendingPortableRefRemaps) {
      const patch: Record<string, unknown> = {}
      for (const ref of pending.refs) {
        if (!Object.prototype.hasOwnProperty.call(pending.stashed, ref.field)) continue
        const targetTable = portableRefTargetTable(ref)
        const targetMap = newIdMaps.get(targetTable)
        patch[ref.field] = remapPortableReferenceValue(
          pending.stashed[ref.field],
          ref,
          (exportIndex: number) => targetMap?.get(exportIndex),
          { operation: 'import', table: pending.spec.name, row: pending.newId },
        )
      }
      if (Object.keys(patch).length > 0) {
        await (db as any)[pending.spec.name].update(pending.newId, patch)
      }
    }

    // NS-4：旧备份可能只有 stateCards、没有 temporalFacts。导入后用新项目内的
    // 新 stateCard 主键生成可审候选；旧卡保留，不自动升 Canon。函数幂等，若备份已有
    // 对应候选不会重复写。
    if (((data as any).temporalFacts?.length ?? 0) === 0) {
      await migrateStateCardsToTemporalFactCandidates(db, newProjectId)
    }

    return newProjectId
  })
}

function remapPortableIdArray(value: unknown, idMap: Map<number, number>, stringify: boolean): number[] | string {
  const mapped = Array.isArray(value)
    ? value.map(index => typeof index === 'number' ? idMap.get(index) : undefined).filter((id): id is number => id != null)
    : []
  return stringify ? JSON.stringify(mapped) : mapped
}

async function remapSceneCharacterIndexes(
  table: any,
  rowId: number,
  field: string,
  portableRefs: unknown,
  idMap: Map<number, number>,
): Promise<unknown[] | undefined> {
  if (!Array.isArray(portableRefs)) return undefined
  const row = await table.get(rowId)
  const scenes = row?.[field]
  if (!Array.isArray(scenes)) return undefined
  return scenes.map((scene: unknown, sceneIndex: number) => {
    if (!scene || typeof scene !== 'object') return scene
    const indexes = portableRefs[sceneIndex]
    const characterIds = Array.isArray(indexes)
      ? indexes.map(index => typeof index === 'number' ? idMap.get(index) : undefined).filter((id): id is number => id != null)
      : []
    return { ...(scene as Record<string, unknown>), characterIds }
  })
}
