import { getRuntime } from '../../runtime'
import type {
  CredentialId,
  GistBackupMeta as RuntimeGistBackupMeta,
  GistRevisionMeta as RuntimeGistRevisionMeta,
} from '../../runtime/contract'
import type { ProjectExportData } from './json-export'

export interface GistConfig {
  pat: string
  gistId?: string
}

export interface GistResult {
  gistId: string
  url: string
}

export type GistBackupMeta = RuntimeGistBackupMeta
export type GistRevisionMeta = RuntimeGistRevisionMeta

const GIST_CREDENTIAL_KEY = 'storyforge.github.gist' as const

function sessionCredential(pat: string): Promise<CredentialId> {
  return getRuntime().secrets.put(
    { key: GIST_CREDENTIAL_KEY, persistence: 'session' },
    pat,
  )
}

export function clearGitHubPATCredential(): Promise<void> {
  return getRuntime().secrets.delete(GIST_CREDENTIAL_KEY)
}

/**
 * Business export/parse stays in TypeScript. RuntimeAdapter owns only the
 * fixed GitHub Gist transport, so the renderer never receives a generic HTTP
 * command when the desktop implementation arrives.
 */
export async function exportToGist(
  data: ProjectExportData,
  config: GistConfig,
): Promise<GistResult> {
  const safeProjectName = data.project.name.replace(/[/\\?%*:|"<>\s]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  const filename = `storyforge-${safeProjectName}.json`
  const credentialId = await sessionCredential(config.pat)
  return getRuntime().gist.writeBackup({
    credentialId,
    ...(config.gistId ? { gistId: config.gistId } : {}),
    filename,
    description: `故事熔炉备份 — ${data.project.name} (${new Date().toLocaleString('zh-CN')})`,
    content: JSON.stringify(data, null, 2),
  })
}

export async function listStoryforgeGists(pat: string): Promise<GistBackupMeta[]> {
  return getRuntime().gist.listBackups(await sessionCredential(pat))
}

/** The returned JSON is still validated/imported by the shared TS layer. */
export async function importFromGist(
  gistId: string,
  pat: string,
  revision?: string,
): Promise<ProjectExportData> {
  const credentialId = await sessionCredential(pat)
  const backup = await getRuntime().gist.readBackup(
    credentialId,
    gistId,
    revision,
  )
  return JSON.parse(backup.content) as ProjectExportData
}

export async function listGistRevisions(gistId: string, pat: string): Promise<GistRevisionMeta[]> {
  return getRuntime().gist.listRevisions(await sessionCredential(pat), gistId)
}

export async function validateGitHubPAT(pat: string): Promise<string> {
  const credentialId = await sessionCredential(pat)
  try {
    const result = await getRuntime().gist.validateCredential(credentialId)
    return result.login
  } catch (error) {
    await clearGitHubPATCredential()
    throw error
  }
}
