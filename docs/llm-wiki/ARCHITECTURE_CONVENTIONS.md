---
title: Architecture Conventions
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: architecture_conventions
project: ax-request-portal
last_updated: 2026-11-04
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/api/contract.ts
  - src/api/client.ts
  - src/api/queries.ts
  - src/api/openapi.ts
  - src/main.tsx
  - src/mocks/handlers.ts
  - src/mocks/store.ts
  - src/config/schema.ts
  - src/config/env.ts
  - src/i18n/index.ts
  - vite.config.ts
  - deploy/nginx.conf
evidence:
  - src/api/contract.ts#symbol:EndpointSpec
  - src/api/contract.ts#symbol:ApiErrorBody
  - src/api/client.ts#symbol:call
  - src/api/queries.ts#symbol:keys
  - src/api/queries.ts#symbol:onRequestChanged
  - src/api/query-client.ts#symbol:createQueryClient
  - src/api/openapi.test.ts
  - src/domain/registry.ts#symbol:named
  - src/main.tsx#symbol:MOCK_START_TIMEOUT_MS
  - src/main.tsx#symbol:BOOT_RELOAD_KEY
  - src/mocks/handlers.ts#symbol:createHandlers
  - src/mocks/engine.ts#symbol:STATE_VERSION
  - src/config/env.ts#symbol:env
  - src/config/schema.ts#symbol:AppConfigSchema
  - src/i18n/index.ts#symbol:initialLocale
  - src/i18n/en.ts
  - src/app/nav.ts#symbol:NAV_ITEMS
  - vite.config.ts
  - deploy/nginx.conf
related:
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/profiles/frontend.md
  - docs/llm-wiki/COMPONENT_INVENTORY.md
visibility: public
contains_sensitive_info: false
---

# Architecture Conventions

## Summary

A front-end-only SPA whose backend is a contract. One table of endpoints (`src/api/contract.ts`, Zod schemas) generates the typed client, the in-browser mock server and `docs/openapi.json`. The business rules that both sides must agree on — the request lifecycle and the permission table — live in `src/domain/` as plain TypeScript with no framework imports, so the mock server and a future real backend can share them.

## Module layout

| Path | Owns | May import |
| --- | --- | --- |
| `src/domain/` | Models (Zod), lifecycle, roles and permissions, precheck, report rules | nothing app-specific |
| `src/api/` | `contract.ts` (endpoint table), `client.ts` (fetch), `queries.ts` (TanStack Query hooks), `openapi.ts` | `domain` |
| `src/mocks/` | MSW handlers, `MockEngine` (rules + state), persistence, seed, localized server texts, mock AI | `domain`, `api/contract` |
| `src/config/` | `app.config.ts` (validated template settings), `env.ts` (build-time variables) | `domain`, `i18n/locales` |
| `src/app/` | Router, guards, shell and navigation, theme, page helpers | everything below |
| `src/features/<domain>/` | Pages and page-specific components, one folder per domain | `app`, `api`, `components`, `domain` |
| `src/components/` | Shared UI (`ui/`) and request widgets (`request/`) | `domain` types, `lib` |
| `src/stores/` | zustand stores persisted to `localStorage` (`session`, `preferences`) | — |
| `src/i18n/` | i18next setup, `ko.ts`, `en.ts`, `locales.ts` | `config`, `stores` |

- `@/` is an alias for `src/`. Only `src/main.tsx` and `src/app/demo.ts` import mocks, and only dynamically, so a real-backend build does not bundle them.
- `src/i18n/locales.ts` must stay dependency-free: `config/schema.ts` imports it and `i18n/index.ts` imports `config`.
- Two files are called `preferences.ts`: `src/stores/preferences.ts` is the persisted store, `src/app/preferences.ts` is the `useSetLanguage` hook.

## API contract

- `EndpointSpec`: `method`, OpenAPI-style `path` (`/requests/{id}`), `summary`, `tag`, optional `public`, `params`, `query`, `body` (Zod), `multipart`, `status` (200/201) and `response` (`null` → 204). The table is `api`; it has 35 endpoints.
- `call` in `client.ts` builds the URL from the spec, adds `Authorization: Bearer`, `Accept: application/json` and `Accept-Language`, and validates the response with the spec's schema: a mismatch throws `ApiError` with code `contract_violation`, a network failure `network`. A `401` from a non-public endpoint triggers `onUnauthorized` (session cleared). Error bodies follow `ApiErrorBody` (`bad_request`, `unauthorized`, `forbidden`, `not_found`, `invalid_transition`, `guard_failed`, `internal`) with a localized `message`.
- Every schema used by the contract is registered with `named()` (`src/domain/registry.ts`); an unregistered schema makes OpenAPI generation throw.
- `npm run openapi` regenerates `docs/openapi.json`. `src/api/openapi.test.ts` fails when the committed file differs byte for byte, when an endpoint lacks a unique `operationId`, or when a `$ref` is broken. The file is excluded from Prettier for that reason.

**Adding or changing an endpoint:** edit `contract.ts` (and `domain/model.ts` for new shapes), implement it in `src/mocks/handlers.ts` + `engine.ts`, add or adjust the hook in `queries.ts`, run `npm run openapi`, and add a case to `src/mocks/api.test.ts`.

## Data fetching and cache

- Query keys come from `keys` in `queries.ts` and are hierarchical: `['api', resource, …]`.
- Defaults (`createQueryClient`): 10 s stale time, no retry on 4xx, up to two retries otherwise, no mutation retries.
- Live polling: while a request is `submitted`, `reporting` or `in_progress`, detail polls every 2 s and lists every 4 s; notifications poll every 15 s.
- Every mutation that changes a request must call `onRequestChanged`: it writes the returned request into the detail cache and invalidates lists, the regression queue, notifications, the dashboard and releases. A new screen derived from requests must be added there.
- Switching language invalidates every query, because server texts are localized.

## Mock mode

- `VITE_API_MOCK` (default `true`) selects the in-browser mock; `VITE_API_BASE_URL` is the real backend; `VITE_BASE` is the public path (read only by `vite.config.ts`). `.env.example` documents all three.
- Boot (`main.tsx`): i18n first (the language decides the seed), theme sync, client configuration, then in mock mode the service worker races an 8 s timeout. On failure the page reloads once (a `sessionStorage` flag prevents loops) and then shows a retry screen. Reason: WebKit can refuse or hang the worker registration when the page is reloaded during the first load; creating a second worker on the same page risks handling requests twice.
- `createHandlers` derives one MSW handler per contract entry, validates params/query/body with the same schemas, adds 120–380 ms latency, reads the language and the mock token, advances simulated time (`engine.tick`) and runs the resolver.
- State is `MockState` in `localStorage` (`ax-request-portal:mock-db`). Bumping `STATE_VERSION` discards every visitor's stored data and reseeds. The seed is produced by running the real engine through the lifecycle, so seeded requests are always reachable states; steps a person would click (scope choices, assumption ticks) are filled in by `withDefaults` with the AI's suggestion. `dirty` marks data a person edited: untouched demo data is regenerated when the language changes, edited data keeps its language.

## Configuration

- Template users change `src/config/app.config.ts`: brand (per locale), locales and default locale, enabled roles, role permissions, request types, workflow (`scopeCheck`: ask the requester to confirm the AI's reading before developer review; the mock follows it and a real backend should read the same setting), mock timings. `AppConfigSchema` validates it at start-up and refuses a configuration without `admin`, without an active role that can manage users, or with a default locale that is not enabled.
- Colours are tokens in `src/index.css`; texts are in `src/i18n/`; demo accounts and seed data are in `src/mocks/seed.ts`.

## i18n

- Korean is the default and the source of truth: `ko.ts` exports `Messages`, and `en.ts` is typed as `Messages`, so a missing or extra key is a compile error. `t()` keys are type-checked.
- Initial language: stored preference (if enabled) → browser languages → `appConfig.defaultLocale`. `<html lang>` follows every change.
- Server-side texts (errors, notifications, AI report) follow `Accept-Language`; notifications are stored as key + parameters and rendered on read.

## Navigation

`NAV_ITEMS` is one permission-aware table that renders the desktop sidebar, the tablet icon rail and the phone tab bar (up to four tabs by priority, the rest in a "more" sheet). Route permissions and navigation visibility use the same `Permission` values. A route with `handle.focus` (the wizard) hides the phone tab bar.

## Build and deploy

- `vite.config.ts` splits fixed vendor chunks with `build.rolldownOptions.output.codeSplitting.groups` (Vite 8 / Rolldown; the Rollup `manualChunks` option does not apply): react, router, query + zustand, i18n, zod, ui, and one chunk per message file. Icons are deliberately left to the pages that use them.
- Production is static files behind nginx (`deploy/nginx.conf`): SPA fallback to `index.html` with `no-cache`, hashed `/assets/` cached for a year as `immutable`, a missing asset answers `404` instead of HTML, `mockServiceWorker.js` is `no-cache`, security headers repeated per `location` (nginx does not inherit `add_header`). An `/api/` proxy block is provided commented out. `deploy/check-nginx.sh` verifies these rules in CI.
- The GitHub Pages demo is a mock-mode build with `VITE_BASE=/<repository>/` and `404.html` copied from `index.html`.

## Evidence

- `src/api/contract.ts#symbol:EndpointSpec`, `src/api/contract.ts#symbol:ApiErrorBody` — contract shape and error codes.
- `src/api/client.ts#symbol:call` — headers, validation, 401 handling.
- `src/api/queries.ts#symbol:keys`, `src/api/queries.ts#symbol:onRequestChanged`, `src/api/query-client.ts#symbol:createQueryClient` — cache rules.
- `src/api/openapi.test.ts`, `src/domain/registry.ts#symbol:named` — OpenAPI generation and its test.
- `src/main.tsx#symbol:MOCK_START_TIMEOUT_MS`, `src/main.tsx#symbol:BOOT_RELOAD_KEY` — boot recovery.
- `src/mocks/handlers.ts#symbol:createHandlers`, `src/mocks/engine.ts#symbol:STATE_VERSION` — mock server.
- `src/config/env.ts#symbol:env`, `src/config/schema.ts#symbol:AppConfigSchema` — configuration.
- `src/i18n/index.ts#symbol:initialLocale`, `src/i18n/en.ts` — language selection and the typed English messages.
- `src/app/nav.ts#symbol:NAV_ITEMS` — navigation table.
- `vite.config.ts`, `deploy/nginx.conf` — chunks and serving rules.

## Open Questions

- The mock engine re-implements server-side authorization from `src/domain`; a real backend has to implement the same checks, and nothing in this repository verifies a backend against the contract beyond the OpenAPI document.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
