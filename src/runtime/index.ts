import type { RuntimeAdapter } from './contract'
import { readRuntimeTarget, selectRuntimeAdapter } from './target'
import { createTauriRuntime } from './tauri'
import { createWebRuntime } from './web'

const configuredTarget = import.meta.env.VITE_RUNTIME_TARGET
let activeRuntime = configuredTarget === 'tauri'
  ? selectRuntimeAdapter('tauri', { tauri: createTauriRuntime })
  : selectRuntimeAdapter(readRuntimeTarget(configuredTarget), { web: createWebRuntime })

export function getRuntime(): RuntimeAdapter {
  return activeRuntime
}

/** Composition-root/test hook. Product components should only call getRuntime(). */
export function setRuntimeAdapter(adapter: RuntimeAdapter): void {
  activeRuntime = adapter
}

export type * from './contract'
export { RuntimeError, normalizeRuntimeError } from './errors'
export { readRuntimeTarget, selectRuntimeAdapter } from './target'
