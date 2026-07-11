import { describe, expect, it } from 'vitest'

import { buildHumanityEnvironmentContext } from '../../src/lib/worldview-humanity-context'

describe('worldview humanity environment generation context', () => {
  it('keeps sibling humanity fields, including cities, as full fixed facts for the next generated field', () => {
    const longHistory = `大初立国于赤河下游。${'盐铁官营与河运税构成早期国本。'.repeat(12)}终点标记-大初国号不得改写。`

    const context = buildHumanityEnvironmentContext({
      worldview: {
        projectId: 1,
        geography: '',
        history: '',
        society: '',
        culture: '',
        economy: '',
        rules: '',
        summary: '',
        worldOrigin: '天陨之后诸族沿赤河迁徙。',
        continentLayout: '东境赤砂台地与赤河古道相连。',
      },
      values: {
        history: longHistory,
        events: '赤河盟约确立了诸侯朝贡秩序。',
        races: '人族与山民长期通婚，形成赤河民系。',
        factions: '盐铁司、河运总署与边军三方制衡。',
        cities: '帝都赤京位于赤河下游，不在北境雪岭。',
        pec: '旧政经草稿不应在生成政经文化时重复注入。',
        conflicts: '盐税与军费矛盾贯穿前三卷。',
        items: '赤铜符牌是官府通行凭证。',
      },
      skipKey: 'pec',
    })

    expect(context).toContain('【世界历史线】')
    expect(context).toContain('终点标记-大初国号不得改写')
    expect(context).toContain('【城池重镇】帝都赤京位于赤河下游')
    expect(context).toContain('【势力分布】盐铁司、河运总署与边军三方制衡。')
    expect(context).toContain('【矛盾冲突】盐税与军费矛盾贯穿前三卷。')
    expect(context).not.toContain('旧政经草稿不应在生成政经文化时重复注入')
  })
})
