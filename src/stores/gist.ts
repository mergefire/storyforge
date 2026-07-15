/** GitHub Gist cloud backup state. Plaintext PATs are memory-only. */
import { create } from 'zustand'
import {
  clearGitHubPATCredential,
  connectGitHubPAT,
  exportToGistWithCredential,
  importFromGistWithCredential,
  listGistRevisionsWithCredential,
  listStoryforgeGistsWithCredential,
  storedGitHubPATCredential,
  storeGitHubPATCredential,
  type GistBackupMeta,
  type GistRevisionMeta,
} from '../lib/export/gist-export'
import { exportProjectJSON, importProjectJSON } from '../lib/export/json-export'
import type { CredentialId } from '../runtime'

const LEGACY_PAT_KEY = 'sf-gist-pat'
const USER_KEY = 'sf-gist-user'
const PERSISTENCE_KEY = 'sf-gist-credential-persistence'
const AUTO_KEY = 'sf-gist-auto'
const projKey = (projectId: number) => `sf-gist-proj-${projectId}`

interface ProjBackup { gistId: string; lastBackupAt: number }

function readProj(projectId: number): ProjBackup | null {
  try { const saved = localStorage.getItem(projKey(projectId)); return saved ? JSON.parse(saved) : null } catch { return null }
}

function writeProj(projectId: number, value: ProjBackup) {
  localStorage.setItem(projKey(projectId), JSON.stringify(value))
}

function readInitialAuth(): {
  pat: string | null
  username: string | null
  rememberPat: boolean
} {
  const sessionPat = sessionStorage.getItem(LEGACY_PAT_KEY)
  const localPat = localStorage.getItem(LEGACY_PAT_KEY)
  const persistence = localStorage.getItem(PERSISTENCE_KEY)
  const rememberPat = persistence === 'device' || (persistence === null && !!localPat)
  return {
    pat: sessionPat || localPat,
    username: rememberPat
      ? localStorage.getItem(USER_KEY)
      : sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY),
    rememberPat,
  }
}

function writeAuthMetadata(username: string, rememberPat: boolean): void {
  const target = rememberPat ? localStorage : sessionStorage
  const other = rememberPat ? sessionStorage : localStorage
  target.setItem(USER_KEY, username)
  other.removeItem(USER_KEY)
  localStorage.setItem(PERSISTENCE_KEY, rememberPat ? 'device' : 'session')
  // Legacy plaintext locations are canaries after M1 migration.
  localStorage.removeItem(LEGACY_PAT_KEY)
  sessionStorage.removeItem(LEGACY_PAT_KEY)
}

function clearAuthMetadata(): void {
  localStorage.removeItem(LEGACY_PAT_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(PERSISTENCE_KEY)
  sessionStorage.removeItem(LEGACY_PAT_KEY)
  sessionStorage.removeItem(USER_KEY)
}

interface GistState {
  /** Plaintext exists only during the current renderer session. */
  pat: string | null
  credentialId: CredentialId | null
  connected: boolean
  username: string | null
  rememberPat: boolean
  autoBackup: boolean
  busy: boolean
  error: string | null

  initializeCredential: () => Promise<void>
  connect: (pat: string, rememberPat?: boolean) => Promise<boolean>
  disconnect: () => Promise<void>
  setAutoBackup: (on: boolean) => void
  backupProject: (projectId: number) => Promise<{ url: string } | null>
  restoreFromGist: (gistId: string, sha?: string) => Promise<number | null>
  listBackups: () => Promise<GistBackupMeta[]>
  listRevisions: (projectId: number) => Promise<GistRevisionMeta[]>
  projBackup: (projectId: number) => ProjBackup | null
}

const initialAuth = readInitialAuth()

async function resolveCredential(state: GistState): Promise<CredentialId | null> {
  if (state.credentialId) return state.credentialId
  if (state.pat) {
    return storeGitHubPATCredential(state.pat, state.rememberPat ? 'device' : 'session')
  }
  return storedGitHubPATCredential()
}

export const useGistStore = create<GistState>((set, get) => ({
  pat: initialAuth.pat,
  credentialId: null,
  connected: !!initialAuth.pat,
  username: initialAuth.username,
  rememberPat: initialAuth.rememberPat,
  autoBackup: localStorage.getItem(AUTO_KEY) === '1',
  busy: false,
  error: null,

  initializeCredential: async () => {
    try {
      const credentialId = await resolveCredential(get())
      set({ credentialId, connected: credentialId !== null })
    } catch (error) {
      set({
        credentialId: null,
        connected: false,
        error: error instanceof Error ? error.message : '无法恢复 Gist 凭据',
      })
    }
  },

  connect: async (pat, rememberPat = false) => {
    const value = pat.trim()
    if (!value) return false
    set({ busy: true, error: null })
    try {
      const { login, credentialId } = await connectGitHubPAT(
        value,
        rememberPat ? 'device' : 'session',
      )
      writeAuthMetadata(login, rememberPat)
      set({
        pat: value,
        credentialId,
        connected: true,
        username: login,
        rememberPat,
        busy: false,
      })
      return true
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : '连接失败' })
      return false
    }
  },

  disconnect: async () => {
    clearAuthMetadata()
    localStorage.removeItem(AUTO_KEY)
    set({
      pat: null,
      credentialId: null,
      connected: false,
      username: null,
      rememberPat: false,
      autoBackup: false,
      busy: false,
      error: null,
    })
    try {
      await clearGitHubPATCredential()
    } catch {
      set({ error: '已断开，但运行时凭据清理失败，请重启应用后检查凭据状态' })
    }
  },

  setAutoBackup: on => {
    localStorage.setItem(AUTO_KEY, on ? '1' : '0')
    set({ autoBackup: on })
  },

  backupProject: async projectId => {
    const credentialId = await resolveCredential(get())
    if (!credentialId) { set({ error: '未连接 GitHub', connected: false }); return null }
    set({ busy: true, error: null, credentialId, connected: true })
    try {
      const data = await exportProjectJSON(projectId)
      const existing = readProj(projectId)
      const result = await exportToGistWithCredential(data, credentialId, existing?.gistId)
      writeProj(projectId, { gistId: result.gistId, lastBackupAt: Date.now() })
      set({ busy: false })
      return { url: result.url }
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : '备份失败' })
      return null
    }
  },

  restoreFromGist: async (gistId, revision) => {
    const credentialId = await resolveCredential(get())
    if (!credentialId) { set({ error: '未连接 GitHub', connected: false }); return null }
    set({ busy: true, error: null, credentialId, connected: true })
    try {
      const data = await importFromGistWithCredential(gistId, credentialId, revision)
      const newId = await importProjectJSON(data)
      set({ busy: false })
      return newId
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : '恢复失败' })
      return null
    }
  },

  listBackups: async () => {
    const credentialId = await resolveCredential(get())
    if (!credentialId) return []
    set({ credentialId, connected: true })
    return listStoryforgeGistsWithCredential(credentialId)
  },

  listRevisions: async projectId => {
    const credentialId = await resolveCredential(get())
    const project = readProj(projectId)
    if (!credentialId || !project?.gistId) return []
    set({ credentialId, connected: true })
    return listGistRevisionsWithCredential(project.gistId, credentialId)
  },

  projBackup: projectId => readProj(projectId),
}))
