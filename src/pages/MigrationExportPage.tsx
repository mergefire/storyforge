import { useState } from 'react'
import { Archive, ArrowLeft, CheckCircle2, Download, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { ProfileExportResult } from '../lib/migration/profile-export'
import { exportFullMigrationArchiveToFile } from '../lib/migration/profile-export'
import { getRuntime } from '../runtime'

export default function MigrationExportPage() {
  const runtime = getRuntime()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<(ProfileExportResult & { displayName: string | null }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportProfile = async () => {
    setBusy(true)
    setError(null)
    try {
      setResult(await exportFullMigrationArchiveToFile())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg-base px-5 py-10 text-text-primary">
      <div className="mx-auto max-w-3xl">
        <Link to="/settings" className="mb-6 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回设置
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Archive className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">桌面客户端迁移</p>
            <h1 className="text-xl font-semibold">导出完整迁移文件</h1>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-bg-elevated p-6 shadow-sm">
          {!runtime.migration.policy.canExportProfile ? (
            <div>
              <h2 className="text-base font-semibold">此版本不提供旧端导出</h2>
              <p className="mt-2 text-sm text-text-secondary">完整资料导出只在原网页版本中提供；桌面端负责导入和校验。</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-semibold">只读打包，不修改原资料</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                    导出会核对前后数据是否一致，并打包项目、正文、历史记录、附件和非敏感偏好。API 密钥与设备目录授权不会写入文件。
                  </p>
                </div>
              </div>

              {result?.displayName ? (
                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                    <div>
                      <h3 className="text-sm font-medium">迁移文件已保存</h3>
                      <p className="mt-1 break-all text-sm text-text-secondary">{result.displayName}</p>
                    </div>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
                    <div><dt className="text-xs text-text-muted">项目</dt><dd className="mt-1 text-sm font-medium tabular-nums">{result.manifest.sourceAudit.projectCount}</dd></div>
                    <div><dt className="text-xs text-text-muted">章节</dt><dd className="mt-1 text-sm font-medium tabular-nums">{result.manifest.sourceAudit.chapterCount}</dd></div>
                    <div><dt className="text-xs text-text-muted">记录</dt><dd className="mt-1 text-sm font-medium tabular-nums">{result.manifest.tables.reduce((sum, table) => sum + table.count, 0).toLocaleString()}</dd></div>
                    <div><dt className="text-xs text-text-muted">附件</dt><dd className="mt-1 text-sm font-medium tabular-nums">{result.manifest.blobs.length}</dd></div>
                  </dl>
                </div>
              ) : result ? (
                <p className="mt-5 text-sm text-text-secondary">保存已取消，原资料没有变化。</p>
              ) : null}

              {error && <p role="alert" className="mt-5 rounded-lg bg-bg-surface px-3 py-2 text-sm text-error">{error}</p>}
              <button
                type="button"
                onClick={() => void exportProfile()}
                disabled={busy}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {busy ? '正在校验并打包…' : result ? '重新导出' : '导出迁移文件'}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
