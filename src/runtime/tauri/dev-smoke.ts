const DEV_SMOKE_MARKER = 'storyforge-m0-dev-smoke'

export interface StoryForgeDesktopDevSmoke {
  readonly marker: typeof DEV_SMOKE_MARKER
  extractSyntheticPdf(base64: string): Promise<{
    text: string
    rawChars: number
    pageCount?: number
  }>
}

declare global {
  interface Window {
    __STORYFORGE_DESKTOP_DEV_SMOKE__?: StoryForgeDesktopDevSmoke
  }
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function installDesktopDevSmoke(): void {
  if (window.__STORYFORGE_DESKTOP_DEV_SMOKE__) return

  Object.defineProperty(window, '__STORYFORGE_DESKTOP_DEV_SMOKE__', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze<StoryForgeDesktopDevSmoke>({
      marker: DEV_SMOKE_MARKER,
      async extractSyntheticPdf(base64) {
        const { extractTextFromFile } = await import('../../lib/doc-parser')
        const bytes = decodeBase64(base64)
        const buffer = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(buffer).set(bytes)
        const file = new File([buffer], 'storyforge-m0-worker-smoke.pdf', {
          type: 'application/pdf',
        })
        return extractTextFromFile(file)
      },
    }),
  })
}
