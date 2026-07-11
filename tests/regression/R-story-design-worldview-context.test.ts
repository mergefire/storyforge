import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/lib/db/schema'
import { buildStoryDesignGenerationContext } from '../../src/lib/story-design-context'

describe('story design generation context', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    db.close()
  })

  it('reads the full registered worldview context instead of a hand-picked truncated subset', async () => {
    const now = Date.now()
    const projectId = await db.projects.add({
      name: 'Story Design Context Test',
      genre: '架空历史',
      description: '',
      targetWordCount: 0,
      enableMultiWorld: false,
      createdAt: now,
      updatedAt: now,
    } as any) as number

    await db.worldviews.add({
      projectId,
      worldGroupId: null,
      geography: '',
      history: '',
      society: '',
      culture: '',
      economy: '',
      rules: '',
      summary: '',
      worldOrigin: '天陨之后诸族沿赤河迁徙。',
      powerHierarchy: '赤铜符牌决定官府通行权。',
      worldStructure: '赤河、雪岭、东海三域构成主要舞台。',
      continentLayout: `东境赤砂台地连接赤河古道。${'盐铁驿道贯穿南北。'.repeat(20)}终点标记-赤砂台地不得消失。`,
      regionDimensions: '帝都赤京位于赤河下游，不在北境雪岭。',
      mountainsRivers: '赤河自西北雪岭入东海，是东境诸城的生命线。',
      climateByRegion: '赤砂台地干旱多风，赤河下游潮湿多雾。',
      naturalResourceOverview: '盐、赤铜与耐旱灵草集中在赤砂台地。',
      historyLine: '大初立国于赤河下游，盐铁官营成为早期国本。',
      worldEvents: '赤河盟约确立了诸侯朝贡秩序。',
      races: '人族与山民长期通婚，形成赤河民系。',
      factionLayout: '盐铁司、河运总署与边军三方制衡。',
      politicsEconomyCulture: '盐税、河运税与军费构成大初财政主轴。',
      internalConflicts: '旧税制与新军费矛盾贯穿前三卷。',
      itemDesign: '赤铜符牌是官府通行凭证。',
      createdAt: now,
      updatedAt: now,
    } as any)

    await db.storyCores.add({
      projectId,
      logline: '旧约继承人被迫揭开赤河税制的谎言。',
      concept: '以盐铁财政为核心的架空王朝权谋。',
      theme: '制度与自由。',
      centralConflict: '个人良知对抗盐铁官营秩序。',
      plotPattern: '多线并行。',
      storyLines: '',
      mainPlot: '主角从赤京查案一路追到赤砂台地。',
      subPlots: '师徒裂痕与边军旧案。',
      createdAt: now,
      updatedAt: now,
    } as any)

    const context = await buildStoryDesignGenerationContext(projectId, null)

    expect(context).toContain('终点标记-赤砂台地不得消失')
    expect(context).toContain('帝都赤京位于赤河下游')
    expect(context).toContain('盐铁司、河运总署与边军三方制衡')
    expect(context).toContain('旧税制与新军费矛盾贯穿前三卷')
    expect(context).toContain('赤铜符牌是官府通行凭证')
    expect(context).toContain('旧约继承人被迫揭开赤河税制的谎言')
    expect(context).toContain('以盐铁财政为核心的架空王朝权谋')
  })
})
