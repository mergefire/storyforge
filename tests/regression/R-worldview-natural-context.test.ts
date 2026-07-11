import { describe, expect, it } from 'vitest'

import { buildNaturalEnvironmentContext } from '../../src/lib/worldview-natural-context'

describe('worldview natural environment generation context', () => {
  it('keeps sibling natural fields as full fixed facts for the next generated field', () => {
    const longTerrain = `东境为赤砂台地。${'连绵盐岭与赤河古道构成商路边界。'.repeat(12)}终点标记-赤河不得改道。`

    const context = buildNaturalEnvironmentContext({
      worldview: {
        projectId: 1,
        geography: '',
        history: '',
        society: '',
        culture: '',
        economy: '',
        rules: '',
        summary: '',
        worldOrigin: '天陨之后诸国沿赤河建城。',
      },
      values: {
        continentLayout: longTerrain,
        mountainsRivers: '赤河自西北雪岭入东海，是东境诸城的生命线。',
        naturalResourceOverview: '盐、赤铜与耐旱灵草集中在赤砂台地。',
        climateByRegion: '旧气候草稿不应在生成气候时重复注入。',
      },
      naturalResources: {
        rareCreatures: '赤鬃驼',
        herbs: '旱莲草',
        minerals: '赤铜矿',
        others: '盐砖',
      },
      skipKey: 'climateByRegion',
    })

    expect(context).toContain('【地貌分布】')
    expect(context).toContain('终点标记-赤河不得改道')
    expect(context).toContain('【山川水系】赤河自西北雪岭入东海')
    expect(context).toContain('【自然资源】盐、赤铜与耐旱灵草集中在赤砂台地。')
    expect(context).toContain('【自然物产】珍禽异兽：赤鬃驼；灵药草药：旱莲草；矿石矿料：赤铜矿；其他物产：盐砖')
    expect(context).not.toContain('旧气候草稿不应在生成气候时重复注入')
  })
})
