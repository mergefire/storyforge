import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  decodeRuntimeFileText,
  openRuntimeFile,
  runtimeSafeSuggestedName,
  runtimeFileAsBrowserFile,
  saveRuntimeText,
} from '../../src/lib/runtime-file'
import { createFakeRuntime, type FakeRuntimeAdapter } from '../../src/runtime/fake'
import { getRuntime, setRuntimeAdapter } from '../../src/runtime'

const originalRuntime = getRuntime()
let runtime: FakeRuntimeAdapter
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.[cm]?[jt]sx?$/.test(entry.name)
      ? [relative(process.cwd(), path).replaceAll('\\', '/')]
      : []
  })
}

describe('R-RUNTIME-FILES · business callers use RuntimeAdapter', () => {
  beforeEach(() => {
    runtime = createFakeRuntime()
    setRuntimeAdapter(runtime)
  })

  afterEach(() => setRuntimeAdapter(originalRuntime))

  it('keeps file-open bytes, name and media type compatible with existing parsers', async () => {
    runtime.state.openedFile = {
      name: 'novel.md',
      mediaType: 'text/markdown',
      bytes: new TextEncoder().encode('第一章'),
    }
    const opened = await openRuntimeFile('source-document')
    expect(opened.status).toBe('completed')
    if (opened.status !== 'completed') return

    expect(decodeRuntimeFileText(opened.value)).toBe('第一章')
    const browserFile = runtimeFileAsBrowserFile(opened.value)
    expect(browserFile.name).toBe('novel.md')
    expect(browserFile.type).toBe('text/markdown')
    expect(await browserFile.text()).toBe('第一章')
  })

  it('propagates open/save cancellation without inventing a file result', async () => {
    runtime.failNext('files.open', 'CANCELLED')
    expect(await openRuntimeFile('project-json')).toEqual({ status: 'cancelled' })

    runtime.failNext('files.save', 'CANCELLED')
    expect(await saveRuntimeText('fact-ledger', 'facts.md', '# facts')).toEqual({
      status: 'cancelled',
    })
    expect(runtime.state.savedFiles).toHaveLength(0)
  })

  it('sanitizes user-authored path separators before runtime filename validation', async () => {
    expect(runtimeSafeSuggestedName('A/B\\C\0D.txt')).toBe('A-B-C-D.txt')
    await saveRuntimeText('state-cards-text', 'A/B\\C.txt', 'state')
    expect(runtime.state.savedFiles[0]?.suggestedName).toBe('A-B-C.txt')
  })

  it('routes every historical direct export through its frozen save purpose', () => {
    const expectations: Array<[string, string]> = [
      ['src/components/facts/FactLibraryPanel.tsx', "'fact-ledger'"],
      ['src/components/state/StatePanel.tsx', "'state-cards-text'"],
      ['src/components/geography/WorldMapVoronoi.tsx', "'world-map-png'"],
      ['src/components/project/InspirationPanel.tsx', "'inspiration-markdown'"],
      ['src/components/settings/prompt/PromptManagerPanel.tsx', "'prompt-library-json'"],
      ['src/components/settings/prompt/PromptTemplateEditor.tsx', "'prompt-template-json'"],
      ['src/components/settings/prompt/PromptWorkflowsPanel.tsx', "'prompt-workflow-json'"],
      ['src/lib/safety/require-backup-before.ts', "'pre-destructive-backup'"],
    ]
    for (const [path, purpose] of expectations) {
      const text = source(path)
      expect(text, path).toContain(purpose)
      expect(text, path).not.toContain('URL.createObjectURL')
      expect(text, path).not.toMatch(/document\.createElement\(['"]a['"]\)/)
    }
    expect(source('src/components/geography/WorldMapVoronoi.tsx')).toContain(
      'new Uint8Array(await blob.arrayBuffer())',
    )
  })

  it('routes all five file selectors and folder lifecycle through opaque runtime calls', () => {
    const openExpectations: Array<[string, string]> = [
      ['src/components/data/DataManagementPanel.tsx', "openRuntimeFile('project-json')"],
      ['src/components/system/ImportDocPanel.tsx', "openRuntimeFile('source-document')"],
      ['src/components/project/ReferencePanel.tsx', "openRuntimeFile('reference-document')"],
      ['src/components/settings/prompt/PromptManagerPanel.tsx', "openRuntimeFile('prompt-library-json')"],
      ['src/components/settings/prompt/PromptWorkflowsPanel.tsx', "openRuntimeFile('prompt-workflow-json')"],
    ]
    for (const [path, call] of openExpectations) {
      const text = source(path)
      expect(text, path).toContain(call)
      expect(text, path).not.toContain('type="file"')
    }

    for (const path of [
      'src/lib/storage/folder-backup.ts',
      'src/components/data/DataManagementPanel.tsx',
      'src/hooks/useFolderAutoBackup.ts',
      'src/pages/HomePage.tsx',
    ]) {
      const text = source(path)
      expect(text, path).not.toContain('FileSystemDirectoryHandle')
      expect(text, path).not.toContain('showDirectoryPicker')
      expect(text, path).not.toContain('folder-handle-store')
    }
    expect(source('src/components/system/ImportDocPanel.tsx')).toContain(
      'getRuntime().durability.inspect()',
    )
    expect(source('src/pages/HomePage.tsx')).toContain("external.open({ kind: 'project-repository' })")
  })

  it('globally confines browser file/FSA APIs and the handle store to runtime/web', () => {
    const files = sourceFiles(resolve(process.cwd(), 'src'))
    const handleStore = 'src/lib/storage/folder-handle-store.ts'
    const allowedBrowserFiles = new Set(['src/runtime/web/index.ts', handleStore])

    expect(
      files.filter(path => path !== handleStore && source(path).includes('folder-handle-store')),
    ).toEqual(['src/runtime/web/index.ts'])

    for (const path of files.filter(path => !allowedBrowserFiles.has(path))) {
      const text = source(path)
      expect(text, path).not.toContain('URL.createObjectURL')
      expect(text, path).not.toContain('showDirectoryPicker')
      expect(text, path).not.toContain('FileSystemDirectoryHandle')
      expect(text, path).not.toMatch(/type\s*=\s*['"]file['"]/)
    }
  })
})
