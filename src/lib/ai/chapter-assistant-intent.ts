import type { ChapterAssistantInteractionMode } from '../../stores/chapter-ai-chat'

export type ResolvedChapterAssistantMode = Exclude<ChapterAssistantInteractionMode, 'auto'>

const DIRECT_WRITING_INTENT = /(?:生成|写(?:出|一|这|本|个|段|章|正文)?|续写|补写|扩写|改写|重写|润色|精简|压缩|删减|修改|改(?:得|为|成|一下|一遍|掉)|更(?:紧凑|简洁|克制|自然|流畅)|调整|替换|换成|加入|补充|去\s*AI\s*味)/iu

/**
 * “自动判断”只决定本轮是否需要形成可采纳候选，不让模型自行决定写回范围。
 * 明确的写作动词优先；带问题意图的请求保持顾问答复，避免把讨论误当整章替换。
 */
export function resolveChapterAssistantMode(
  requestedMode: ChapterAssistantInteractionMode,
  instruction: string,
): ResolvedChapterAssistantMode {
  if (requestedMode !== 'auto') return requestedMode
  const normalized = instruction.trim()
  if (!normalized) return 'discuss'
  if (DIRECT_WRITING_INTENT.test(normalized)) return 'edit'
  return 'discuss'
}
