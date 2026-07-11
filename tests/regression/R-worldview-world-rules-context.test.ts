/**
 * R-worldview-world-rules-context:
 * Worldview panels pass the real-vs-fiction rules through buildWorldviewPrompt
 * when generating origin / natural / humanity fields.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { buildWorldviewPrompt } from '../../src/lib/ai/adapters/worldview-adapter'
import { usePromptStore } from '../../src/stores/prompt'

describe('worldview.dimension worldRulesContext wiring', () => {
  beforeEach(() => {
    usePromptStore.setState({ templates: [], loaded: false })
  })

  it('renders worldRulesContext passed by humanity generation into the prompt messages', () => {
    const rulesContext = [
      '[WORLD_RULES_CONTEXT_SENTINEL]',
      'countryName=TAI_CHU_COUNTRY',
      'fictionPriority=fiction_first',
    ].join('\n')

    const messages = buildWorldviewPrompt(
      'society',
      'Test Project',
      'fantasy',
      'Existing world context',
      '',
      { parameterValues: { worldRulesContext: rulesContext } },
      '',
      'expand',
    )

    const fullPrompt = messages.map(message => message.content).join('\n\n')
    expect(fullPrompt).toContain('[WORLD_RULES_CONTEXT_SENTINEL]')
    expect(fullPrompt).toContain('countryName=TAI_CHU_COUNTRY')
    expect(fullPrompt).toContain('fictionPriority=fiction_first')
  })
})
