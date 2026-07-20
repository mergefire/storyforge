/**
 * 全量项目种子 · 测试共享 helper
 *
 * 覆盖全部 31 张 exportable 表 + 双世界组 + 树 + 各类外键。
 * 供 R-export-fullcoverage(往返安全网)与 R-export-derive-equivalence(派生等价性)共用。
 */
import { db } from '../../src/lib/db/schema'
import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'
import {
  createFixtureText,
  D04_FIXTURE_CLOCK_MS,
  stableFixtureNumericId,
} from './d04-fixture-kit'

const DEFAULT_NOW = 1_700_000_000_000 // 保持既有测试的历史固定时间戳

export interface SeedFullProjectOptions {
  fixtureId?: string
  now?: number
  projectName?: string
  chapterCount?: number
  volumeCount?: number
  nonWhitespaceCharactersPerChapter?: number
  useDeterministicPrimaryKeys?: boolean
  includeSecondaryWorldGroup?: boolean
}

/** 种子:每张 exportable 表至少一行,带双世界组 + 树 + 各类外键。返回各源 id 便于断言。 */
export async function seedFullProject(options: SeedFullProjectOptions = {}) {
  const fixtureId = options.fixtureId ?? 'full-project'
  const now = options.now
    ?? (options.useDeterministicPrimaryKeys ? D04_FIXTURE_CLOCK_MS : DEFAULT_NOW)
  const chapterCount = options.chapterCount ?? 1
  const volumeCount = options.volumeCount ?? 1
  const nonWhitespaceCharacters = options.nonWhitespaceCharactersPerChapter

  if (!Number.isSafeInteger(chapterCount) || chapterCount < 1) {
    throw new Error('chapterCount must be a positive safe integer')
  }
  if (!Number.isSafeInteger(volumeCount) || volumeCount < 1 || chapterCount % volumeCount !== 0) {
    throw new Error('volumeCount must be positive and divide chapterCount exactly')
  }
  if (nonWhitespaceCharacters !== undefined
    && (!Number.isSafeInteger(nonWhitespaceCharacters) || nonWhitespaceCharacters < 1)) {
    throw new Error('nonWhitespaceCharactersPerChapter must be a positive safe integer')
  }

  const tableOrdinals = new Map<string, number>()
  const addRow = async (tableName: string, row: Record<string, unknown>): Promise<number> => {
    const ordinal = tableOrdinals.get(tableName) ?? 0
    tableOrdinals.set(tableName, ordinal + 1)
    const record = options.useDeterministicPrimaryKeys
      ? { ...row, id: stableFixtureNumericId(fixtureId, tableName, ordinal) }
      : row
    return await db.table(tableName).add(record) as number
  }

  const projectId = await addRow('projects', {
    name: options.projectName ?? '全量作品', genre: 'fantasy', genres: ['fantasy'], description: '全表往返',
    targetWordCount: 100000, enableMultiWorld: true, createdAt: now, updatedAt: now,
  } as any) as number

  // ── 双世界组(order 决定导出序) ──
  const wgA = await addRow('worldGroups', { projectId, name: '主世界群', order: 0, createdAt: now, updatedAt: now } as any) as number
  const includeSecondaryWorldGroup = options.includeSecondaryWorldGroup ?? true
  const wgB = includeSecondaryWorldGroup
    ? await addRow('worldGroups', { projectId, name: '镜世界群', order: 1, createdAt: now, updatedAt: now } as any) as number
    : wgA
  await addRow('worldGroupLinks', {
    projectId,
    fromGroupId: wgA,
    toGroupId: wgB,
    type: includeSecondaryWorldGroup ? 'portal' : 'loop',
    createdAt: now,
    updatedAt: now,
  } as any)

  // ── worldScoped 设定表(挂 wgA / wgB,验证 worldGroupId 重映射) ──
  await addRow('worldviews', { projectId, worldGroupId: wgA, worldOrigin: '混沌创世', powerHierarchy: '炼气→金丹', createdAt: now, updatedAt: now } as any)
  if (includeSecondaryWorldGroup) {
    await addRow('worldviews', { projectId, worldGroupId: wgB, worldOrigin: '镜中倒影', createdAt: now, updatedAt: now } as any)
  }
  await addRow('storyCores', { projectId, logline: '少年逆袭', mainPlot: '从山村到仙界', createdAt: now, updatedAt: now } as any)
  await addRow('powerSystems', { projectId, worldGroupId: wgA, name: '修真体系', description: '九重天', createdAt: now, updatedAt: now } as any)
  await addRow('geographies', { projectId, worldGroupId: wgA, overview: '三大洲', createdAt: now, updatedAt: now } as any)
  await addRow('histories', { projectId, worldGroupId: wgA, summary: '上古神战', createdAt: now, updatedAt: now } as any)
  await addRow('historicalTimelineEvents', { projectId, worldGroupId: wgA, title: '封神之战', year: -1000, createdAt: now, updatedAt: now } as any)
  await addRow('historicalKeywords', { projectId, worldGroupId: wgA, keyword: '神器', createdAt: now, updatedAt: now } as any)
  await addRow('worldRulesProfiles', { projectId, worldGroupId: wgA, rules: '魔法守恒', createdAt: now, updatedAt: now } as any)

  // ── worldNodes(树 + portalsJSON 自引用,wgA) ──
  const rootWorld = await addRow('worldNodes', { projectId, worldGroupId: wgA, parentId: null, name: '主世界', description: '起点', sortOrder: 0, createdAt: now, updatedAt: now } as any) as number
  const mirrorWorld = await addRow('worldNodes', { projectId, worldGroupId: wgA, parentId: rootWorld, name: '镜界', description: '镜中', sortOrder: 1, createdAt: now, updatedAt: now } as any) as number
  await db.worldNodes.update(rootWorld, { portalsJSON: JSON.stringify([{ name: '镜门', targetWorldId: mirrorWorld, x: 1, y: 2 }]) })

  // ── importantLocations(树) ──
  const locParent = await addRow('importantLocations', { projectId, parentId: null, name: '青云山', type: 'mountain', createdAt: now, updatedAt: now } as any) as number
  await addRow('importantLocations', { projectId, parentId: locParent, name: '青云峰', type: 'peak', createdAt: now, updatedAt: now } as any)

  // ── 角色(homeWorldScoped:一个挂 wgA,一个跨世界) ──
  const currentMainGoodAxes = options.useDeterministicPrimaryKeys
    ? { roleWeight: 'main', moralAxis: 'good', orderAxis: 'neutral' }
    : {}
  const currentMainNeutralAxes = options.useDeterministicPrimaryKeys
    ? { roleWeight: 'main', moralAxis: 'neutral', orderAxis: 'neutral' }
    : {}
  const char1 = await addRow('characters', { projectId, homeWorldGroupId: wgA, name: '林惊羽', role: 'protagonist', ...currentMainGoodAxes, personality: '坚毅', createdAt: now, updatedAt: now } as any) as number
  const char2 = await addRow('characters', { projectId, isCrossWorld: true, name: '苏长歌', role: 'supporting', ...currentMainNeutralAxes, createdAt: now, updatedAt: now } as any) as number
  await addRow('characterRelations', { projectId, fromCharacterId: char1, toCharacterId: char2, type: 'ally', description: '同门', createdAt: now, updatedAt: now } as any)

  const foreshadow = await addRow('foreshadows', { projectId, name: '神秘玉佩', type: 'item', status: 'planted', description: '身世之谜', createdAt: now, updatedAt: now } as any)

  // ── 大纲(树,wgA)+ 章节 + 细纲 + 情感卡 ──
  const volumeIds: number[] = []
  for (let volumeIndex = 0; volumeIndex < volumeCount; volumeIndex += 1) {
    volumeIds.push(await addRow('outlineNodes', {
      projectId,
      worldGroupId: wgA,
      parentId: null,
      type: 'volume',
      title: volumeCount === 1 ? '第一卷' : `第${volumeIndex + 1}卷`,
      summary: volumeIndex === 0 ? '开篇' : `卷${volumeIndex + 1}`,
      order: volumeIndex,
      createdAt: now,
      updatedAt: now,
    } as any) as number)
  }
  const vol = volumeIds[0]
  const chaptersPerVolume = chapterCount / volumeCount
  const chapNodeIds: number[] = []
  const chapterIds: number[] = []
  for (let index = 0; index < chapterCount; index += 1) {
    const chapterNumber = index + 1
    const title = `第${chapterNumber}章`
    const chapNodeId = await addRow('outlineNodes', {
      projectId,
      worldGroupId: wgA,
      parentId: volumeIds[Math.floor(index / chaptersPerVolume)],
      type: 'chapter',
      title,
      summary: index === 0 ? '觉醒' : `推进${chapterNumber}`,
      order: index,
      createdAt: now,
      updatedAt: now,
    } as any) as number
    const content = nonWhitespaceCharacters === undefined
      ? (index === 0 ? '<p>废墟中睁眼</p>' : `<p>${title}废墟中睁眼</p>`)
      : createFixtureText(fixtureId, 'chapter-content', index, nonWhitespaceCharacters)
    const chapterId = await addRow('chapters', {
      projectId,
      outlineNodeId: chapNodeId,
      title,
      content,
      wordCount: nonWhitespaceCharacters ?? (index === 0 ? 6 : title.length + 6),
      status: 'draft',
      order: index,
      createdAt: now,
      updatedAt: now,
    } as any) as number
    await addRow('detailedOutlines', {
      projectId,
      outlineNodeId: chapNodeId,
      openingHook: '承接',
      endingCliffhanger: '黑影',
      appearingCharacterIds: [char1],
      ...(options.useDeterministicPrimaryKeys ? { foreshadowIds: [foreshadow] } : {}),
      scenes: [{
        sceneId: `s${chapterNumber}`,
        title: '苏醒',
        summary: '醒来',
        characterIds: [char1],
        location: '废墟',
        conflict: '失忆',
      }],
      createdAt: now,
      updatedAt: now,
    } as any)
    await addRow('emotionBeatCards', {
      projectId,
      chapterId,
      overallArc: '低落→振奋',
      beats: '[]',
      createdAt: now,
      updatedAt: now,
    } as any)
    chapNodeIds.push(chapNodeId)
    chapterIds.push(chapterId)
  }
  const chapNode = chapNodeIds[0]
  const chapter = chapterIds[0]

  // ── 下游产物 ──
  await addRow('storyArcs', { projectId, type: 'main', name: '复仇线', stages: '[]', createdAt: now, updatedAt: now } as any)
  await addRow('stateCards', { projectId, category: 'character', entityName: '林惊羽', fields: JSON.stringify([{ key: '境界', value: '炼气一层' }]), createdAt: now, updatedAt: now } as any)
  await addRow('itemLedger', { projectId, itemName: '青锋剑', action: 'gain', quantity: 1, chapterId: chapter, chapterTitle: '第1章', createdAt: now, updatedAt: now } as any)
  await addRow('storyTimelineEvents', { projectId, chapterId: chapter, title: '获得青锋剑', createdAt: now, updatedAt: now } as any)
  await addRow('notes', { projectId, title: '灵感', content: '记一笔', createdAt: now, updatedAt: now } as any)

  // ── 参考书 + 分块分析(creativeRules 引用 reference) ──
  const ref1 = await addRow('references', { projectId, title: '斗破苍穹', author: '天蚕土豆', type: 'story', note: '参考爽点', createdAt: now, updatedAt: now } as any) as number
  await addRow('referenceChunkAnalysis', { referenceId: ref1, chunkIndex: 0, openingTechnique: '天才陨落钩子', createdAt: now, updatedAt: now } as any)
  await addRow('creativeRules', {
    projectId,
    citedReferenceIds: JSON.stringify([ref1]),
    content: '多爽点',
    createdAt: now,
    updatedAt: now,
  } as any)

  // ── 词条(树,wgA) ──
  const cat = await addRow('codexCategories', { projectId, worldGroupId: wgA, parentId: null, name: '势力', order: 0, createdAt: now, updatedAt: now } as any) as number
  const subCat = await addRow('codexCategories', { projectId, worldGroupId: wgA, parentId: cat, name: '宗门', order: 0, createdAt: now, updatedAt: now } as any) as number
  const codexEntry = await addRow('codexEntries', { projectId, worldGroupId: wgA, categoryId: subCat, name: '青云宗', summary: '正道魁首', createdAt: now, updatedAt: now } as any)
  if (options.useDeterministicPrimaryKeys) {
    await db.codexEntries.update(codexEntry, {
      refs: JSON.stringify({ related: [codexEntry] }),
    })
  }

  // ── FB-5 文风画像 ──
  await addRow('userStyleProfiles', { projectId, profile: '简洁明快', enabled: true, createdAt: now, updatedAt: now } as any)

  // ── NS-4 时序事实账本（带分类型 FK，供全表往返覆盖） ──
  await addRow('temporalFacts', { projectId, worldGroupId: wgA, characterId: char1, subjectName: '林惊羽', predicate: 'powerStage', factKind: 'state', value: '炼气一层', sourceType: 'chapter', sourceChapterId: chapter, validFromChapterId: chapter, status: 'confirmed', locked: false, createdAt: now, updatedAt: now } as any)

  return {
    projectId,
    wgA,
    wgB,
    char1,
    char2,
    vol,
    volumeIds,
    chapNode,
    chapter,
    chapNodeIds,
    chapterIds,
    ref1,
    cat,
    subCat,
    rootWorld,
    mirrorWorld,
    locParent,
  }
}

/** 所有 exportable 的项目级表名(可按 projectId 查;排除 projects 与 direct-child referenceChunkAnalysis) */
export const EXPORTABLE_PROJECT_TABLES = PROJECT_TABLES
  .filter(s => s.exportable && s.name !== 'projects' && s.name !== 'referenceChunkAnalysis')
  .map(s => s.name)
