import { assembleContext } from './registry/assemble-context'

export async function buildStoryDesignGenerationContext(
  projectId: number,
  worldGroupId: number | null,
): Promise<string> {
  const assembled = await assembleContext({
    projectId,
    worldGroupId,
    sourceKeys: ['worldview', 'powerSystem', 'codex', 'worldRules', 'storyCore'],
  })
  return assembled.text
}
