import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import WorkspacePage from './pages/WorkspacePage'
import SettingsRoutePage from './pages/SettingsRoutePage'
import MigrationExportPage from './pages/MigrationExportPage'
import FirstRunMigration from './components/migration/FirstRunMigration'
import type { MigrationReceipt } from './lib/migration/archive-types'
import type { MigrationStartupState } from './lib/migration/profile-import'

interface AppProps {
  initialMigrationState: MigrationStartupState
  initializeSeeds: () => Promise<void>
}

export default function App({ initialMigrationState, initializeSeeds }: AppProps) {
  const [migrationState, setMigrationState] = useState(initialMigrationState)

  if (migrationState.status === 'awaiting-choice') {
    return (
      <FirstRunMigration
        onReady={async (receipt?: MigrationReceipt) => {
          await initializeSeeds()
          setMigrationState({ status: 'ready', ...(receipt ? { receipt } : {}) })
        }}
      />
    )
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/settings" element={<SettingsRoutePage />} />
      <Route path="/migration-export" element={<MigrationExportPage />} />
      <Route path="/workspace/:projectId" element={<WorkspacePage />} />
    </Routes>
  )
}
