import { create } from 'zustand'
import type { EditorSelectionSnapshot } from '../lib/editor/selection-snapshot'
import { nanoid } from '../lib/utils/id'

export type ChapterAssistantAction =
  | 'generate'
  | 'continue'
  | 'polish'
  | 'expand'
  | 'condense'
  | 'rewrite'
  | 'check'
  | 'ask'
  | 'deai'
  | 'review'

export type ChapterAssistantApplyMode =
  | 'replace-chapter'
  | 'append-chapter'
  | 'replace-selection'
  | 'none'

export type ChapterAssistantInteractionMode = 'auto' | 'edit' | 'discuss'

export interface ChapterAssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'status'
  content: string
  createdAt: number
  taskId?: string
}

export interface ChapterAssistantTask {
  id: string
  action: ChapterAssistantAction
  label: string
  applyMode: ChapterAssistantApplyMode
  /** 最近一次请求的交付协议；讨论候选时不覆盖候选本身的 applyMode。 */
  lastResponseApplyMode?: ChapterAssistantApplyMode
  instruction: string
  selection?: EditorSelectionSnapshot
  /** 请求建立时锁定的章节，防止候选跨章节写回。 */
  chapterId?: number
  /** 请求建立时编辑器可见完整正文的 hash。 */
  chapterContentHash?: string
  /** 续写任务建立时的正文末尾锚点。 */
  chapterTailAnchor?: string
  sourceTextHash?: string
  /** 本轮候选所基于的原文，用于采纳前对照。 */
  sourceText?: string
  candidate?: string
  /** 流式生成期间周期性缓存、停止或失败时保留的未完成输出；始终不可直接采纳。 */
  partialOutput?: string
  failureMessage?: string
  blockedReason?: string
  /** 0 表示首次执行；后续对话始终走统一章节助手，避免重复触发首轮生成模板。 */
  iteration: number
  status: 'draft' | 'generating' | 'completed' | 'stopped' | 'failed' | 'blocked' | 'applied' | 'discarded'
}

export interface ChapterAssistantContextMeta {
  phase?: 'preparing' | 'assembled'
  planned?: string[]
  included: string[]
  /** 本轮实际发送的来源与 token，供作者核对，而不是只显示笼统的“已关联”。 */
  sources?: Array<{ key: string; tokens: number }>
  /** 请求了但当前没有可用内容的来源；可选以兼容旧会话缓存。 */
  omitted?: string[]
  trimmed: string[]
  compressed?: string[]
  sourceLimits?: Array<{ key: string; configuredTokens: number; effectiveTokens: number; applied: boolean }>
  protectedSources?: string[]
  totalInputTokens: number
  inputBudgetTokens?: number
  provider?: string
  model?: string
  contextWindowTokens?: number
  maxOutputTokens?: number
}

export interface ChapterAssistantSession {
  messages: ChapterAssistantMessage[]
  activeTask: ChapterAssistantTask | null
  contextMeta: ChapterAssistantContextMeta | null
}

const EMPTY_SESSION: ChapterAssistantSession = {
  messages: [],
  activeTask: null,
  contextMeta: null,
}

interface ChapterAssistantStore {
  sessions: Record<string, ChapterAssistantSession>
  hydrated: Record<string, boolean>
  hydrateSession: (key: string) => void
  appendMessage: (key: string, message: Omit<ChapterAssistantMessage, 'id' | 'createdAt'>) => void
  /** 同步认领一次运行；同一会话已有生成任务时拒绝后来的重复入口。 */
  claimTaskRun: (key: string, task: ChapterAssistantTask) => boolean
  /** 只允许当前仍在生成的同一任务更新流式恢复缓存。 */
  patchRunningTask: (key: string, taskId: string, patch: Partial<ChapterAssistantTask>) => boolean
  /** 只允许当前任务收尾，防止过期请求覆盖或中止较新的任务。 */
  settleTaskRun: (key: string, taskId: string, task: ChapterAssistantTask) => boolean
  setTask: (key: string, task: ChapterAssistantTask | null) => void
  patchTask: (key: string, patch: Partial<ChapterAssistantTask>) => void
  setContextMeta: (key: string, meta: ChapterAssistantContextMeta | null) => void
  clearSession: (key: string) => void
}

const STORAGE_PREFIX = 'storyforge-chapter-assistant:'
const MAX_PERSISTED_MESSAGES = 60

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function persistedSession(session: ChapterAssistantSession): ChapterAssistantSession {
  return {
    ...session,
    messages: session.messages.slice(-MAX_PERSISTED_MESSAGES),
  }
}

function saveSession(key: string, session: ChapterAssistantSession | undefined): void {
  const storage = getStorage()
  if (!storage) return
  try {
    if (!session) storage.removeItem(`${STORAGE_PREFIX}${key}`)
    else storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(persistedSession(session)))
  } catch {
    // 对话持久化属于体验增强；容量不足时不能阻断正文编辑与 AI 调用。
  }
}

function loadSession(key: string): ChapterAssistantSession | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(`${STORAGE_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ChapterAssistantSession>
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      activeTask: parsed.activeTask
        ? {
            ...parsed.activeTask,
            iteration: parsed.activeTask.iteration ?? 0,
            status: (parsed.activeTask as { status?: string }).status === 'ready'
              ? 'completed'
              : parsed.activeTask.status === 'generating'
                ? 'stopped'
                : parsed.activeTask.status,
          } as ChapterAssistantTask
        : null,
      contextMeta: parsed.contextMeta ?? null,
    }
  } catch {
    return null
  }
}

function withSession(
  sessions: Record<string, ChapterAssistantSession>,
  key: string,
  patch: Partial<ChapterAssistantSession>,
): Record<string, ChapterAssistantSession> {
  return {
    ...sessions,
    [key]: {
      ...(sessions[key] ?? EMPTY_SESSION),
      ...patch,
    },
  }
}

export const useChapterAssistantStore = create<ChapterAssistantStore>((set, get) => {
  const persist = (key: string) => {
    queueMicrotask(() => saveSession(key, get().sessions[key]))
  }

  return {
  sessions: {},
  hydrated: {},
  hydrateSession: key => set(state => {
    if (state.hydrated[key]) return state
    const stored = loadSession(key)
    return {
      hydrated: { ...state.hydrated, [key]: true },
      sessions: stored ? withSession(state.sessions, key, stored) : state.sessions,
    }
  }),
  appendMessage: (key, message) => set(state => {
    const current = state.sessions[key] ?? EMPTY_SESSION
    persist(key)
    return {
      sessions: withSession(state.sessions, key, {
        messages: [
          ...current.messages,
          { ...message, id: nanoid(), createdAt: Date.now() },
        ],
      }),
    }
  }),
  claimTaskRun: (key, task) => {
    let claimed = false
    set(state => {
      const current = state.sessions[key] ?? EMPTY_SESSION
      if (current.activeTask?.status === 'generating') return state
      claimed = true
      return {
        sessions: withSession(state.sessions, key, {
          activeTask: { ...task, status: 'generating' },
        }),
      }
    })
    if (claimed) persist(key)
    return claimed
  },
  patchRunningTask: (key, taskId, patch) => {
    let patched = false
    set(state => {
      const current = state.sessions[key] ?? EMPTY_SESSION
      if (current.activeTask?.id !== taskId || current.activeTask.status !== 'generating') return state
      patched = true
      return {
        sessions: withSession(state.sessions, key, {
          activeTask: { ...current.activeTask, ...patch },
        }),
      }
    })
    if (patched) persist(key)
    return patched
  },
  settleTaskRun: (key, taskId, task) => {
    let settled = false
    set(state => {
      const current = state.sessions[key] ?? EMPTY_SESSION
      if (current.activeTask?.id !== taskId) return state
      settled = true
      return { sessions: withSession(state.sessions, key, { activeTask: task }) }
    })
    if (settled) persist(key)
    return settled
  },
  setTask: (key, task) => set(state => {
    persist(key)
    return { sessions: withSession(state.sessions, key, { activeTask: task }) }
  }),
  patchTask: (key, patch) => set(state => {
    const current = state.sessions[key] ?? EMPTY_SESSION
    if (!current.activeTask) return state
    persist(key)
    return {
      sessions: withSession(state.sessions, key, {
        activeTask: { ...current.activeTask, ...patch },
      }),
    }
  }),
  setContextMeta: (key, contextMeta) => set(state => {
    persist(key)
    return { sessions: withSession(state.sessions, key, { contextMeta }) }
  }),
  clearSession: key => set(state => {
    saveSession(key, undefined)
    if (!(key in state.sessions)) return state
    const sessions = { ...state.sessions }
    delete sessions[key]
    return { sessions }
  }),
  }
})

export function selectChapterAssistantSession(key: string) {
  return (state: ChapterAssistantStore): ChapterAssistantSession => state.sessions[key] ?? EMPTY_SESSION
}

export function createChapterAssistantTask(
  task: Omit<ChapterAssistantTask, 'id' | 'status' | 'iteration'> & { iteration?: number },
): ChapterAssistantTask {
  return { ...task, iteration: task.iteration ?? 0, id: nanoid(), status: 'draft' }
}
