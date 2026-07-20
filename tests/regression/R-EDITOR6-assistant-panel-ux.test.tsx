import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChapterAIAssistantPanel, {
  type ChapterAssistantLinkedWorkspace,
} from '../../src/components/editor/ChapterAIAssistantPanel'
import PanelLayout from '../../src/components/shared/PanelLayout'
import { DialogProvider } from '../../src/components/shared/Dialog'
import { ToastProvider } from '../../src/components/shared/Toast'
import type { UseAIStreamReturn } from '../../src/hooks/useAIStream'
import type { ChapterAssistantSession } from '../../src/stores/chapter-ai-chat'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted: Array<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> = []

function stream(overrides: Partial<UseAIStreamReturn> = {}): UseAIStreamReturn {
  return {
    output: '',
    reasoning: '',
    isStreaming: false,
    error: null,
    tokenUsage: null,
    operation: null,
    start: vi.fn(async () => ''),
    startWithOutcome: vi.fn(async () => ({ output: '', status: 'completed' as const })),
    stop: vi.fn(),
    reset: vi.fn(),
    setOperation: vi.fn(),
    ...overrides,
  }
}

function linked(): ChapterAssistantLinkedWorkspace {
  return {
    goalTitle: '第一章',
    goalSummary: '主角在雨夜接到密信',
    memoryBusy: false,
    reconciliationCurrent: true,
    pendingStateCount: 0,
    stateBusy: false,
    factBusy: false,
    factCandidates: [],
    impactBusy: false,
    notes: '',
    onNotesChange: vi.fn(),
    onGenerateMemory: vi.fn(),
    onConfirmProgress: vi.fn(),
    onApplyOutlineCandidate: vi.fn(),
    onExtractState: vi.fn(),
    onExtractFacts: vi.fn(),
    onUpdateFactCandidate: vi.fn(async () => undefined),
    onConfirmFactCandidates: vi.fn(async () => undefined),
    onRejectFactCandidates: vi.fn(async () => undefined),
    onOpenFactLibrary: vi.fn(),
    onAnalyzeImpact: vi.fn(),
    onOpenOutline: vi.fn(),
    onOpenReview: vi.fn(),
    onOpenNotes: vi.fn(),
    onOpenEmotion: vi.fn(),
  }
}

async function renderPanel(
  session: ChapterAssistantSession,
  streamValue = stream(),
  callbacks: {
    onRevealSelection?: () => void
    onResumePartial?: () => void | Promise<void>
    onQuickAction?: () => void | Promise<void>
  } = {},
) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  mounted.push({ host, root })
  const render = async (nextSession: ChapterAssistantSession, nextStream = streamValue) => act(async () => root.render(createElement(ToastProvider, null,
    createElement(DialogProvider, null, createElement(ChapterAIAssistantPanel, {
      session: nextSession,
      stream: nextStream,
      hasText: true,
      activeTab: 'assistant',
      linked: linked(),
      onTabChange: vi.fn(),
      onClose: vi.fn(),
      onClear: vi.fn(),
      onQuickAction: callbacks.onQuickAction ?? vi.fn(),
      onSend: vi.fn(),
      onApply: vi.fn(),
      onRetry: vi.fn(),
      onResumePartial: callbacks.onResumePartial ?? vi.fn(),
      onDiscard: vi.fn(),
      onUseWholeChapterScope: vi.fn(),
      onRevealSelection: callbacks.onRevealSelection ?? vi.fn(),
    })),
  )))
  await render(session)
  return { host, render }
}

beforeEach(() => localStorage.clear())

afterEach(async () => {
  while (mounted.length > 0) {
    const item = mounted.pop()!
    await act(async () => item.root.unmount())
    item.host.remove()
  }
})

describe('EDITOR-6.7 · AI 面板与对话体验', () => {
  it('恢复宽度偏好，并支持键盘调整和双击复位', async () => {
    localStorage.setItem('storyforge.chapter-ai.width', '500')
    const { host } = await renderPanel({ messages: [], activeTask: null, contextMeta: null })
    const aside = host.querySelector('aside') as HTMLElement
    const separator = host.querySelector('[role="separator"]') as HTMLElement

    expect(aside.style.getPropertyValue('--chapter-ai-width')).toBe('500px')
    await act(async () => separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(aside.style.getPropertyValue('--chapter-ai-width')).toBe('520px')
    expect(localStorage.getItem('storyforge.chapter-ai.width')).toBe('520')

    await act(async () => separator.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(aside.style.getPropertyValue('--chapter-ai-width')).toBe('420px')
  })

  it('清楚区分作者、AI 和系统状态消息', async () => {
    const { host } = await renderPanel({
      activeTask: null,
      contextMeta: null,
      messages: [
        { id: 'u', role: 'user', content: '把开场收紧', createdAt: 1 },
        { id: 'a', role: 'assistant', content: '建议从敲门声直接切入。', createdAt: 2 },
        { id: 's', role: 'status', content: '已建立整章任务', createdAt: 3 },
      ],
    })
    expect(host.textContent).toContain('你')
    expect(host.textContent).toContain('AI')
    expect(host.textContent).toContain('已建立整章任务')
    expect(host.querySelectorAll('.justify-end')).toHaveLength(1)
    expect(host.querySelectorAll('.justify-start')).toHaveLength(1)
    expect(host.querySelectorAll('.justify-center')).toHaveLength(1)
  })

  it('选区候选在侧栏显示字词级差异、字数和锁定范围', async () => {
    const { host } = await renderPanel({
      messages: [],
      contextMeta: null,
      activeTask: {
        id: 'selection-candidate',
        action: 'polish',
        label: '选中段落',
        applyMode: 'replace-selection',
        instruction: '收紧节奏',
        iteration: 1,
        status: 'completed',
        sourceText: '门外响了三声。',
        candidate: '门外只响三声。',
        selection: { from: 1, to: 8, text: '门外响了三声。', beforeText: '', afterText: '' },
      },
    })
    expect(host.textContent).toContain('原文 7 字 → 候选 7 字')
    expect(host.textContent).toContain('锁定原选区')
    const compare = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('原文对照'))!
    await act(async () => compare.click())
    expect(host.querySelector('[aria-label="选区字词差异"]')).toBeTruthy()
    expect(host.querySelector('del')).toBeTruthy()
    expect(host.querySelector('ins')).toBeTruthy()
  })

  it('锁定选区提供一键回到正文位置的入口', async () => {
    const onRevealSelection = vi.fn()
    const { host } = await renderPanel({
      messages: [],
      contextMeta: null,
      activeTask: {
        id: 'selection-draft',
        action: 'polish',
        label: '选中段落',
        applyMode: 'replace-selection',
        instruction: '润色',
        iteration: 0,
        status: 'draft',
        selection: { from: 1, to: 8, text: '门外响了三声。', beforeText: '', afterText: '' },
      },
    }, stream(), { onRevealSelection })
    const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('回到选区')) as HTMLButtonElement
    await act(async () => button.click())
    expect(onRevealSelection).toHaveBeenCalledOnce()
  })

  it('网络中断后展示已保留正文，并允许从保留内容继续', async () => {
    const onResumePartial = vi.fn()
    const { host } = await renderPanel({
      messages: [],
      contextMeta: null,
      activeTask: {
        id: 'failed-draft',
        action: 'generate',
        label: '整章正文',
        applyMode: 'replace-chapter',
        instruction: '按章纲生成',
        iteration: 0,
        status: 'failed',
        partialOutput: '这是网络中断前已经生成的正文。',
        failureMessage: 'AI 连接中断',
      },
    }, stream(), { onResumePartial })
    expect(host.textContent).toContain('这是网络中断前已经生成的正文。')
    const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('从保留内容继续')) as HTMLButtonElement
    await act(async () => button.click())
    expect(onResumePartial).toHaveBeenCalledOnce()
  })

  it('主动停止后同样保留正文，并显示继续生成入口', async () => {
    const onResumePartial = vi.fn()
    const { host } = await renderPanel({
      messages: [],
      contextMeta: null,
      activeTask: {
        id: 'stopped-draft',
        action: 'generate',
        label: '整章正文',
        applyMode: 'replace-chapter',
        instruction: '按章纲生成',
        iteration: 0,
        status: 'stopped',
        partialOutput: '这是停止前已经生成并缓存的正文。',
      },
    }, stream(), { onResumePartial })

    expect(host.textContent).toContain('已保留 16 字未完成正文')
    const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('从保留内容继续')) as HTMLButtonElement
    await act(async () => button.click())
    expect(onResumePartial).toHaveBeenCalledOnce()
  })

  it('快速重复点击生成时只提交一个正文任务', async () => {
    let finishRequest!: () => void
    const pendingRequest = new Promise<void>(resolve => { finishRequest = resolve })
    const onQuickAction = vi.fn(() => pendingRequest)
    const { host } = await renderPanel({
      messages: [],
      activeTask: null,
      contextMeta: null,
    }, stream(), { onQuickAction })
    const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('重写整章')) as HTMLButtonElement

    await act(async () => {
      button.click()
      button.click()
      await Promise.resolve()
    })

    expect(onQuickAction).toHaveBeenCalledOnce()
    await act(async () => finishRequest())
  })

  it('用户向上阅读时不抢滚动，并显示回到底部入口', async () => {
    const initial: ChapterAssistantSession = {
      activeTask: null,
      contextMeta: null,
      messages: [{ id: 'first', role: 'assistant', content: '第一条', createdAt: 1 }],
    }
    const { host, render } = await renderPanel(initial)
    const viewport = host.querySelector('.relative.min-h-0.flex-1.overflow-y-auto') as HTMLDivElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 200 })
    viewport.scrollTop = 100
    await act(async () => viewport.dispatchEvent(new Event('scroll', { bubbles: true })))
    await render({
      ...initial,
      messages: [...initial.messages, { id: 'second', role: 'assistant', content: '第二条', createdAt: 2 }],
    })
    expect(host.textContent).toContain('有新输出，回到底部')
    const returnButton = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('有新输出'))!
    await act(async () => returnButton.click())
    expect(viewport.scrollTop).toBe(1000)
  })

  it('中等宽度打开 AI 时自动折叠章节目录', async () => {
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: '(max-width: 1279px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    mounted.push({ host, root })
    await act(async () => root.render(createElement(PanelLayout, {
      sidebar: createElement('span', null, '章节目录内容'),
      sidebarTitle: '章节',
      autoCollapse: true,
      children: createElement('main', null, '正文'),
    })))
    expect(host.textContent).not.toContain('章节目录内容')
    expect(host.querySelector('[title="展开侧栏"]')).toBeTruthy()
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: original })
  })
})
