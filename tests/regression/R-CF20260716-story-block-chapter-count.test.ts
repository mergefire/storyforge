/**
 * R-CF20260716：章节工作区必须统计故事块/篇章下的章节。
 *
 * 复现：大纲为「卷 -> 故事块 -> 第1章」时，大纲页显示 1 章，章节侧栏却显示 0 章。
 * 根因是章节侧栏只读取卷的直接 chapter 子节点。
 */
import { describe, expect, it } from 'vitest'
import {
  getVolumeChapterGroups,
  getVolumeChapterNodes,
} from '../../src/lib/outline/selectors'
import type { OutlineNode } from '../../src/lib/types'

function node(
  id: number,
  type: OutlineNode['type'],
  parentId: number | null,
  title: string,
  order: number,
  projectId = 1,
): OutlineNode {
  return {
    id,
    projectId,
    parentId,
    type,
    title,
    summary: '',
    order,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('R-CF20260716 · 故事块章节统计', () => {
  it('把卷下故事块中的章节计入章节工作区分组', () => {
    const volume = node(1, 'volume', null, '第一卷：婚配惊变', 0)
    const storyBlock = node(10, 'storyBlock', 1, '本卷主任务', 0)
    const chapter = node(11, 'chapter', 10, '第1章', 0)

    const groups = getVolumeChapterGroups([volume, storyBlock, chapter])

    expect(groups).toHaveLength(1)
    expect(groups[0].volume.id).toBe(1)
    expect(groups[0].chapters.map(item => item.id)).toEqual([11])
  })

  it('统一收集直挂、故事块和篇章中的章节，并按树顺序隔离到各卷', () => {
    const firstVolume = node(1, 'volume', null, '第一卷', 0)
    const secondVolume = node(2, 'volume', null, '第二卷', 1)
    const earlyBlock = node(10, 'storyBlock', 1, '开端', 0)
    const nestedArc = node(12, 'arc', 10, '相遇篇', 0)
    const lateBlock = node(11, 'storyBlock', 1, '发展', 1)
    const nestedVolume = node(20, 'volume', 1, '异常嵌套卷', 3)
    const nodes = [
      firstVolume,
      secondVolume,
      earlyBlock,
      nestedArc,
      lateBlock,
      nestedVolume,
      node(101, 'chapter', nestedArc.id!, '嵌套篇章章节', 0),
      node(102, 'chapter', lateBlock.id!, '故事块章节', 0),
      node(103, 'chapter', firstVolume.id!, '直挂章节', 2),
      node(104, 'chapter', secondVolume.id!, '第二卷章节', 0),
      node(105, 'chapter', nestedVolume.id!, '不得串入父卷', 0),
      node(106, 'chapter', earlyBlock.id!, '其它项目同父级', 1, 99),
    ]

    expect(getVolumeChapterNodes(nodes, firstVolume.id!).map(item => item.id))
      .toEqual([101, 102, 103])
    expect(getVolumeChapterNodes(nodes, secondVolume.id!).map(item => item.id))
      .toEqual([104])
    expect(getVolumeChapterGroups(nodes).map(group => ({
      volumeId: group.volume.id,
      chapterIds: group.chapters.map(item => item.id),
    }))).toEqual([
      { volumeId: 1, chapterIds: [101, 102, 103] },
      { volumeId: 2, chapterIds: [104] },
    ])
  })

  it('卷不存在时返回空集合，避免损坏引用把章节串到错误分组', () => {
    expect(getVolumeChapterNodes([], 404)).toEqual([])
  })
})
