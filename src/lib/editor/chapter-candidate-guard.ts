import type { ChapterCandidateApplyMode } from './chapter-candidate-adoption'

export interface ChapterCandidateInspection {
  ok: boolean
  reason?: string
  code?: 'empty' | 'markdown' | 'prompt-leak' | 'analysis' | 'refusal' | 'structured-data' | 'not-manuscript'
}

const PROMPT_MARKERS = [
  '【项目只读上下文】',
  '【当前章节完整正文（只读）】',
  '【目标前邻文',
  '【目标后邻文',
  '【本轮可写目标】',
  '【交付协议】',
  '<system>',
  '</system>',
  '<analysis>',
  '</analysis>',
  '<prompt>',
  '</prompt>',
]

const MARKDOWN_PATTERNS = [
  /^\s*```/m,
  /```\s*$/m,
  /^\s{0,3}#{1,6}\s+\S/m,
  /(?:^|[^*])\*\*[^*\n]+\*\*(?:[^*]|$)/m,
  /(?:^|[^_])__[^_\n]+__(?:[^_]|$)/m,
  /!\[[^\]]*\]\([^\n)]+\)/m,
  /\[[^\]]+\]\([^\n)]+\)/m,
]

export function inspectChapterCandidate(
  candidate: string,
  mode: ChapterCandidateApplyMode,
): ChapterCandidateInspection {
  const trimmed = candidate.trim()
  if (!trimmed) return { ok: false, code: 'empty', reason: 'AI 没有返回可采纳的正文。' }

  if (PROMPT_MARKERS.some(marker => trimmed.toLowerCase().includes(marker.toLowerCase()))) {
    return { ok: false, code: 'prompt-leak', reason: 'AI 返回了只读上下文、Prompt 标签或内部指令。' }
  }
  if (MARKDOWN_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return { ok: false, code: 'markdown', reason: '候选包含 Markdown 标签或围栏，不能直接写入正文。' }
  }
  if (/^\s*(?:修改说明|改写说明|分析|创作思路|思考过程|以下是(?:修改|改写|生成)|here(?:'s| is)|i (?:have|will))\s*[:：]/iu.test(trimmed)) {
    return { ok: false, code: 'analysis', reason: '候选混入了分析或修改说明，不是纯正文。' }
  }
  if (/^\s*(?:抱歉|对不起|很抱歉)[，,：:\s]*(?:我)?(?:不能|无法|不便|没法)/u.test(trimmed)) {
    return { ok: false, code: 'refusal', reason: '模型返回了拒答文本，不是正文候选。' }
  }
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return { ok: false, code: 'structured-data', reason: '模型返回了结构化数据，不是正文候选。' }
    } catch {
      // 小说正文可以合法地以方括号或花括号开头；只有可解析 JSON 才拦截。
    }
  }
  if (mode === 'replace-chapter' && trimmed.replace(/\s/gu, '').length < 8) {
    return { ok: false, code: 'not-manuscript', reason: '整章候选过短，明显不是可替换的正文。' }
  }
  return { ok: true }
}
