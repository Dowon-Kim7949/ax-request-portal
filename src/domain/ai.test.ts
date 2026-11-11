import { describe, expect, it } from 'vitest'
import { DEFAULT_AI_PRICING, DEFAULT_AI_SELECTIONS } from '../config/ai'
import {
  AiPricing,
  bookUsage,
  cacheHitRate,
  costUsd,
  normalizeUsage,
  overRequestLimit,
  priceOf,
  resolveSelection,
  runtimeFor,
  type ModelPrice,
} from './ai'

const opus: ModelPrice = {
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  label: 'Claude Opus 5.5',
  inputUsd: 4,
  cacheReadUsd: 0.2,
  cacheWriteUsd: 5,
  outputUsd: 20,
}

describe('normalizeUsage', () => {
  it('keeps Claude counts as they are: input_tokens already excludes the cache', () => {
    expect(
      normalizeUsage({
        provider: 'anthropic',
        usage: {
          input_tokens: 1_000,
          cache_read_input_tokens: 20_000,
          cache_creation_input_tokens: 3_000,
          output_tokens: 500,
        },
      }),
    ).toEqual({ input: 1_000, cacheRead: 20_000, cacheWrite: 3_000, output: 500 })
  })

  it('takes cached and cache-write tokens out of OpenAI input_tokens', () => {
    // The worked example of OpenAI's prompt caching guide: 12000 - 4000 - 7000 = 1000.
    expect(
      normalizeUsage({
        provider: 'openai',
        usage: {
          input_tokens: 12_000,
          input_tokens_details: { cached_tokens: 4_000, cache_write_tokens: 7_000 },
          output_tokens: 1_186,
          output_tokens_details: { reasoning_tokens: 1_024 },
        },
      }),
    ).toEqual({ input: 1_000, cacheRead: 4_000, cacheWrite: 7_000, output: 1_186, reasoning: 1_024 })
  })

  it('reads a Codex turn the same way, and tolerates missing details', () => {
    expect(
      normalizeUsage({
        provider: 'codex',
        usage: { input_tokens: 24_763, cached_input_tokens: 24_448, output_tokens: 122 },
      }),
    ).toEqual({ input: 315, cacheRead: 24_448, cacheWrite: 0, output: 122 })
    expect(normalizeUsage({ provider: 'openai', usage: { input_tokens: 10, output_tokens: 5 } })).toEqual({
      input: 10,
      cacheRead: 0,
      cacheWrite: 0,
      output: 5,
    })
  })

  it('never produces negative uncached input from a malformed report', () => {
    const tokens = normalizeUsage({
      provider: 'openai',
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 90, cache_write_tokens: 50 },
        output_tokens: 1,
      },
    })
    expect(tokens).toMatchObject({ input: 0, cacheRead: 90, cacheWrite: 10 })
  })
})

describe('cost', () => {
  it('prices every token kind at its own rate', () => {
    // 1M of each kind at Opus 5.5 rates: 4 + 0.2 + 5 + 20
    const usd = costUsd({ input: 1e6, cacheRead: 1e6, cacheWrite: 1e6, output: 1e6 }, opus)
    expect(usd).toBeCloseTo(29.2, 6)
  })

  it('books an entry in USD and KRW, rounded to 1/100', () => {
    const pricing = AiPricing.parse({ asOf: '2026-11-03', usdKrw: 1400, models: [opus] })
    const entry = bookUsage(pricing, {
      id: 'ai-1',
      at: '2026-11-03T00:00:00.000Z',
      task: 'work',
      selection: { provider: 'anthropic', model: 'claude-opus-5-5' },
      requestId: 7,
      caller: { userId: 'u-choi', teamId: 't-engineering' },
      tokens: { input: 10_000, cacheRead: 100_000, cacheWrite: 0, output: 2_000 },
    })
    // 0.04 + 0.02 + 0.04 = 0.10 USD
    expect(entry).toMatchObject({ runtime: 'claude_code', costUsd: 0.1, costKrw: 140, requestId: 7 })
    expect(entry).toMatchObject({ userId: 'u-choi', teamId: 't-engineering' })
  })

  it('books a person without a team with no team', () => {
    const entry = bookUsage(DEFAULT_AI_PRICING, {
      id: 'ai-3',
      at: '2026-11-03T00:00:00.000Z',
      task: 'precheck',
      selection: { provider: 'anthropic', model: 'claude-haiku-5-5' },
      caller: { userId: 'u-new' },
      tokens: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 },
    })
    expect(entry?.userId).toBe('u-new')
    expect(entry).not.toHaveProperty('teamId')
  })

  it('books nothing for a model without a price', () => {
    const entry = bookUsage(DEFAULT_AI_PRICING, {
      id: 'ai-2',
      at: '2026-11-03T00:00:00.000Z',
      task: 'report',
      selection: { provider: 'openai', model: 'not-a-model' },
      caller: { userId: 'u-kim' },
      tokens: { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 },
    })
    expect(entry).toBeUndefined()
  })
})

describe('selection', () => {
  it('uses the project override, else the task default', () => {
    const settings = {
      defaults: DEFAULT_AI_SELECTIONS,
      projectOverrides: [
        {
          projectId: 'p-data',
          task: 'work' as const,
          selection: { provider: 'openai' as const, model: 'gpt-6.1-sol' },
        },
      ],
    }
    expect(resolveSelection(settings, 'p-data', 'work')).toEqual({ provider: 'openai', model: 'gpt-6.1-sol' })
    expect(resolveSelection(settings, 'p-data', 'report')).toEqual(DEFAULT_AI_SELECTIONS.report)
    expect(resolveSelection(settings, 'p-portal', 'work')).toEqual(DEFAULT_AI_SELECTIONS.work)
  })

  it('runs work on the provider’s coding agent and everything else on the API', () => {
    expect(runtimeFor('work', 'anthropic')).toBe('claude_code')
    expect(runtimeFor('work', 'openai')).toBe('codex')
    expect(runtimeFor('report', 'openai')).toBe('api')
  })
})

describe('default price table', () => {
  it('prices every default selection and lists each model once', () => {
    for (const sel of Object.values(DEFAULT_AI_SELECTIONS))
      expect(priceOf(DEFAULT_AI_PRICING, sel)).toBeDefined()
    const dup = { ...DEFAULT_AI_PRICING, models: [...DEFAULT_AI_PRICING.models, opus] }
    expect(AiPricing.safeParse(dup).success).toBe(false)
  })
})

describe('limits and ratios', () => {
  it('blocks a further AI run once the per-request limit is reached; 0 means no limit', () => {
    expect(overRequestLimit(29_999, 30_000)).toBe(false)
    expect(overRequestLimit(30_000, 30_000)).toBe(true)
    expect(overRequestLimit(1_000_000, 0)).toBe(false)
  })

  it('measures the cache hit rate over every input token', () => {
    expect(cacheHitRate({ input: 100, cacheRead: 800, cacheWrite: 100, output: 50 })).toBeCloseTo(0.8)
    expect(cacheHitRate({ input: 0, cacheRead: 0, cacheWrite: 0, output: 5 })).toBe(0)
  })
})
