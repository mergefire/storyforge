import { useEffect, useRef } from 'react'
import { projectBackupBindingId, writeProjectJSONToFolder } from '../lib/storage/folder-backup'
import { getRuntime } from '../runtime'

/** 本地文件夹自动备份间隔（毫秒）— 5 分钟 */
export const FOLDER_AUTO_INTERVAL = 5 * 60 * 1000

/**
 * 本地文件夹自动备份 Hook（FB-11 数据持久层）。
 *
 * 进入某项目工作区时：若该项目此前绑过本地文件夹、且授权仍有效（不弹窗静默判断），
 * 则**进入即写一次** + 之后每 FOLDER_AUTO_INTERVAL 写一次完整 JSON。
 * 目录能力由 RuntimeAdapter 持久化；业务侧只保留 opaque bindingId。
 *
 * 未绑定 / 授权失效 → 静默跳过（不打扰；用户可在「数据管理」面板重新授权）。
 */
export function useFolderAutoBackup(projectId: number | null) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (!projectId) return

    const writeIfAvailable = async () => {
      try {
        const bindingId = projectBackupBindingId(projectId)
        const binding = await getRuntime().files.inspectBackupBinding(bindingId)
        if (cancelled || binding.permission !== 'granted') return

        await writeProjectJSONToFolder(bindingId, projectId)
      } catch (err) {
        console.error('[FolderAutoBackup] 写入或检查目录绑定失败:', err)
      }
    }

    // Keep the timer armed even when no binding exists yet. A directory bound or
    // reauthorized in the current workspace is picked up on the very next tick.
    void writeIfAvailable()
    timerRef.current = setInterval(() => { void writeIfAvailable() }, FOLDER_AUTO_INTERVAL)

    return () => {
      cancelled = true
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }, [projectId])
}
