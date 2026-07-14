import { getRuntime } from '../../runtime'

export { shouldRegisterStoryForgeServiceWorker } from '../../runtime/web/service-worker-policy'

/** @deprecated Application bootstrap now calls RuntimeAdapter directly. */
export function registerStoryForgeServiceWorker(): Promise<void> {
  return getRuntime().updates.initialize()
}
