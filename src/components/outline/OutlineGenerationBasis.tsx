import { AlertTriangle, BookOpenCheck, Loader2 } from 'lucide-react'
import { CONTEXT_SOURCE_BY_KEY } from '../../lib/registry/context-sources'
import type { AssembleContextResult } from '../../lib/registry/types'

function contextSourceLabel(key: string): string {
  return CONTEXT_SOURCE_BY_KEY.get(key)?.label ?? key
}

function contextExcerpt(assembled: AssembleContextResult, key: string, maxChars = 180): string {
  const index = assembled.included.indexOf(key)
  const content = index >= 0 ? assembled.segments[index]?.content ?? '' : ''
  const compact = content
    .replace(/^【[^】]+】\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (compact.length <= maxChars) return compact
  return `${compact.slice(0, maxChars)}...`
}

export default function OutlineGenerationBasis({
  context,
  loading,
  error,
}: {
  context: AssembleContextResult | null
  loading: boolean
  error: string
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted" data-testid="outline-basis-loading">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在读取本次生成依据...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-xs text-error" role="alert">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>生成依据读取失败：{error}</span>
      </div>
    )
  }

  if (!context) return null

  const storyCore = contextExcerpt(context, 'storyCore')
  const existingVolumes = contextExcerpt(context, 'existingVolumeOutlines')
  const storyCoreTrimmed = context.trimmed.includes('storyCore')
  const compressed = context.compressed ?? []

  return (
    <div className="space-y-2 text-xs" data-testid="outline-generation-basis">
      <div className="flex items-center gap-2 text-text-primary">
        <BookOpenCheck className="h-3.5 w-3.5 text-accent" />
        <span className="font-medium">本次生成依据</span>
        <span className="text-[10px] text-text-muted">
          约 {context.totalInputTokens.toLocaleString()} / {context.inputBudget.toLocaleString()} tokens
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="已读取来源">
        {context.included.map(key => (
          <span key={key} className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">
            {contextSourceLabel(key)}
          </span>
        ))}
        {context.included.length === 0 && (
          <span className="text-warning">
            {context.trimmed.length > 0
              ? '已读取作品资料，但因模型上下文预算未发送'
              : '没有读取到已登记的作品资料'}
          </span>
        )}
      </div>

      {storyCore ? (
        <p className="leading-5 text-text-secondary"><span className="text-text-muted">故事核心：</span>{storyCore}</p>
      ) : storyCoreTrimmed ? (
        <p className="leading-5 text-warning">故事核心已读取，但因模型上下文预算未发送；这不代表故事主线未填写。</p>
      ) : (
        <p className="leading-5 text-warning">未填写故事主线，AI 将主要依据世界观、角色、已有大纲与额外要求生成。</p>
      )}
      {existingVolumes && (
        <p className="leading-5 text-text-secondary"><span className="text-text-muted">已有卷纲：</span>{existingVolumes}</p>
      )}

      {context.omitted.length > 0 && (
        <p className="text-text-muted">
          无可用内容：{context.omitted.map(contextSourceLabel).join('、')}
        </p>
      )}
      {context.trimmed.length > 0 && (
        <p className="text-warning">
          因模型上下文预算未发送：{context.trimmed.map(contextSourceLabel).join('、')}
        </p>
      )}
      {compressed.length > 0 && (
        <p className="text-accent">
          已通过 AI 语义摘要且逐条校验完整性：{compressed.map(contextSourceLabel).join('、')}
        </p>
      )}
      {context.overBudgetAfterTrim && (
        <p className="text-warning" role="status">
          完整词条详情超过当前模型窗口；确认生成后会先调用 AI 分批做语义摘要，全部词条通过编号校验后才会生成大纲。
        </p>
      )}
      <p className="text-text-muted">未采纳的灵感草稿不会进入生成上下文。</p>
    </div>
  )
}
