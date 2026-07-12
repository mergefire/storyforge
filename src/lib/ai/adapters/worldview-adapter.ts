import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'
import { composeFieldGenerationHint, type FieldGenerationMode } from '../field-generation-context'

const DIMENSION_LABELS: Record<string, string> = {
  origin: '世界来源',
  power: '力量体系',
  divine: '神明与信仰',
  geography: '地理环境',
  history: '历史年表',
  society: '社会结构',
  culture: '文化与宗教',
  economy: '经济体系',
  rules: '世界规则/物理法则',
  summary: '世界观精华摘要',
}

export interface RunOptions {
  parameterValues?: Record<string, unknown>
  overrides?: { systemPrompt?: string; userPromptTemplate?: string }
}

function getWorldviewFieldBoundary(dimension: string): string {
  const label = DIMENSION_LABELS[dimension] || dimension
  if (label === '世界来源') {
    return [
      '【字段边界】本次只生成“世界来源”：世界如何诞生、历史来源、文明起点、核心起源事件。',
      '不要展开力量等级、修炼/科技晋升路径、能力数值或战斗体系；已有“力量体系”只能作为约束条件，不能反向吞并或改写世界来源。',
      '如果上下文中的力量体系与世界来源冲突，请保留世界来源事实，并简短说明需要协调的冲突点。',
    ].join('\n')
  }
  if (label === '力量体系') {
    return [
      '【字段边界】本次只生成“力量体系”：力量来源、层级结构、晋升方式、使用代价、限制与失控风险。',
      '不要改写世界来源、创世神话、历史起点或文明起源；已有“世界来源”是上游事实，必须保持一致。',
      '如果力量体系设想与世界来源冲突，请明确标注冲突点，并给出兼容方案，不要静默覆盖原设定。',
    ].join('\n')
  }
  if (label === '神明与信仰' || label === '神明与信仰设定') {
    return [
      '【字段边界】本次只生成”神明与信仰”：信仰层级、神明名号、职司、仪式、禁忌与规则。',
      '不要改写世界来源或力量体系；若信仰设定需要解释两者关系，只能作为补充说明，并保持已有事实不变。',
    ].join('\n')
  }
  // 通用兜底边界：对所有没有专门规则的维度，也做字段隔离约束
  return [
    `【字段边界】本次只生成”${label}”相关内容。`,
    '上下文中列出的其他维度仅供参考以保持一致性，不要将其内容重复、展开或混入本次输出。',
    '不要生成其他维度/字段的内容，不要用标题列举多个维度，专注于当前指定维度即可。',
  ].join('\n')
}

/** 生成世界观某个维度（API 与旧 src/lib/ai/prompts/worldview.ts 一致） */
export function buildWorldviewPrompt(
  dimension: string,
  projectName: string,
  genre: string,
  existingContext: string,
  userHint?: string,
  options?: RunOptions,
  currentValue?: string,
  mode: FieldGenerationMode = 'expand',
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('worldview.dimension')
  const label = DIMENSION_LABELS[dimension] || dimension
  const boundary = getWorldviewFieldBoundary(dimension)
  const worldRulesContext = typeof options?.parameterValues?.worldRulesContext === 'string'
    ? options.parameterValues.worldRulesContext
    : ''
  const effectiveHint = [boundary, composeFieldGenerationHint(userHint, currentValue, mode)]
    .filter(Boolean)
    .join('\n\n')
  const { messages } = renderPrompt(tpl, {
    projectName,
    genres: genre,
    dimension: label,
    worldContext: existingContext,
    currentValue: currentValue || '',
    generationMode: mode,
    worldRulesContext,
    userHint: effectiveHint,
    isSummary: dimension === 'summary' ? '1' : '',
  }, options)
  return messages
}
