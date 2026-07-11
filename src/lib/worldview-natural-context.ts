import type { NaturalResources, Worldview } from './types'

const NATURAL_FIELD_LABELS = [
  ['worldStructure', '世界结构'],
  ['worldDimensions', '疆域尺寸'],
  ['continentLayout', '地貌分布'],
  ['mountainsRivers', '山川水系'],
  ['climateByRegion', '气候环境'],
  ['naturalResourceOverview', '自然资源'],
] as const

type NaturalFieldKey = typeof NATURAL_FIELD_LABELS[number][0]

interface BuildNaturalEnvironmentContextInput {
  worldview?: Partial<Worldview> | null
  values?: Record<string, string | undefined>
  naturalResources?: NaturalResources | null
  skipKey?: string
}

function textFrom(
  worldview: Partial<Worldview> | null | undefined,
  values: Record<string, string | undefined> | undefined,
  key: NaturalFieldKey,
): string {
  const value = values && Object.prototype.hasOwnProperty.call(values, key)
    ? values[key]
    : worldview?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function formatNaturalResources(resources: NaturalResources | null | undefined): string {
  if (!resources) return ''
  return [
    resources.rareCreatures && `珍禽异兽：${resources.rareCreatures.trim()}`,
    resources.herbs && `灵药草药：${resources.herbs.trim()}`,
    resources.minerals && `矿石矿料：${resources.minerals.trim()}`,
    resources.others && `其他物产：${resources.others.trim()}`,
  ].filter(Boolean).join('；')
}

export function buildNaturalEnvironmentContext({
  worldview,
  values,
  naturalResources,
  skipKey,
}: BuildNaturalEnvironmentContextInput): string {
  const parts: string[] = [
    '【自然环境一致性锚点】以下内容是同一世界的既有事实。本次生成只能在这些事实基础上补全当前字段，不得重设大陆、河流、气候、资源或与之矛盾。',
  ]

  if (worldview?.worldOrigin?.trim()) parts.push(`【世界来源】${worldview.worldOrigin.trim()}`)
  if (worldview?.powerHierarchy?.trim()) parts.push(`【力量体系】${worldview.powerHierarchy.trim()}`)

  for (const [key, label] of NATURAL_FIELD_LABELS) {
    if (key === skipKey) continue
    const value = textFrom(worldview, values, key)
    if (value) parts.push(`【${label}】${value}`)
  }

  const resourceText = formatNaturalResources(naturalResources ?? worldview?.naturalResources)
  if (resourceText && skipKey !== 'naturalResources') parts.push(`【自然物产】${resourceText}`)

  if (worldview?.historyLine?.trim()) parts.push(`【世界历史线】${worldview.historyLine.trim()}`)
  if (worldview?.races?.trim()) parts.push(`【种族与民族】${worldview.races.trim()}`)
  if (worldview?.factionLayout?.trim()) parts.push(`【势力分布】${worldview.factionLayout.trim()}`)

  return parts.filter(Boolean).join('\n')
}
