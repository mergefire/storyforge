import { useMemo } from 'react'
import { Inbox, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { OutlineNode, StoryStructure, WorldGroup } from '../../lib/types'
import { getVolumeChapterNodes } from '../../lib/outline/selectors'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { CInput } from '../shared/CompositionInput'
import { useDragReorder } from './useDragReorder'
import OutlineStructureMenu from './OutlineStructureMenu'
import { OutlineChapterRow, OutlineStoryBlockSection } from './OutlineChapterTree'
import type { ChapterDragPayload, GetActiveChapterDrag } from './chapter-drag'

interface Props {
  volume: OutlineNode | null
  nodes: OutlineNode[]
  multiWorldEnabled: boolean
  worldGroups: WorldGroup[]
  aiStreaming: boolean
  activeChapterDrag: ChapterDragPayload | null
  getActiveChapterDrag: GetActiveChapterDrag
  onChapterDragStart: (payload: ChapterDragPayload) => void
  onChapterDragEnd: () => void
  onUpdateNode: (id: number, patch: Partial<OutlineNode>) => void
  onDeleteNode: (id: number) => void
  onGenerateVolume: (volumeId: number) => void
  onGenerateAllChapters: () => void
  onAddChapter: (parentId?: number) => void
  onDeleteVolume: () => void
  onAddStructure: (structure: StoryStructure) => void
  onInsertChapterAfter: (chapterId: number, parentId: number) => void
  onGenerateChapter: (chapterId: number) => void
  onOpenChapter?: (chapterId: number) => void
  onReorderNodes: (orderedIds: number[]) => void
  onMoveChapter: (chapterId: number, targetParentId: number, index: number) => Promise<void>
}

export default function OutlineVolumeDetail({
  volume,
  nodes,
  multiWorldEnabled,
  worldGroups,
  aiStreaming,
  activeChapterDrag,
  getActiveChapterDrag,
  onChapterDragStart,
  onChapterDragEnd,
  onUpdateNode,
  onDeleteNode,
  onGenerateVolume,
  onGenerateAllChapters,
  onAddChapter,
  onDeleteVolume,
  onAddStructure,
  onInsertChapterAfter,
  onGenerateChapter,
  onOpenChapter,
  onReorderNodes,
  onMoveChapter,
}: Props) {
  const storyBlocks = useMemo(() => (
    volume
      ? nodes.filter(node => node.parentId === volume.id && node.type === 'storyBlock').sort((a, b) => a.order - b.order)
      : []
  ), [nodes, volume])
  const directChapters = useMemo(() => (
    volume
      ? nodes.filter(node => node.parentId === volume.id && node.type === 'chapter').sort((a, b) => a.order - b.order)
      : []
  ), [nodes, volume])
  const volumeChapters = useMemo(
    () => volume?.id == null ? [] : getVolumeChapterNodes(nodes, volume.id),
    [nodes, volume?.id],
  )
  const storyBlockIds = useMemo(
    () => new Set(storyBlocks.flatMap(block => block.id == null ? [] : [block.id])),
    [storyBlocks],
  )
  const unassignedChapters = useMemo(
    () => volumeChapters.filter(chapter => !storyBlockIds.has(chapter.parentId ?? -1)),
    [storyBlockIds, volumeChapters],
  )
  const volumeChapterCount = volumeChapters.length
  const directChaptersDnD = useDragReorder(directChapters.map(chapter => chapter.id), onReorderNodes)
  const hasBlocks = storyBlocks.length > 0

  if (!volume) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3">
        <div className="text-4xl opacity-20">📖</div>
        <p className="text-sm">选择左侧的卷开始编辑，或点击「批量生成卷级大纲」</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CInput
          value={volume.title}
          onChange={event => onUpdateNode(volume.id!, { title: event.target.value })}
          className="text-lg font-bold bg-transparent text-text-primary outline-none flex-1"
        />
        <div className="flex items-center gap-1.5">
          {!volume.summary.trim() && (
            <button
              onClick={() => onGenerateVolume(volume.id!)}
              disabled={aiStreaming}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-bg-elevated text-accent rounded-md hover:bg-accent/10 border border-accent/30 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI 生成本卷卷纲
            </button>
          )}
          <button
            onClick={onGenerateAllChapters}
            disabled={aiStreaming}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> 生成本卷所有章节
          </button>
          {!hasBlocks && (
            <button
              onClick={() => onAddChapter()}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-bg-elevated text-text-secondary rounded-md hover:text-text-primary border border-border transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 添加章节
            </button>
          )}
          <button onClick={onDeleteVolume} title="删除当前卷" className="p-1.5 text-text-muted hover:text-error rounded transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {multiWorldEnabled && worldGroups.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">本卷所属世界</label>
          <select
            value={volume.worldGroupId ?? ''}
            onChange={event => onUpdateNode(volume.id!, { worldGroupId: event.target.value ? Number(event.target.value) : null })}
            className="px-2 py-1 bg-bg-surface border border-border rounded text-xs text-text-primary focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="">未指定</option>
            {worldGroups.map(group => (
              <option key={group.id} value={group.id}>{group.icon || '🌐'} {group.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs text-text-muted mb-1 block">卷情节摘要</label>
        <AutoResizeTextarea
          value={volume.summary}
          onChange={event => onUpdateNode(volume.id!, { summary: event.target.value })}
          placeholder="描述本卷的核心冲突、关键转折和主要情节..."
          minRows={3}
          maxRows={10}
          className="w-full px-3 py-2 bg-bg-surface border border-border rounded-md text-text-secondary text-sm focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-primary">
            {hasBlocks ? '故事结构' : '章节列表'}
            <span className="text-text-muted font-normal ml-1">（{volumeChapterCount} 章）</span>
            {hasBlocks && unassignedChapters.length > 0 && (
              <span className="ml-2 text-xs font-normal text-warning">
                其中 {unassignedChapters.length} 章待编排
              </span>
            )}
          </h3>
          {!hasBlocks && <OutlineStructureMenu onSelect={onAddStructure} />}
        </div>

        {hasBlocks && (
          <div className="space-y-3 mb-3">
            {unassignedChapters.length > 0 && (
              <section
                data-outline-unassigned-chapters
                aria-label="待编排章节"
                className="overflow-hidden rounded-lg border border-warning/30"
              >
                <div className="flex items-center gap-2 bg-warning/5 px-3 py-2">
                  <Inbox className="h-3.5 w-3.5 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">待编排章节</span>
                      <span className="text-[10px] text-warning">{unassignedChapters.length} 章</span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      这些章节属于本卷，但尚未放入故事块。可直接编辑，或拖到下方对应的故事块。
                    </p>
                  </div>
                </div>
                <div className="space-y-1 p-2">
                  {unassignedChapters.map((chapter, index) => {
                    const parentId = chapter.parentId ?? volume.id!
                    return (
                      <OutlineChapterRow
                        key={chapter.id}
                        ch={chapter}
                        idx={index}
                        onUpdate={onUpdateNode}
                        onDelete={onDeleteNode}
                        onOpen={onOpenChapter}
                        dnd={chapter.parentId === volume.id ? directChaptersDnD.itemDnD(chapter.id) : undefined}
                        onInsertAfter={() => onInsertChapterAfter(chapter.id!, parentId)}
                        onGenerate={() => onGenerateChapter(chapter.id!)}
                        parentId={parentId}
                        onMoveChapter={onMoveChapter}
                        activeChapterDrag={activeChapterDrag}
                        getActiveChapterDrag={getActiveChapterDrag}
                        onChapterDragStart={onChapterDragStart}
                        onChapterDragEnd={onChapterDragEnd}
                      />
                    )
                  })}
                </div>
              </section>
            )}
            {storyBlocks.map(block => {
              const blockChapters = nodes
                .filter(node => node.parentId === block.id && node.type === 'chapter')
                .sort((a, b) => a.order - b.order)
              return (
                <OutlineStoryBlockSection
                  key={block.id}
                  block={block}
                  chapters={blockChapters}
                  onUpdateNode={onUpdateNode}
                  onDeleteNode={onDeleteNode}
                  onAddChapter={() => onAddChapter(block.id!)}
                  onOpenChapter={onOpenChapter}
                  onReorder={onReorderNodes}
                  onInsertAfter={chapterId => onInsertChapterAfter(chapterId, block.id!)}
                  onGenerateChapter={onGenerateChapter}
                  onMoveChapter={onMoveChapter}
                  activeChapterDrag={activeChapterDrag}
                  getActiveChapterDrag={getActiveChapterDrag}
                  onChapterDragStart={onChapterDragStart}
                  onChapterDragEnd={onChapterDragEnd}
                />
              )
            })}
            <button
              onClick={() => onAddStructure('custom')}
              className="w-full py-2 text-xs text-text-muted border border-dashed border-border rounded-lg hover:text-accent hover:border-accent/50 transition-colors"
            >
              + 添加故事块
            </button>
          </div>
        )}

        {!hasBlocks && (
          directChapters.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm border border-dashed border-border rounded-lg">
              还没有章节，点击「生成本卷所有章节」或「添加章节」
            </div>
          ) : (
            <div className="space-y-1">
              {directChapters.map((chapter, index) => (
                <OutlineChapterRow
                  key={chapter.id}
                  ch={chapter}
                  idx={index}
                  onUpdate={onUpdateNode}
                  onDelete={onDeleteNode}
                  onOpen={onOpenChapter}
                  dnd={directChaptersDnD.itemDnD(chapter.id)}
                  onInsertAfter={() => onInsertChapterAfter(chapter.id!, volume.id!)}
                  onGenerate={() => onGenerateChapter(chapter.id!)}
                  parentId={volume.id!}
                  onMoveChapter={onMoveChapter}
                  activeChapterDrag={activeChapterDrag}
                  getActiveChapterDrag={getActiveChapterDrag}
                  onChapterDragStart={onChapterDragStart}
                  onChapterDragEnd={onChapterDragEnd}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
