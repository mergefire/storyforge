import type { Table } from 'dexie'
import { db } from '../db/schema'
import { PROJECT_TABLES } from '../registry/project-tables'
import { APP_VERSION } from '../version'
import { getRuntime, type RuntimeAdapter } from '../../runtime'

const MAX_RUNTIME_ERRORS = 20
const MAX_STACK_FRAMES = 8

export interface RuntimeDiagnosticError {
  occurredAt: string
  source: 'react' | 'window.error' | 'unhandledrejection'
  name: string
  frames: string[]
}

export interface LocalDiagnosticReport {
  format: 'storyforge-local-diagnostics'
  formatVersion: 1
  generatedAt: string
  application: {
    version: string
    routePattern: string
  }
  environment: {
    userAgent: string
    language: string
    platform: string
    online: boolean
    viewport: { width: number; height: number }
  }
  storage: {
    persisted: boolean | null
    usageBytes: number | null
    quotaBytes: number | null
  }
  database: {
    schemaVersion: number
    tableCounts: Record<string, number | null>
  }
  recentErrors: RuntimeDiagnosticError[]
  privacy: {
    includesRecordContents: false
    includesApiKeys: false
    includesLocalStorage: false
    automaticallyUploaded: false
  }
}

const runtimeErrors: RuntimeDiagnosticError[] = []
let installed = false

function normalizeErrorName(value: unknown): string {
  const name = value instanceof Error ? value.name : ''
  return /^[A-Za-z][A-Za-z0-9]*Error$/.test(name) || name === 'Error' ? name : 'Error'
}

function safeStackFrames(value: unknown): string[] {
  if (!(value instanceof Error) || !value.stack) return []
  return value.stack
    .split('\n')
    .slice(1, MAX_STACK_FRAMES + 1)
    .map(frame => frame.trim().replace(/[?#].*$/, '').slice(0, 240))
    .filter(Boolean)
}

export function recordRuntimeDiagnosticError(
  value: unknown,
  source: RuntimeDiagnosticError['source'],
): void {
  runtimeErrors.push({
    occurredAt: new Date().toISOString(),
    source,
    name: normalizeErrorName(value),
    frames: safeStackFrames(value),
  })
  if (runtimeErrors.length > MAX_RUNTIME_ERRORS) runtimeErrors.shift()
}

export function installRuntimeDiagnostics(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', event => {
    recordRuntimeDiagnosticError(event.error, 'window.error')
  })
  window.addEventListener('unhandledrejection', event => {
    recordRuntimeDiagnosticError(event.reason, 'unhandledrejection')
  })
}

async function readTableCounts(
  tables: ReadonlyArray<{ name: string; table: Table }>,
): Promise<Record<string, number | null>> {
  const counts = await Promise.all(tables.map(async ({ name, table }) => {
    try {
      return [name, await table.count()] as const
    } catch {
      return [name, null] as const
    }
  }))
  return Object.fromEntries(counts)
}

async function readStorageMetadata(
  runtime: RuntimeAdapter,
): Promise<LocalDiagnosticReport['storage']> {
  try {
    const status = await runtime.durability.inspect()
    return {
      persisted: status.persisted,
      usageBytes: status.usageBytes ?? null,
      quotaBytes: status.quotaBytes ?? null,
    }
  } catch {
    // Some privacy modes deny storage metadata. The report remains usable without it.
    return { persisted: null, usageBytes: null, quotaBytes: null }
  }
}

function routePattern(): string {
  if (typeof location === 'undefined') return ''
  return location.pathname.replace(/\d+/g, ':id')
}

export async function buildLocalDiagnosticReport(
  runtime: RuntimeAdapter = getRuntime(),
): Promise<LocalDiagnosticReport> {
  return {
    format: 'storyforge-local-diagnostics',
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    application: {
      version: APP_VERSION,
      routePattern: routePattern(),
    },
    environment: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      online: navigator.onLine,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    },
    storage: await readStorageMetadata(runtime),
    database: {
      schemaVersion: db.verno,
      tableCounts: await readTableCounts(PROJECT_TABLES),
    },
    recentErrors: runtimeErrors.map(error => ({ ...error, frames: [...error.frames] })),
    privacy: {
      includesRecordContents: false,
      includesApiKeys: false,
      includesLocalStorage: false,
      automaticallyUploaded: false,
    },
  }
}

export function resetRuntimeDiagnostics(): void {
  runtimeErrors.length = 0
}
