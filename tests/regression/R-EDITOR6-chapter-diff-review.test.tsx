import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChapterCandidateReview from '../../src/components/editor/ChapterCandidateReview'
import { buildChapterDiff } from '../../src/lib/editor/chapter-diff'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mounted: Array<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> = []

afterEach(async () => {
  while (mounted.length > 0) {
    const item = mounted.pop()!
    await act(async () => item.root.unmount())
    item.host.remove()
  }
})

describe('EDITOR-6.8 · 整章中央审阅与真实 Diff', () => {
  it('计算段落结构变化并在修改段内生成字词级差异', () => {
    const diff = buildChapterDiff(
      '雨下得很大。\n\n他走进门。\n\n灯熄了。',
      '雨下得更大。\n\n他推门进来。\n\n灯熄了。\n\n门外传来脚步声。',
    )
    expect(diff.stats.originalCharacters).toBeGreaterThan(0)
    expect(diff.stats.candidateCharacters).toBeGreaterThan(diff.stats.originalCharacters)
    expect(diff.stats.changedParagraphs).toBe(3)
    expect(diff.stats.addedParagraphs).toBe(1)
    const modified = diff.rows.find(row => row.kind === 'modified')
    expect(modified?.pieces?.some(piece => piece.kind === 'delete')).toBe(true)
    expect(modified?.pieces?.some(piece => piece.kind === 'insert')).toBe(true)
    expect(diff.rows.some(row => row.kind === 'equal' && row.original === '灯熄了。')).toBe(true)
  })

  it('全量重写默认展示干净候选，Diff 作为按组跳转的可选对照', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const onApply = vi.fn()
    const onContinue = vi.fn()
    const onRegenerate = vi.fn()
    const onDiscard = vi.fn()
    await act(async () => root.render(createElement(ChapterCandidateReview, {
      chapterTitle: '雨夜来客',
      originalText: '门外响了三声。\n\n沈砚没有回头。',
      candidateText: '雨落在门槛上，门外响了三声。\n\n沈砚握住刀柄，没有回头。',
      onApply,
      onContinue,
      onRegenerate,
      onDiscard,
    })))

    expect(host.getAttribute('aria-label')).toBeNull()
    expect(host.querySelector('[aria-label="整章候选审阅"]')).toBeTruthy()
    expect(host.textContent).toContain('原文 14 字 → 候选 26 字')
    expect(host.textContent).toContain('Diff 只用于按需对照，不需要逐项确认')
    expect(host.querySelector('[data-diff-kind="modified"]')).toBeNull()

    const buttons = [...host.querySelectorAll('button')]
    const inlineButton = buttons.find(button => button.textContent === '行内 Diff')!
    await act(async () => inlineButton.click())
    expect(host.querySelector('[data-diff-kind="modified"]')).toBeTruthy()
    expect(host.textContent).toContain('差异片段 1 组')

    const candidateButton = buttons.find(button => button.textContent === '候选正文')!
    await act(async () => candidateButton.click())
    expect(host.textContent).toContain('雨落在门槛上，门外响了三声。')

    // 整章采纳不依赖差异导航是否逐项访问。
    await act(async () => buttons.find(button => button.textContent?.includes('采纳并替换整章'))!.click())
    await act(async () => buttons.find(button => button.textContent?.includes('继续修改'))!.click())
    await act(async () => buttons.find(button => button.textContent?.includes('重新生成'))!.click())
    await act(async () => buttons.find(button => button.textContent?.includes('放弃'))!.click())
    expect(onContinue).toHaveBeenCalledOnce()
    expect(onRegenerate).toHaveBeenCalledOnce()
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(onApply).toHaveBeenCalledOnce()
  })

  it('首次生成不制造无意义的原文 Diff 和逐段检查压力', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const onApply = vi.fn()
    await act(async () => root.render(createElement(ChapterCandidateReview, {
      chapterTitle: '婚配大典·选妾',
      originalText: '',
      candidateText: '暗红印记刚被唱出。\n\n两名差役掀开未侧布帘。\n\n她膝上的旧纸散落下来。',
      onApply,
      onContinue: vi.fn(),
      onRegenerate: vi.fn(),
      onDiscard: vi.fn(),
    })))

    expect(host.textContent).toContain('新正文审阅')
    expect(host.textContent).toContain('这是首次生成，没有需要逐项核对的旧正文')
    expect(host.textContent).toContain('暗红印记刚被唱出。')
    expect(host.textContent).not.toContain('行内 Diff')
    expect(host.textContent).not.toContain('并排 Diff')
    expect(host.textContent).not.toContain('差异片段')
    expect(host.querySelector('[role="alert"]')).toBeNull()

    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent?.includes('采纳并替换整章'))!.click())
    expect(onApply).toHaveBeenCalledOnce()
  })
})
