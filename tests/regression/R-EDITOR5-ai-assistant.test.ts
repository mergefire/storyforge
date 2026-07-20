import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildChapterAssistantConversationHistory,
  buildChapterAssistantPrompt,
  buildChapterContentPrompt,
} from '../../src/lib/ai/adapters/chapter-adapter'
import {
  createChapterAssistantTask,
  useChapterAssistantStore,
} from '../../src/stores/chapter-ai-chat'
import { resolveChapterAssistantMode } from '../../src/lib/ai/chapter-assistant-intent'
import { inspectSelectionCandidate } from '../../src/lib/editor/selection-candidate-guard'

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('EDITOR-5 · contextual chapter AI assistant', () => {
  it('separates read-only context, writable target, neighbours and delivery contract', () => {
    const messages = buildChapterAssistantPrompt({
      chapterTitle: '雨夜来客',
      chapterSummary: '主角识破来客身份',
      instruction: '让这段对话更克制',
      editContract: '只输出选中段落的替换正文',
      readOnlyContext: '角色设定：沈砚从不直呼对方姓名',
      beforeText: '门外响了三声。',
      targetText: '你终于来了。',
      afterText: '灯芯忽然爆开。',
      currentCandidate: '你还是来了。',
      conversationHistory: '作者：再收一点情绪',
      recipeContext: '保持原意与人物口吻',
    })

    const user = messages.find(message => message.role === 'user')?.content ?? ''
    expect(user).toContain('【项目只读上下文】')
    expect(user).toContain('【目标前邻文（只读，不得输出）】')
    expect(user).toContain('【本轮可写目标】')
    expect(user).toContain('【目标后邻文（只读，不得输出）】')
    expect(user).toContain('【当前候选（本轮在此基础上继续）】')
    expect(user).toContain('只输出选中段落的替换正文')
  })

  it('bounds chapter conversation history while keeping the latest turns', () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `第${index + 1}轮-${'字'.repeat(20)}`,
    }))
    const history = buildChapterAssistantConversationHistory(messages, 160)
    expect(history).toContain('第12轮')
    expect(history).not.toContain('第1轮-')
    expect(history.length).toBeLessThanOrEqual(174)
  })

  it('automatically treats writing commands as candidates and questions as discussion', () => {
    expect(resolveChapterAssistantMode('auto', '写第一章，开场从婚礼现场切入')).toBe('edit')
    expect(resolveChapterAssistantMode('auto', '把这段改得更克制')).toBe('edit')
    expect(resolveChapterAssistantMode('auto', '这段能不能更紧凑')).toBe('edit')
    expect(resolveChapterAssistantMode('auto', '可以帮我重写一下吗')).toBe('edit')
    expect(resolveChapterAssistantMode('auto', '把刚才说的问题直接改掉')).toBe('edit')
    expect(resolveChapterAssistantMode('auto', '为什么这一段的节奏不对？')).toBe('discuss')
    expect(resolveChapterAssistantMode('discuss', '生成第一章')).toBe('discuss')
    expect(resolveChapterAssistantMode('edit', '这段有什么问题？')).toBe('edit')
  })

  it('blocks selection candidates that echo read-only neighbours', () => {
    const snapshot = {
      from: 20,
      to: 28,
      text: '你终于来了。',
      beforeText: '雨水沿着门框落下。门外准时响起了三声克制的敲门声。',
      afterText: '灯芯忽然爆开，沈砚却没有回头，只把手按在刀柄上。',
    }

    expect(inspectSelectionCandidate('你还是来了。', snapshot)).toEqual({ ok: true })
    expect(inspectSelectionCandidate('门外准时响起了三声克制的敲门声。你还是来了。', snapshot)).toMatchObject({ ok: false })
    expect(inspectSelectionCandidate('你还是来了。灯芯忽然爆开，沈砚却没有回头，只把手按在刀柄上。', snapshot)).toMatchObject({ ok: false })
    expect(inspectSelectionCandidate('【目标后邻文（只读，不得输出）】灯芯忽然爆开。', snapshot)).toMatchObject({ ok: false })
  })

  it('allows a per-run prompt override without mutating the active template', () => {
    const messages = buildChapterAssistantPrompt({
      chapterTitle: '第一章',
      chapterSummary: '开场相遇',
      instruction: '写出正文',
      editContract: '只输出完整正文',
      readOnlyContext: '角色档案：周迟不善言辞',
      targetText: '（空白正文）',
    }, {
      overrides: {
        systemPrompt: '本轮使用作者自定义的系统要求。',
        userPromptTemplate: '任务={{instruction}}\n资料={{readOnlyContext}}',
      },
    })

    expect(messages.find(message => message.role === 'system')?.content).toContain('作者自定义的系统要求')
    expect(messages.find(message => message.role === 'user')?.content).toContain('角色档案：周迟不善言辞')
  })

  it('passes the visible per-run prompt and author requirement into first-draft generation', () => {
    const messages = buildChapterContentPrompt(
      '第一章',
      '婚礼现场发生变故',
      '【故事核心】女主隐瞒身份',
      '【角色档案】周迟不善言辞',
      '',
      '',
      '开场不要介绍背景，直接从宣誓被打断开始。',
      {
        overrides: {
          systemPrompt: '本轮正文采用冷峻短句。',
          userPromptTemplate: '任务={{chapterSummary}}\n资料={{worldContext}}\n角色={{characters}}\n要求={{userHint}}',
        },
        skipContinuityEnvelope: true,
      },
    )

    expect(messages.find(message => message.role === 'system')?.content).toContain('本轮正文采用冷峻短句')
    const user = messages.find(message => message.role === 'user')?.content ?? ''
    expect(user).toContain('女主隐瞒身份')
    expect(user).toContain('周迟不善言辞')
    expect(user).toContain('直接从宣誓被打断开始')
  })

  it('persists each chapter conversation locally and restores its active edit target', async () => {
    const key = 'project:7:chapter.assistant:chapter:9'
    localStorage.clear()
    useChapterAssistantStore.setState({ sessions: {}, hydrated: {} })
    const task = createChapterAssistantTask({
      action: 'polish',
      label: '选中段落',
      applyMode: 'replace-selection',
      instruction: '写得更克制',
      sourceText: '原文',
    })
    useChapterAssistantStore.getState().setTask(key, task)
    useChapterAssistantStore.getState().appendMessage(key, { role: 'user', content: '写得更克制' })
    await Promise.resolve()

    useChapterAssistantStore.setState({ sessions: {}, hydrated: {} })
    useChapterAssistantStore.getState().hydrateSession(key)
    const restored = useChapterAssistantStore.getState().sessions[key]
    expect(restored.activeTask).toMatchObject({ label: '选中段落', sourceText: '原文', iteration: 0 })
    expect(restored.messages.at(-1)?.content).toBe('写得更克制')
  })

  it('migrates legacy ready tasks and never restores an interrupted task as completed', () => {
    const readyKey = 'project:7:chapter.assistant:chapter:ready'
    const generatingKey = 'project:7:chapter.assistant:chapter:generating'
    const baseTask = {
      id: 'legacy-task',
      action: 'rewrite',
      label: '整章正文',
      applyMode: 'replace-chapter',
      instruction: '重写',
      iteration: 1,
      candidate: '候选稿',
    }
    localStorage.setItem(`storyforge-chapter-assistant:${readyKey}`, JSON.stringify({
      messages: [],
      activeTask: { ...baseTask, status: 'ready' },
      contextMeta: null,
    }))
    localStorage.setItem(`storyforge-chapter-assistant:${generatingKey}`, JSON.stringify({
      messages: [],
      activeTask: { ...baseTask, candidate: undefined, status: 'generating' },
      contextMeta: null,
    }))
    useChapterAssistantStore.setState({ sessions: {}, hydrated: {} })

    useChapterAssistantStore.getState().hydrateSession(readyKey)
    useChapterAssistantStore.getState().hydrateSession(generatingKey)

    expect(useChapterAssistantStore.getState().sessions[readyKey].activeTask?.status).toBe('completed')
    expect(useChapterAssistantStore.getState().sessions[generatingKey].activeTask?.status).toBe('stopped')
  })

  it('routes selection actions through one assistant and adopts only verified editor output', () => {
    const chapterEditor = read('src/components/editor/ChapterEditor.tsx')
    const floatingToolbar = read('src/components/editor/FloatingToolbar.tsx')
    const richEditor = read('src/components/editor/RichEditor.tsx')
    const assistantPanel = read('src/components/editor/ChapterAIAssistantPanel.tsx')
    const assistantStore = read('src/stores/chapter-ai-chat.ts')

    expect(floatingToolbar).not.toContain('useAIStream')
    expect(floatingToolbar).toContain('onAction(action, selection.snapshot)')
    expect(floatingToolbar).not.toContain("document.addEventListener('selectionchange'")
    expect(floatingToolbar).toContain('onMouseDown={event => event.preventDefault()}')
    expect(chapterEditor).toContain('const fullContext = await buildFullWorldCtx(')
    expect(chapterEditor).toContain("['manualText']")
    expect(chapterEditor).toContain("['chapterContent']")
    expect(chapterEditor).toContain("'characters',")
    expect(chapterEditor).toContain("characterContext: segmentFor('characters')")
    expect(chapterEditor).toContain('fullContext.characterContext')
    expect(chapterEditor).toContain('protectedSourceKeys: CHAPTER_AI_PROTECTED_SOURCE_KEYS')
    expect(chapterEditor).toContain('inspectSelectionCandidate(candidate, effectiveTask.selection)')
    expect(chapterEditor).toContain('resolveChapterAssistantMode(interactionMode, instruction)')
    expect(chapterEditor).toContain('【当前章节完整正文（只读）】')
    expect(chapterEditor).toContain("target: 'chapters'")
    expect(chapterEditor).toContain("mode: 'replace'")
    expect(chapterEditor).toContain("applySelectionSnapshot(task.selection, candidateHtml, 'replace')")
    expect(chapterEditor).toContain('applyChapterCandidate({')
    expect(chapterEditor).toContain("kind: 'chapter-content-hash'")
    expect(chapterEditor).toContain('createSnapshot: useBackupStore.getState().createSnapshot')
    expect(chapterEditor).toContain('undoChapterAdoption({')
    expect(chapterEditor).toContain('clearSession(assistantSessionKey)')
    expect(richEditor).toContain('current !== snapshot.text')
    expect(richEditor).toContain("placement: 'replace' | 'before' | 'after'")
    expect(assistantPanel).toContain('原文对照')
    expect(assistantPanel).toContain('自动判断')
    expect(assistantPanel).toContain('生成候选')
    expect(assistantPanel).toContain('PromptRunPanel')
    expect(assistantPanel).toContain('本次实际读取')
    expect(assistantPanel).toContain('修改范围：{scopeLabel}')
    expect(assistantPanel).toContain("runDefaultQuickAction('generate')")
    expect(assistantPanel).not.toContain("onApply('insert-before')")
    expect(assistantPanel).not.toContain("onApply('append')")
    expect(assistantPanel).not.toContain("onApply('replace')")
    expect(chapterEditor).toContain("responseApplyMode: 'none'")
    expect(assistantPanel).toContain('章节关联')
    expect(assistantStore).toContain('storyforge-chapter-assistant:')
    expect(assistantStore).toContain('hydrateSession')
  })
})
