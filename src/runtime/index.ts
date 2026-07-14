import type { RuntimeAdapter } from './contract'
import { readRuntimeTarget, selectRuntimeAdapter } from './target'
import { createWebRuntime } from './web'

let activeRuntime = selectRuntimeAdapter(readRuntimeTarget(), {
  web: createWebRuntime,
  // D1 registers the formal Tauri implementation. D0 must fail closed for a
  // tauri build instead of silently falling back to browser capabilities.
})

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
