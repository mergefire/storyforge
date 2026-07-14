/**
 * Local directory backup orchestration.
 *
 * Business code owns only opaque binding IDs. Directory handles and browser
 * File System Access APIs are confined to runtime/web.
 */
import { exportProjectJSON, type ProjectExportData } from '../export/json-export'
import { db } from '../db/schema'
import { getRuntime } from '../../runtime'

export const HOME_RESTORE_BINDING_ID = 'home-project-restore'

export function projectBackupBindingId(projectId: number): string {
  return `project-backup-${projectId}`
}

function safeName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-')
}

/** Project backup filename, recognized by every RuntimeAdapter implementation. */
export function backupFilename(projectName: string): string {
  return `storyforge-${safeName(projectName)}.json`
}

/** Export through PROJECT_TABLES, then ask the runtime to atomically persist it. */
export async function writeProjectJSONToFolder(
  bindingId: string,
  projectId: number,
): Promise<boolean> {
  const project = await db.projects.get(projectId)
  if (!project) return false
  const data = await exportProjectJSON(projectId)
  await getRuntime().files.writeBackup({
    bindingId,
    purpose: 'project-backup',
    suggestedName: backupFilename(project.name),
    content: { kind: 'text', text: JSON.stringify(data, null, 2) },
  })
  return true
}

export interface FolderBackupFile {
  name: string
  data: ProjectExportData
}

/** Parse all valid StoryForge backups; one corrupt file never blocks the rest. */
export async function readStoryforgeBackups(bindingId: string): Promise<FolderBackupFile[]> {
  const files = await getRuntime().files.readBackups({
    bindingId,
    purpose: 'project-backup',
  })
  const out: FolderBackupFile[] = []
  for await (const file of files) {
    try {
      const text = new TextDecoder().decode(file.bytes)
      out.push({ name: file.name, data: JSON.parse(text) as ProjectExportData })
    } catch (error) {
      console.warn('[folder] 跳过无法解析的备份文件:', file.name, error)
    }
  }
  return out
}
