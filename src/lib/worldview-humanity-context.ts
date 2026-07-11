import type { Worldview } from './types'

const HUMANITY_FIELD_LABELS = [
  ['history', 'historyLine', '世界历史线'],
  ['events', 'worldEvents', '世界大事记'],
  ['races', 'races', '种族与民族'],
  ['factions', 'factionLayout', '势力分布'],
  ['cities', 'regionDimensions', '城池重镇'],
  ['pec', 'politicsEconomyCulture', '政治/经济/文化'],
  ['conflicts', 'internalConflicts', '矛盾冲突'],
  ['items', 'itemDesign', '道具与器物'],
] as const

type HumanityUiKey = typeof HUMANITY_FIELD_LABELS[number][0]
type HumanityWorldviewKey = typeof HUMANITY_FIELD_LABELS[number][1]

interface BuildHumanityEnvironmentContextInput {
  worldview?: Partial<Worldview> | null
  values?: Record<string, string | undefined>
  skipKey?: string
}

function textFrom(
  worldview: Partial<Worldview> | null | undefined,
  values: Record<string, string | undefined> | undefined,
  uiKey: HumanityUiKey,
  worldviewKey: HumanityWorldviewKey,
): string {
  const value = values && Object.prototype.hasOwnProperty.call(values, uiKey)
    ? values[uiKey]
    : worldview?.[worldviewKey]
  return typeof value === 'string' ? value.trim() : ''
}

export function buildHumanityEnvironmentContext({
  worldview,
  values,
  skipKey,
}: BuildHumanityEnvironmentContextInput): string {
  const parts: string[] = [
    '【人文环境一致性锚点】以下内容是同一世界的既有事实。本次生成只能在这些事实基础上补全当前字段，不得重设国号、历史、种族、势力、城池、制度或与之矛盾。',
  ]

  if (worldview?.summary?.trim()) parts.push(`【世界观摘要】${worldview.summary.trim()}`)
  if (worldview?.worldOrigin?.trim()) parts.push(`【世界起源】${worldview.worldOrigin.trim()}`)
  if (worldview?.powerHierarchy?.trim()) parts.push(`【力量体系】${worldview.powerHierarchy.trim()}`)

  if (worldview?.worldStructure?.trim()) parts.push(`【世界结构】${worldview.worldStructure.trim()}`)
  if (worldview?.continentLayout?.trim()) parts.push(`【地貌分布】${worldview.continentLayout.trim()}`)
  if (worldview?.mountainsRivers?.trim()) parts.push(`【山川水系】${worldview.mountainsRivers.trim()}`)
  if (worldview?.climateByRegion?.trim()) parts.push(`【气候环境】${worldview.climateByRegion.trim()}`)
  if (worldview?.naturalResourceOverview?.trim()) parts.push(`【自然资源】${worldview.naturalResourceOverview.trim()}`)

  for (const [uiKey, worldviewKey, label] of HUMANITY_FIELD_LABELS) {
    if (uiKey === skipKey) continue
    const value = textFrom(worldview, values, uiKey, worldviewKey)
    if (value) parts.push(`【${label}】${value}`)
  }

  return parts.filter(Boolean).join('\n')
}
