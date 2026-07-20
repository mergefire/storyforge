import { lazy, Suspense, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import type { MigrationReceipt } from './lib/migration/archive-types'
import type { MigrationStartupState } from './lib/migration/profile-import'

const FirstRunMigration = lazy(() => import('./components/migration/FirstRunMigration'))
const HomePage = lazy(() => import('./pages/HomePage'))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))
const SettingsRoutePage = lazy(() => import('./pages/SettingsRoutePage'))
const MigrationExportPage = lazy(() => import('./pages/MigrationExportPage'))

interface AppProps {
  initialMigrationState: MigrationStartupState
  initializeSeeds: () => Promise<void>
}

export default function App({ initialMigrationState, initializeSeeds }: AppProps) {
  const [migrationState, setMigrationState] = useState(initialMigrationState)

  if (migrationState.status === 'awaiting-choice') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-bg-base" aria-label="正在加载迁移向导" />}>
        <FirstRunMigration
          onReady={async (receipt?: MigrationReceipt) => {
            await initializeSeeds()
            setMigrationState({ status: 'ready', ...(receipt ? { receipt } : {}) })
          }}
        />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-base" aria-label="正在加载页面" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsRoutePage />} />
        <Route path="/migration-export" element={<MigrationExportPage />} />
        <Route path="/workspace/:projectId" element={<WorkspacePage />} />
      </Routes>
    </Suspense>
  )
}
