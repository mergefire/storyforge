import { useState, useEffect } from 'react'
import {
  Download, Upload, FileJson, FileText, FileType,
  Loader2, CheckCircle, AlertCircle, FolderOpen, X,
  History, Plus, Trash2, RotateCcw, HardDrive,
  ShieldAlert, Stethoscope,
} from 'lucide-react'
import { exportProjectJSON, downloadJSON, importProjectJSON, type ProjectExportData } from '../../lib/export/json-export'
import { exportProjectMarkdown, exportProjectTXT, downloadTextFile } from '../../lib/export/text-export'
import {
  projectBackupBindingId, writeProjectJSONToFolder,
} from '../../lib/storage/folder-backup'
import { useBackupStore } from '../../stores/backup'
import CloudBackupCard from './CloudBackupCard'
import { useToast } from '../shared/Toast'
import { useDialog } from '../shared/Dialog'
import type { Project, Snapshot } from '../../lib/types'
import { buildLocalDiagnosticReport } from '../../lib/diagnostics/local-diagnostic-report'
import { decodeRuntimeFileText, openRuntimeFile } from '../../lib/runtime-file'
import { getRuntime, type BackupBinding } from '../../runtime'

type Tab = 'export' | 'backup'
type ExportStatus = 'idle' | 'loading' | 'success' | 'error'

interface Props {
  project: Project
  onImported?: (newProjectId: number) => void
}

export default function DataManagementPanel({ project, onImported }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('export')

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'export',    label: '导出 / 导入', icon: FileJson },
    { id: 'backup',    label: '版本历史',    icon: History },
  ]

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-1">数据管理</h2>
        <p className="text-sm text-text-muted">备份、恢复、导出正文。（AI 解析导入请用左侧「文档导入」面板。）</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 bg-bg-elevated rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'export'    && <ExportTab    project={project} onImported={onImported} />}
      {activeTab === 'backup'    && <BackupTab    project={project} onImported={onImported} />}
    </div>
  )
}

// ── 导出/导入 Tab ────────────────────────────────────────────
function ExportTab({ project, onImported }: Props) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [message, setMessage] = useState('')

  // ── 本地文件夹（不透明绑定 + 重新授权 + 自动备份，FB-11）──
  const [folderBinding, setFolderBinding] = useState<BackupBinding | null>(null)
  const [folderBusy, setFolderBusy] = useState(false)
  const bindingId = projectBackupBindingId(project.id!)
  const folderBound = folderBinding != null && folderBinding.permission !== 'missing'
  const folderNeedsAuth = folderBound && folderBinding.permission !== 'granted'
  const folderName = folderBinding?.label ?? ''

  // Runtime owns the persisted directory capability; the renderer only sees an opaque binding.
  useEffect(() => {
    let cancelled = false
    setFolderBinding(null)
    void (async () => {
      try {
        const binding = await getRuntime().files.inspectBackupBinding(projectBackupBindingId(project.id!))
        if (!cancelled) setFolderBinding(binding)
      } catch (error) {
        console.error('[folder] 检查目录绑定失败:', error)
      }
    })()
    return () => { cancelled = true }
  }, [project.id])

  const show = (s: ExportStatus, msg: string) => {
    setStatus(s); setMessage(msg)
    if (s === 'success') setTimeout(() => setStatus('idle'), 4000)
  }

  const handleExportJSON = async () => {
    try {
      show('loading', '正在导出 JSON...')
      const data = await exportProjectJSON(project.id!)
      const output = await downloadJSON(data, `${project.name}_${new Date().toISOString().slice(0, 10)}.json`)
      if (output.status === 'cancelled') { show('idle', ''); return }
      show('success', 'JSON 导出成功！')
    } catch (e) { show('error', `导出失败：${(e as Error).message}`) }
  }

  const handleImportJSON = async () => {
    try {
      const opened = await openRuntimeFile('project-json')
      if (opened.status === 'cancelled') return
      show('loading', '正在导入项目...')
      const data: ProjectExportData = JSON.parse(decodeRuntimeFileText(opened.value))
      const newId = await importProjectJSON(data)
      show('success', '导入成功！')
      onImported?.(newId)
    } catch (err) { show('error', `导入失败：${(err as Error).message}`) }
  }

  const handleExportMarkdown = async () => {
    try {
      show('loading', '正在导出 Markdown...')
      const md = await exportProjectMarkdown(project.id!)
      const output = await downloadTextFile(md, `${project.name}_${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown')
      if (output.status === 'cancelled') { show('idle', ''); return }
      show('success', 'Markdown 导出成功！')
    } catch (e) { show('error', `导出失败：${(e as Error).message}`) }
  }

  const handleExportTXT = async () => {
    try {
      show('loading', '正在导出 TXT...')
      const txt = await exportProjectTXT(project.id!)
      const output = await downloadTextFile(txt, `${project.name}_${new Date().toISOString().slice(0, 10)}.txt`)
      if (output.status === 'cancelled') { show('idle', ''); return }
      show('success', 'TXT 导出成功！')
    } catch (e) { show('error', `导出失败：${(e as Error).message}`) }
  }

  const handleDownloadDiagnostics = async () => {
    try {
      show('loading', '正在整理本地诊断信息...')
      const report = await buildLocalDiagnosticReport()
      await downloadTextFile(
        JSON.stringify(report, null, 2),
        `storyforge-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
        'diagnostic-bundle',
      )
      show('success', '诊断信息已下载，不含作品内容与 API Key。')
    } catch (e) {
      show('error', `诊断信息生成失败：${(e as Error).message}`)
    }
  }

  // 绑定文件夹：选目录 → 请求授权 → 持久化句柄 → 立刻写一次
  const handleBindFolder = async () => {
    setFolderBusy(true)
    try {
      const outcome = await getRuntime().files.bindBackupDirectory(bindingId)
      if (outcome.status === 'cancelled') return
      let binding = outcome.value
      if (binding.permission !== 'granted') {
        binding = await getRuntime().files.requestBackupPermission(bindingId, true)
      }
      setFolderBinding(binding)
      if (binding.permission !== 'granted') {
        show('error', '未授予文件夹写入权限')
        return
      }
      const wrote = await writeProjectJSONToFolder(bindingId, project.id!)
      show(wrote ? 'success' : 'error', wrote ? `已绑定并保存到 / ${binding.label}` : '绑定成功但写入失败')
    } catch (e) { show('error', `绑定失败：${(e as Error).message}`) }
    finally { setFolderBusy(false) }
  }

  // Reauthorize an expired browser/native directory capability in a user gesture.
  const handleReauthFolder = async () => {
    if (!folderBound) return
    setFolderBusy(true)
    try {
      const binding = await getRuntime().files.requestBackupPermission(bindingId, true)
      setFolderBinding(binding)
      if (binding.permission !== 'granted') { show('error', '仍未获授权'); return }
      await writeProjectJSONToFolder(bindingId, project.id!)
      show('success', '已重新授权，本项目会自动写入该文件夹')
    } catch (e) { show('error', `授权失败：${(e as Error).message}`) }
    finally { setFolderBusy(false) }
  }

  const handleSaveToFolder = async () => {
    if (!folderBound) return
    setFolderBusy(true)
    try {
      show('loading', '正在写入本地文件夹...')
      let binding = folderBinding!
      if (binding.permission !== 'granted') {
        binding = await getRuntime().files.requestBackupPermission(bindingId, true)
        setFolderBinding(binding)
      }
      if (binding.permission !== 'granted') { show('error', '未获授权，无法写入'); return }
      const ok = await writeProjectJSONToFolder(bindingId, project.id!)
      show(ok ? 'success' : 'error', ok ? '已保存到本地文件夹' : '写入失败，请重新绑定文件夹')
    } catch (e) { show('error', `写入失败：${(e as Error).message}`) }
    finally { setFolderBusy(false) }
  }

  const handleUnbindFolder = async () => {
    try {
      await getRuntime().files.clearBackupBinding(bindingId)
      setFolderBinding(null)
    } catch (e) {
      show('error', `解绑失败：${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-4">
      {status !== 'idle' && (
        <StatusBar status={status} message={message} />
      )}

      {/* JSON */}
      <SectionCard
        icon={<FileJson className="w-5 h-5 text-accent" />}
        title="JSON（完整备份）"
        desc="导出包含所有数据的完整备份文件，可用于恢复项目。"
      >
        <div className="flex gap-3 flex-wrap">
          <ActionButton onClick={handleExportJSON} disabled={status === 'loading'} variant="accent">
            <Download className="w-4 h-4" /> 导出 JSON
          </ActionButton>
          <ActionButton onClick={() => void handleImportJSON()} disabled={status === 'loading'} variant="default">
            <Upload className="w-4 h-4" /> 导入 JSON
          </ActionButton>
        </div>
      </SectionCard>

      {/* 云备份（GitHub Gist）—— 清浏览器/换设备都不丢 */}
      <CloudBackupCard projectId={project.id!} onImported={onImported} />

      {/* Markdown */}
      <SectionCard
        icon={<FileText className="w-5 h-5 text-blue-400" />}
        title="Markdown（正文导出）"
        desc="按大纲结构导出所有章节正文。"
      >
        <ActionButton onClick={handleExportMarkdown} disabled={status === 'loading'} variant="blue">
          <Download className="w-4 h-4" /> 导出 Markdown
        </ActionButton>
      </SectionCard>

      {/* TXT */}
      <SectionCard
        icon={<FileType className="w-5 h-5 text-yellow-400" />}
        title="纯文本 TXT"
        desc="适合直接发布到小说平台。"
      >
        <ActionButton onClick={handleExportTXT} disabled={status === 'loading'} variant="yellow">
          <Download className="w-4 h-4" /> 导出 TXT
        </ActionButton>
      </SectionCard>

      {/* 本地文件夹 */}
      <SectionCard
        icon={<FolderOpen className="w-5 h-5 text-orange-400" />}
        title="本地文件夹自动备份"
        desc="绑定后，进入本项目会自动把完整数据写入该文件夹（打开时 + 每 5 分钟）。绑定跨刷新/更新保留；换设备或数据重置后，可在首页「从本地文件夹恢复」。"
      >
        {folderBound ? (
          <div className="space-y-2">
            {folderNeedsAuth ? (
              <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">已绑定「{folderName}」，但浏览器需重新授权才能自动写入</span>
                <button onClick={handleUnbindFolder} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">已绑定：{folderName}（自动写入已生效）</span>
                <button onClick={handleUnbindFolder} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {folderNeedsAuth && (
                <ActionButton onClick={handleReauthFolder} disabled={folderBusy} variant="orange">
                  {folderBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  重新授权
                </ActionButton>
              )}
              <ActionButton onClick={handleSaveToFolder} disabled={folderBusy || status === 'loading'} variant={folderNeedsAuth ? 'default' : 'orange'}>
                {folderBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {folderBusy ? '写入中...' : '立即保存'}
              </ActionButton>
            </div>
          </div>
        ) : (
          <ActionButton onClick={handleBindFolder} disabled={folderBusy || status === 'loading'} variant="orange">
            {folderBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} 选择本地文件夹
          </ActionButton>
        )}
      </SectionCard>

      <SectionCard
        icon={<Stethoscope className="w-5 h-5 text-teal-400" />}
        title="本地诊断信息"
        desc="仅包含应用/浏览器版本、数据库表记录数量和本次页面会话的错误位置；不包含作品正文、设定、API Key 或 localStorage 内容，也不会自动上传。"
      >
        <ActionButton onClick={handleDownloadDiagnostics} disabled={status === 'loading'} variant="default">
          <Download className="w-4 h-4" /> 下载诊断信息
        </ActionButton>
      </SectionCard>
    </div>
  )
}

// ── 版本历史 Tab ─────────────────────────────────────────────
function BackupTab({ project }: Props) {
  const { snapshots, loading, loadSnapshots, createSnapshot, deleteSnapshot, restoreSnapshot } = useBackupStore()
  const toast = useToast()
  const dialog = useDialog()
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [showForm, setShowForm] = useState(false)

  useState(() => { loadSnapshots(project.id!) })

  const handleCreate = async () => {
    setCreating(true)
    try {
      await createSnapshot(project.id!, label.trim() || `手动备份 ${new Date().toLocaleString('zh-CN')}`, 'manual')
      toast.success('快照创建成功')
      setLabel(''); setShowForm(false)
    } catch (err) {
      toast.error('快照创建失败: ' + (err as Error).message)
    } finally { setCreating(false) }
  }

  const handleRestore = async (snap: Snapshot) => {
    const ok = await dialog.confirm({
      title: `恢复快照「${snap.label}」？`,
      message: '将创建一个新项目，不会覆盖当前项目。',
      confirmText: '恢复为新项目',
    })
    if (!ok) return
    setRestoring(snap.id!)
    try {
      await restoreSnapshot(snap.id!)
      toast.success('恢复成功，已创建新项目')
    } catch (err) { toast.error('恢复失败: ' + (err as Error).message) }
    finally { setRestoring(null) }
  }

  return (
    <div className="space-y-4">
      {/* 新建快照 */}
      <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">创建快照</span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            {showForm ? '收起' : '+ 新建'}
          </button>
        </div>
        {showForm && (
          <div className="flex gap-2">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="快照备注（可选）"
              className="flex-1 px-3 py-1.5 bg-bg-base border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              创建
            </button>
          </div>
        )}
      </div>

      {/* 快照列表 */}
      <div className="space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
          </div>
        )}
        {!loading && snapshots.length === 0 && (
          <div className="text-center text-text-muted text-sm py-10">
            <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
            暂无快照，创建第一个吧
          </div>
        )}
        {snapshots.map(snap => (
          <div key={snap.id} className="bg-bg-surface border border-border rounded-lg p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{snap.label}</p>
              <p className="text-xs text-text-muted">{new Date(snap.createdAt).toLocaleString('zh-CN')}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleRestore(snap)}
                disabled={restoring === snap.id}
                title="从此快照恢复"
                className="p-1.5 text-text-muted hover:text-accent rounded hover:bg-accent/10 transition-colors disabled:opacity-50"
              >
                {restoring === snap.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              </button>
              <button
                onClick={() => deleteSnapshot(snap.id!)}
                title="删除快照"
                className="p-1.5 text-text-muted hover:text-error rounded hover:bg-error/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 共用小组件 ───────────────────────────────────────────────
function StatusBar({ status, message }: { status: ExportStatus; message: string }) {
  const cls = status === 'loading' ? 'bg-accent/10 text-accent'
    : status === 'success' ? 'bg-green-500/10 text-green-400'
    : 'bg-red-500/10 text-red-400'
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${cls}`}>
      {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {status === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
      {status === 'error'   && <AlertCircle className="w-4 h-4 shrink-0" />}
      <span>{message}</span>
    </div>
  )
}

function SectionCard({
  icon, title, desc, badge, children,
}: {
  icon: React.ReactNode; title: string; desc: string; badge?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        {icon} {title}
        {badge && <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded ml-auto">{badge}</span>}
      </h3>
      <p className="text-xs text-text-muted">{desc}</p>
      {children}
    </div>
  )
}

type ButtonVariant = 'accent' | 'default' | 'blue' | 'yellow' | 'orange'
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  accent:  'bg-accent text-white hover:bg-accent-hover',
  default: 'bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  blue:    'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
  yellow:  'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
  orange:  'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30',
}

function ActionButton({
  onClick, disabled, variant, children,
}: {
  onClick: () => void; disabled?: boolean; variant: ButtonVariant; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  )
}
