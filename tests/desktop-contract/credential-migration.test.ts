import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeAdapter } from '../../src/runtime'
import {
  desktopPlaintextCredentialCanaries,
  migrateLegacyRuntimeCredentials,
} from '../../src/runtime/credential-migration'
import { createFakeRuntime } from '../../src/runtime/fake'

function desktopRuntime(): RuntimeAdapter {
  const runtime = createFakeRuntime()
  Object.assign(runtime.secrets.policy, {
    storesPlaintextConfiguration: false,
    reuseReferenceWhenPlaintextOmitted: true,
    migrateLegacyPlaintext: true,
    storageLabel: 'Windows 凭据管理器',
  })
  return runtime
}

describe('M1 desktop credential migration', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('moves AI, embedding, preset, and Gist plaintext into opaque runtime references', async () => {
    localStorage.setItem('storyforge-ai-api-key-remember', 'true')
    localStorage.setItem('storyforge-ai-config', JSON.stringify({
      provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-primary',
    }))
    localStorage.setItem('storyforge-embedding-config', JSON.stringify({
      provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-embedding',
    }))
    localStorage.setItem('storyforge-ai-presets', JSON.stringify([{
      id: 'preset-one',
      name: 'Synthetic',
      config: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-preset' },
    }]))
    localStorage.setItem('sf-gist-pat', 'github_pat_synthetic')
    const runtime = desktopRuntime()

    await migrateLegacyRuntimeCredentials(runtime)
    await migrateLegacyRuntimeCredentials(runtime)

    expect(desktopPlaintextCredentialCanaries()).toEqual([])
    await expect(runtime.secrets.reference('storyforge.ai.primary')).resolves.toEqual(expect.any(String))
    await expect(runtime.secrets.reference('storyforge.ai.embedding')).resolves.toEqual(expect.any(String))
    await expect(runtime.secrets.reference('storyforge.ai.preset.preset-one')).resolves.toEqual(expect.any(String))
    await expect(runtime.secrets.reference('storyforge.github.gist')).resolves.toEqual(expect.any(String))
  })

  it('does not scrub a legacy value when the runtime vault write fails', async () => {
    localStorage.setItem('storyforge-ai-api-key-remember', 'true')
    localStorage.setItem('storyforge-ai-config', JSON.stringify({
      provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'keep-until-safe',
    }))
    const runtime = desktopRuntime()
    vi.spyOn(runtime.secrets, 'put').mockRejectedValueOnce(new Error('vault unavailable'))

    await expect(migrateLegacyRuntimeCredentials(runtime)).rejects.toThrow('vault unavailable')

    expect(JSON.parse(localStorage.getItem('storyforge-ai-config') ?? '{}').apiKey).toBe('keep-until-safe')
  })
})
