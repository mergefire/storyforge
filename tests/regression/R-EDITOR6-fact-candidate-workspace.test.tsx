import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChapterFactCandidateWorkspace from '../../src/components/editor/ChapterFactCandidateWorkspace'
import type { TemporalFact } from '../../src/lib/types/temporal-fact'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted: Array<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> = []

function fact(): TemporalFact {
  return {
    id: 7,
    projectId: 1,
    characterId: 2,
    subjectName: '沈砚',
    predicate: 'location',
    factKind: 'state',
    value: '王府西院',
    sourceType: 'chapter',
    sourceChapterId: 3,
    sourceQuote: '沈砚翻进王府西院。',
    validFromChapterId: 3,
    status: 'candidate',
    locked: false,
    createdAt: 1,
    updatedAt: 1,
  }
}

async function renderWorkspace(overrides: Partial<Parameters<typeof ChapterFactCandidateWorkspace>[0]> = {}) {
  const props: Parameters<typeof ChapterFactCandidateWorkspace>[0] = {
    candidates: [fact()],
    onUpdate: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => undefined),
    onReject: vi.fn(async () => undefined),
    onOpenLibrary: vi.fn(),
    ...overrides,
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  mounted.push({ host, root })
  await act(async () => root.render(createElement(ChapterFactCandidateWorkspace, props)))
  return { host, props }
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const items = [...host.querySelectorAll('button')]
  const hit = items.find(item => item.textContent?.trim() === label)
    ?? items.find(item => item.textContent?.includes(label))
  if (!hit) throw new Error(`button not found: ${label}`)
  return hit as HTMLButtonElement
}

afterEach(async () => {
  while (mounted.length > 0) {
    const item = mounted.pop()!
    await act(async () => item.root.unmount())
    item.host.remove()
  }
})

describe('EDITOR-6.5 · 章节长期事实候选工作区', () => {
  it('显示受控事实字段、证据和批量操作，确认前先保存编辑', async () => {
    const { host, props } = await renderWorkspace()
    expect(host.textContent).toContain('本章提取到 1 条长期事实候选')
    expect(host.textContent).toContain('事实类型')
    expect(host.textContent).toContain('正文证据（必须逐字存在）')
    expect(button(host, '全部确认')).toBeTruthy()
    expect(button(host, '放弃本轮全部')).toBeTruthy()
    expect(button(host, '完整事实库')).toBeTruthy()

    await act(async () => {
      button(host, '全部确认').click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(props.onUpdate).toHaveBeenCalledWith(7, {
      subjectName: '沈砚',
      predicate: 'location',
      value: '王府西院',
      sourceQuote: '沈砚翻进王府西院。',
    })
    expect(props.onConfirm).toHaveBeenCalledWith([7])
  })

  it('单条放弃只提交当前候选 ID', async () => {
    const onReject = vi.fn(async () => undefined)
    const { host } = await renderWorkspace({ onReject })
    await act(async () => {
      button(host, '放弃').click()
      await Promise.resolve()
    })
    expect(onReject).toHaveBeenCalledWith([7])
  })
})
