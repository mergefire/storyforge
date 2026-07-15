import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { Character } from '../../lib/types'
import { dimensionsByGroup, type CharacterDimensionKey, type CharacterDimensionSpec } from '../../lib/character/character-dimensions'
import { CTextarea } from '../shared/CompositionInput'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  character: Character
  onChange: (patch: Partial<Character>) => void
  /** 行内已显示、此处不重复的维度（如 NPC 行已有 简介/地点） */
  exclude?: CharacterDimensionKey[]
  /** 传入则每个字段旁出现「✨」按钮,可就地对单个字段做 AI 生成/修改 */
  projectId?: number
  worldGroupId?: number | null
}

interface DimensionFieldProps {
  dimension: CharacterDimensionSpec
  value: string
  onCommit: (value: string) => void
}

function CharacterDimensionField({ dimension, value, onCommit }: DimensionFieldProps) {
  const [draft, setDraft] = useState(value)
  const draftRef = useRef(value)
  const dirtyRef = useRef(false)
  const lastSentRef = useRef(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  const flushDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const next = draftRef.current
    if (!dirtyRef.current || next === lastSentRef.current) return
    lastSentRef.current = next
    onCommitRef.current(next)
  }, [])

  useEffect(() => {
    const external = String(value ?? '')
    if (dirtyRef.current && external !== draftRef.current) return
    dirtyRef.current = false
    lastSentRef.current = external
    draftRef.current = external
    setDraft(external)
  }, [value])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const next = draftRef.current
    if (dirtyRef.current && next !== lastSentRef.current) {
      onCommitRef.current(next)
    }
  }, [])

  return (
    <CTextarea
      value={draft}
      onChange={e => {
        const next = e.target.value
        draftRef.current = next
        dirtyRef.current = true
        setDraft(next)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(flushDraft, 400)
      }}
      onBlur={flushDraft}
      placeholder={`${dimension.label}…`}
      rows={dimension.rows}
      className="flex-1 px-2 py-1 bg-bg-base border border-border rounded text-xs text-text-primary resize-y focus:outline-none focus:border-accent"
    />
  )
}

/**
 * 角色完整维度的展示/编辑区(共享)——按 CHARACTER_DIMENSIONS 分组渲染。
 * NPC / 次要 / 路人 / 主要面板复用,让 AI 生成的完整内容在各自页面都能看到、能改。
 * 加一个维度只改 CHARACTER_DIMENSIONS + FIELD_REGISTRY,这里自动出现。
 * 传入 project 时,每个字段可就地单独 AI 生成/修改（扩写/重写/润色）。
 */
export default function CharacterDimensionFields({ character, onChange, exclude = [], projectId, worldGroupId = null }: Props) {
  const skip = new Set<CharacterDimensionKey>(exclude)

  return (
    <div className="space-y-3">
      {dimensionsByGroup().map(({ group, dims }) => {
        const shown = dims.filter(d => !skip.has(d.key))
        if (!shown.length) return null
        return (
          <div key={group}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted/70">{group}</div>
            <div className="space-y-1.5">
              {shown.map(d => (
                <div key={d.key} className="flex gap-2">
                  <span className="w-20 flex-shrink-0 pt-1.5 text-xs text-text-muted">{d.label}</span>
                  <CharacterDimensionField
                    key={`${character.id ?? 'draft'}:${d.key}`}
                    dimension={d}
                    value={String(character[d.key] ?? '')}
                    onCommit={value => onChange({ [d.key]: value } as Partial<Character>)}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 单维度行（含可选的就地 AI 编辑器） ──────────────────────────

function DimensionRow({ dim, character, onChange, projectId, worldGroupId }: {
  dim: { key: CharacterDimensionKey; label: string; rows: number }
  character: Character
  onChange: (patch: Partial<Character>) => void
  projectId?: number
  worldGroupId: number | null
}) {
  const [aiOpen, setAiOpen] = useState(false)
  const value = (character[dim.key] as string) || ''

  return (
    <div>
      <div className="flex gap-2">
        <span className="w-20 flex-shrink-0 pt-1.5 text-xs text-text-muted">{dim.label}</span>
        <CTextarea
          value={value}
          onChange={e => onChange({ [dim.key]: e.target.value } as Partial<Character>)}
          placeholder={`${dim.label}…`}
          rows={dim.rows}
          className="flex-1 px-2 py-1 bg-bg-base border border-border rounded text-xs text-text-primary resize-y focus:outline-none focus:border-accent"
        />
        {projectId != null && (
          <button
            onClick={() => setAiOpen(v => !v)}
            title={`AI ${value ? '修改' : '生成'}「${dim.label}」`}
            className={`shrink-0 self-start mt-0.5 p-1.5 rounded transition-colors ${
              aiOpen ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-accent hover:bg-accent/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {projectId != null && aiOpen && (
        <div className="ml-[5.5rem] mt-1.5">
          <CharacterFieldAIEditor
            fieldKey={dim.key}
            fieldLabel={dim.label}
            character={character}
            projectId={projectId}
            worldGroupId={worldGroupId}
            currentValue={value}
            onAccept={text => { onChange({ [dim.key]: text } as Partial<Character>); setAiOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}

// ── 单维度 AI 编辑器 ──────────────────────────────────────────

/**
 * 单字段 AI 编辑器（通用）——维度字段 + 顶部的名字/简介都能用。
 * fieldKey 仅用于 session 唯一标识 + 拼上下文时跳过自身。
 */
export function CharacterFieldAIEditor({ fieldKey, fieldLabel, character, projectId, worldGroupId, currentValue, onAccept }: {
  fieldKey: string
  fieldLabel: string
  character: Character
  projectId: number
  worldGroupId: number | null
  currentValue: string
  onAccept: (text: string) => void
}) {
  const [hint, setHint] = useState('')
  const [mode, setMode] = useState<FieldGenerationMode>(currentValue ? 'polish' : 'expand')
  const ai = useAIStream(createAISessionKey(
    projectId,
    'character.dimension',
    `${worldGroupId ?? 'global'}:${character.id}:${fieldKey}`,
  ))

  const handleGenerate = async () => {
    const aiConfig = useAIConfigStore.getState().config
    // 读：世界观/设定上下文（角色自身已有设定由 prompt 直接带）
    const assembled = await assembleContext({
      projectId,
      worldGroupId,
      provider: aiConfig.provider,
      model: aiConfig.model,
      sourceKeys: ['worldview', 'storyCore', 'powerSystem', 'codex', 'creativeRules', 'worldRules', 'locations'],
    })
    // 角色已有信息（其他维度）作为一致性约束
    const existingInfo = buildCharacterExistingInfo(character, fieldKey)
    const messages = buildCharacterDimensionPrompt(
      character.name, fieldLabel, existingInfo, assembled.text,
      undefined, currentValue, mode, hint.trim() || undefined,
    )
    ai.start(messages, undefined, { category: 'character.dimension', projectId })
  }

  return (
    <div className="space-y-2 border-l-2 border-accent/40 pl-3">
      <div className="flex items-center gap-2">
        <AIFieldModeTabs value={mode} onChange={setMode} />
        <input value={hint} onChange={e => setHint(e.target.value)}
          placeholder={`给 AI 的补充说明（如"名字要更有古风"）`}
          className="flex-1 px-2 py-1 bg-bg-base border border-border rounded text-xs text-text-primary focus:outline-none focus:border-accent" />
        <button onClick={handleGenerate} disabled={ai.isStreaming}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded disabled:opacity-50 shrink-0 bg-accent/10 text-accent hover:bg-accent/20">
          <Sparkles className="w-3 h-3" /> 生成
        </button>
      </div>
      {(ai.output || ai.isStreaming || ai.error) && (
        <AIStreamOutput output={ai.output} reasoning={ai.reasoning} isStreaming={ai.isStreaming} error={ai.error}
          tokenUsage={ai.tokenUsage} onStop={ai.stop}
          onAccept={onAccept} onRetry={handleGenerate}
          onDismiss={ai.reset} moduleKey="character.dimension" />
      )}
    </div>
  )
}

/** 把角色其他已填字段拼成上下文（供单字段生成时保持一致性）。skipKey = 本次要生成/修改的字段名。 */
function buildCharacterExistingInfo(character: Character, skipKey: string): string {
  const parts: string[] = []
  // 顶部特殊字段（不在 CHARACTER_DIMENSIONS 里,但对单字段生成同样重要）
  if (skipKey !== 'name' && character.name?.trim()) parts.push(`【姓名】${character.name.trim()}`)
  if (skipKey !== 'shortDescription' && character.shortDescription?.trim()) parts.push(`【一句话简介】${character.shortDescription.trim()}`)
  // 完整维度
  for (const { dims } of dimensionsByGroup()) {
    for (const d of dims) {
      if (d.key === skipKey) continue
      const v = (character[d.key] as string)?.trim()
      if (v) parts.push(`【${d.label}】${v}`)
    }
  }
  return parts.join('\n')
}
