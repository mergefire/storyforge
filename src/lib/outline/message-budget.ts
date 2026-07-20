import type { AIConfig, ChatMessage } from '../types'
import { estimateTokens, trimMessagesToFit } from '../ai/context-budget'
import { resolveRequestConfig } from '../ai/client'

export interface OutlineMessageBudgetResult {
  fits: boolean
  totalInputTokens: number
  inputBudget: number
}

export function inspectOutlineMessageBudget(
  messages: ChatMessage[],
  requestedConfig: AIConfig,
  category: 'outline.volume' | 'outline.chapter',
): OutlineMessageBudgetResult {
  const effective = resolveRequestConfig(requestedConfig, { category }).config
  const checked = trimMessagesToFit(
    messages,
    effective.provider,
    effective.model,
    effective.maxTokens,
    effective.contextWindow,
  )
  const totalInputTokens = messages.reduce(
    (sum, message) => sum + estimateTokens(message.content),
    0,
  )
  return {
    fits: totalInputTokens <= checked.inputBudget,
    totalInputTokens,
    inputBudget: checked.inputBudget,
  }
}

export function formatOutlineBudgetError(result: OutlineMessageBudgetResult): string {
  return `完整设定词条与大纲指令压缩后仍超过当前模型上下文（约 ${result.totalInputTokens.toLocaleString()} / ${result.inputBudget.toLocaleString()} tokens）。本次未调用 API；请减少单条词条的超长详情，或增大模型上下文窗口。`
}

export function nextOutlineContextBudget(
  currentContextTokens: number,
  result: OutlineMessageBudgetResult,
): number {
  const overflow = Math.max(0, result.totalInputTokens - result.inputBudget)
  return Math.max(1, currentContextTokens - overflow - 128)
}
