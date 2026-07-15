import type { RuntimeAdapter } from '../../runtime'
import type { MigrationJournal, MigrationJournalPhase } from './archive-types'

export function migrationJournal(
  phase: MigrationJournalPhase,
  archive?: { exportId: string; archiveSha256: string },
  errorCode?: string,
): MigrationJournal {
  return {
    phase,
    ...(archive ? { exportId: archive.exportId, archiveSha256: archive.archiveSha256 } : {}),
    updatedAt: new Date().toISOString(),
    ...(errorCode ? { errorCode } : {}),
  }
}

export async function transitionMigrationJournal(
  runtime: RuntimeAdapter,
  next: MigrationJournal,
  expectedPhase: MigrationJournalPhase | null,
): Promise<void> {
  await runtime.migration.writeJournal(next, expectedPhase)
}

export function recordMigrationPhase(
  runtime: RuntimeAdapter,
  phase: 'preflight' | 'export' | 'import' | 'verify' | 'activate' | 'rollback',
  outcome: 'started' | 'completed' | 'failed',
  detail: { tableCount?: number; recordCount?: number } = {},
): void {
  runtime.diagnostics.record({
    kind: 'migration-phase',
    timestamp: Date.now(),
    phase,
    outcome,
    ...detail,
  })
}
