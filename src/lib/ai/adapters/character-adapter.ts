import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'
import { composeFieldGenerationHint, type FieldGenerationMode } from '../field-generation-context'

export interface RunOptions {
  parameterValues?: Record<string, unknown>
  overrides?: { systemPrompt?: string; userPromptTemplate?: string }
}

/** 生成角色设定 */
export function buildCharacterPrompt(
  projectName: string,
  genre: string,
  worldContext: string,
  existingCharacters: string,
  userHint?: string,
  options?: RunOptions,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('character.generate')
  const { messages } = renderPrompt(tpl, {
    projectName,
    genres: genre,
    worldContext: worldContext || '（暂无）',
    existingCharacters: existingCharacters || '（暂无）',
    userHint,
  }, options)
  return messages
}

/** AI 丰富角色某个维度 */
export function buildCharacterDimensionPrompt(
  characterName: string,
  dimension: string,
  existingInfo: string,
  worldContext: string,
  options?: RunOptions,
  currentValue?: string,
  mode: FieldGenerationMode = 'expand',
  userHint?: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('character.dimension')
  const genHint = composeFieldGenerationHint(userHint, currentValue, mode)
  const { messages } = renderPrompt(tpl, {
    characterName,
    dimension,
    characterInfo: existingInfo || '（暂无）',
    currentValue: currentValue || '',
    generationMode: mode,
    generationHint: genHint,
    fieldFormat: FIELD_FORMAT_HINTS[dimension] ?? '要具体生动，约 200-400 字。',
    worldContext: worldContext || '（暂无）',
  }, options)
  return messages
}

/**
 * 各维度的输出格式约束。短字段（姓名/简介/单行）避免被生成一大段。
 * 没有注册的维度使用默认的"200-400字"提示。
 */
const FIELD_FORMAT_HINTS: Record<string, string> = {
  '姓名':       '只输出名字本身（1-4个字），不要任何解释、引号或额外内容。',
  '一句话简介':  '只输出一句话（15-40字），不要引号，不要解释。',
  '年龄·性别·种族': '简短填写，如"25岁 · 男 · 人族"，不超过20字。',
  '常驻地点':   '简短填写地点名称，不超过30字。',
  '实力定位/境界': '简短填写，如"筑基中期"或"S级猎人"，不超过20字。',
  '标志性物品/符号': '简短描述，不超过40字。',
}
