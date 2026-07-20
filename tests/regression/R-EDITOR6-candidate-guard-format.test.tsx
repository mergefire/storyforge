import { act, createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RichEditor, { type RichEditorHandle } from '../../src/components/editor/RichEditor'
import { inspectChapterCandidate } from '../../src/lib/editor/chapter-candidate-guard'
import { inspectSelectionCandidate } from '../../src/lib/editor/selection-candidate-guard'
import { plainTextToHtml, plainTextToInlineHtml } from '../../src/lib/utils/html'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mounted: Array<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> = []

afterEach(async () => {
  while (mounted.length > 0) {
    const item = mounted.pop()!
    await act(async () => item.root.unmount())
    item.host.remove()
  }
})

describe('EDITOR-6.9 · 候选守卫与正文格式', () => {
  it('拦截空输出、Markdown、Prompt 回显、说明、拒答和结构化数据', () => {
    expect(inspectChapterCandidate('', 'replace-chapter').code).toBe('empty')
    expect(inspectChapterCandidate('```text\n正文\n```', 'replace-chapter').code).toBe('markdown')
    expect(inspectChapterCandidate('# 第一章\n正文内容已经足够长。', 'replace-chapter').code).toBe('markdown')
    expect(inspectChapterCandidate('【项目只读上下文】\n人物设定', 'replace-chapter').code).toBe('prompt-leak')
    expect(inspectChapterCandidate('修改说明：我收紧了节奏。', 'replace-chapter').code).toBe('analysis')
    expect(inspectChapterCandidate('抱歉，我无法完成这个请求。', 'replace-chapter').code).toBe('refusal')
    expect(inspectChapterCandidate('{"content":"正文"}', 'replace-chapter').code).toBe('structured-data')
    expect(inspectChapterCandidate('雨点敲在窗纸上，沈砚听见院门外传来第三声脚步。', 'replace-chapter')).toEqual({ ok: true })
  })

  it('选区守卫先执行通用检查，再检查前后邻文回显', () => {
    const snapshot = {
      from: 10,
      to: 15,
      text: '选中文字',
      beforeText: '门外传来三声克制的敲门声，沈砚没有立刻起身。',
      afterText: '灯芯爆开一朵火花，屋里重新安静下来。',
    }
    expect(inspectSelectionCandidate('**替换文字**', snapshot).reason).toContain('Markdown')
    expect(inspectSelectionCandidate('门外传来三声克制的敲门声，沈砚没有立刻起身。换一种写法。', snapshot).reason).toContain('之前的邻文')
  })

  it('整章转换不会把常规段落分隔膨胀为空段，并保留明确的场景空行', () => {
    expect(plainTextToHtml('第一段\n\n第二段')).toBe('<p>第一段</p><p>第二段</p>')
    expect(plainTextToHtml('第一场\n\n\n第二场')).toBe('<p>第一场</p><p></p><p>第二场</p>')
    expect(plainTextToInlineHtml('**不是加粗**\n下一句')).toBe('**不是加粗**<br>下一句')
  })

  it('TipTap 加载 AI 常规段落文本时不会插入额外空段', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const editorRef = createRef<RichEditorHandle>()

    await act(async () => root.render(createElement(RichEditor, {
      ref: editorRef,
      value: '第一段\n\n第二段',
      onChange: vi.fn(),
      showToolbar: false,
    })))

    expect(editorRef.current?.getHTML()).toBe('<p>第一段</p><p>第二段</p>')
  })

  it('单段选区替换继承原选区的加粗 marks', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    const editorRef = createRef<RichEditorHandle>()
    await act(async () => root.render(createElement(RichEditor, {
      ref: editorRef,
      value: '<p><strong>选中的文字</strong>以及后文</p>',
      onChange: vi.fn(),
      showToolbar: false,
    })))
    let applied = null
    await act(async () => {
      applied = editorRef.current?.applySelectionSnapshot({
        from: 1,
        to: 6,
        text: '选中的文字',
        beforeText: '',
        afterText: '以及后文',
      }, plainTextToInlineHtml('替换的文字'), 'replace')
    })
    expect(applied).toBeTruthy()
    expect(editorRef.current?.getHTML()).toContain('<strong>替换的文字</strong>')
    expect(editorRef.current?.getHTML()).toContain('以及后文')
  })
})
