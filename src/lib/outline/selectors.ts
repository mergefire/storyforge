import type { OutlineNode } from '../types'
import { normalizeOutlineNode } from './normalize'

type OutlineLike = Pick<OutlineNode, 'type'> & { parentId?: number | null }

export function isTopLevelVolumeNode(node: OutlineLike): boolean {
  return node.type === 'volume' && node.parentId == null
}

export function getTopLevelVolumes(nodes: OutlineNode[]): OutlineNode[] {
  return nodes
    .map(normalizeOutlineNode)
    .filter(isTopLevelVolumeNode)
    .sort((a, b) => a.order - b.order)
}

export interface OutlineVolumeChapterGroup {
  volume: OutlineNode
  chapters: OutlineNode[]
}

function compareOutlineOrder(a: OutlineNode, b: OutlineNode): number {
  return a.order - b.order || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
}

/**
 * 返回某一卷下的全部章节，而不假定章节一定直接挂在卷上。
 *
 * 大纲同时支持 `卷 -> 章节` 和 `卷 -> 故事块/篇章 -> 章节`。章节编辑器、
 * 大纲统计和跳转都必须使用同一套遍历口径，否则故事块里的章节会被误计为 0。
 */
export function getVolumeChapterNodes(nodes: OutlineNode[], volumeId: number): OutlineNode[] {
  const volume = nodes.find(node => node.id === volumeId && node.type === 'volume')
  if (!volume) return []

  const childrenByParent = new Map<number, OutlineNode[]>()
  for (const node of nodes) {
    if (node.projectId !== volume.projectId || node.parentId == null) continue
    const children = childrenByParent.get(node.parentId)
    if (children) children.push(node)
    else childrenByParent.set(node.parentId, [node])
  }
  for (const children of childrenByParent.values()) children.sort(compareOutlineOrder)

  const chapters: OutlineNode[] = []
  const visitedContainerIds = new Set<number>()
  const visit = (parentId: number) => {
    if (visitedContainerIds.has(parentId)) return
    visitedContainerIds.add(parentId)

    for (const child of childrenByParent.get(parentId) ?? []) {
      if (child.type === 'chapter') {
        chapters.push(child)
        continue
      }
      if (child.type !== 'volume' && child.id != null) visit(child.id)
    }
  }

  visit(volumeId)
  return chapters
}

export function getVolumeChapterGroups(nodes: OutlineNode[]): OutlineVolumeChapterGroup[] {
  return getTopLevelVolumes(nodes).map(volume => ({
    volume,
    chapters: volume.id == null ? [] : getVolumeChapterNodes(nodes, volume.id),
  }))
}

/** 每章字数默认值（仅当用户未自定义时用；用户可在「每章字数」里按自己的更新习惯改） */
export const DEFAULT_WORDS_PER_CHAPTER = 3000

/**
 * 按「项目目标字数 ÷ 卷数 ÷ 每章字数」估算单卷章节数（仅作「用户没手动设时」的智能默认值）。
 * 不限制用户:每章字数由用户自定义；章节数算出来后用户还能随意滑/填覆盖。只兜下限 1（不出 0/负）。
 */
export function estimateChaptersPerVolume(
  totalWordCount: number,
  volumeCount: number,
  wordsPerChapter: number = DEFAULT_WORDS_PER_CHAPTER,
): number {
  const total = totalWordCount > 0 ? totalWordCount : 500000
  const vols = Math.max(1, volumeCount || Math.ceil(total / 300000))
  const perChapter = wordsPerChapter > 0 ? wordsPerChapter : DEFAULT_WORDS_PER_CHAPTER
  const perVolumeWords = total / vols
  return Math.max(1, Math.round(perVolumeWords / perChapter))
}
