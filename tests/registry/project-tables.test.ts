/**
 * Phase 1.1a 注册表单元测试
 *
 * 验证:
 *   ① 注册表完整性(45 表双向覆盖 + ref target 存在)
 *   ② 派生选择器正确
 *   ③ cascadeDeleteProject / cascadeDeleteGroup / stampPrimaryWorld 与现有手写逻辑等价
 *
 * 注意:Phase 1.1a 这些派生 API 是【纯新增】,现有 stores 还没切换。
 *       本测试直接调派生 API,确认它们正确,为 1.1b 切换做保证。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../src/lib/db/schema'
import { PROJECT_TABLES, REGISTRY_BY_NAME } from '../../src/lib/registry/project-tables'
import { checkPortableRefContracts, checkRegistry } from '../../src/lib/registry/validate'
import type { RefSpec, TableSpec } from '../../src/lib/registry/types'
import {
  projectScopedTables, worldScopedTables, exportableTables,
  transactionTablesFor, cascadeDeleteProject, cascadeDeleteGroup, stampPrimaryWorld,
} from '../../src/lib/registry/lifecycle'

describe('Phase 1.1a · PROJECT_TABLES 注册表', () => {
  describe('完整性校验', () => {
    it('注册表与 Dexie 双向覆盖,无遗漏无多余', () => {
      const result = checkRegistry()
      if (!result.ok) console.error(result.errors)
      expect(result.ok, result.errors.join('; ')).toBe(true)
    })

    it('登记了全部 42 张表', () => {
      expect(PROJECT_TABLES.length).toBe(42)   // v36 retrievalChunks→41；v37 narrativeSummaryNodes→42
    })

    it('每张表名唯一', () => {
      const names = PROJECT_TABLES.map(s => s.name)
      expect(new Set(names).size).toBe(names.length)
    })

    it('五类嵌套引用声明 portable=require,且目标由 array/json 契约解析', () => {
      const contracts = PROJECT_TABLES.flatMap((spec) =>
        (spec.refs ?? []).flatMap((ref) => {
          if ((ref.kind !== 'array' && ref.kind !== 'json') || !ref.portable) return []
          const target = ref.kind === 'array'
            ? ref.itemTarget
            : ref.target.match(/^(\w+)\[/)?.[1]
          return [{
            source: spec.name,
            field: ref.field,
            kind: ref.kind,
            target,
            onUnmapped: ref.portable.onUnmapped,
          }]
        }),
      )

      expect(contracts).toEqual([
        { source: 'detailedOutlines', field: 'appearingCharacterIds', kind: 'array', target: 'characters', onUnmapped: 'require' },
        { source: 'detailedOutlines', field: 'foreshadowIds', kind: 'array', target: 'foreshadows', onUnmapped: 'require' },
        { source: 'detailedOutlines', field: 'scenes', kind: 'json', target: 'characters', onUnmapped: 'require' },
        { source: 'creativeRules', field: 'citedReferenceIds', kind: 'array', target: 'references', onUnmapped: 'require' },
        { source: 'codexEntries', field: 'refs', kind: 'json', target: 'codexEntries', onUnmapped: 'require' },
      ])

      for (const contract of contracts) {
        expect(REGISTRY_BY_NAME.get(contract.source)?.exportable).toBe(true)
        expect(contract.target).toBeTruthy()
        expect(REGISTRY_BY_NAME.get(contract.target!)?.exportable).toBe(true)
      }
    })

    it('角色反向冗余声明已移除,portals 继续只走既有 exportRefRemap', () => {
      const characterRefs = REGISTRY_BY_NAME.get('characters')?.refs ?? []
      expect(characterRefs.some(ref =>
        ref.kind === 'array' && ref.field === 'appearingCharacterIds',
      )).toBe(false)

      const worldNodes = REGISTRY_BY_NAME.get('worldNodes')!
      const portalsRef = worldNodes.refs?.find(ref =>
        ref.kind === 'json' && ref.field === 'portalsJSON',
      )
      expect(portalsRef?.kind).toBe('json')
      if (portalsRef?.kind === 'json') expect(portalsRef.portable).toBeUndefined()
      expect(worldNodes.exportRefRemap).toContainEqual({
        field: 'portalsJSON', remapVia: 'worldNodes', kind: 'portals',
      })
    })

    it('portable 纯校验拒绝错误引用类型、不可导出源/目标、缺失和畸形目标', () => {
      const illegalSimple = {
        kind: 'simple',
        field: 'id',
        target: 'characterRelations[fromCharacterId]',
        onDelete: 'cascade',
        portable: { onUnmapped: 'require' },
      } as unknown as RefSpec

      const invalidSpecs: TableSpec[] = PROJECT_TABLES.map((spec): TableSpec => {
        if (spec.name === 'characters') {
          return {
            ...spec,
            refs: [...(spec.refs ?? []), illegalSimple],
            exportRemap: [
              ...(spec.exportRemap ?? []),
              {
                field: 'unstableOwnerId',
                remapVia: 'worldGroups',
                exportAs: '_unstableOwnerExportId',
                onUnmapped: 'drop',
              },
            ],
          }
        }
        if (spec.name === 'snapshots') {
          return {
            ...spec,
            refs: [{
              kind: 'array', field: 'cachedCharacterIds', itemTarget: 'characters',
              onDelete: 'keep', portable: { onUnmapped: 'require' },
            }],
          }
        }
        if (spec.name === 'detailedOutlines') {
          return {
            ...spec,
            exportRefRemap: [
              ...(spec.exportRefRemap ?? []),
              { field: 'scenes', remapVia: 'worldNodes', kind: 'portals' },
            ],
            refs: [
              ...(spec.refs ?? []),
              {
                kind: 'array', field: 'missingIds', itemTarget: 'missingPortableTarget',
                onDelete: 'keep', portable: { onUnmapped: 'require' },
              },
              {
                kind: 'array', field: 'localOnlyIds', itemTarget: 'promptTemplates',
                onDelete: 'keep', portable: { onUnmapped: 'require' },
              },
              {
                kind: 'json', field: 'malformedRefs', jsonPath: '$.*', target: 'characters[',
                onDelete: 'keep', portable: { onUnmapped: 'require' },
              },
              {
                kind: 'json', field: 'nonPrimaryRefs', jsonPath: '$.*', target: 'characters[name]',
                onDelete: 'keep', portable: { onUnmapped: 'require' },
              },
            ],
          }
        }
        return spec
      })

      const result = checkPortableRefContracts(invalidSpecs)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('characters.refs portable 仅支持 array/json,当前为 simple')
      expect(result.errors).toContain('snapshots.refs(cachedCharacterIds) portable 源表必须 exportable')
      expect(result.errors).toContain('detailedOutlines.refs(missingIds) portable target 不存在: missingPortableTarget')
      expect(result.errors).toContain('detailedOutlines.refs(localOnlyIds) portable target 必须 exportable: promptTemplates')
      expect(result.errors).toContain('detailedOutlines.refs(malformedRefs) portable target 格式非法')
      expect(result.errors).toContain(
        'detailedOutlines.refs(nonPrimaryRefs) portable JSON target 必须指向主键 [id]',
      )
      expect(result.errors).toContain(
        'detailedOutlines.refs(scenes) portable 不得与 exportRefRemap 重复登记',
      )
      expect(result.errors).toContain(
        'detailedOutlines.refs(appearingCharacterIds) portable target characters 可丢行时必须声明 exportIdField',
      )
    })
  })

  describe('派生选择器', () => {
    it('worldScopedTables 包含已知多世界表', () => {
      const names = worldScopedTables().map(s => s.name)
      for (const t of [
        'worldviews', 'powerSystems', 'geographies', 'histories', 'worldNodes',
        'historicalTimelineEvents', 'historicalKeywords', 'outlineNodes',
        'codexCategories', 'codexEntries', 'worldRulesProfiles',
      ]) {
        expect(names, `worldScoped 应含 ${t}`).toContain(t)
      }
    })

    it('exportableTables 不含 global/transient/统计表', () => {
      const names = exportableTables().map(s => s.name)
      for (const t of ['promptTemplates', 'promptWorkflows', 'snapshots', 'aiUsageLog',
                       'importSessions', 'importJobs', 'importLogs', 'importFiles']) {
        expect(names, `exportable 不应含 ${t}`).not.toContain(t)
      }
    })

    it('projectScopedTables 不含 global 表', () => {
      const names = projectScopedTables().map(s => s.name)
      for (const t of ['promptTemplates', 'promptWorkflows']) {
        expect(names).not.toContain(t)
      }
    })

    it('transactionTablesFor(deleteGroup) 含 worldScoped + characters + outlineNodes + worldGroups', () => {
      const tables = transactionTablesFor('deleteGroup')
      const tableNames = tables.map(t => t.name)
      expect(tableNames).toContain('characters')
      expect(tableNames).toContain('outlineNodes')
      expect(tableNames).toContain('worldGroups')
      expect(tableNames).toContain('codexEntries')
      expect(tableNames).toContain('worldRulesProfiles')
    })

    it('transactionTablesFor(importProject) 从 projectScopedTables 派生', () => {
      const importNames = transactionTablesFor('importProject').map(t => t.name).sort()
      const projectScopedNames = projectScopedTables().map(s => s.table.name).sort()
      expect(importNames).toEqual(projectScopedNames)
      expect(importNames).toContain('projects')
      expect(importNames).toContain('codexEntries')
      expect(importNames).not.toContain('promptTemplates')
    })
  })

  describe('派生生命周期 API 行为', () => {
    beforeEach(async () => { await db.delete(); await db.open() })
    afterEach(async () => { db.close() })

    it('cascadeDeleteProject 清空所有项目级数据(含间接归属 blob)', async () => {
      const now = Date.now()
      const projectId = await db.projects.add({
        name: 'P', genre: '', description: '', targetWordCount: 0,
        enableMultiWorld: false, createdAt: now, updatedAt: now,
      } as any) as number

      await db.worldviews.add({ projectId, worldOrigin: 'x', createdAt: now, updatedAt: now } as any)
      await db.characters.add({ projectId, name: 'A', role: 'protagonist', createdAt: now, updatedAt: now } as any)
      const sessionId = await db.importSessions.add({
        projectId, type: 'character', status: 'done', filename: 'f', fileSize: 1,
        fileHash: 'h', totalChunks: 1, completedChunks: 1, parsedSummary: {} as any,
        createdAt: now, updatedAt: now,
      } as any) as number
      await db.importLogs.add({ sessionId, level: 'info', message: 'm', timestamp: now } as any)
      await db.importFiles.put({ sessionId, filename: 'f', blob: new Blob(['x']), fileHash: 'h', createdAt: now } as any)

      await cascadeDeleteProject(projectId)

      expect(await db.projects.get(projectId)).toBeUndefined()
      expect(await db.worldviews.where('projectId').equals(projectId).count()).toBe(0)
      expect(await db.characters.where('projectId').equals(projectId).count()).toBe(0)
      expect(await db.importSessions.where('projectId').equals(projectId).count()).toBe(0)
      expect(await db.importLogs.where('sessionId').equals(sessionId).count()).toBe(0)
      expect(await db.importFiles.count(), 'importFiles 应全清(间接归属 blob)').toBe(0)
    })

    it('cascadeDeleteGroup 删世界数据 + 内置词条分类保留 + 大纲 setNull', async () => {
      const now = Date.now()
      const projectId = await db.projects.add({
        name: 'P', genre: '', description: '', targetWordCount: 0,
        enableMultiWorld: true, createdAt: now, updatedAt: now,
      } as any) as number
      const wgId = await db.worldGroups.add({
        projectId, name: '斗破', type: 'parallel', order: 1, createdAt: now, updatedAt: now,
      } as any) as number

      await db.worldviews.add({ projectId, worldGroupId: wgId, worldOrigin: 'x', createdAt: now, updatedAt: now } as any)
      await db.codexEntries.add({ projectId, worldGroupId: wgId, categoryId: 0, name: '玄铁', fields: '{}', refs: '{}', createdAt: now, updatedAt: now } as any)
      // 内置词条分类(builtInKey 非空,worldGroupId=null)应保留
      await db.codexCategories.add({ projectId, worldGroupId: null, builtInKey: 'mineral', domain: 'natural', name: '矿物', createdAt: now, updatedAt: now } as any)
      // 大纲卷挂该世界 → 应被 setNull 不删
      const nodeId = await db.outlineNodes.add({ projectId, worldGroupId: wgId, parentId: null, type: 'volume', title: '第一卷', summary: '', order: 0, createdAt: now, updatedAt: now } as any) as number

      await cascadeDeleteGroup(projectId, wgId)

      // worldGroupId 非索引字段,用 projectId 查 + 内存过滤
      const wvLeft = (await db.worldviews.where('projectId').equals(projectId).toArray())
        .filter((w: any) => w.worldGroupId === wgId)
      expect(wvLeft.length, '世界观删').toBe(0)
      const ceLeft = (await db.codexEntries.where('projectId').equals(projectId).toArray())
        .filter((e: any) => e.worldGroupId === wgId)
      expect(ceLeft.length, '词条删').toBe(0)
      expect(await db.codexCategories.count(), '内置分类保留').toBe(1)
      const node = await db.outlineNodes.get(nodeId)
      expect(node?.worldGroupId ?? null, '大纲卷 setNull 不删').toBeNull()
      expect(await db.worldGroups.get(wgId), '世界组本身删').toBeUndefined()
    })

    it('stampPrimaryWorld 盖章所有 null,但内置词条分类不盖', async () => {
      const now = Date.now()
      const projectId = await db.projects.add({
        name: 'P', genre: '', description: '', targetWordCount: 0,
        enableMultiWorld: false, createdAt: now, updatedAt: now,
      } as any) as number
      const primaryId = await db.worldGroups.add({
        projectId, name: '主世界', type: 'primary', order: 0, createdAt: now, updatedAt: now,
      } as any) as number

      await db.worldviews.add({ projectId, worldOrigin: 'x', createdAt: now, updatedAt: now } as any)
      await db.outlineNodes.add({ projectId, parentId: null, type: 'volume', title: 'V', summary: '', order: 0, createdAt: now, updatedAt: now } as any)
      await db.codexCategories.add({ projectId, worldGroupId: null, builtInKey: 'mineral', domain: 'natural', name: '矿物', createdAt: now, updatedAt: now } as any)

      await stampPrimaryWorld(projectId, primaryId)

      const wv = await db.worldviews.where('projectId').equals(projectId).first()
      expect(wv?.worldGroupId, 'worldview 盖章').toBe(primaryId)
      const node = await db.outlineNodes.where('projectId').equals(projectId).first()
      expect(node?.worldGroupId, '大纲盖章').toBe(primaryId)
      const cat = await db.codexCategories.where('projectId').equals(projectId).first()
      expect(cat?.worldGroupId ?? null, '内置分类保持 null 全局').toBeNull()
    })
  })
})
