import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { DialogProvider } from './components/shared/Dialog'
import { ToastProvider } from './components/shared/Toast'
import { initializeApplicationSeeds, prepareApplicationData } from './lib/db/bootstrap'
import { prepareMigrationStartup } from './lib/migration/profile-import'
import { validateRegistry } from './lib/registry/validate'
import { applyStoryForgeTheme, resolveStoryForgeTheme } from './lib/theme'
import { registerStoryForgeServiceWorker } from './lib/pwa/register-service-worker'
import { installRuntimeDiagnostics } from './lib/diagnostics/local-diagnostic-report'
import { getRuntime } from './runtime'
import { initializeRuntimeCapabilities } from './runtime/bootstrap'
import { desktopPlaintextCredentialCanaries, migrateLegacyRuntimeCredentials } from './runtime/credential-migration'
import { RuntimeRouter } from './runtime/router'
import { useGistStore } from './stores/gist'
import { useAIConfigStore } from './stores/ai-config'
import './index.css'

// 从 localStorage 恢复主题（兼容旧主题名迁移）
applyStoryForgeTheme(resolveStoryForgeTheme(localStorage.getItem('storyforge-theme')))
registerStoryForgeServiceWorker()
installRuntimeDiagnostics()

if (import.meta.env.VITE_DESKTOP_CHANNEL === 'dev') {
  void import('./runtime/tauri/dev-smoke').then(({ installDesktopDevSmoke }) => {
    installDesktopDevSmoke()
  })
}

/**
 * FB-11 数据持久 · 启动期申请「持久化存储」。
 * 不申请时浏览器把 IndexedDB 当 best-effort,可在磁盘压力/关闭清理/隐私插件下
 * 直接驱逐整库 → 用户表现为"数据被重置"。persist() 在 Chrome 是静默授予(按使用度
 * 启发式,不弹窗),被拒或不支持都不影响主流程,故 fire-and-forget。
 */
async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted()
      if (!already) {
        const granted = await navigator.storage.persist()
        console.info(`[bootstrap] persistent storage ${granted ? '已授予' : '未授予(浏览器启发式未满足,可稍后再试)'}`)
      }
    }
  } catch (e) {
    console.warn('[bootstrap] persist storage 申请失败(不影响运行):', e)
  }
}

async function bootstrap() {
  void requestPersistentStorage()

  try {
    await migrateLegacyRuntimeCredentials(getRuntime())
    await useAIConfigStore.getState().refreshCredentialAvailability()
    await useGistStore.getState().initializeCredential()
    const canaries = getRuntime().secrets.policy.migrateLegacyPlaintext
      ? desktopPlaintextCredentialCanaries()
      : []
    if (canaries.length > 0) console.error('[bootstrap] desktop plaintext credential canaries:', canaries)
  } catch (error) {
    console.error('[bootstrap] runtime credential migration failed:', error)
  }
  void initializeRuntimeCapabilities(getRuntime())

  // Phase 1.1b: validate the three registries before opening application data.
  try {
    validateRegistry({ throwOnError: import.meta.env.DEV })
  } catch (error) {
    console.error('[bootstrap] registry validation failed:', error)
  }

  // Open and finalize the database without seeds. Desktop first-run migration
  // needs an actually empty target until the user imports or chooses a new profile.
  let migrationState
  try {
    await prepareApplicationData(import.meta.env.DEV)
    migrationState = await prepareMigrationStartup({ runtime: getRuntime() })
    if (migrationState.status === 'ready') await initializeApplicationSeeds()
  } catch (error) {
    console.error('[bootstrap] application data initialization failed:', error)
    const message = error instanceof Error ? error.message : String(error)
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <div className="min-h-screen bg-bg-base px-6 py-16 text-text-primary">
        <div className="mx-auto max-w-xl rounded-xl border border-border bg-bg-elevated p-6">
          <h1 className="text-lg font-semibold">无法打开 StoryForge 数据</h1>
          <p className="mt-2 text-sm text-text-secondary">启动检查没有完成，应用没有继续写入数据。</p>
          <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-surface p-3 text-xs text-error">{message}</pre>
        </div>
      </div>,
    )
    return
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <RuntimeRouter>
          <ToastProvider>
            <DialogProvider>
              <App
                initialMigrationState={migrationState}
                initializeSeeds={initializeApplicationSeeds}
              />
            </DialogProvider>
          </ToastProvider>
        </RuntimeRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

void bootstrap()
