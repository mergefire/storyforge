import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { DialogProvider } from './components/shared/Dialog'
import { ToastProvider } from './components/shared/Toast'
import { initializeApplicationData } from './lib/db/bootstrap'
import { validateRegistry } from './lib/registry/validate'
import { applyStoryForgeTheme, resolveStoryForgeTheme } from './lib/theme'
import { getRuntime } from './runtime'
import { initializeRuntimeCapabilities } from './runtime/bootstrap'
import { desktopPlaintextCredentialCanaries, migrateLegacyRuntimeCredentials } from './runtime/credential-migration'
import { RuntimeRouter } from './runtime/router'
import { useGistStore } from './stores/gist'
import './index.css'

if (import.meta.env.VITE_DESKTOP_CHANNEL === 'dev') {
  void import('./runtime/tauri/dev-smoke').then(({ installDesktopDevSmoke }) => {
    installDesktopDevSmoke()
  })
}

applyStoryForgeTheme(resolveStoryForgeTheme(localStorage.getItem('storyforge-theme')))

async function bootstrap() {
  try {
    await migrateLegacyRuntimeCredentials(getRuntime())
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

  // Schema health, Dexie open, migration finalization, and seed writers are one
  // ordered gate. A blocked/failed database must never receive prompt/workflow seeds.
  try {
    await initializeApplicationData(import.meta.env.DEV)
  } catch (error) {
    console.error('[bootstrap] application data initialization failed:', error)
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <RuntimeRouter>
          <ToastProvider>
            <DialogProvider>
              <App />
            </DialogProvider>
          </ToastProvider>
        </RuntimeRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

void bootstrap()
