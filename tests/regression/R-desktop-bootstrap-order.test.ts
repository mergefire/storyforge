import { describe, expect, it, vi } from 'vitest'
import {
  initializeApplicationData,
  prepareApplicationData,
  type ApplicationDataBootstrapDependencies,
} from '../../src/lib/db/bootstrap'
import { REQUIRED_TABLES } from '../../src/lib/db/ensure-schema'

function dependencies(
  events: string[],
  schema = { reset: false, missing: [] as string[], blocked: false },
): ApplicationDataBootstrapDependencies {
  return {
    ensureSchema: vi.fn(async (tables, options) => {
      expect(tables).toBe(REQUIRED_TABLES)
      expect(options).toEqual({ allowReset: false })
      events.push('schema')
      return schema
    }),
    openDatabase: vi.fn(async () => { events.push('open') }),
    finalizeMigrations: vi.fn(async () => { events.push('finalize') }),
    initializePromptStore: vi.fn(async () => { events.push('prompt-seed') }),
    initializeWorkflowStore: vi.fn(async () => { events.push('workflow-seed') }),
  }
}

describe('D1.3 application data bootstrap order', () => {
  it('opens and finalizes the database before either seed writer', async () => {
    const events: string[] = []

    await initializeApplicationData(false, dependencies(events))

    expect(events).toEqual(['schema', 'open', 'finalize', 'prompt-seed', 'workflow-seed'])
  })

  it('can hold seed writers behind the desktop first-run migration choice', async () => {
    const events: string[] = []
    const deps = dependencies(events)

    await prepareApplicationData(false, deps)

    expect(events).toEqual(['schema', 'open', 'finalize'])
    expect(deps.initializePromptStore).not.toHaveBeenCalled()
    expect(deps.initializeWorkflowStore).not.toHaveBeenCalled()
  })

  it('does not open or seed when the production schema check is blocked', async () => {
    const events: string[] = []
    const deps = dependencies(events, {
      reset: false,
      missing: ['promptTemplates'],
      blocked: true,
    })

    await expect(initializeApplicationData(false, deps)).rejects.toThrow(
      'schema initialization blocked; missing stores: promptTemplates',
    )

    expect(events).toEqual(['schema'])
    expect(deps.openDatabase).not.toHaveBeenCalled()
    expect(deps.initializePromptStore).not.toHaveBeenCalled()
    expect(deps.initializeWorkflowStore).not.toHaveBeenCalled()
  })

  it('does not seed when opening or migration finalization fails', async () => {
    const openEvents: string[] = []
    const openFailure = dependencies(openEvents)
    vi.mocked(openFailure.openDatabase).mockRejectedValueOnce(new Error('open failed'))

    await expect(initializeApplicationData(false, openFailure)).rejects.toThrow('open failed')
    expect(openEvents).toEqual(['schema'])
    expect(openFailure.initializePromptStore).not.toHaveBeenCalled()
    expect(openFailure.initializeWorkflowStore).not.toHaveBeenCalled()

    const migrationEvents: string[] = []
    const migrationFailure = dependencies(migrationEvents)
    vi.mocked(migrationFailure.finalizeMigrations).mockRejectedValueOnce(new Error('finalize failed'))

    await expect(initializeApplicationData(false, migrationFailure)).rejects.toThrow('finalize failed')
    expect(migrationEvents).toEqual(['schema', 'open'])
    expect(migrationFailure.initializePromptStore).not.toHaveBeenCalled()
    expect(migrationFailure.initializeWorkflowStore).not.toHaveBeenCalled()
  })
})
