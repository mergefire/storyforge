import { db } from '../../src/lib/db/schema'
import { D04_FIXTURE_CLOCK_MS, stableFixtureNumericId } from './d04-fixture-kit'
import { seedFullProject } from './seed-full-project'

const FIXTURE_ID = 'large-synthetic-v1'
const VOLUME_COUNT = 10
const TARGETS = Object.freeze({
  chapters: 1_000,
  outlineNodes: 1_010,
  characters: 64,
  characterRelations: 257,
  worldNodes: 128,
  importantLocations: 128,
  foreshadows: 128,
  codexEntries: 128,
  temporalFacts: 2_000,
  stateCards: 128,
  storyArcs: 16,
  itemLedger: 1_000,
  storyTimelineEvents: 1_000,
  notes: 256,
  references: 32,
  referenceChunkAnalysis: 128,
  creativeRules: 8,
})

async function addRows(tableName: string, rows: Array<Record<string, unknown>>): Promise<number[]> {
  const startOrdinal = await db.table(tableName).count()
  const ids: number[] = []
  for (const [offset, row] of rows.entries()) {
    const id = stableFixtureNumericId(FIXTURE_ID, tableName, startOrdinal + offset)
    await db.table(tableName).add({ ...row, id })
    ids.push(id)
  }
  return ids
}

async function idsFor(tableName: string): Promise<number[]> {
  const rows = await db.table(tableName).toArray() as Array<{ id: number }>
  return rows.map(row => row.id)
}

function repeatRows(count: number, build: (index: number) => Record<string, unknown>) {
  return Array.from({ length: count }, (_, index) => build(index))
}

export async function seedLargeSyntheticProject() {
  const now = D04_FIXTURE_CLOCK_MS
  const seeded = await seedFullProject({
    fixtureId: FIXTURE_ID,
    projectName: 'D0.4 large-synthetic-v1',
    chapterCount: TARGETS.chapters,
    volumeCount: VOLUME_COUNT,
    nonWhitespaceCharactersPerChapter: 5_000,
    useDeterministicPrimaryKeys: true,
    includeSecondaryWorldGroup: false,
  })
  const { projectId, wgA, subCat, chapterIds, chapNodeIds } = seeded

  await addRows('characters', repeatRows(TARGETS.characters - 2, index => ({
    projectId,
    homeWorldGroupId: wgA,
    name: `合成角色${index + 3}`,
    role: 'supporting',
    roleWeight: index % 7 === 0 ? 'major' : 'minor',
    moralAxis: ['good', 'neutral', 'evil'][index % 3],
    orderAxis: ['lawful', 'neutral', 'chaotic'][index % 3],
    personality: `角色性格-${index % 16}`,
    createdAt: now,
    updatedAt: now,
  })))
  const characterIds = await idsFor('characters')
  await addRows('characterRelations', repeatRows(TARGETS.characterRelations - 1, index => ({
    projectId,
    fromCharacterId: characterIds[index % characterIds.length],
    toCharacterId: characterIds[(index + 1 + Math.floor(index / characterIds.length)) % characterIds.length],
    type: ['ally', 'rival', 'mentor', 'family'][index % 4],
    description: `稠密有效关系-${index}`,
    createdAt: now,
    updatedAt: now,
  })))

  const existingWorldNodeIds = await idsFor('worldNodes')
  const addedWorldNodeIds = await addRows('worldNodes', repeatRows(
    TARGETS.worldNodes - existingWorldNodeIds.length,
    index => ({
      projectId,
      worldGroupId: wgA,
      parentId: existingWorldNodeIds[index % existingWorldNodeIds.length],
      name: `图谱节点${index + existingWorldNodeIds.length + 1}`,
      description: `用于画布负载的合成节点-${index}`,
      sortOrder: index + existingWorldNodeIds.length,
      createdAt: now,
      updatedAt: now,
    }),
  ))
  const worldNodeIds = [...existingWorldNodeIds, ...addedWorldNodeIds]
  for (const [index, id] of worldNodeIds.entries()) {
    await db.worldNodes.update(id, {
      portalsJSON: JSON.stringify([1, 2, 3].map(distance => ({
        name: `通道-${distance}`,
        targetWorldId: worldNodeIds[(index + distance) % worldNodeIds.length],
        x: (index * 17 + distance) % 997,
        y: (index * 31 + distance) % 991,
      }))),
    })
  }

  const existingLocationIds = await idsFor('importantLocations')
  await addRows('importantLocations', repeatRows(
    TARGETS.importantLocations - existingLocationIds.length,
    index => ({
      projectId,
      parentId: existingLocationIds[index % existingLocationIds.length],
      name: `合成地点${index + existingLocationIds.length + 1}`,
      type: ['city', 'ruin', 'forest', 'fortress'][index % 4],
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    }),
  ))
  const locationIds = await idsFor('importantLocations')

  await addRows('foreshadows', repeatRows(TARGETS.foreshadows - 1, index => ({
    projectId,
    name: `合成伏笔${index + 2}`,
    type: ['item', 'event', 'identity'][index % 3],
    status: 'planted',
    description: `长篇伏笔-${index}`,
    createdAt: now,
    updatedAt: now,
  })))
  const foreshadowIds = await idsFor('foreshadows')

  await addRows('codexEntries', repeatRows(TARGETS.codexEntries - 1, index => ({
    projectId,
    worldGroupId: wgA,
    categoryId: subCat,
    name: `合成词条${index + 2}`,
    summary: `图谱与记忆检索词条-${index}`,
    order: index + 1,
    createdAt: now,
    updatedAt: now,
  })))
  const codexEntryIds = await idsFor('codexEntries')
  for (const [index, id] of codexEntryIds.entries()) {
    await db.codexEntries.update(id, {
      refs: JSON.stringify({
        related: [
          codexEntryIds[(index + 1) % codexEntryIds.length],
          codexEntryIds[(index + 7) % codexEntryIds.length],
        ],
        contrasts: [codexEntryIds[(index + codexEntryIds.length - 1) % codexEntryIds.length]],
      }),
    })
  }

  const detailedOutlines = await db.detailedOutlines.toArray()
  const detailByOutlineId = new Map(detailedOutlines.map(row => [row.outlineNodeId, row.id] as const))
  for (let index = 0; index < chapNodeIds.length; index += 1) {
    const detailId = detailByOutlineId.get(chapNodeIds[index])
    if (detailId === undefined) throw new Error(`large fixture detailed outline missing at ${index}`)
    const appearingCharacterIds = Array.from(
      { length: 8 },
      (_, offset) => characterIds[(index + offset * 7) % characterIds.length],
    )
    const selectedForeshadows = Array.from(
      { length: 4 },
      (_, offset) => foreshadowIds[(index + offset * 11) % foreshadowIds.length],
    )
    await db.detailedOutlines.update(detailId, {
      openingHook: `固定开场钩子-${index}`,
      endingCliffhanger: `固定结尾悬念-${index}`,
      appearingCharacterIds,
      foreshadowIds: selectedForeshadows,
      scenes: Array.from({ length: 3 }, (_, sceneIndex) => ({
        sceneId: `large-${index}-${sceneIndex}`,
        title: `场景${sceneIndex + 1}`,
        summary: `编辑器与细纲负载-${index}-${sceneIndex}`,
        characterIds: appearingCharacterIds.slice(sceneIndex, sceneIndex + 5),
        location: `地点${(index + sceneIndex) % locationIds.length}`,
        conflict: `冲突${(index * 3 + sceneIndex) % 64}`,
      })),
    })
  }

  await addRows('storyArcs', repeatRows(TARGETS.storyArcs - 1, index => ({
    projectId,
    type: index % 3 === 0 ? 'main' : 'subplot',
    name: `长篇故事线${index + 2}`,
    stages: JSON.stringify(chapterIds.filter((_, chapterIndex) => chapterIndex % 64 === index)),
    createdAt: now,
    updatedAt: now,
  })))
  const storyArcIds = await idsFor('storyArcs')

  await addRows('stateCards', repeatRows(TARGETS.stateCards - 1, index => ({
    projectId,
    category: 'character',
    entityName: `合成角色${(index % characterIds.length) + 1}`,
    fields: JSON.stringify([{ key: '状态', value: `阶段-${index % 32}` }]),
    createdAt: now,
    updatedAt: now,
  })))
  await addRows('itemLedger', repeatRows(TARGETS.itemLedger - 1, index => ({
    projectId,
    itemName: `物品${index % 128}`,
    action: index % 2 === 0 ? 'gain' : 'use',
    quantity: 1,
    chapterId: chapterIds[index + 1],
    chapterTitle: `第${index + 2}章`,
    createdAt: now,
    updatedAt: now,
  })))
  await addRows('storyTimelineEvents', repeatRows(
    TARGETS.storyTimelineEvents - 1,
    index => ({
      projectId,
      chapterId: chapterIds[index + 1],
      title: `长篇时间线事件-${index + 2}`,
      order: index + 1,
      createdAt: now,
      updatedAt: now,
    }),
  ))
  await addRows('notes', repeatRows(TARGETS.notes - 1, index => ({
    projectId,
    chapterId: chapterIds[index % chapterIds.length],
    title: `合成笔记${index + 2}`,
    content: `固定笔记内容-${index}`,
    pinned: index % 17 === 0,
    createdAt: now,
    updatedAt: now,
  })))

  await addRows('references', repeatRows(TARGETS.references - 1, index => ({
    projectId,
    title: `合成参考作品${index + 2}`,
    author: `合成作者${index % 8}`,
    type: 'story',
    note: `只含确定性合成内容-${index}`,
    createdAt: now,
    updatedAt: now,
  })))
  const referenceIds = await idsFor('references')
  const existingReferenceChunkCount = await db.referenceChunkAnalysis.count()
  await addRows('referenceChunkAnalysis', repeatRows(
    TARGETS.referenceChunkAnalysis - existingReferenceChunkCount,
    index => ({
      referenceId: referenceIds[Math.floor((index + 1) / 4) % referenceIds.length],
      chunkIndex: (index + 1) % 4,
      openingTechnique: `确定性分析片段-${index}`,
      createdAt: now,
      updatedAt: now,
    }),
  ))
  await addRows('creativeRules', repeatRows(TARGETS.creativeRules - 1, index => ({
    projectId,
    citedReferenceIds: JSON.stringify(Array.from(
      { length: 16 },
      (_, offset) => referenceIds[(index * 5 + offset) % referenceIds.length],
    )),
    content: `长篇创作规则-${index + 2}`,
    createdAt: now,
    updatedAt: now,
  })))

  await addRows('temporalFacts', repeatRows(TARGETS.temporalFacts - 1, index => ({
    projectId,
    worldGroupId: wgA,
    characterId: characterIds[index % characterIds.length],
    locationId: locationIds[index % locationIds.length],
    storyArcId: storyArcIds[index % storyArcIds.length],
    codexEntryId: codexEntryIds[index % codexEntryIds.length],
    objectCharacterId: characterIds[(index + 1) % characterIds.length],
    objectLocationId: locationIds[(index + 3) % locationIds.length],
    objectCodexEntryId: codexEntryIds[(index + 5) % codexEntryIds.length],
    subjectName: `记忆主体-${index % characterIds.length}`,
    predicate: 'location',
    factKind: 'state',
    value: `记忆值-${index % 256}`,
    sourceType: 'chapter',
    sourceChapterId: chapterIds[index % chapterIds.length],
    validFromChapterId: chapterIds[index % chapterIds.length],
    status: index % 5 === 0 ? 'candidate' : 'confirmed',
    locked: index % 29 === 0,
    createdAt: now,
    updatedAt: now,
  })))

  return { ...seeded, targetCounts: TARGETS }
}
