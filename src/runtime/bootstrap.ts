import type { RuntimeAdapter } from './contract'

export interface RuntimeBootstrapLogger {
  info(message: string): void
  warn(message: string, error?: unknown): void
}

/**
 * Starts runtime-owned distribution and durability capabilities without making
 * application bootstrap depend on browser globals. Failures stay non-fatal,
 * matching the existing PWA/persistence startup behavior.
 */
export async function initializeRuntimeCapabilities(
  runtime: RuntimeAdapter,
  logger: RuntimeBootstrapLogger = console,
): Promise<void> {
  let updateInitialization: Promise<void>
  try {
    updateInitialization = runtime.updates.initialize().catch(error => {
      logger.warn('[bootstrap] runtime update initialization failed:', error)
    })
  } catch (error) {
    logger.warn('[bootstrap] runtime update initialization failed:', error)
    updateInitialization = Promise.resolve()
  }

  try {
    const current = await runtime.durability.inspect()
    if (!current.persisted) {
      const requested = await runtime.durability.requestPersistence()
      logger.info(`[bootstrap] persistent storage ${requested.persisted ? 'granted' : 'not granted'}`)
    }
  } catch (error) {
    logger.warn('[bootstrap] persistent storage request failed (non-fatal):', error)
  }

  await updateInitialization
}
