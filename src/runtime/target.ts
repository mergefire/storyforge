import type { RuntimeAdapter, RuntimeKind } from './contract'
import { RuntimeError } from './errors'

export type RuntimeFactories = {
  [K in RuntimeKind]?: () => RuntimeAdapter
}

export function readRuntimeTarget(value: string | undefined = import.meta.env.VITE_RUNTIME_TARGET): RuntimeKind {
  if (value === undefined || value === '' || value === 'web') return 'web'
  if (value === 'tauri') return 'tauri'
  throw new RuntimeError('INVALID_INPUT', 'VITE_RUNTIME_TARGET 必须是 web 或 tauri', {
    operation: 'runtime.selectTarget',
  })
}

export function selectRuntimeAdapter(target: RuntimeKind, factories: RuntimeFactories): RuntimeAdapter {
  const factory = factories[target]
  if (!factory) {
    throw new RuntimeError('UNAVAILABLE', `${target} RuntimeAdapter 尚未注册`, {
      operation: 'runtime.selectTarget',
    })
  }
  const adapter = factory()
  if (adapter.kind !== target) {
    throw new RuntimeError('INTEGRITY_ERROR', 'RuntimeAdapter kind 与构建目标不一致', {
      operation: 'runtime.selectTarget',
    })
  }
  return adapter
}
