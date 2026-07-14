/**
 * R-export-derive-equivalence · 派生导出格式 ≡ 真实旧格式(防漂移)
 *
 * AUDIT-1 切换后,旧手写导出已删,改用一份**真实旧手写版生成的 fixture**
 * (tests/fixtures/legacy-export-v3.json)作对照基准。v4 只允许新增显式嵌套引用编码；去掉
 * 该有意差异后，其余字段必须与 v3 一致。旧备份的可读性由 roundtrip 测试另行锁定。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../../src/lib/db/schema'
import { deriveExportProjectJSON } from '../../src/lib/export/registry-export'
import { seedFullProject } from '../helpers/seed-full-project'

const legacyFixturePath = path.resolve(__dirname, '../fixtures/legacy-export-v3.json')

/**
 * 对齐两处无害的有意差异后比较:
 * 1. exportedAt(Date.now)抹平。
 * 2. 旧手写版 outlineNodes/worldNodes 冗余保留了原始 parentId(db id 死字段,导入侧解构即丢);
 *    派生版干净去除。两者导入结果一致,删掉对齐。
 */
function normalizeNonPortablePayload(data: any) {
  const normalized = JSON.parse(JSON.stringify(data))
  normalized.version = 3
  delete normalized.nestedRefEncoding
  normalized.exportedAt = 0
  for (const t of ['outlineNodes', 'worldNodes']) {
    for (const row of normalized[t] ?? []) delete row.parentId
  }
  for (const row of normalized.detailedOutlines ?? []) {
    delete row.appearingCharacterIds
    delete row.foreshadowIds
    for (const scene of row.scenes ?? []) delete scene.characterIds
  }
  for (const row of normalized.creativeRules ?? []) delete row.citedReferenceIds
  for (const row of normalized.codexEntries ?? []) delete row.refs
  return normalized
}

describe('R-export-derive-equivalence · 派生导出 ≡ 真实旧格式 fixture', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(async () => { db.close() })

  it('v4 除显式嵌套引用编码外与旧 v3 fixture 逐字段相等', async () => {
    const legacy = JSON.parse(fs.readFileSync(legacyFixturePath, 'utf8'))
    const { projectId } = await seedFullProject()
    const derived = await deriveExportProjectJSON(projectId)
    expect(normalizeNonPortablePayload(derived)).toEqual(normalizeNonPortablePayload(legacy))
  })
})
