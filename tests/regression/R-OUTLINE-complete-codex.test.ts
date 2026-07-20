import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/lib/db/schema'
import { assembleContext } from '../../src/lib/registry/assemble-context'
import { useCodexStore } from '../../src/stores/codex'

describe('R-OUTLINE · 大纲完整词条上下文', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(() => db.close())

  it('预检阶段保留 codex 全部原始详情，不再做机械字符截断', async () => {
    const now = Date.now()
    const projectId = await db.projects.add({
      name: '山河', genre: '历史', description: '', targetWordCount: 500_000,
      enableMultiWorld: false, createdAt: now, updatedAt: now,
    } as any) as number
    const store = useCodexStore.getState()
    await store.loadAll(projectId)
    const category = (await db.codexCategories.where('projectId').equals(projectId).toArray())
      .find(item => item.builtInKey === 'humEvent')!

    for (let index = 1; index <= 36; index++) {
      await store.addEntry({
        projectId,
        categoryId: category.id!,
        name: `不可遗漏词条-${String(index).padStart(2, '0')}`,
        summary: `该词条约束第 ${index} 段剧情。`.repeat(30),
        description: `完整详情 ${index}。`.repeat(30),
        fields: JSON.stringify({ type: '重大事件', time: `${index}年`, impact: `影响${index}` }),
        order: index,
        worldGroupId: null,
      } as any)
    }

    const assembled = await assembleContext({
      projectId,
      worldGroupId: null,
      sourceKeys: ['codex'],
      requiredSourceKeys: ['codex'],
      inputBudgetTokens: 1_000,
    })

    expect(assembled.included).toEqual(['codex'])
    expect(assembled.trimmed).not.toContain('codex')
    expect(assembled.compressed).not.toContain('codex')
    expect(assembled.totalInputTokens).toBeGreaterThan(1_000)
    expect(assembled.overBudgetAfterTrim).toBe(true)
    for (let index = 1; index <= 36; index++) {
      expect(assembled.text).toContain(`不可遗漏词条-${String(index).padStart(2, '0')}`)
    }
    expect(assembled.text).toContain('完整详情 36')
    expect(assembled.text).toContain('36/36 条及其原始详情均已完整载入')
  })

  it('连全部词条名称都装不下时保留名称并明确标记超预算，不静默删词条', async () => {
    const now = Date.now()
    const projectId = await db.projects.add({
      name: '极限词条', genre: '', description: '', targetWordCount: 0,
      enableMultiWorld: false, createdAt: now, updatedAt: now,
    } as any) as number
    const store = useCodexStore.getState()
    await store.loadAll(projectId)
    const category = (await db.codexCategories.where('projectId').equals(projectId).toArray())
      .find(item => item.builtInKey === 'humEvent')!
    for (let index = 1; index <= 12; index++) {
      await store.addEntry({
        projectId, categoryId: category.id!,
        name: `超长且不可遗漏的设定词条名称-${index}-${'山河'.repeat(12)}`,
        summary: '', description: '', fields: '{}', order: index, worldGroupId: null,
      } as any)
    }

    const assembled = await assembleContext({
      projectId,
      worldGroupId: null,
      sourceKeys: ['codex'],
      requiredSourceKeys: ['codex'],
      inputBudgetTokens: 60,
    })

    expect(assembled.included).toEqual(['codex'])
    expect(assembled.trimmed).not.toContain('codex')
    expect(assembled.overBudgetAfterTrim).toBe(true)
    for (let index = 1; index <= 12; index++) {
      expect(assembled.text).toContain(`超长且不可遗漏的设定词条名称-${index}`)
    }
  })
})
