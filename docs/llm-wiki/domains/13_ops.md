---
title: AI Operations
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-10
author: claude-code
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/ops
  - src/domain/ai.ts
  - src/config/ai.ts
  - src/components/ai
evidence:
  - src/features/ops/usage-page.tsx#symbol:UsagePage
  - src/features/ops/usage-charts.tsx#symbol:DailyChart
  - src/features/ops/agents-page.tsx#symbol:AgentsPage
  - src/features/ops/pricing-page.tsx#symbol:PricingPage
  - src/features/ops/budget-page.tsx#symbol:BudgetPage
  - src/domain/ai.ts#symbol:normalizeUsage
  - src/domain/ai.ts#symbol:bookUsage
  - src/domain/ai.ts#symbol:resolveSelection
  - src/domain/ai.ts#symbol:overRequestLimit
  - src/config/ai.ts#symbol:DEFAULT_AI_PRICING
  - src/components/ai/provider.ts#symbol:useModelLabel
  - src/mocks/engine.ts#symbol:bookAi
  - src/mocks/engine.ts#symbol:present
  - src/mocks/engine.ts#symbol:updateAiSettings
  - src/mocks/engine.ts#symbol:setProviderKey
  - src/mocks/engine.ts#symbol:removeProviderKey
  - src/mocks/engine.ts#symbol:updateAiPricing
  - src/mocks/engine.ts#symbol:aiUsageReport
  - src/mocks/engine.ts#symbol:businessDate
  - src/domain/model.ts#symbol:checkBudgetLimits
  - src/domain/model.ts#symbol:perRequestLimitFits
  - src/domain/model.ts#symbol:BUDGET_LIMIT_MAX_KRW
  - src/domain/model.ts#symbol:YearMonth
  - src/lib/format.ts#L162-L175
  - src/features/ops/budget-page.test.tsx
  - src/domain/budget.test.ts
  - src/mocks/api.test.ts#L218-L372
  - src/domain/ai.test.ts
  - e2e/operator.spec.ts
related:
  - docs/llm-wiki/domains/01_admin.md
  - docs/llm-wiki/domains/02_auth.md
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/12_work.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-10
---

# AI Operations

## Responsibility

The AI side of the service, run by the `operator` role: which provider and model each AI task uses, the provider keys, the price table that turns tokens into money, the AI budget, and a usage dashboard. The operator holds `agent:manage`, `usage:view` and `budget:manage` and no request permissions. Operator accounts are provisioned by the service, not by an organization admin ([Admin](01_admin.md)).

| Route | Page | Permission |
| --- | --- | --- |
| `/ops/usage` | `UsagePage` | `usage:view` |
| `/ops/agents` | `AgentsPage` | `agent:manage` |
| `/ops/pricing` | `PricingPage` | `agent:manage` |
| `/ops/budget` | `BudgetPage` | `budget:manage` (`/admin/budget` redirects here) |

The sidebar shows these under an "AI operations" heading (`NavGroup` `ops`); the home page shows this month's spending against the limit and links to the four screens.

## Concepts

- **Providers**: `anthropic` (Claude models through the Claude API, a Claude coding agent for AI work) and `openai` (GPT models through the OpenAI API, Codex for AI work). Charts call them "Claude" and "GPT"; the connection screen uses the vendor names. The runtime id `claude_code` is shown as "Claude Agent": Anthropic's Agent SDK branding guidelines do not permit "Claude Code" as a name in third-party products, and allow "Claude Agent".
- **Tasks**: `precheck` (draft advice), `report` (feasibility report) and `work` (code change and merge request). `runtimeFor` maps precheck and report to `api` and work to `claude_code` or `codex`.
- **Selection**: per-task defaults plus per-project overrides; `resolveSelection` picks the override, else the default.
- **Usage entry**: one ledger row per AI call or agent run with provider, model, runtime, request id (absent for a precheck), normalized tokens, and cost in USD and KRW.

## Workflows

- **Agents**: each provider shows connected / not connected and the last four characters of its key. Adding or replacing a key opens a sheet with a password field (at least 8 characters); the key is cleared from memory when the sheet closes and never returned by the API. Disconnecting asks for confirmation. Below, a model select per task (grouped by provider; models of a disconnected provider are listed but disabled) shows the runtime and the input/output price; project overrides are listed and added with project + task + model (adding the same pair replaces it). Save is disabled with "matches the saved settings" until something changes.
- **Prices**: exchange rate (KRW per USD), the date prices were last checked, and per provider the models with display name, model id and four prices per 1M tokens (input, cache read, cache write, output). Models in use carry an "in use" badge and cannot be removed or renamed. Links point to each provider's official pricing page.
- **Budget**: this month's spending with a `Meter` against the monthly limit, spending per provider/model, and the form for monthly limit, per-request limit and alert threshold. Each limit field says "0 means no limit". An emptied field is an error, never saved as 0 (which would lift the limit). The two limit fields re-validate each other (`register(..., { deps })`), so the "per-request above monthly" error disappears as soon as either value fixes it.
- **Usage**: a month stepper above everything (head-office calendar months, see below); stat tiles for cost (share of the limit, USD equivalent), calls, cache hit rate and exchange rate; a provider split (thin segmented bar, then Claude and GPT side by side with calls, cache hit rate and token mix); stacked daily columns (Claude at the base, GPT on top) with a hover/focus readout and a table view; ranked bars per model in the provider's colour; cost per task; the ten most expensive requests.

## Cost model

- Each provider reports usage in its own shape and `normalizeUsage` maps it to `TokenUsage { input, cacheRead, cacheWrite, output, reasoning? }`, where no field contains another:
  - Claude (API and Claude Code): `input_tokens` already excludes cache reads and writes.
  - OpenAI Responses and Codex: `input_tokens` includes cached and cache-write tokens, so both are subtracted; `output_tokens` includes reasoning. For Codex this is an assumption (its docs do not say), clamped so a malformed report cannot go negative.
- Cost = Σ tokens × the operator's price ÷ 1M, in USD, then × `usdKrw`. `bookUsage` books it once, when the call finishes, rounded to 1/100; editing prices later never re-prices past entries. A model without a price books nothing.
- All costs are estimates, and the usage page says so with an "estimate" chip beside its title (`PageHeader` `badge`). Provider SDK cost fields (the Claude Agent SDK's `total_cost_usd`) are client-side estimates too; the bill is in each provider's console.
- Daily and monthly totals, the budget's month and "today" on the daily chart follow the head-office business calendar ([Glossary](../GLOSSARY.md)): an entry booked between 00:00 and 09:00 in Korea counts in that Korean day and month. A viewer on another clock sees `HqCalendarNote` next to the month stepper. Key registration times are `DateTimeText` (compact, full form in the tooltip).
- Korean amounts group by 만 and 억 (`formatKrw`: "1.5억 원", "18.4만 원"); English uses compact `₩` notation.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useAiSettings` / `useUpdateAiSettings` | `GET` / `PUT /ai/settings` | `AiSettingsInput { defaults, projectOverrides }` → `AiSettings` (+ `providers`) | 400 `providerNotConnected`, `modelNotPriced`, unknown project, duplicate override. Writes the cache. |
| `useSetProviderKey` | `PUT /ai/providers/{provider}/key` | `{ apiKey }` (8–500 chars, write-only) → `ProviderConnection` | Invalidates settings. |
| `useRemoveProviderKey` | `DELETE /ai/providers/{provider}/key` | → `null` | 409 `providerInUse` while a task or override uses it. |
| `useAiPricing` / `useUpdateAiPricing` | `GET` / `PUT /ai/pricing` | `AiPricing { asOf, usdKrw, models[] }` (unique provider/model) | Read needs `agent:manage` or `usage:view`. 409 `modelInUse` when a used model is removed. Invalidates usage. |
| `useAiUsage(month)` | `GET /ai/usage?month=` | → `AiUsageReport` (totals, `byProvider`, `byModel`, `byTask`, `daily`, `topRequests` ≤ 10) | Keeps the previous month while loading. A month outside `01`–`12` is a 400 (`YearMonth`). |
| `useBudget` / `useUpdateBudget` | `GET` / `PUT /budget` | `BudgetInput` → `Budget` (`byModel` per provider/model) | 400 when a limit breaks the rule below. Invalidates dashboard and usage. |

All calls carry the bearer token; failed changes show `toast.error` with the localized server message. A failed first load of a screen shows `LoadFailed` with a retry; a failed refresh keeps the data with a `RefreshFailed` line.

## Domain rules

- Budget limits are whole won from 0 to `BUDGET_LIMIT_MAX_KRW` (10,000,000,000, "100억 원"); 0 means no limit. The per-request limit may not exceed the monthly one while both are set (`perRequestLimitFits`). `checkBudgetLimits` is the one rule: the contract's `BudgetInput` and the budget form both apply it.

- Starting AI work or a revision run is refused with 409 `guard_failed` / `requestBudgetExceeded` once the costs booked against that request reach the per-request limit (`overRequestLimit`; `0` = no limit). The request page uses the same function to disable the buttons beforehand ([Developer Work](12_work.md)).
- A request's usage (`WorkRequest.aiUsage`) is attached only for viewers with `report:read` (`present`); requesters never see costs.
- The usage report's `alertThresholdPct` is a display threshold; nothing sends an alert.
- `useModelLabel` shows the operator's display names to people who may read the price table and falls back to the template defaults (`DEFAULT_AI_PRICING`), then the model id, for everyone else.
- Provider colours are fixed tokens (`--color-provider-anthropic`, `--color-provider-openai`), checked for colour-vision separation and 3:1 contrast in both themes (`src/theme.test.ts`); every chart also names the providers in text.

## Evidence

- `src/features/ops/usage-page.tsx#symbol:UsagePage`, `src/features/ops/usage-charts.tsx#symbol:DailyChart` — dashboard and charts.
- `src/features/ops/agents-page.tsx#symbol:AgentsPage`, `src/features/ops/pricing-page.tsx#symbol:PricingPage`, `src/features/ops/budget-page.tsx#symbol:BudgetPage` — the editing screens.
- `src/domain/ai.ts#symbol:normalizeUsage`, `src/domain/ai.ts#symbol:bookUsage`, `src/domain/ai.ts#symbol:resolveSelection`, `src/domain/ai.ts#symbol:overRequestLimit` — the rules, shared by UI, mock and a future backend; `src/domain/ai.test.ts` covers them.
- `src/components/ai/provider.ts#symbol:useModelLabel` — model display names and provider colours.
- `src/config/ai.ts#symbol:DEFAULT_AI_PRICING` — starting prices (checked 2026-11-03) and default models; the exchange rate is a placeholder.
- `src/mocks/engine.ts#symbol:bookAi`, `src/mocks/engine.ts#symbol:present`, `src/mocks/engine.ts#symbol:aiUsageReport` and the settings/key/pricing methods — server-side behaviour; `src/mocks/api.test.ts#L218-L372` ("AI budget", "AI operations").
- `src/domain/model.ts#symbol:checkBudgetLimits`, `src/domain/model.ts#symbol:perRequestLimitFits`, `src/domain/model.ts#symbol:BUDGET_LIMIT_MAX_KRW`, `src/domain/model.ts#symbol:YearMonth`, `src/domain/budget.test.ts`, `src/features/ops/budget-page.test.tsx` — budget limits and their form.
- `src/mocks/engine.ts#symbol:businessDate`, `src/lib/format.ts#L162-L175` (`formatKrw`) — business-calendar totals; Korean amounts. Cited by line range: `format.ts` is a hub file, and only this function matters here.
- `e2e/operator.spec.ts` — keys, models, prices, usage, budget and the developer's limit message, end to end.

## Open Questions

- OpenAI cache-write prices other than GPT-6 Astra are derived from the 1.25× input rule, and the OpenAI pricing page showed a promotional-price notice when checked; confirm before relying on them.
- Usage entries do not record who triggered the call, so there is no per-person or per-team view yet.
- Per-user ChatGPT or Claude subscription sign-in is not offered: as checked on 2026-11-03, Anthropic does not allow third-party products to offer claude.ai login without approval, and OpenAI documents ChatGPT-plan sign-in only for open-source or locally hosted apps.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
