/** @vitest-environment happy-dom */
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import PromptTemplateEditor from '../../src/components/settings/prompt/PromptTemplateEditor'
import { DialogProvider } from '../../src/components/shared/Dialog'
import { ToastProvider } from '../../src/components/shared/Toast'
import { db } from '../../src/lib/db/schema'
import type { PromptTemplate } from '../../src/lib/types/prompt'
import { usePromptStore } from '../../src/stores/prompt'

const NOW = 1_700_000_000_000

function systemTemplate(): PromptTemplate {
  return {
    id: 1,
    scope: 'system',
    moduleKey: 'worldview.dimension',
    promptType: 'generate',
    name: 'System prompt',
    description: 'Read-only seed',
    systemPrompt: 'system',
    userPromptTemplate: 'user',
    variables: [],
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    examples: {
      good: [{
        id: 'good-1',
        text: 'desired output',
        source: 'user-marked',
        rating: 5,
        createdAt: NOW,
      }],
      bad: [],
    },
  }
}

async function waitFor(predicate: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 50; i++) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('condition was not met')
}

describe('prompt examples on system templates', () => {
  let root: Root | null = null
  let host: HTMLDivElement | null = null

  beforeEach(async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    await db.promptTemplates.clear()
    usePromptStore.setState({ templates: [], loaded: true })
  })

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount())
      root = null
    }
    host?.remove()
    host = null
    await db.promptTemplates.clear()
  })

  test('deleting an example from a system template creates an editable user copy', async () => {
    const template = systemTemplate()
    await db.promptTemplates.put(template)
    usePromptStore.setState({ templates: [template], loaded: true })

    const selectedIds: number[] = []
    const onChanged = vi.fn()

    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root?.render(
        <ToastProvider>
          <DialogProvider>
            <PromptTemplateEditor
              template={template}
              onChanged={onChanged}
              onDeleted={vi.fn()}
              onSelected={(id: number) => selectedIds.push(id)}
            />
          </DialogProvider>
        </ToastProvider>,
      )
    })

    const deleteButton = host.querySelector<HTMLButtonElement>('button[aria-label="delete good prompt example"]')
    expect(deleteButton).not.toBeNull()

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await waitFor(async () => {
        const userTemplates = await db.promptTemplates.where('scope').equals('user').toArray()
        return userTemplates.length === 1 && userTemplates[0].isActive === true
      })
    })

    const userTemplates = await db.promptTemplates.where('scope').equals('user').toArray()
    expect(userTemplates).toHaveLength(1)
    const clone = userTemplates[0]
    expect(clone.parentId).toBe(template.id)
    expect(clone.examples?.good ?? []).toEqual([])
    expect(clone.isActive).toBe(true)
    expect(selectedIds).toEqual([clone.id])
    expect(onChanged).toHaveBeenCalled()

    const original = await db.promptTemplates.get(template.id!)
    expect(original?.scope).toBe('system')
    expect(original?.examples?.good).toHaveLength(1)
  })
})
