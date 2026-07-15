/** @vitest-environment happy-dom */
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import CloudBackupCard from '../../src/components/data/CloudBackupCard'
import { DialogProvider } from '../../src/components/shared/Dialog'
import { createFakeRuntime, type FakeRuntimeAdapter } from '../../src/runtime/fake'
import { getRuntime, setRuntimeAdapter } from '../../src/runtime'
import { useGistStore } from '../../src/stores/gist'

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('condition was not met')
}

describe('CloudBackupCard external navigation', () => {
  const originalRuntime = getRuntime()
  let runtime: FakeRuntimeAdapter
  let root: Root | null = null
  let host: HTMLDivElement | null = null

  beforeEach(async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    runtime = createFakeRuntime()
    setRuntimeAdapter(runtime)
    useGistStore.setState({
      pat: null,
      username: null,
      rememberPat: false,
      autoBackup: false,
      busy: false,
      error: null,
    })
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root?.render(
        <DialogProvider>
          <CloudBackupCard projectId={1} />
        </DialogProvider>,
      )
    })
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = null
    host?.remove()
    host = null
    setRuntimeAdapter(originalRuntime)
  })

  function tokenHelpButton(): HTMLButtonElement {
    const button = [...(host?.querySelectorAll('button') ?? [])]
      .find(candidate => candidate.textContent?.includes('Token'))
    if (!button) throw new Error('token help button not found')
    return button
  }

  it('routes token help through the closed external destination', async () => {
    expect(host?.querySelector('a[href*="github.com/settings/tokens"]')).toBeNull()

    await act(async () => {
      tokenHelpButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await waitFor(() => runtime.state.externalDestinations.length === 1)
    })

    expect(runtime.state.externalDestinations).toEqual([{ kind: 'github-gist-token' }])
  })

  it('keeps an external-open failure visible in the card', async () => {
    runtime.failNext('external.open', 'PERMISSION_DENIED')

    await act(async () => {
      tokenHelpButton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => !!host?.querySelector('.text-error'))

    expect(host?.querySelector('.text-error')?.textContent?.trim()).not.toBe('')
  })
})
