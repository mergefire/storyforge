import { usePromptStore } from '../../stores/prompt'
import { useWorkflowStore } from '../../stores/workflow'
import { finalizeCharacterAxesMigrationSnapshots } from '../migrations/finalize-character-axes-snapshots'
import { ensureSchema, REQUIRED_TABLES, type EnsureSchemaOptions } from './ensure-schema'
import { db } from './schema'

type SchemaResult = Awaited<ReturnType<typeof ensureSchema>>

export interface ApplicationDataBootstrapDependencies {
  ensureSchema: (
    expectedTables: readonly string[],
    options: EnsureSchemaOptions,
  ) => Promise<SchemaResult>
  openDatabase: () => Promise<unknown>
  finalizeMigrations: () => Promise<unknown>
  initializePromptStore: () => Promise<void>
  initializeWorkflowStore: () => Promise<void>
}

const defaultDependencies: ApplicationDataBootstrapDependencies = {
  ensureSchema,
  openDatabase: () => db.open(),
  finalizeMigrations: finalizeCharacterAxesMigrationSnapshots,
  initializePromptStore: () => usePromptStore.getState().init(),
  initializeWorkflowStore: () => useWorkflowStore.getState().init(),
}

/**
 * Opens application data in the only safe startup order.
 *
 * Prompt/workflow initialization writes system seeds. It must therefore remain
 * behind the schema health check, Dexie open, and migration finalization. A
 * blocked or failed database never reaches either seed writer.
 */
export async function initializeApplicationData(
  allowReset: boolean,
  dependencies: ApplicationDataBootstrapDependencies = defaultDependencies,
): Promise<SchemaResult> {
  const schema = await dependencies.ensureSchema(REQUIRED_TABLES, { allowReset })
  if (schema.blocked) {
    throw new Error(`[bootstrap] schema initialization blocked; missing stores: ${schema.missing.join(', ')}`)
  }

  await dependencies.openDatabase()
  await dependencies.finalizeMigrations()
  await dependencies.initializePromptStore()
  await dependencies.initializeWorkflowStore()

  return schema
}
