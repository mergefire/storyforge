import { describe, expect, it, vi } from 'vitest'
import type { AIConfig, ChatMessage } from '../../src/lib/types'
import {
  compressCodexContextWithAI,
  parseCompleteCodexContext,
} from '../../src/lib/ai/codex-semantic-compression'
import { estimateTokens } from '../../src/lib/ai/context-budget'

const config: AIConfig = {
  provider: 'custom',
  apiKey: 'test',
  baseUrl: 'http://localhost/v1',
  model: 'semantic-compressor-test',
  temperature: 0.1,
  maxTokens: 2048,
  contextWindow: 6000,
}

function completeCodex(): string {
  return [
    '【设定词条 · 全量 3/3 条】（作者设定）',
    '[历史事件]',
    '- [词条#1] 路家旧案',
    `  详情：起因=盐铁账册；约束=${'必须保留边军与西境商税的因果链。'.repeat(400)}；结论=不可提前翻案`,
    '- [词条#2] 酒楼品牌',
    `  详情：定位=夫妻创业；约束=${'品牌扩张必须受供应链制约。'.repeat(80)}`,
    '[人物关系]',
    '- [词条#3] 路承谨与周迟语',
    '  详情：关系=夫妻；禁忌=不可无铺垫决裂；目标=共同查清旧案',
    '【词条完整性】3/3 条及其原始详情均已完整载入。',
  ].join('\n')
}

function fakeSemanticCall(seenSource: Map<string, string>) {
  return vi.fn(async (messages: ChatMessage[]) => {
    const input = JSON.parse(messages.at(-1)!.content) as Array<{
      key: string
      entryId: number
      maxChars: number
      details: string
    }>
    return JSON.stringify({
      items: input.map(item => {
        if (/^\d+\.\d+$/.test(item.key)) {
          seenSource.set(item.key, item.details)
        }
        const summary = `词条${item.entryId}关键约束：${item.details.slice(-Math.max(1, item.maxChars - 12))}`
        return { key: item.key, summary: summary.slice(0, item.maxChars) }
      }),
    })
  })
}

describe('R-OUTLINE · 词条 AI 语义压缩', () => {
  it('分片处理全部原始详情并保留每个词条编号和名称', async () => {
    const source = completeCodex()
    const entries = parseCompleteCodexContext(source)
    const seenSource = new Map<string, string>()
    const call = fakeSemanticCall(seenSource)

    const result = await compressCodexContextWithAI({
      content: source,
      targetTokens: 900,
      config,
      projectId: 1,
      call,
    })

    expect(call.mock.calls.length).toBeGreaterThan(1)
    expect(estimateTokens(result)).toBeLessThanOrEqual(900)
    expect(result).toContain('AI语义压缩 3/3 条')
    for (const entry of entries) {
      expect(result).toContain(`[词条#${entry.id}] ${entry.name}`)
      const reconstructed = Array.from(seenSource)
        .filter(([key]) => key.startsWith(`${entry.id}.`))
        .sort(([left], [right]) => Number(left.split('.')[1]) - Number(right.split('.')[1]))
        .map(([, details]) => details)
        .join('')
      if (entry.details) expect(reconstructed).toBe(entry.details)
    }
    expect(result).toContain('3/3 条均已通过编号校验')
  })

  it('AI 连续漏掉任一 key 时拒绝生成摘要', async () => {
    const call = vi.fn(async (messages: ChatMessage[]) => {
      const input = JSON.parse(messages.at(-1)!.content) as Array<{ key: string; maxChars: number }>
      return JSON.stringify({
        items: input.slice(0, -1).map(item => ({ key: item.key, summary: '不完整摘要'.slice(0, item.maxChars) })),
      })
    })

    await expect(compressCodexContextWithAI({
      content: completeCodex(),
      targetTokens: 900,
      config,
      projectId: 1,
      call,
    })).rejects.toThrow('未通过完整性校验')
    expect(call).toHaveBeenCalledTimes(2)
  })
})
