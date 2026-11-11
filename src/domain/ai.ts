/**
 * AI providers, models, usage and cost — shared by the UI, the mock API and
 * any real backend. Pure TypeScript: no framework, no network.
 *
 * Cost is an estimate: the token counts a provider returns with each call,
 * times the operator's price table, converted at the operator's exchange rate.
 * It is booked when the call finishes and never re-priced, so editing the
 * price table changes future entries only.
 */
import * as z from 'zod'
import { named } from './registry'

// Local primitives: model.ts imports this module, so it cannot import model.ts.
const Timestamp = z.iso.datetime()
const CalendarDate = z.iso.date()

/* ------------------------------------------------------------------ */
/* Providers, tasks, selection                                         */
/* ------------------------------------------------------------------ */

export const AiProvider = named(
  'AiProvider',
  z.enum(['anthropic', 'openai']),
  'anthropic = Claude models through the Claude API, and Claude Code for AI work; openai = GPT models through the OpenAI API, and Codex for AI work.',
)
export type AiProvider = z.infer<typeof AiProvider>
export const AI_PROVIDERS = AiProvider.options

export const AiTask = named(
  'AiTask',
  z.enum(['precheck', 'report', 'work']),
  'precheck = advice on a draft before submission; report = feasibility report; work = code change and merge request by a coding agent.',
)
export type AiTask = z.infer<typeof AiTask>
export const AI_TASKS = AiTask.options

/** How a task drives the model. */
export const AiRuntime = named(
  'AiRuntime',
  z.enum(['api', 'claude_code', 'codex']),
  'api = one model API call; claude_code / codex = a coding-agent run made of many calls.',
)
export type AiRuntime = z.infer<typeof AiRuntime>

/** Precheck and report call the model API; work runs the provider's coding agent. */
export function runtimeFor(task: AiTask, provider: AiProvider): AiRuntime {
  if (task !== 'work') return 'api'
  return provider === 'anthropic' ? 'claude_code' : 'codex'
}

export const AiSelection = named(
  'AiSelection',
  z.object({ provider: AiProvider, model: z.string().min(1).describe("The provider's model id") }),
)
export type AiSelection = z.infer<typeof AiSelection>

/* ------------------------------------------------------------------ */
/* Token usage                                                         */
/* ------------------------------------------------------------------ */

const Count = z.int().nonnegative()

/**
 * Provider-neutral token counts. Every field is billed at its own rate and
 * none contains another, so cost is a plain sum.
 */
export const TokenUsage = named(
  'TokenUsage',
  z.object({
    input: Count.describe('Input tokens billed at the full input rate (cache reads and writes excluded)'),
    cacheRead: Count.describe('Input tokens served from the prompt cache'),
    cacheWrite: Count.describe('Input tokens written to the prompt cache'),
    output: Count.describe('Output tokens, reasoning included'),
    reasoning: Count.optional().describe('Part of `output` spent on reasoning, when the provider reports it'),
  }),
)
export type TokenUsage = z.infer<typeof TokenUsage>

export const ZERO_USAGE: TokenUsage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }

/**
 * `usage` of a Claude API Messages response, and of a Claude Code / Agent SDK
 * run. `input_tokens` excludes cache reads and writes.
 */
export const AnthropicUsage = z.object({
  input_tokens: Count,
  output_tokens: Count,
  cache_creation_input_tokens: Count.nullish(),
  cache_read_input_tokens: Count.nullish(),
})
export type AnthropicUsage = z.infer<typeof AnthropicUsage>

/**
 * `usage` of an OpenAI Responses API call. `input_tokens` includes the cached
 * and cache-write tokens; `output_tokens` includes the reasoning tokens.
 */
export const OpenAiUsage = z.object({
  input_tokens: Count,
  input_tokens_details: z.object({ cached_tokens: Count, cache_write_tokens: Count }).partial().nullish(),
  output_tokens: Count,
  output_tokens_details: z.object({ reasoning_tokens: Count }).partial().nullish(),
})
export type OpenAiUsage = z.infer<typeof OpenAiUsage>

/**
 * `usage` of one Codex turn (`turn.completed` in `codex exec --json`). A run
 * reports one per turn; sum them. Assumed to follow the Responses API: input
 * includes cached and cache-write tokens, output includes reasoning.
 */
export const CodexUsage = z.object({
  input_tokens: Count,
  cached_input_tokens: Count.nullish(),
  cache_write_input_tokens: Count.nullish(),
  output_tokens: Count,
  reasoning_output_tokens: Count.nullish(),
})
export type CodexUsage = z.infer<typeof CodexUsage>

/** Claude Code (Agent SDK) reports Anthropic-shaped usage, so it uses the `anthropic` variant. */
export type RawUsage =
  | { provider: 'anthropic'; usage: AnthropicUsage }
  | { provider: 'openai'; usage: OpenAiUsage }
  | { provider: 'codex'; usage: CodexUsage }

/** Maps a provider's own usage object onto `TokenUsage`. */
export function normalizeUsage(raw: RawUsage): TokenUsage {
  if (raw.provider === 'anthropic') {
    const u = raw.usage
    return {
      input: u.input_tokens,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      output: u.output_tokens,
    }
  }
  const parts =
    raw.provider === 'openai'
      ? {
          input: raw.usage.input_tokens,
          cached: raw.usage.input_tokens_details?.cached_tokens ?? 0,
          written: raw.usage.input_tokens_details?.cache_write_tokens ?? 0,
          output: raw.usage.output_tokens,
          reasoning: raw.usage.output_tokens_details?.reasoning_tokens ?? undefined,
        }
      : {
          input: raw.usage.input_tokens,
          cached: raw.usage.cached_input_tokens ?? 0,
          written: raw.usage.cache_write_input_tokens ?? 0,
          output: raw.usage.output_tokens,
          reasoning: raw.usage.reasoning_output_tokens ?? undefined,
        }
  // Never let a malformed report produce negative uncached input.
  const cached = Math.min(parts.cached, parts.input)
  const written = Math.min(parts.written, parts.input - cached)
  return {
    input: parts.input - cached - written,
    cacheRead: cached,
    cacheWrite: written,
    output: parts.output,
    ...(parts.reasoning !== undefined ? { reasoning: parts.reasoning } : {}),
  }
}

/** Share of input tokens served from the prompt cache, 0–1; 0 when there was no input. */
export function cacheHitRate(tokens: TokenUsage): number {
  const all = tokens.input + tokens.cacheRead + tokens.cacheWrite
  return all ? tokens.cacheRead / all : 0
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  const reasoning = (a.reasoning ?? 0) + (b.reasoning ?? 0)
  return {
    input: a.input + b.input,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    output: a.output + b.output,
    ...(a.reasoning !== undefined || b.reasoning !== undefined ? { reasoning } : {}),
  }
}

/* ------------------------------------------------------------------ */
/* Prices                                                              */
/* ------------------------------------------------------------------ */

const PerMTok = z.number().nonnegative()

export const ModelPrice = named(
  'ModelPrice',
  z.object({
    provider: AiProvider,
    model: z.string().min(1),
    label: z.string().min(1),
    inputUsd: PerMTok.describe('USD per 1M input tokens'),
    cacheReadUsd: PerMTok.describe('USD per 1M cached input tokens'),
    cacheWriteUsd: PerMTok.describe(
      'USD per 1M tokens written to the cache at the shortest TTL; 0 when not billed',
    ),
    outputUsd: PerMTok.describe('USD per 1M output tokens'),
  }),
)
export type ModelPrice = z.infer<typeof ModelPrice>

export const AiPricing = named(
  'AiPricing',
  z
    .object({
      asOf: CalendarDate.describe('Date the prices were last checked against the providers'),
      usdKrw: z.number().positive().describe('KRW per USD used to book new usage'),
      models: z.array(ModelPrice).min(1),
    })
    .refine((p) => new Set(p.models.map((m) => `${m.provider}/${m.model}`)).size === p.models.length, {
      message: 'Each provider/model appears once',
      path: ['models'],
    }),
)
export type AiPricing = z.infer<typeof AiPricing>

export function priceOf(pricing: AiPricing, sel: AiSelection): ModelPrice | undefined {
  return pricing.models.find((m) => m.provider === sel.provider && m.model === sel.model)
}

/** USD for one usage at one price, unrounded. */
export function costUsd(tokens: TokenUsage, price: ModelPrice): number {
  return (
    (tokens.input * price.inputUsd +
      tokens.cacheRead * price.cacheReadUsd +
      tokens.cacheWrite * price.cacheWriteUsd +
      tokens.output * price.outputUsd) /
    1_000_000
  )
}

/** Money is booked at 1/100 of the unit so small calls do not round to zero. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/* ------------------------------------------------------------------ */
/* Usage ledger                                                        */
/* ------------------------------------------------------------------ */

export const AiUsageEntry = named(
  'AiUsageEntry',
  z.object({
    id: z.string(),
    at: Timestamp,
    task: AiTask,
    provider: AiProvider,
    model: z.string(),
    runtime: AiRuntime,
    requestId: z
      .int()
      .positive()
      .optional()
      .describe('Absent for a precheck, which runs before the request exists'),
    userId: z
      .string()
      .describe(
        'The person whose action started the call. The feasibility report made automatically on submission counts against the requester who submitted',
      ),
    team: z
      .string()
      .optional()
      .describe("The person's team when the call was booked, kept as it was; absent when they had none"),
    tokens: TokenUsage,
    costUsd: z.number().nonnegative(),
    costKrw: z.number().nonnegative(),
  }),
)
export type AiUsageEntry = z.infer<typeof AiUsageEntry>

/** Who a call is booked against: the person, and their team at that moment. */
export type AiCaller = { userId: string; team?: string }

/** Prices one call and returns the ledger entry; `undefined` when the model has no price. */
export function bookUsage(
  pricing: AiPricing,
  call: {
    id: string
    at: string
    task: AiTask
    selection: AiSelection
    requestId?: number
    caller: AiCaller
    tokens: TokenUsage
  },
): AiUsageEntry | undefined {
  const price = priceOf(pricing, call.selection)
  if (!price) return undefined
  const usd = costUsd(call.tokens, price)
  return {
    id: call.id,
    at: call.at,
    task: call.task,
    provider: call.selection.provider,
    model: call.selection.model,
    runtime: runtimeFor(call.task, call.selection.provider),
    ...(call.requestId !== undefined ? { requestId: call.requestId } : {}),
    userId: call.caller.userId,
    ...(call.caller.team ? { team: call.caller.team } : {}),
    tokens: call.tokens,
    costUsd: roundMoney(usd),
    costKrw: roundMoney(usd * pricing.usdKrw),
  }
}

/**
 * Whether a request has used up its per-request AI limit, so no further AI
 * run may start. A limit of 0 means no limit. The server enforces it; the UI
 * uses the same rule to explain a disabled button before anyone presses it.
 */
export function overRequestLimit(spentKrw: number, limitKrw: number): boolean {
  return limitKrw > 0 && spentKrw >= limitKrw
}

/* ------------------------------------------------------------------ */
/* Agent settings                                                      */
/* ------------------------------------------------------------------ */

export const AiTaskSelections = named(
  'AiTaskSelections',
  z.object({ precheck: AiSelection, report: AiSelection, work: AiSelection }),
)
export type AiTaskSelections = z.infer<typeof AiTaskSelections>

export const AiProjectOverride = named(
  'AiProjectOverride',
  z.object({ projectId: z.string(), task: AiTask, selection: AiSelection }),
)
export type AiProjectOverride = z.infer<typeof AiProjectOverride>

export const ProviderConnection = named(
  'ProviderConnection',
  z.object({
    provider: AiProvider,
    connected: z.boolean(),
    keyHint: z
      .string()
      .optional()
      .describe('Last four characters of the stored key; the key itself is never returned'),
    updatedAt: Timestamp.optional(),
  }),
)
export type ProviderConnection = z.infer<typeof ProviderConnection>

export const AiSettings = named(
  'AiSettings',
  z.object({
    defaults: AiTaskSelections,
    projectOverrides: z.array(AiProjectOverride),
    providers: z.array(ProviderConnection),
  }),
)
export type AiSettings = z.infer<typeof AiSettings>

/** The model a task uses for a project: the project's override, else the default. */
export function resolveSelection(
  settings: Pick<AiSettings, 'defaults' | 'projectOverrides'>,
  projectId: string,
  task: AiTask,
): AiSelection {
  return (
    settings.projectOverrides.find((o) => o.projectId === projectId && o.task === task)?.selection ??
    settings.defaults[task]
  )
}

/** Every selection the settings use, defaults first. */
export function selectionsInUse(settings: Pick<AiSettings, 'defaults' | 'projectOverrides'>): AiSelection[] {
  return [...AI_TASKS.map((t) => settings.defaults[t]), ...settings.projectOverrides.map((o) => o.selection)]
}
