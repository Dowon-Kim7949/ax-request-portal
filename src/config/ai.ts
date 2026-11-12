/**
 * Starting values for AI operations: the price table and the model each task
 * uses. The mock API seeds itself from these; a real backend can start from
 * them too. At runtime the service operator edits both in the console, so
 * this file is a default, not the source of truth.
 *
 * Prices are USD per 1M tokens, standard processing, prompts within the
 * short-context tier. Check them before relying on any number:
 *   Claude  https://platform.claude.com/docs/en/about-claude/pricing
 *   OpenAI  https://developers.openai.com/api/docs/pricing
 * Cache-write prices are the shortest TTL (Claude 5 minutes, OpenAI 30
 * minutes); both providers list one per model. Claude Haiku 5.5 is priced by
 * prompt length: these are its prices up to 100,000 tokens.
 */
import {
  AiPricing,
  AiTaskSelections,
  type AiPricing as AiPricingType,
  type AiTaskSelections as AiTaskSelectionsType,
} from '../domain/ai'

export const DEFAULT_AI_PRICING: AiPricingType = AiPricing.parse({
  asOf: '2026-11-12',
  // Placeholder rate: set the one your finance team books against.
  usdKrw: 1400,
  models: [
    {
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      label: 'Claude Opus 5.5',
      inputUsd: 4,
      cacheReadUsd: 0.2,
      cacheWriteUsd: 5,
      outputUsd: 20,
    },
    {
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      label: 'Claude Sonnet 5.5',
      inputUsd: 2,
      cacheReadUsd: 0.1,
      cacheWriteUsd: 2.5,
      outputUsd: 10,
    },
    {
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      label: 'Claude Haiku 5.5',
      inputUsd: 0.1,
      cacheReadUsd: 0.01,
      cacheWriteUsd: 0.125,
      outputUsd: 0.5,
    },
    {
      provider: 'openai',
      model: 'gpt-6-astra',
      label: 'GPT-6 Astra',
      inputUsd: 10,
      cacheReadUsd: 1,
      cacheWriteUsd: 12.5,
      outputUsd: 50,
    },
    {
      provider: 'openai',
      model: 'gpt-6.1-sol',
      label: 'GPT-6.1 Sol',
      inputUsd: 2,
      cacheReadUsd: 0.1,
      cacheWriteUsd: 2.5,
      outputUsd: 10,
    },
    {
      provider: 'openai',
      model: 'gpt-6.1-terra',
      label: 'GPT-6.1 Terra',
      inputUsd: 1,
      cacheReadUsd: 0.05,
      cacheWriteUsd: 1.25,
      outputUsd: 5,
    },
    {
      provider: 'openai',
      model: 'gpt-6-luna',
      label: 'GPT-6 Luna',
      inputUsd: 0.1,
      cacheReadUsd: 0.01,
      cacheWriteUsd: 0.125,
      outputUsd: 0.5,
    },
  ],
})

/** The model each task uses unless a project overrides it. */
export const DEFAULT_AI_SELECTIONS: AiTaskSelectionsType = AiTaskSelections.parse({
  precheck: { provider: 'anthropic', model: 'claude-haiku-5-5' },
  report: { provider: 'anthropic', model: 'claude-opus-5-5' },
  work: { provider: 'anthropic', model: 'claude-opus-5-5' },
})
