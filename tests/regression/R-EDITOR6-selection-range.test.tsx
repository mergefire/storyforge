import { act, createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RichEditor, { type RichEditorHandle } from '../../src/components/editor/RichEditor'
import FloatingToolbar from '../../src/components/editor/FloatingToolbar'
import type { EditorSelectionPresentation, EditorSelectionSnapshot } from '../../src/lib/editor/selection-snapshot'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mounted: Array<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> = []

function snapshot(text = '选中的文字'): EditorSelectionSnapshot {
  return { from: 1, to: 1 + text.length, text, beforeText: '', afterText: '' }
}

function presentation(revision: number, text = '选中的文字'): EditorSelectionPresentation {
  return { snapshot: snapshot(text), top: 100, left: 200, revision }
}

function closeButton(host: HTMLElement): HTMLButtonElement {
  const buttons = [...host.querySelectorAll('button')]
  return buttons.at(-1) as HTMLButtonElement
}

afterEach(async () => {
  while (mounted.length > 0) {
    const item = mounted.pop()!
    await act(async () => item.root.unmount())
    item.host.remove()
  }
})

describe('EDITOR-6.6 · AI 选区范围', () => {
  it('Decoration 持续高亮但不进入正文 HTML，失效时切换警告样式', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const editorRef = createRef<RichEditorHandle>()
    const onValidity = vi.fn()
    const validSnapshot = snapshot('选中的文字')

    await act(async () => root.render(createElement(RichEditor, {
      ref: editorRef,
      value: '<p>选中的文字以及后文</p>',
      onChange: vi.fn(),
      aiSelection: validSnapshot,
      aiSelectionState: 'generating',
      onAISelectionValidityChange: onValidity,
      showToolbar: false,
    })))

    expect(host.querySelector('[data-ai-selection="generating"]')).toBeTruthy()
    expect(editorRef.current?.getHTML()).not.toContain('sf-ai-selection')
    expect(editorRef.current?.getHTML()).not.toContain('data-ai-selection')

    await act(async () => root.render(createElement(RichEditor, {
      ref: editorRef,
      value: '<p>选中的文字以及后文</p>',
      onChange: vi.fn(),
      aiSelection: { ...validSnapshot, text: '已经不匹配' },
      aiSelectionState: 'active',
      onAISelectionValidityChange: onValidity,
      showToolbar: false,
    })))
    expect(host.querySelector('[data-ai-selection="invalid"]')).toBeTruthy()
    expect(onValidity).toHaveBeenLastCalledWith(false)
  })

  it('可一键重新聚焦并滚回仍然有效的 AI 选区', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const editorRef = createRef<RichEditorHandle>()
    const validSnapshot = snapshot('选中的文字')

    await act(async () => root.render(createElement(RichEditor, {
      ref: editorRef,
      value: '<p>选中的文字以及后文</p>',
      onChange: vi.fn(),
      aiSelection: validSnapshot,
      showToolbar: false,
    })))

    const highlighted = host.querySelector('[data-ai-selection]') as HTMLElement
    const scrollIntoView = vi.fn()
    highlighted.scrollIntoView = scrollIntoView
    expect(editorRef.current?.revealSelectionSnapshot(validSnapshot)).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    expect(editorRef.current?.getSelectedText()).toBe('选中的文字')
  })

  it('同一坐标重新选择后工具条可再次出现', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const onAction = vi.fn()

    await act(async () => root.render(createElement(FloatingToolbar, { selection: presentation(1), onAction })))
    expect(host.textContent).toContain('问 AI')
    await act(async () => closeButton(host).click())
    expect(host.textContent).not.toContain('问 AI')

    await act(async () => root.render(createElement(FloatingToolbar, { selection: presentation(2), onAction })))
    expect(host.textContent).toContain('问 AI')
  })

  it('超长选区显示明确字数和整章切换入口', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const onWhole = vi.fn()
    const text = '字'.repeat(7_318)

    await act(async () => root.render(createElement(FloatingToolbar, {
      selection: { ...presentation(1, text), tooLong: true },
      onAction: vi.fn(),
      onUseWholeChapterScope: onWhole,
    })))
    expect(host.textContent).toContain('当前选区 7,318 字')
    const switchButton = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('切换整章')) as HTMLButtonElement
    await act(async () => switchButton.click())
    expect(onWhole).toHaveBeenCalledOnce()
  })
})
