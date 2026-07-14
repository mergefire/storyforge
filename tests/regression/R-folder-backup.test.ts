/** R-FOLDER · folder backup orchestration through opaque RuntimeAdapter bindings. */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/lib/db/schema'
import {
  backupFilename,
  projectBackupBindingId,
  readStoryforgeBackups,
  writeProjectJSONToFolder,
} from '../../src/lib/storage/folder-backup'
import { importProjectJSON } from '../../src/lib/export/json-export'
import { createFakeRuntime, type FakeRuntimeAdapter } from '../../src/runtime/fake'
import { getRuntime, setRuntimeAdapter } from '../../src/runtime'
import { FOLDER_AUTO_INTERVAL, useFolderAutoBackup } from '../../src/hooks/useFolderAutoBackup'

const originalRuntime = getRuntime()
let runtime: FakeRuntimeAdapter

describe('R-FOLDER · opaque directory backup', () => {
  beforeEach(async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    await db.delete()
    await db.open()
    runtime = createFakeRuntime()
    setRuntimeAdapter(runtime)
  })

  afterEach(() => {
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    vi.useRealTimers()
    vi.restoreAllMocks()
    setRuntimeAdapter(originalRuntime)
    db.close()
  })

  it('bind → inspect → clear never exposes a directory handle or path', async () => {
    const bindingId = projectBackupBindingId(7)
    const bound = await runtime.files.bindBackupDirectory(bindingId)
    expect(bound.status).toBe('completed')
    expect(await runtime.files.inspectBackupBinding(bindingId)).toMatchObject({
      bindingId,
      permission: 'granted',
    })

    await runtime.files.clearBackupBinding(bindingId)
    expect(await runtime.files.inspectBackupBinding(bindingId)).toEqual({
      bindingId,
      label: '',
      permission: 'missing',
    })
  })

  it('keeps the timer armed so a binding created in the current workspace is detected', async () => {
    vi.useFakeTimers()
    const inspect = vi.spyOn(runtime.files, 'inspectBackupBinding')
    const bindingId = projectBackupBindingId(91)
    const host = document.createElement('div')
    const root = createRoot(host)
    const Harness = () => {
      useFolderAutoBackup(91)
      return null
    }

    await act(async () => { root.render(createElement(Harness)) })
    expect(inspect).toHaveBeenCalledTimes(1)
    await runtime.files.bindBackupDirectory(bindingId)

    await act(async () => {
      vi.advanceTimersByTime(FOLDER_AUTO_INTERVAL)
      await Promise.resolve()
    })
    expect(inspect).toHaveBeenCalledTimes(2)
    act(() => root.unmount())
  })

  it('write → read → import roundtrip preserves project data', async () => {
    const now = Date.now()
    const pid = await db.projects.add({
      name: '盘里的书', genre: '', description: '', targetWordCount: 0,
      enableMultiWorld: false, createdAt: now, updatedAt: now,
    } as any) as number
    await db.characters.add({
      projectId: pid, name: '盘中角色', role: 'protagonist', createdAt: now, updatedAt: now,
    } as any)

    const bindingId = projectBackupBindingId(pid)
    await runtime.files.bindBackupDirectory(bindingId)
    expect(await writeProjectJSONToFolder(bindingId, pid)).toBe(true)
    expect(runtime.state.bindingFiles.get(bindingId)?.has(backupFilename('盘里的书'))).toBe(true)

    await db.projects.delete(pid)
    await db.characters.where('projectId').equals(pid).delete()

    const backups = await readStoryforgeBackups(bindingId)
    expect(backups).toHaveLength(1)
    const newId = await importProjectJSON(backups[0].data)
    expect((await db.projects.get(newId))?.name).toContain('盘里的书')
    expect(
      (await db.characters.where('projectId').equals(newId).toArray()).map(character => character.name),
    ).toContain('盘中角色')
  })

  it('read skips one corrupt backup without blocking valid files', async () => {
    const bindingId = projectBackupBindingId(9)
    await runtime.files.bindBackupDirectory(bindingId)
    const files = runtime.state.bindingFiles.get(bindingId)!
    const encode = (value: string) => new TextEncoder().encode(value)
    files.set('storyforge-好书.json', encode(JSON.stringify({
      version: 3,
      exportedAt: 1,
      project: { name: '好书' },
      worldviews: [], storyCores: [], powerSystems: [], characters: [], outlineNodes: [],
      chapters: [], foreshadows: [], geographies: [], histories: [], creativeRules: [],
      characterRelations: [],
    })))
    files.set('storyforge-坏文件.json', encode('{坏 JSON'))

    expect((await readStoryforgeBackups(bindingId)).map(file => file.name)).toEqual([
      'storyforge-好书.json',
    ])
  })
})
