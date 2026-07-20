import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mode: 'completed' as 'completed' | 'stopped' | 'failed' | 'failed-after-output',
}))

vi.mock('../../src/lib/ai/client', () => ({
  resolveRequestConfig: () => ({ config: { provider: 'test', model: 'test' } }),
  streamChat: async function* (_messages: unknown, _config: unknown, signal: AbortSignal) {
    if (mocks.mode === 'failed') throw new Error('provider unavailable')
    if (mocks.mode === 'failed-after-output') {
      yield { kind: 'content', text: '网络中断前已经生成的正文' }
      throw new TypeError('Failed to fetch')
    }
    yield { kind: 'content', text: mocks.mode === 'stopped' ? '未完成的半篇' : '完整正文' }
    if (mocks.mode === 'stopped') {
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
    }
  },
}))

vi.mock('../../src/lib/ai/config-readiness', () => ({
  isAIConfigReady: () => true,
  getAIConfigRequiredMessage: () => '',
}))

import { useAIStream, type AIStreamOutcome, type UseAIStreamReturn } from '../../src/hooks/useAIStream'
import {
  createChapterAssistantTask,
  useChapterAssistantStore,
} from '../../src/stores/chapter-ai-chat'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let stream!: UseAIStreamReturn
const mounted: Array<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> = []

async function mount(): Promise<void> {
  function Harness() {
    stream = useAIStream()
    return createElement('div', null, stream.isStreaming ? 'generating' : 'idle')
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  mounted.push({ host, root })
  await act(async () => root.render(createElement(Harness)))
}

afterEach(async () => {
  while (mounted.length > 0) {
    const item = mounted.pop()!
    await act(async () => item.root.unmount())
    item.host.remove()
  }
  localStorage.clear()
  useChapterAssistantStore.setState({ sessions: {}, hydrated: {} })
})

describe('EDITOR-6.3 · 流式任务完成原因', () => {
  it('同步认领章节任务，单次运行期间拒绝第二个并发任务', () => {
    const key = '7:chapter.assistant:9'
    const first = createChapterAssistantTask({
      action: 'generate',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction: '按章纲生成',
    })
    const duplicate = createChapterAssistantTask({
      action: 'generate',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction: '按章纲生成',
    })

    expect(useChapterAssistantStore.getState().claimTaskRun(key, first)).toBe(true)
    expect(useChapterAssistantStore.getState().claimTaskRun(key, duplicate)).toBe(false)
    expect(useChapterAssistantStore.getState().sessions[key].activeTask?.id).toBe(first.id)
  })

  it('过期任务不能覆盖新任务', async () => {
    const key = '7:chapter.assistant:10'
    const first = createChapterAssistantTask({
      action: 'generate',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction: '第一次生成',
    })
    const second = createChapterAssistantTask({
      action: 'generate',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction: '第二次生成',
    })
    const store = useChapterAssistantStore.getState()

    expect(store.claimTaskRun(key, first)).toBe(true)
    expect(store.patchRunningTask(key, first.id, { partialOutput: '已经流式生成的正文' })).toBe(true)
    expect(store.settleTaskRun(key, first.id, { ...first, status: 'stopped', partialOutput: '已经流式生成的正文' })).toBe(true)
    expect(useChapterAssistantStore.getState().claimTaskRun(key, second)).toBe(true)
    expect(useChapterAssistantStore.getState().settleTaskRun(key, first.id, { ...first, status: 'failed' })).toBe(false)
    expect(useChapterAssistantStore.getState().sessions[key].activeTask?.id).toBe(second.id)

    await Promise.resolve()
  })

  it('流式正文缓存可在应用意外关闭后恢复为未完成输出', async () => {
    const key = '7:chapter.assistant:11'
    const task = createChapterAssistantTask({
      action: 'generate',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction: '按章纲生成',
    })
    const store = useChapterAssistantStore.getState()

    expect(store.claimTaskRun(key, task)).toBe(true)
    expect(store.patchRunningTask(key, task.id, { partialOutput: '应用关闭前已经生成的正文' })).toBe(true)
    await Promise.resolve()
    useChapterAssistantStore.setState({ sessions: {}, hydrated: {} })
    useChapterAssistantStore.getState().hydrateSession(key)
    expect(useChapterAssistantStore.getState().sessions[key].activeTask).toMatchObject({
      id: task.id,
      status: 'stopped',
      partialOutput: '应用关闭前已经生成的正文',
    })
  })

  it('正常结束返回 completed 和完整输出', async () => {
    mocks.mode = 'completed'
    await mount()
    let outcome!: AIStreamOutcome
    await act(async () => {
      outcome = await stream.startWithOutcome([{ role: 'user', content: '生成正文' }])
    })
    expect(outcome).toEqual({ output: '完整正文', status: 'completed', error: undefined })
  })

  it('用户停止后保留部分输出但明确返回 stopped', async () => {
    mocks.mode = 'stopped'
    await mount()
    let pending!: Promise<AIStreamOutcome>
    await act(async () => {
      pending = stream.startWithOutcome([{ role: 'user', content: '生成正文' }])
      await Promise.resolve()
    })
    await act(async () => { stream.stop() })
    let outcome!: AIStreamOutcome
    await act(async () => { outcome = await pending })
    expect(outcome).toEqual({ output: '未完成的半篇', status: 'stopped', error: undefined })
  })

  it('请求异常返回 failed 而不是把空字符串当完成', async () => {
    mocks.mode = 'failed'
    await mount()
    let outcome!: AIStreamOutcome
    await act(async () => {
      outcome = await stream.startWithOutcome([{ role: 'user', content: '生成正文' }])
    })
    expect(outcome).toEqual({ output: '', status: 'failed', error: 'provider unavailable' })
    expect(stream.error).toBe('provider unavailable')
  })

  it('响应流中断时仍返回并缓存中断前的正文', async () => {
    mocks.mode = 'failed-after-output'
    await mount()
    let outcome!: AIStreamOutcome
    await act(async () => {
      outcome = await stream.startWithOutcome([{ role: 'user', content: '生成正文' }])
    })
    expect(outcome).toEqual({
      output: '网络中断前已经生成的正文',
      status: 'failed',
      error: 'Failed to fetch',
    })
  })
})
