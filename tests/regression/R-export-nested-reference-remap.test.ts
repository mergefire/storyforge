/**
 * R-export-nested-reference-remap · AUDIT-1b
 *
 * v4 exports encode portable array/JSON references as target-table export indexes.
 * Import must remap those indexes to the newly allocated target IDs without changing
 * array/scene order, duplicate entries, JSON-string storage, or unrelated business data.
 * Legacy v3 backups keep their historical raw nested IDs and are never reinterpreted.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../../src/lib/db/schema'
import { deriveExportProjectJSON } from '../../src/lib/export/registry-export'
import { exportProjectJSON, importProjectJSON, type ProjectExportData } from '../../src/lib/export/json-export'
import { NESTED_REF_ENCODING, PROJECT_EXPORT_VERSION } from '../../src/lib/export/export-format'
import { PROJECT_TABLES } from '../../src/lib/registry/project-tables'

const NOW = 1_780_000_000_000
const LEGACY_V3_FIXTURE = path.resolve(__dirname, '../fixtures/legacy-export-v3.json')

const SOURCE_IDS = {
  project: 8_000_000_000_101,
  outline: 8_100_000_000_401,
  detailedOutline: 8_200_000_000_613,
  characterZero: 8_300_000_000_001,
  characterOne: 8_300_000_000_997,
  foreshadowZero: 8_400_000_000_003,
  foreshadowOne: 8_400_000_000_811,
  referenceZero: 8_500_000_000_005,
  referenceOne: 8_500_000_000_923,
  creativeRules: 8_600_000_000_719,
  codexCategory: 8_700_000_000_211,
  codexEntryZero: 8_800_000_000_007,
  codexEntryOne: 8_800_000_000_877,
} as const

const SOURCE_SCENES = [
  {
    sceneId: 'scene-first',
    title: '先遇见角色一',
    summary: '重复引用角色零，顺序不可变化',
    characterIds: [
      SOURCE_IDS.characterOne,
      SOURCE_IDS.characterZero,
      SOURCE_IDS.characterZero,
    ],
    location: '北门',
    conflict: '身份误认',
    pace: 'fast',
    estimatedWords: 880,
    notes: '场景一备注',
  },
  {
    sceneId: 'scene-second',
    title: '再回到角色零',
    summary: '第二场景证明场景顺序保持',
    characterIds: [SOURCE_IDS.characterZero, SOURCE_IDS.characterOne],
    location: '钟楼',
    conflict: '时间不足',
    pace: 'climax',
    estimatedWords: 1_120,
    notes: '场景二备注',
  },
] as const

function cloneExport(data: ProjectExportData): ProjectExportData {
  return JSON.parse(JSON.stringify(data)) as ProjectExportData
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
}

async function seedNestedReferenceFixture(): Promise<number> {
  const ids = Object.values(SOURCE_IDS)
  expect(ids.every(id => Number.isSafeInteger(id) && id > 8_000_000_000_000)).toBe(true)
  expect(SOURCE_IDS.characterOne - SOURCE_IDS.characterZero).toBeGreaterThan(1)

  await db.projects.add({
    id: SOURCE_IDS.project,
    name: 'AUDIT-1b 高位主键夹具',
    genre: 'fantasy',
    genres: ['fantasy'],
    description: 'v4 nested reference integration fixture',
    targetWordCount: 20_000,
    enableMultiWorld: false,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)

  // Deliberately insert the larger key first. Export indexes are derived from the
  // query result, never from insertion order or the source database ID itself.
  await db.characters.add({
    id: SOURCE_IDS.characterOne,
    projectId: SOURCE_IDS.project,
    name: '角色一',
    role: 'supporting',
    roleWeight: 'supporting',
    moralAxis: 'neutral',
    orderAxis: 'neutral',
    personality: '冷静',
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.characters.add({
    id: SOURCE_IDS.characterZero,
    projectId: SOURCE_IDS.project,
    name: '角色零',
    role: 'protagonist',
    roleWeight: 'main',
    moralAxis: 'good',
    orderAxis: 'neutral',
    personality: '果断',
    createdAt: NOW,
    updatedAt: NOW,
  } as any)

  await db.foreshadows.add({
    id: SOURCE_IDS.foreshadowOne,
    projectId: SOURCE_IDS.project,
    name: '伏笔一',
    type: 'event',
    status: 'planted',
    description: '后置伏笔',
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.foreshadows.add({
    id: SOURCE_IDS.foreshadowZero,
    projectId: SOURCE_IDS.project,
    name: '伏笔零',
    type: 'item',
    status: 'planted',
    description: '首个伏笔',
    createdAt: NOW,
    updatedAt: NOW,
  } as any)

  await db.outlineNodes.add({
    id: SOURCE_IDS.outline,
    projectId: SOURCE_IDS.project,
    parentId: null,
    type: 'chapter',
    title: '嵌套引用章节',
    summary: '验证数组与 JSON-string 引用',
    order: 7,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.detailedOutlines.add({
    id: SOURCE_IDS.detailedOutline,
    projectId: SOURCE_IDS.project,
    outlineNodeId: SOURCE_IDS.outline,
    openingHook: '业务字段：从旧钟声开始',
    endingCliffhanger: '业务字段：门后仍有人',
    sceneLocation: '旧城',
    appearingCharacterIds: [
      SOURCE_IDS.characterZero,
      SOURCE_IDS.characterZero,
      SOURCE_IDS.characterOne,
    ],
    foreshadowIds: [
      SOURCE_IDS.foreshadowZero,
      SOURCE_IDS.foreshadowOne,
      SOURCE_IDS.foreshadowZero,
    ],
    scenes: SOURCE_SCENES.map(scene => ({ ...scene, characterIds: [...scene.characterIds] })),
    emotionArc: 'wave',
    lastUsedSummary: '业务字段：摘要快照',
    createdAt: NOW,
    updatedAt: NOW,
  } as any)

  await db.references.add({
    id: SOURCE_IDS.referenceOne,
    projectId: SOURCE_IDS.project,
    title: '参考一',
    author: '作者乙',
    type: 'story',
    note: '第二本参考',
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.references.add({
    id: SOURCE_IDS.referenceZero,
    projectId: SOURCE_IDS.project,
    title: '参考零',
    author: '作者甲',
    type: 'story',
    note: '第一本参考',
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.creativeRules.add({
    id: SOURCE_IDS.creativeRules,
    projectId: SOURCE_IDS.project,
    writingStyle: '业务字段：短句与留白',
    narrativePOV: 'third-limited',
    toneAndMood: '克制',
    prohibitions: JSON.stringify(['不得改变顺序']),
    consistencyRules: JSON.stringify(['重复引用必须保留']),
    specialRequirements: 'JSON string 存储形态必须保留',
    referenceWorks: '[]',
    citedReferenceIds: JSON.stringify([
      SOURCE_IDS.referenceZero,
      SOURCE_IDS.referenceOne,
      SOURCE_IDS.referenceZero,
    ]),
    createdAt: NOW,
    updatedAt: NOW,
  } as any)

  await db.codexCategories.add({
    id: SOURCE_IDS.codexCategory,
    projectId: SOURCE_IDS.project,
    parentId: null,
    name: '人物关系',
    domain: 'character',
    fieldSchema: '[]',
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.codexEntries.add({
    id: SOURCE_IDS.codexEntryOne,
    projectId: SOURCE_IDS.project,
    categoryId: SOURCE_IDS.codexCategory,
    name: '词条一',
    summary: '被词条零引用',
    description: '业务字段：第二词条',
    fields: '{}',
    refs: JSON.stringify({ allies: [SOURCE_IDS.codexEntryZero] }),
    tags: JSON.stringify(['第二']),
    order: 1,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)
  await db.codexEntries.add({
    id: SOURCE_IDS.codexEntryZero,
    projectId: SOURCE_IDS.project,
    categoryId: SOURCE_IDS.codexCategory,
    name: '词条零',
    summary: '覆盖 export index 0 与重复引用',
    description: '业务字段：第一词条',
    fields: '{}',
    refs: JSON.stringify({
      allies: [
        SOURCE_IDS.codexEntryOne,
        SOURCE_IDS.codexEntryZero,
        SOURCE_IDS.codexEntryZero,
      ],
      rivals: [SOURCE_IDS.codexEntryZero],
    }),
    tags: JSON.stringify(['第一', '重复']),
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  } as any)

  return SOURCE_IDS.project
}

async function exportFixture(): Promise<ProjectExportData> {
  const projectId = await seedNestedReferenceFixture()
  const derived = await deriveExportProjectJSON(projectId)
  const viaFacade = await exportProjectJSON(projectId)

  for (const exported of [derived, viaFacade]) {
    expect(exported.version).toBe(PROJECT_EXPORT_VERSION)
    expect(exported.version).toBe(4)
    expect(exported.nestedRefEncoding).toBe(NESTED_REF_ENCODING)
    expect(exported.nestedRefEncoding).toBe('export-index-v1')
  }
  expect(viaFacade.detailedOutlines).toEqual(derived.detailedOutlines)
  expect(viaFacade.creativeRules).toEqual(derived.creativeRules)
  expect(viaFacade.codexEntries).toEqual(derived.codexEntries)
  return viaFacade
}

describe('R-export-nested-reference-remap · AUDIT-1b', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(() => {
    db.close()
  })

  it('v4 导出使用 export index，清库导入后数组/JSON 引用全部指向新 ID 且业务顺序不变', async () => {
    const exported = await exportFixture()

    expect(exported.characters.map(row => row.name)).toEqual(['角色零', '角色一'])
    expect(exported.foreshadows.map(row => row.name)).toEqual(['伏笔零', '伏笔一'])
    expect(exported.references?.map(row => row.title)).toEqual(['参考零', '参考一'])
    expect(exported.codexEntries?.map(row => row.name)).toEqual(['词条零', '词条一'])

    const exportedDetail = exported.detailedOutlines![0] as any
    expect(exportedDetail.appearingCharacterIds).toEqual([0, 0, 1])
    expect(exportedDetail.scenes.map((scene: any) => scene.characterIds)).toEqual([
      [1, 0, 0],
      [0, 1],
    ])
    expect(exportedDetail.foreshadowIds).toEqual([0, 1, 0])
    expect(JSON.parse((exported.creativeRules![0] as any).citedReferenceIds)).toEqual([0, 1, 0])
    expect(JSON.parse(exported.codexEntries![0].refs!)).toEqual({
      allies: [1, 0, 0],
      rivals: [0],
    })

    await resetDatabase()
    const importedProjectId = await importProjectJSON(exported)

    const importedCharacters = await db.characters.where('projectId').equals(importedProjectId).toArray()
    const characterZero = importedCharacters.find(row => row.name === '角色零')!
    const characterOne = importedCharacters.find(row => row.name === '角色一')!
    expect(characterZero.id).not.toBe(SOURCE_IDS.characterZero)
    expect(characterOne.id).not.toBe(SOURCE_IDS.characterOne)

    const importedForeshadows = await db.foreshadows.where('projectId').equals(importedProjectId).toArray()
    const foreshadowZero = importedForeshadows.find(row => row.name === '伏笔零')!
    const foreshadowOne = importedForeshadows.find(row => row.name === '伏笔一')!

    const importedDetail = await db.detailedOutlines.where('projectId').equals(importedProjectId).first()
    expect(importedDetail).toBeDefined()
    expect(importedDetail!.appearingCharacterIds).toEqual([
      characterZero.id,
      characterZero.id,
      characterOne.id,
    ])
    expect(importedDetail!.foreshadowIds).toEqual([
      foreshadowZero.id,
      foreshadowOne.id,
      foreshadowZero.id,
    ])
    expect(importedDetail!.scenes).toEqual([
      {
        ...SOURCE_SCENES[0],
        characterIds: [characterOne.id, characterZero.id, characterZero.id],
      },
      {
        ...SOURCE_SCENES[1],
        characterIds: [characterZero.id, characterOne.id],
      },
    ])
    expect(importedDetail).toMatchObject({
      openingHook: '业务字段：从旧钟声开始',
      endingCliffhanger: '业务字段：门后仍有人',
      sceneLocation: '旧城',
      emotionArc: 'wave',
      lastUsedSummary: '业务字段：摘要快照',
    })
    const importedOutline = await db.outlineNodes.where('projectId').equals(importedProjectId).first()
    expect(importedDetail!.outlineNodeId).toBe(importedOutline!.id)

    const importedReferences = await db.references.where('projectId').equals(importedProjectId).toArray()
    const referenceZero = importedReferences.find(row => row.title === '参考零')!
    const referenceOne = importedReferences.find(row => row.title === '参考一')!
    const importedRules = await db.creativeRules.where('projectId').equals(importedProjectId).first()
    expect(typeof importedRules!.citedReferenceIds).toBe('string')
    expect(JSON.parse(importedRules!.citedReferenceIds!)).toEqual([
      referenceZero.id,
      referenceOne.id,
      referenceZero.id,
    ])
    expect(importedRules).toMatchObject({
      writingStyle: '业务字段：短句与留白',
      specialRequirements: 'JSON string 存储形态必须保留',
    })

    const importedEntries = await db.codexEntries.where('projectId').equals(importedProjectId).toArray()
    const codexEntryZero = importedEntries.find(row => row.name === '词条零')!
    const codexEntryOne = importedEntries.find(row => row.name === '词条一')!
    expect(codexEntryZero.id).not.toBe(SOURCE_IDS.codexEntryZero)
    expect(codexEntryOne.id).not.toBe(SOURCE_IDS.codexEntryOne)
    expect(typeof codexEntryZero.refs).toBe('string')
    expect(JSON.parse(codexEntryZero.refs!)).toEqual({
      allies: [codexEntryOne.id, codexEntryZero.id, codexEntryZero.id],
      rivals: [codexEntryZero.id],
    })
    expect(codexEntryZero).toMatchObject({
      summary: '覆盖 export index 0 与重复引用',
      description: '业务字段：第一词条',
      tags: JSON.stringify(['第一', '重复']),
      order: 0,
    })
  })

  it('v4 嵌套映射被篡改为不存在的 export index 时整体回滚，不留下项目或半数据', async () => {
    const broken = cloneExport(await exportFixture())
    ;(broken.detailedOutlines![0] as any).appearingCharacterIds = [0, 999_999]

    await resetDatabase()
    await expect(importProjectJSON(broken)).rejects.toThrow(/appearingCharacterIds/)

    for (const spec of PROJECT_TABLES.filter(row => row.exportable)) {
      expect(await spec.table.count(), `${spec.name} 不应留下半导入数据`).toBe(0)
    }
  })

  it('真实 legacy v3 fixture 仍可导入，嵌套数字保持历史 raw ID 语义而不按 v4 index 解释', async () => {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_V3_FIXTURE, 'utf8')) as ProjectExportData
    expect(legacy.version).toBe(3)
    expect(legacy.nestedRefEncoding).toBeUndefined()

    const legacyAppearingIds = [...((legacy.detailedOutlines![0] as any).appearingCharacterIds as number[])]
    const legacySceneIds = (legacy.detailedOutlines![0] as any).scenes.map(
      (scene: any) => [...scene.characterIds] as number[],
    )
    const legacyCitedIds = (legacy.creativeRules![0] as any).citedReferenceIds

    const importedProjectId = await importProjectJSON(legacy)
    const importedDetail = await db.detailedOutlines.where('projectId').equals(importedProjectId).first()
    const importedRules = await db.creativeRules.where('projectId').equals(importedProjectId).first()

    expect(importedDetail!.appearingCharacterIds).toEqual(legacyAppearingIds)
    expect(importedDetail!.scenes.map(scene => scene.characterIds)).toEqual(legacySceneIds)
    expect((importedRules as any).citedReferenceIds).toEqual(legacyCitedIds)
  })

  it('v4 marker 缺失/错误或未来版本时 fail closed 且不创建项目', async () => {
    const valid = await exportFixture()
    await resetDatabase()

    const invalidCases: Array<{ label: string; marker: string | undefined }> = [
      { label: 'missing', marker: undefined },
      { label: 'wrong', marker: 'source-db-id-v1' },
    ]

    for (const testCase of invalidCases) {
      const invalid = cloneExport(valid) as ProjectExportData & { nestedRefEncoding?: string }
      if (testCase.marker === undefined) delete invalid.nestedRefEncoding
      else invalid.nestedRefEncoding = testCase.marker

      await expect(importProjectJSON(invalid as ProjectExportData), testCase.label)
        .rejects.toThrow(/nestedRefEncoding=export-index-v1/)
      expect(await db.projects.count(), `${testCase.label} marker 不应创建项目`).toBe(0)
    }

    const future = cloneExport(valid)
    future.version = PROJECT_EXPORT_VERSION + 1
    await expect(importProjectJSON(future)).rejects.toThrow(
      `unsupported export version ${PROJECT_EXPORT_VERSION + 1}`,
    )
    expect(await db.projects.count(), '未来版本不应创建项目').toBe(0)
  })
})
