import { useState } from 'react'
import { Archive, CheckCircle2, FileUp, ShieldCheck } from 'lucide-react'

import type { MigrationPreflight, MigrationReceipt } from '../../lib/migration/archive-types'
import {
  chooseEmptyDesktopProfile,
  importFullMigrationArchive,
  preflightMigrationArchive,
} from '../../lib/migration/profile-import'
import { getRuntime } from '../../runtime'

interface FirstRunMigrationProps {
  onReady: (receipt?: MigrationReceipt) => Promise<void>
}

type Step = 'idle' | 'checking' | 'ready' | 'importing' | 'success' | 'fresh-confirm' | 'entering'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums text-text-primary">{value}</dd>
    </div>
  )
}

export default function FirstRunMigration({ onReady }: FirstRunMigrationProps) {
  const runtime = getRuntime()
  const [step, setStep] = useState<Step>('idle')
  const [preflight, setPreflight] = useState<MigrationPreflight | null>(null)
  const [receipt, setReceipt] = useState<MigrationReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectArchive = async () => {
    setError(null)
    setStep('checking')
    try {
      const opened = await runtime.files.open({ purpose: 'full-migration-archive' })
      if (opened.status !== 'completed') {
        setStep('idle')
        return
      }
      const checked = await preflightMigrationArchive(opened.value.bytes, runtime)
      setPreflight(checked)
      setStep('ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStep('idle')
    }
  }

  const importArchive = async () => {
    if (!preflight) return
    setError(null)
    setStep('importing')
    try {
      const verified = await importFullMigrationArchive(preflight, { runtime })
      setReceipt(verified)
      setStep('success')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setPreflight(null)
      setStep('idle')
    }
  }

  const startFresh = async () => {
    setError(null)
    setStep('entering')
    try {
      await chooseEmptyDesktopProfile(runtime)
      await onReady()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStep('idle')
    }
  }

  const enterMigratedProfile = async () => {
    if (!receipt) return
    setStep('entering')
    try {
      await onReady(receipt)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStep('success')
    }
  }

  return (
    <main className="min-h-screen bg-bg-base px-5 py-12 text-text-primary">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Archive className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">StoryForge Desktop</p>
            <h1 className="text-xl font-semibold">导入旧版创作资料</h1>
          </div>
        </div>

        {receipt ? (
          <section className="rounded-xl border border-border bg-bg-elevated p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">迁移已校验并激活</h2>
                <p className="mt-1 text-sm text-text-secondary">表记录、正文、引用和文件哈希均已核对。旧版资料没有被删除或改写。</p>
              </div>
            </div>

            {(receipt.reauthorization.length > 0 || receipt.rebuildQueue.length > 0) && (
              <div className="mt-5 border-t border-border pt-5">
                {receipt.reauthorization.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium">进入后需要重新授权</h3>
                    <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                      {receipt.reauthorization.map(item => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}
                {receipt.rebuildQueue.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium">将自动重建</h3>
                    <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                      {receipt.rebuildQueue.map(item => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
            <button
              type="button"
              onClick={() => void enterMigratedProfile()}
              disabled={step === 'entering'}
              className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
            >
              {step === 'entering' ? '正在进入…' : '进入 StoryForge'}
            </button>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-bg-elevated p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">先检查，再导入</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                  请选择旧版网页导出的 .storyforge-migrate 文件。检查不会写入数据；只有你确认后才会导入到这个空白桌面资料库。
                </p>
              </div>
            </div>

            {preflight && step === 'ready' ? (
              <div className="mt-6">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 sm:grid-cols-3">
                  <Stat label="项目" value={preflight.projectCount} />
                  <Stat label="章节" value={preflight.chapterCount} />
                  <Stat label="正文字符" value={preflight.totalWords.toLocaleString()} />
                  <Stat label="数据表" value={preflight.tableCount} />
                  <Stat label="记录" value={preflight.recordCount.toLocaleString()} />
                  <Stat label="预计空间" value={formatBytes(preflight.requiredBytes)} />
                </dl>
                {preflight.reauthorization.length > 0 && (
                  <p className="mt-4 text-sm text-warning">密钥和设备授权不会随文件迁移，完成后需要重新授权 {preflight.reauthorization.length} 项。</p>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void importArchive()}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    确认导入
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreflight(null); setStep('idle') }}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-hover hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    换一个文件
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void selectArchive()}
                  disabled={step === 'checking' || step === 'importing' || step === 'entering'}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
                >
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  {step === 'checking' ? '正在检查…' : step === 'importing' ? '正在导入并校验…' : '选择迁移文件'}
                </button>
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-lg bg-bg-surface px-3 py-2 text-sm text-error">{error}</p>}
          </section>
        )}

        {!receipt && (
          <section className="mt-5 px-1">
            {step === 'fresh-confirm' ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <p className="text-text-secondary">确认创建一个空白资料库？以后仍可手动导入，但不会自动合并。</p>
                <button type="button" onClick={() => void startFresh()} className="font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:underline">确认新建</button>
                <button type="button" onClick={() => setStep('idle')} className="text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:underline">取消</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStep('fresh-confirm')}
                disabled={step !== 'idle'}
                className="text-sm text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:underline disabled:opacity-40"
              >
                不迁移，创建空白资料库
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
