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
const GIST_FILENAME_PREFIX = 'storyforge-'
const GIST_FILENAME_SUFFIX = '.json'
const GIST_FILENAME_MAX_LENGTH = 180

export function gistBackupFilename(projectName: string): string {
  const sanitized = projectName
    .replace(/[/\\?%*:|"<>\s]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project'
  const maxStemLength = GIST_FILENAME_MAX_LENGTH
    - GIST_FILENAME_PREFIX.length
    - GIST_FILENAME_SUFFIX.length
  let stem = sanitized.slice(0, maxStemLength)
  // Avoid ending on half of a UTF-16 surrogate pair when a long emoji name is truncated.
  if (/[\uD800-\uDBFF]$/.test(stem)) stem = stem.slice(0, -1)
  return `${GIST_FILENAME_PREFIX}${stem}${GIST_FILENAME_SUFFIX}`
}

export function storeGitHubPATCredential(
  pat: string,
  persistence: 'session' | 'device' = 'session',
): Promise<CredentialId> {
  return getRuntime().secrets.put(
    { key: GIST_CREDENTIAL_KEY, persistence, scope: { kind: 'github-gist' } },
    pat,
  )
}

export function storedGitHubPATCredential(): Promise<CredentialId | null> {
  return getRuntime().secrets.reference(GIST_CREDENTIAL_KEY)
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
  const credentialId = await storeGitHubPATCredential(config.pat)
  return exportToGistWithCredential(data, credentialId, config.gistId)
}

export async function exportToGistWithCredential(
  data: ProjectExportData,
  credentialId: CredentialId,
  gistId?: string,
): Promise<GistResult> {
  const filename = gistBackupFilename(data.project.name)
  return getRuntime().gist.writeBackup({
    credentialId,
    ...(gistId ? { gistId } : {}),
    filename,
    description: `故事熔炉备份 — ${data.project.name} (${new Date().toLocaleString('zh-CN')})`,
    content: JSON.stringify(data, null, 2),
  })
}

export async function listStoryforgeGists(pat: string): Promise<GistBackupMeta[]> {
  return getRuntime().gist.listBackups(await storeGitHubPATCredential(pat))
}

export function listStoryforgeGistsWithCredential(credentialId: CredentialId): Promise<GistBackupMeta[]> {
  return getRuntime().gist.listBackups(credentialId)
}

/** The returned JSON is still validated/imported by the shared TS layer. */
export async function importFromGist(
  gistId: string,
  pat: string,
  revision?: string,
): Promise<ProjectExportData> {
  const credentialId = await storeGitHubPATCredential(pat)
  return importFromGistWithCredential(gistId, credentialId, revision)
}

export async function importFromGistWithCredential(
  gistId: string,
  credentialId: CredentialId,
  revision?: string,
): Promise<ProjectExportData> {
  const backup = await getRuntime().gist.readBackup(
    credentialId,
    gistId,
    revision,
  )
  return JSON.parse(backup.content) as ProjectExportData
}

export async function listGistRevisions(gistId: string, pat: string): Promise<GistRevisionMeta[]> {
  return getRuntime().gist.listRevisions(await storeGitHubPATCredential(pat), gistId)
}

export function listGistRevisionsWithCredential(
  gistId: string,
  credentialId: CredentialId,
): Promise<GistRevisionMeta[]> {
  return getRuntime().gist.listRevisions(credentialId, gistId)
}

export async function validateGitHubPAT(pat: string): Promise<string> {
  const credentialId = await storeGitHubPATCredential(pat)
  try {
    const result = await getRuntime().gist.validateCredential(credentialId)
    return result.login
  } catch (error) {
    await clearGitHubPATCredential()
    throw error
  }
}

export async function connectGitHubPAT(
  pat: string,
  persistence: 'session' | 'device',
): Promise<{ login: string; credentialId: CredentialId }> {
  const credentialId = await storeGitHubPATCredential(pat, persistence)
  try {
    const result = await getRuntime().gist.validateCredential(credentialId)
    return { login: result.login, credentialId }
  } catch (error) {
    await clearGitHubPATCredential()
    throw error
  }
}
