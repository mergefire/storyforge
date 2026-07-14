import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeRuntimeCapabilities } from '../../src/runtime/bootstrap'
import { createFakeRuntime } from '../../src/runtime/fake'
import { getRuntime, setRuntimeAdapter } from '../../src/runtime'
import { createWebRuntime, type WebServiceWorkerContainer } from '../../src/runtime/web'
import { registerStoryForgeServiceWorker } from '../../src/lib/pwa/register-service-worker'

describe('D0.3 distribution runtime capabilities', () => {
  const originalRuntime = getRuntime()

  afterEach(() => {
    setRuntimeAdapter(originalRuntime)
    vi.restoreAllMocks()
  })

  it('initializes one remote Web Service Worker and manages check/install through it', async () => {
    const postMessage = vi.fn()
    const update = vi.fn(async () => undefined)
    const registration = {
      waiting: { postMessage },
      update,
    } as unknown as ServiceWorkerRegistration
    const serviceWorker = {
      register: vi.fn(async () => registration),
      getRegistration: vi.fn(async () => registration),
    } as unknown as WebServiceWorkerContainer
    const runtime = createWebRuntime({
      fetch: vi.fn(),
      hostname: 'storyforge.example.com',
      serviceWorker,
      version: '3.7.5',
    })

    const first = runtime.updates.initialize()
    const second = runtime.updates.initialize()
    window.dispatchEvent(new Event('load'))
    await Promise.all([first, second])

    expect(serviceWorker.register).toHaveBeenCalledTimes(1)
    expect(serviceWorker.register).toHaveBeenCalledWith('/storyforge/sw.js', { scope: '/storyforge/' })
    await expect(runtime.updates.check()).resolves.toEqual({
      releaseId: 'web-service-worker',
      version: '3.7.5',
    })
    expect(update).toHaveBeenCalledTimes(1)
    await runtime.updates.install('web-service-worker')
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(serviceWorker.getRegistration).not.toHaveBeenCalled()
  })

  it('keeps loopback Web development free of Service Worker registration', async () => {
    const serviceWorker = {
      register: vi.fn(),
      getRegistration: vi.fn(),
    } as unknown as WebServiceWorkerContainer
    const runtime = createWebRuntime({
      fetch: vi.fn(),
      hostname: 'localhost',
      serviceWorker,
    })

    await runtime.updates.initialize()
    await expect(runtime.updates.check()).resolves.toBeNull()
    expect(serviceWorker.register).not.toHaveBeenCalled()
    expect(serviceWorker.getRegistration).not.toHaveBeenCalled()
  })

  it('contains Web Service Worker registration failures during bootstrap', async () => {
    const serviceWorker = {
      register: vi.fn(async () => {
        throw new Error('registration blocked')
      }),
      getRegistration: vi.fn(),
    } as unknown as WebServiceWorkerContainer
    const runtime = createWebRuntime({
      fetch: vi.fn(),
      hostname: 'storyforge.example.com',
      serviceWorker,
    })
    const logger = { info: vi.fn(), warn: vi.fn() }

    const initialization = initializeRuntimeCapabilities(runtime, logger)
    window.dispatchEvent(new Event('load'))

    await expect(initialization).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      '[bootstrap] runtime update initialization failed:',
      expect.any(Error),
    )
  })

  it('initializes Fake updates and durability while keeping startup failures non-fatal', async () => {
    const runtime = createFakeRuntime()
    const inspect = vi.fn(async () => ({ persisted: false }))
    const requestPersistence = vi.fn(async () => ({ persisted: true }))
    runtime.durability.inspect = inspect
    runtime.durability.requestPersistence = requestPersistence
    const logger = { info: vi.fn(), warn: vi.fn() }

    await initializeRuntimeCapabilities(runtime, logger)

    expect(runtime.state.updatesInitialized).toBe(true)
    expect(inspect).toHaveBeenCalledTimes(1)
    expect(requestPersistence).toHaveBeenCalledTimes(1)
    expect(logger.warn).not.toHaveBeenCalled()

    const failedRuntime = createFakeRuntime()
    failedRuntime.failNext('updates.initialize', 'PERMISSION_DENIED')
    await expect(initializeRuntimeCapabilities(failedRuntime, logger)).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      '[bootstrap] runtime update initialization failed:',
      expect.any(Error),
    )
  })

  it('keeps the legacy PWA helper as a RuntimeAdapter-only compatibility wrapper', async () => {
    const runtime = createFakeRuntime()
    setRuntimeAdapter(runtime)

    await registerStoryForgeServiceWorker()

    expect(runtime.state.updatesInitialized).toBe(true)
  })
})
