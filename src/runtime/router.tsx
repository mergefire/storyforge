import type { PropsWithChildren } from 'react'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import type { RuntimeKind } from './contract'
import { readRuntimeTarget } from './target'

export interface RuntimeRouterProps extends PropsWithChildren {
  /** Test-only override; product bootstrap always uses the build target. */
  target?: RuntimeKind
}

/** Keeps target-specific route mechanics inside the runtime composition root. */
export function RuntimeRouter({ children, target = readRuntimeTarget() }: RuntimeRouterProps) {
  if (target === 'tauri') return <HashRouter>{children}</HashRouter>
  return <BrowserRouter basename="/storyforge">{children}</BrowserRouter>
}
