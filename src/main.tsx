import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { DialogProvider } from './components/shared/Dialog'
import { ToastProvider } from './components/shared/Toast'
import { usePromptStore } from './stores/prompt'
import { useWorkflowStore } from './stores/workflow'
import { ensureSchema, REQUIRED_TABLES } from './lib/db/ensure-schema'
import { validateRegistry } from './lib/registry/validate'
import { db } from './lib/db/schema'
import { finalizeCharacterAxesMigrationSnapshots } from './lib/migrations/finalize-character-axes-snapshots'
import { applyStoryForgeTheme, resolveStoryForgeTheme } from './lib/theme'
import { getRuntime } from './runtime'
import { initializeRuntimeCapabilities } from './runtime/bootstrap'
import { RuntimeRouter } from './runtime/router'
import './index.css'

applyStoryForgeTheme(resolveStoryForgeTheme(localStorage.getItem('storyforge-theme')))
void initializeRuntimeCapabilities(getRuntime())

async function bootstrap() {
  // Phase 1.1b: validate the three registries before opening application data.
  try {
    validateRegistry({ throwOnError: import.meta.env.DEV })
  } catch (error) {
    console.error('[bootstrap] registry validation failed:', error)
  }

  // Schema health check never resets a production database automatically.
  try {
    await ensureSchema(REQUIRED_TABLES, { allowReset: import.meta.env.DEV })
    await db.open()
    await finalizeCharacterAxesMigrationSnapshots()
  } catch (error) {
    console.error('[bootstrap] schema check failed:', error)
  }

  try {
    await usePromptStore.getState().init()
  } catch (error) {
    console.error('[bootstrap] prompt store init failed:', error)
  }

  try {
    await useWorkflowStore.getState().init()
  } catch (error) {
    console.error('[bootstrap] workflow store init failed:', error)
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
