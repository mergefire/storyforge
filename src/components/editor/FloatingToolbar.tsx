/**
 * 选中文本浮动工具栏 — Phase 24.3
 *
 * 用户选中编辑器中的文字后，弹出浮动工具栏：
 * 这里只选择“修改意图”，实际 AI 调用与采纳统一交给章节协作区。
 */
import { useState } from 'react'
import { MessageSquareText, Wand2, Expand, Minimize2, RefreshCw, Search, X } from 'lucide-react'
import type {
  EditorSelectionPresentation,
  EditorSelectionSnapshot,
} from '../../lib/editor/selection-snapshot'

export type SelectionAIAction = 'ask' | 'polish' | 'expand' | 'condense' | 'rewrite' | 'check'

interface Props {
  /** TipTap 直接上报的选区与位置，避免浏览器 selectionchange 瞬时折叠造成闪退。 */
  selection: EditorSelectionPresentation | null
  /** 把修改意图与选区交给统一 AI 协作区 */
  onAction: (action: SelectionAIAction, snapshot: EditorSelectionSnapshot) => void
  /** 是否禁用（如正在 AI 生成时） */
  disabled?: boolean
  onUseWholeChapterScope?: () => void
}

const ACTIONS: { type: SelectionAIAction; icon: typeof Wand2; label: string; desc: string }[] = [
  { type: 'ask',      icon: MessageSquareText, label: '问 AI', desc: '围绕选区对话' },
  { type: 'polish',   icon: Wand2,      label: '润色', desc: '优化文笔' },
  { type: 'expand',   icon: Expand,     label: '扩写', desc: '丰富细节' },
  { type: 'condense', icon: Minimize2,  label: '缩写', desc: '精简内容' },
  { type: 'rewrite',  icon: RefreshCw,  label: '改写', desc: '换种写法' },
  { type: 'check',    icon: Search,     label: '查漏', desc: '检查问题' },
]

export default function FloatingToolbar({
  selection, onAction, disabled, onUseWholeChapterScope,
}: Props) {
  const [dismissedKey, setDismissedKey] = useState('')
  const selectionKey = selection
    ? `${selection.snapshot.from}:${selection.snapshot.to}:${selection.revision}`
    : ''

  const handleAction = (action: SelectionAIAction) => {
    if (!selection || disabled) return
    setDismissedKey(selectionKey)
    onAction(action, selection.snapshot)
  }

  const handleDismiss = () => {
    setDismissedKey(selectionKey)
  }

  if (!selection || disabled || dismissedKey === selectionKey) return null

  if (selection.tooLong) {
    return (
      <div className="fixed z-50 w-[min(420px,90vw)] -translate-x-1/2 border border-warning/40 bg-bg-elevated px-3 py-2 shadow-lg" style={{ top: `${selection.top - 64}px`, left: `${selection.left}px` }} onMouseDown={event => event.preventDefault()}>
        <p className="text-xs leading-5 text-warning">当前选区 {selection.snapshot.text.length.toLocaleString()} 字，超过局部修改上限。请缩小范围或切换为整章修改。</p>
        <div className="mt-2 flex justify-end gap-2">
          {onUseWholeChapterScope && <button type="button" onClick={onUseWholeChapterScope} className="border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover">切换整章修改</button>}
          <button type="button" onClick={handleDismiss} className="px-2 py-1 text-[11px] text-text-muted hover:text-text-primary">关闭</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed z-50 transform -translate-x-1/2"
      style={{ top: `${selection.top - 45}px`, left: `${selection.left}px` }}
      onMouseDown={event => event.preventDefault()}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-bg-elevated px-1 py-0.5 shadow-lg">
          {ACTIONS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => handleAction(type)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-secondary hover:text-accent hover:bg-accent/10 rounded transition-colors"
              title={`${label}（在 AI 协作区继续）`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
          <button
            onClick={handleDismiss}
            className="p-1.5 text-text-muted hover:text-text-primary rounded"
          >
            <X className="w-3 h-3" />
          </button>
      </div>
    </div>
  )
}
