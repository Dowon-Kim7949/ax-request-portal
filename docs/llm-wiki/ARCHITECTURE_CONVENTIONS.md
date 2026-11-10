---
title: Architecture Conventions
tags:
  - llm-wiki
  - verified
status: verified
doc_type: architecture_conventions
project: ax-request-portal
last_updated: 2026-11-10
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/api/contract.ts
  - src/api/client.ts
  - src/api/queries.ts
  - src/api/query-client.ts
  - src/api/openapi.ts
  - src/main.tsx
  - src/mocks/handlers.ts
  - src/mocks/browser.ts
  - src/mocks/store.ts
  - src/config/schema.ts
  - src/config/env.ts
  - src/config/env-check.ts
  - src/lib/time-zone.ts
  - src/i18n/index.ts
  - vite.config.ts
  - deploy/nginx.conf
  - src/app/update-check.ts
  - src/stores/draft.ts
  - src/features/drafts/sync-engine.ts
evidence:
  - src/api/contract.ts#symbol:EndpointSpec
  - src/api/contract.ts#symbol:timeoutOf
  - src/api/contract.ts#symbol:ApiErrorBody
  - src/api/client.ts#symbol:call
  - src/api/client.ts#symbol:ClientHooks
  - src/lib/abort.ts#symbol:anySignal
  - src/api/error-text.ts#symbol:errorText
  - src/api/queries.ts#symbol:keys
  - src/api/queries.ts#symbol:onRequestChanged
  - src/api/queries.ts#symbol:storeRequest
  - src/api/queries.ts#symbol:requestScope
  - src/api/queries.ts#symbol:storeSavedDraft
  - src/api/queries.ts#symbol:dropSavedDraft
  - src/features/drafts/sync-engine.ts#symbol:DraftSyncEngine
  - src/features/drafts/hooks.ts#symbol:useDraftSync
  - src/stores/draft.ts#symbol:draftsKey
  - src/mocks/engine.ts#symbol:MockState
  - src/config/app.config.ts#symbol:appConfig
  - src/api/query-client.ts#symbol:createQueryClient
  - src/api/query-client.ts#symbol:isRetryable
  - src/api/refresh.ts#symbol:refreshOf
  - src/components/ui/load-failed.tsx#symbol:LoadFailed
  - src/components/ui/load-failed.tsx#symbol:RefreshFailed
  - src/api/openapi.test.ts
  - src/domain/registry.ts#symbol:named
  - src/domain/url.ts#symbol:isSafeUrl
  - src/main.tsx#symbol:MOCK_START_TIMEOUT_MS
  - src/main.tsx#symbol:BOOT_RELOAD_KEY
  - src/mocks/handlers.ts#symbol:createHandlers
  - src/mocks/handlers.ts#symbol:MOCK_RESPONSE_HEADER
  - src/mocks/browser.ts#symbol:reattachIfBypassed
  - src/api/client.test.ts
  - src/api/query-client.test.ts
  - src/mocks/handlers.test.ts
  - e2e/mock-api.spec.ts
  - src/mocks/engine.ts#symbol:STATE_VERSION
  - src/mocks/store.ts#symbol:REVISION_KEY
  - src/mocks/store.ts#symbol:stateProblem
  - src/mocks/store.ts#symbol:createMockStore
  - src/mocks/signals.ts#symbol:reportMockStorageFull
  - src/mocks/signals.ts#symbol:takeMockStorageFull
  - src/mocks/signals.ts#symbol:MOCK_DATA_CHANGED_EVENT
  - src/app/demo-data-sync.tsx#symbol:DemoDataSync
  - src/app/demo-storage-notice.tsx#symbol:DemoStorageNotice
  - src/mocks/store.test.ts
  - src/config/env.ts#symbol:env
  - src/config/env-check.ts#symbol:checkEnv
  - src/config/env-check.ts#symbol:isApiMock
  - src/config/env-check.test.ts
  - src/config/schema.ts#symbol:AppConfigSchema
  - src/config/zod-jitless.ts
  - src/config/nginx-csp.ts#symbol:pagePolicyOf
  - src/config/deploy-config.test.ts
  - scripts/check-real-build.mjs
  - deploy/csp-hashes.mjs
  - src/lib/time-zone.ts#symbol:hqToday
  - src/lib/time-zone.ts#symbol:sameOffset
  - src/lib/time-zone.ts#symbol:dateInTimeZone
  - src/lib/format.ts#symbol:formatDate
  - src/lib/format.ts#symbol:formatWeekday
  - src/lib/format.ts#symbol:describeDateTime
  - src/lib/use-media-query.ts#symbol:useMediaQuery
  - src/lib/use-media-query.ts#symbol:FIT_QUERY
  - src/lib/use-media-query.test.ts
  - src/lib/scrollbar-width.ts#symbol:trackScrollbarWidth
  - src/lib/format.test.ts
  - src/components/ui/date-time.tsx#symbol:DateTimeText
  - src/mocks/engine.ts#symbol:businessDate
  - src/i18n/index.ts#symbol:initialLocale
  - src/i18n/en.ts
  - src/app/nav.ts#symbol:NAV_ITEMS
  - src/app/nav.ts#symbol:phoneTabs
  - src/app/nav.test.ts
  - src/app/router.tsx#symbol:permissionsFor
  - src/app/router.tsx#symbol:RouteHandle
  - src/app/pages.tsx#symbol:RouteErrorView
  - vite.config.ts
  - deploy/nginx.conf
  - src/app/update-check.ts#symbol:watchForUpdates
  - src/app/update-check.ts#symbol:isChunkLoadError
  - src/app/update-notice.tsx#symbol:UpdateNotice
  - src/app/update-check.test.ts
  - src/vite-env.d.ts
  - deploy/check-nginx.sh
  - e2e/update.spec.ts
related:
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/profiles/frontend.md
  - docs/llm-wiki/COMPONENT_INVENTORY.md
  - docs/llm-wiki/GLOSSARY.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-10
---

# Architecture Conventions

## Summary

A front-end-only SPA whose backend is a contract. One table of endpoints (`src/api/contract.ts`, Zod schemas) generates the typed client, the in-browser mock server and `docs/openapi.json`. The business rules that both sides must agree on — the request lifecycle, the permission table, budget limits and URL safety — live in `src/domain/` as plain TypeScript with no framework imports, so the mock server and a future real backend can share them.

## Module layout

| Path | Owns | May import |
| --- | --- | --- |
| `src/domain/` | Models (Zod), lifecycle, roles and permissions, precheck, report rules, URL rules (`url.ts`) | nothing app-specific |
| `src/api/` | `contract.ts` (endpoint table), `client.ts` (fetch), `query-client.ts` (retry and logging), `queries.ts` (TanStack Query hooks), `refresh.ts`, `error-text.ts`, `openapi.ts` | `domain` |
| `src/mocks/` | MSW handlers, `MockEngine` (rules + state), persistence, seed, localized server texts, mock AI; `signals.ts` (window events for the app) | `domain`, `api/contract`, `lib/time-zone` |
| `src/config/` | `app.config.ts` (validated template settings), `env.ts` (build-time variables), `env-check.ts` (build-setting rules), `nginx-csp.ts`, `zod-jitless.ts` | `domain`, `i18n/locales` |
| `src/lib/` | Formatting (`format.ts`), time zones (`time-zone.ts`, no UI state, also used by the mock), small helpers (`abort.ts`, `debounce.ts`, `data-url.ts`, `use-media-query.ts`: `useMediaQuery`, `TABLET_UP`, the `md` breakpoint for a view that needs a tablet's width, and `FIT_QUERY`, the big-screen size the `fit:` CSS variant also names; `scrollbar-width.ts`: the measured scrollbar gutter as `--sbw`) | `config`, `i18n`, `stores` (`format.ts` only) |
| `src/app/` | Router, guards, session sync, shell and navigation, theme, page helpers, demo banner and demo-data signals, time-zone hooks | everything below |
| `src/features/<domain>/` | Pages and page-specific components, one folder per domain; `drafts/` has no page: the draft sync engine (`sync-core.ts` rules, `sync-engine.ts` without React, `sync.ts` wiring, `hooks.ts`) and the saved-drafts section the home, requests and wizard screens render | `app`, `api`, `components`, `domain`, `stores` |
| `src/components/` | Shared UI (`ui/`) and request widgets (`request/`) | `domain` types, `lib` |
| `src/stores/` | zustand stores persisted to `localStorage` (`session`, `preferences`) and the drafts kept on this device (`draft.ts`: plain functions over one `localStorage` key per person, no React; `session.ts` imports it to delete them on sign-out) | — |
| `src/i18n/` | i18next setup, `ko.ts`, `en.ts`, `locales.ts` | `config`, `stores` |

- `@/` is an alias for `src/`. The mock is reached only through dynamic imports in `src/main.tsx` and `src/app/demo.ts`, each behind the `__API_MOCK__` build constant (see Build and deploy); branching on anything else (e.g. `env.apiMock`) keeps the import and ships the mock. The app may import `src/mocks/signals.ts` statically: it has no imports.
- `src/i18n/locales.ts` must stay dependency-free: `config/schema.ts` imports it and `i18n/index.ts` imports `config`. The same holds for `src/config/env-check.ts` and `src/config/nginx-csp.ts`, which are compiled for the browser and for the Node-side Vite config.
- Two files are called `preferences.ts`: `src/stores/preferences.ts` is the persisted store, `src/app/preferences.ts` is the `useSetLanguage` hook. Two are called `time-zone.ts`: `src/lib/time-zone.ts` holds the rules, `src/app/time-zone.ts` the React hooks.

## API contract

- `EndpointSpec`: `method`, OpenAPI-style `path` (`/requests/{id}`), `summary`, `tag`, optional `public`, `params`, `query`, `body` (Zod), `multipart`, `status` (200/201), `conflict` (what a `409` means there, written into `docs/openapi.json`), `response` (`null` → 204) and `timeoutMs`. The table is `api`; it has 41 endpoints.
- Time limits belong to the endpoint, the same for every caller: `timeoutOf(spec)` is the spec's `timeoutMs`, else `UPLOAD_TIMEOUT_MS` (120 s) for multipart, else `DEFAULT_TIMEOUT_MS` (30 s); `0` means no limit. `call` takes no time-limit argument.
- `call` in `client.ts` builds the URL from the spec, adds `Authorization: Bearer`, `Accept: application/json` and `Accept-Language`, and runs the whole call — sending, the mock's re-send and reading the body — under one deadline combined with the caller's `signal` (`anySignal`: `AbortSignal.any`, or a manual merge where it is missing). Every failure becomes an `ApiError`: `timeout` when the deadline passed, `network` when the request could not be sent or read, `contract_violation` when a success body is not JSON (typically an HTML page behind a wrong API base URL) or does not match the spec's schema, otherwise the server's code. Two exceptions pass through: a cancel through the caller's `signal` stays an `AbortError` (how TanStack Query drops a superseded fetch), and a bug such as a missing path parameter is thrown as is.
- A `401` from a non-public endpoint calls `onUnauthorized(token)` with the token the refused request carried ([Auth](domains/02_auth.md)). The optional `recover` hook (set only in mock mode) sees every response first; when it resolves `true` the request is sent exactly once more. `ClientHooks.messages` holds the texts for errors the client raises itself; English fills any gap. Error bodies follow `ApiErrorBody` (`bad_request`, `unauthorized`, `forbidden`, `not_found`, `invalid_transition`, `guard_failed`, `conflict` (a saved draft was saved again since it was read), `limit_reached` (no room for another saved draft), `internal`) with a localized `message` and optional `issues[]` (`path`, `message`).
- What a user is told about a failure comes from one function, `errorText(error, fallback)` in `src/api/error-text.ts`: the API's localized message, or the fallback.
- Every URL field in the contract is validated with the rules in `src/domain/url.ts` (`isSafeUrl` with a kind: `web` absolute http(s); `link` http(s) or a path on this site; `file` adds `data:` images and PDFs and `blob:`; `image` adds `data:image/*` and `blob:`), so a `javascript:` or `data:text/html` URL fails as `contract_violation`. Screens check again before they render a link or an image.
- Every schema used by the contract is registered with `named()` (`src/domain/registry.ts`); an unregistered schema makes OpenAPI generation throw.
- `npm run openapi` regenerates `docs/openapi.json`. `src/api/openapi.test.ts` fails when the committed file differs byte for byte, when an endpoint lacks a unique `operationId`, or when a `$ref` is broken. The file is excluded from Prettier for that reason.

**Adding or changing an endpoint:** edit `contract.ts` (and `domain/model.ts` for new shapes; set `timeoutMs` if it is slow by nature), implement it in `src/mocks/handlers.ts` + `engine.ts`, add or adjust the hook in `queries.ts`, run `npm run openapi`, and add a case to `src/mocks/api.test.ts`.

## Data fetching and cache

- Query keys come from `keys` in `queries.ts` and are hierarchical: `['api', resource, …]`. `main.tsx` creates the one `QueryClient`.
- Defaults (`createQueryClient`): 10 s stale time. A query is retried up to `MAX_RETRIES` (2) times only when `isRetryable`: `network`, `timeout` or a 5xx. A 4xx, a `contract_violation` (a deployment mismatch) and anything that is not an `ApiError` (a bug) fail at once. Mutations are never retried (the server may have applied the change before the answer was lost). The query and mutation caches log errors that are not `ApiError`s to the console, without a toast.
- Live polling: while a request is `submitted`, `reporting` or `in_progress`, detail polls every 2 s and lists every 4 s; notifications poll every 15 s.
- Every mutation that changes a request must call `onRequestChanged`: it stores the returned request with `storeRequest` and invalidates lists, the regression queue, notifications, the dashboard and releases. A new screen derived from requests must be added there. `storeRequest` keeps the cached copy when it is newer (`updatedAt`) than the answer, because answers and polls can arrive out of order.
- Every change to one request runs in the TanStack mutation scope `request:<id>` (`requestScope`), one after another in the order made.
- Saved drafts: `keys.drafts()` (the list) and `keys.draft(id)` (one draft) are separate, so refreshing the list does not re-read an open draft. Drafts are written to the server by the draft sync engine (`DraftSyncEngine`, outside React, one request at a time per tab; [Request Wizard](domains/11_wizard.md)), not by mutation hooks; `useDraftSync` in the shell applies its results to the cache: `storeSavedDraft` puts a saved draft into the detail and list caches at once (upsert, sorted) and then invalidates the list, `dropSavedDraft` removes a deleted or submitted one. Signing out clears the whole cache as before.
- Switching language invalidates every query, because server texts are localized.

## Showing load failures

Every screen follows the same rule, so a failure never looks like "nothing here":

| Query state | Screen shows |
| --- | --- |
| `isPending` | A skeleton. |
| `isLoadingError` (nothing loaded) | `LoadFailed`: the API's message and a retry. The full block (`ErrorState`) when the screen has nothing else; `compact` for one section of a screen. |
| `isRefetchError` (a poll, a return to the tab or a retry failed, earlier data still there) | The earlier data, plus `RefreshFailed` ("may be out of date" and a retry). `refreshOf(...queries)` builds its props from one or more queries. |

The request page answers a 404 with the not-found page even over data loaded before. `useDirectory` exposes the same split for the user and project lists (`usersError` / `projectsError`, `usersStale` / `projectsStale`, `retry`), and its `userName` / `projectName` never return a blank.

A route that fails to load or render ends on `RouteErrorPage` (`RouteErrorView`). The raw error goes to the console, and to the page only in development (a "details for developers" disclosure). A chunk that could not be fetched (`isChunkLoadError`) gets its own copy, which names both causes the browser cannot tell apart — a new deployment or a dropped connection (only the connection when the browser knows it is offline) — and offers "load again" and the home screen.

## Time and the business calendar

Two clocks matter ([Glossary](GLOSSARY.md)):

- **Timestamps** (ISO instants: when something happened) show in the viewing time zone: the one chosen in Settings, otherwise the device's (`Intl`; never an IP lookup). `describeDateTime` and `DateTimeText` add the zone abbreviation and head-office time only when the viewer's clock differs from the head office's at that instant (`sameOffset`): a different zone name with the same offset adds nothing. `DateTimeText` renders `<time dateTime>` and keeps the translated sentence's word order. In Korean, `formatDateTime` always writes 오전 / 오후: some locale data (CLDR 47, used by Node 22 and 24 and by browsers built on it) writes Korean day periods as AM / PM, so tests and screens do not depend on the runtime's data.
- **Date-only values** (`YYYY-MM-DD`: desired dates, scheduled release dates) are calendar dates. `formatDate` and `formatWeekday` format them as a UTC midnight in UTC, so they never move to another day in any time zone; date arithmetic (`addDays`, the schedule's `monthWeeks`) works on the strings in UTC too. Do not parse them with `new Date()` and format them in the local zone.
- **"Today" and day or month totals** follow the head office's business calendar, `appConfig.organization.timeZone`: `hqToday()` in the UI (date-input minimums, the schedule's today and this week, the current month of the dashboard, usage and budget), and `businessDate` / `engine.today(now)` / `engine.dateOf(at)` in the mock (`EngineOptions.timeZone`, default the head office), for monthly dashboard totals, release grouping, AI daily, monthly and budget totals, delay checks, the precheck and the seed. A release that happened is shown by its head-office day (`DateTimeText calendar="hq"`). Viewers on another clock get `HqCalendarNote` / `useHqCalendarNote` where it matters.
- `src/lib/time-zone.ts` holds the rules without UI state, so the mock uses them too; `src/app/time-zone.ts` (`useTimeView`) re-renders when the Settings choice changes. The schema refuses an unknown IANA name in `organization.timeZone` at start-up.

## Mock mode

- `VITE_API_MOCK` (`true`, `false`, or unset/empty = mock) selects the in-browser mock; `VITE_API_BASE_URL` is the real backend; `VITE_BASE` is the public path (read only by `vite.config.ts`). `isApiMock` is the one reading of the value, used by both `vite.config.ts` and `src/config/env.ts`; the build rules are under Build and deploy. `.env.example` documents all four variables.
- Boot (`main.tsx`): `zod-jitless` first, then i18n (the language decides the seed), theme sync, the scrollbar-width measurement (`trackScrollbarWidth`, kept up to date on resize), the query client, client configuration, then in mock mode the service worker races an 8 s timeout. On failure the page reloads once (a `sessionStorage` flag prevents loops) and then shows a retry screen. Reason: WebKit can refuse or hang the worker registration when the page is reloaded during the first load; creating a second worker on the same page risks handling requests twice.
- Worker restarts after boot: browsers stop an idle service worker (Chrome after about 30 s), and MSW's 5 s keep-alive timer is throttled in a background tab, so a tab left alone loses its worker. The restarted worker has an empty `activeClientIds` and passes every request to the network (GitHub Pages answers `404`), which used to leave an error on every screen until a reload. Every mock response carries `X-Mock-Api: 1` (`MOCK_RESPONSE_HEADER`); a response without it makes `reattachIfBypassed` post MSW's `MOCK_ACTIVATE` to the registered worker, wait up to 3 s (`REATTACH_TIMEOUT_MS`) for `MOCKING_ENABLED`, and let the client resend the request once. Concurrent bypassed requests share one re-attach. A bypassed request never reached the mock, so resending a mutation does not apply it twice. `MOCK_ACTIVATE` / `MOCKING_ENABLED` are MSW's worker protocol, not a public API: `e2e/mock-api.spec.ts` stops the worker through the Chrome DevTools Protocol and fails if an MSW upgrade changes them (Chromium only).
- `createHandlers` derives one MSW handler per contract entry, validates params/query/body with the same schemas, adds 120–380 ms latency, reads the language and the mock token, advances simulated time (`engine.tick`) and runs the resolver. A handler reads the request body first and then takes up other tabs' saves, handles the request and saves with nothing awaited in between; an upload takes them up once more after reading the file.
- State is `MockState` in `localStorage` (`ax-request-portal:mock-db`), `STATE_VERSION` 6. Bumping it discards every visitor's stored data and reseeds; so does a stored value that fails the shallow shape check (`stateProblem`, with a console warning). The seed is produced by running the real engine through the lifecycle, so seeded requests are always reachable states; steps a person would click (scope choices, assumption ticks) are filled in by `withDefaults` with the AI's suggestion. `dirty` marks data a person edited, uploads, read notifications and saved drafts included (their routes use `edit`, not `touch`, so a language change cannot reseed a person's drafts away): untouched demo data is regenerated when the language changes, edited data keeps its language.
- Saved drafts live in `MockState.drafts` with their owner (never returned). Someone else's draft answers `404`; an update whose `baseVersion` is not the stored version answers `409 conflict`; a create over the limit (`EngineOptions.draftsPerAccount`, default `appConfig.drafts.maxPerAccount`) answers `409 limit_reached`, except a create repeated with a `clientId` that already made one of the caller's drafts, which returns that draft unchanged. A missing or someone else's attachment is a `400` at `content.attachmentIds.<i>`. The list is most recently changed first. `createRequest` with a `draftId` deletes the caller's draft in the same operation; a refused submission keeps it.
- Several tabs: every save increments a revision, also written to its own key (`REVISION_KEY`, `ax-request-portal:mock-db:revision`). Before each request, and on a `storage` event, the store reads a newer save from another tab first, so tabs used in turn neither overwrite each other nor issue the same request number twice; a reset continues the numbering so other tabs follow it. After taking up another tab's change the mock sends `MOCK_DATA_CHANGED_EVENT`, and `DemoDataSync` invalidates every query (`keys.all`, debounced 150 ms). Two tabs saving at the same instant can still lose one change.
- When saving fails (storage full or blocked) the demo keeps working in memory: `reportMockStorageFull` raises `MOCK_STORAGE_FULL_EVENT` once per run of failures and remembers it until a listener calls `takeMockStorageFull` (the first save can fail before the app renders), and `DemoStorageNotice` shows one toast pointing to "reset demo data". A browser that blocks `localStorage` altogether starts the mock in memory. Notifications are capped at the newest 200 per person.

## Configuration

- Template users change `src/config/app.config.ts`: brand (per locale), organization (`timeZone`, an IANA name for the head office's business calendar, and `timeZoneLabel` per locale), locales and default locale, enabled roles, role permissions, request types, workflow (`scopeCheck`: ask the requester to confirm the AI's reading before developer review; the mock follows it and a real backend should read the same setting), mock timings, and `drafts.maxPerAccount` (saved drafts per account, 20; the API refuses more). `AppConfigSchema` validates it at start-up and refuses a configuration without `admin`, without an active role that can manage users, with a default locale that is not enabled, or with an unknown time zone.
- Colours are tokens in `src/index.css`; texts are in `src/i18n/`; demo accounts and seed data are in `src/mocks/seed.ts`.

## i18n

- Korean is the default and the source of truth: `ko.ts` exports `Messages`, and `en.ts` is typed as `Messages`, so a missing or extra key is a compile error. `t()` keys are type-checked, so a key picked at run time must keep its literal type (`'requests.wantedBy' as const`, or a union of keys); a plain `string` is a compile error (TS2345). With this many keys, passing `t` as a prop typed `ReturnType<typeof useTranslation>['t']` hits TS2589 (type instantiation too deep): call `useTranslation()` in the component instead.
- Initial language: stored preference (if enabled) → browser languages → `appConfig.defaultLocale`. `<html lang>` follows every change.
- Server-side texts (errors, notifications, AI report) follow `Accept-Language`; notifications are stored as key + parameters and rendered on read. Dates inside them are written per language with `readableDate` (`src/mocks/copy.ts`).

## Navigation and routes

- `NAV_ITEMS` is one permission-aware table that renders the desktop sidebar, the tablet icon rail and the phone tab bar (four tabs and a "more" sheet; whoever holds `request:create` finds "new request" as the middle tab, the same place on every account, and the other tabs follow `PHONE_PRIORITY`; `phoneTabs`). A route with `handle.focus` (the wizard) hides the phone tab bar. Every `page()` route has `handle.fit`: its page is built from `Page` parts and, on a big screen, fills the window with only its lists scrolling ([Frontend Profile](profiles/frontend.md)); the not-found route is the exception and scrolls the window.
- Every route sits under a pathless root route that renders `SessionSync` and has `RouteErrorPage` as its `errorElement`, so the login screen gets the app's error page too; `HydrateFallback` is on `/login` and `/`. A route's permission is declared once, as `handle.permission` (`RouteHandle`): `page()` wraps the lazy page in `RequirePermission`, and the post-login redirect reads the same handles. Old addresses are `moved(to)` routes with `handle.redirectTo`. Navigation items declare no permission of their own: `visibleNav` shows an item when every permission `permissionsFor(item.to)` returns (the `handle.permission` of each route the path matches) is held, so a menu never offers a page that would refuse. The router passes `permissionsFor` to `AppShell` as a prop; importing it would close a module cycle (the router renders the shell). `src/app/nav.test.ts` checks that every item links to a page of its own and is shown exactly when that page would open.

## Build and deploy

- `vite.config.ts` splits fixed vendor chunks with `build.rolldownOptions.output.codeSplitting.groups` (Vite 8 / Rolldown; the Rollup `manualChunks` option does not apply): react, router, query + zustand, i18n, zod (with `src/config/zod-jitless.ts`), ui, and one chunk per message file. Icons are deliberately left to the pages that use them.
- Build settings are checked by `checkEnv` (`src/config/env-check.ts`): `vite build` stops on an error, the dev server prints the same as warnings, `vite preview` and Vitest skip it. Errors: `VITE_API_MOCK` other than `true` / `false` / unset; with `false`, a missing `VITE_API_BASE_URL`, or one that is neither a path starting with `/` nor an http(s) URL, has spaces around it, carries a user name or password, a query or fragment, a placeholder host (reserved example domains, including the `.env.example` value), `.` or `..` segments, or is the same path the app is served from (`VITE_BASE`, so API calls would load the app's own pages). Warnings: plain `http` outside localhost, an API at the site root `/`, and any other origin (add it to `connect-src`, and to `img-src` if it serves images, and allow the app in its CORS settings). Messages hide credentials and queries, because build logs are often public. A mock build prints one line saying it is a demo.
- `__API_MOCK__` is defined as a literal from the same check, so a real-backend build folds the mock's dynamic imports away. `ax:drop-mock-worker` removes `mockServiceWorker.js` (copied from `public/`) from a real-backend build. `scripts/check-real-build.mjs` (`npm run check:real-build`, the last step of `npm run verify`) builds with `VITE_API_MOCK=false` into a temporary folder and fails when the worker, MSW, the mock handlers or the demo accounts are in it.
- Zod runs `jitless` (`src/config/zod-jitless.ts`, the first import of `main.tsx`, bundled in the `vendor-zod` chunk so it runs before any schema is built): otherwise Zod probes `new Function`, which the CSP reports as a violation on every page load.
- Production is static files behind nginx (`deploy/nginx.conf`). Two `map $uri` blocks choose `Cache-Control` (`/assets/` a year `immutable`, everything else `no-cache`) and the page CSP, and every header is set once at `server` level, none in a `location`. `Cache-Control` is set without `always`, so a `404` is not cached; the other headers are sent with every response, errors included. A missing asset answers `404` instead of HTML, the SPA falls back to `index.html`, and `/mockServiceWorker.js` has its own `location =` (a `404` in a real-backend build). An `/api/` proxy block and an HSTS line (for the TLS-terminating proxy) are provided commented out, as is a sub-path variant.
- Headers: `Content-Security-Policy`, `Permissions-Policy` (camera, microphone, geolocation, payment, USB and other device APIs off), `Cross-Origin-Opener-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. The CSP is `default-src 'self'`; `script-src 'self'` plus the SHA-256 hash of the inline theme script in `index.html` (no `unsafe-inline`, no `unsafe-eval`); styles and fonts from `self` and `cdn.jsdelivr.net` (the Pretendard stylesheet); `img-src 'self' data: blob:`; `connect-src 'self'`; `object-src 'none'`; `frame-ancestors 'none'`. The mock service worker gets no CSP: a worker follows its own script's policy, which would block its pass-through of the font requests. A backend or image host on another origin must be added to `connect-src` / `img-src`.
- The policy is written once, in `nginx.conf`. `deploy/csp-hashes.mjs` prints the hashes after the inline script changes; `src/config/deploy-config.test.ts` checks that the hashes match `index.html`, that external stylesheets and fonts are allowed and that the strict directives stay; `deploy/check-nginx.sh` (CI, against a running nginx, mock and real-backend builds) checks caching, fallbacks, the worker, compression, `version.json`, every header on every kind of response and the script hashes of the served `index.html`. `vite preview` reads the same policy (`pagePolicyOf`, `hasPagePolicy`) and sends it, so every E2E test runs under it.
- The GitHub Pages demo is a mock-mode build with `VITE_BASE=/<repository>/` and `404.html` copied from `index.html`.
- New-version notice: every build has an id (`VITE_BUILD_ID`, else the commit from `GITHUB_SHA` or git, else the build time) compiled in as `__BUILD_ID__` and written to `dist/version.json` by the `ax:version-file` plugin. `watchForUpdates` (production builds only) fetches `version.json` with a unique query, `cache: 'no-store'` (GitHub Pages caches files for 10 minutes) and a 10 s time limit, so a check that never answers does not block the next, when the tab becomes visible, every 5 minutes, on `vite:preloadError`, and when a lazy page fails to load (`checkForUpdateNow` in `page()`). A different id shows one persistent toast (`UpdateNotice`, id `app-update`) with a reload button, once per new id; it never reloads by itself. A failed page load still ends on `RouteErrorPage`; the toast explains it. nginx serves `version.json` through `location /` (`no-cache`); `deploy/check-nginx.sh` checks it.

## Evidence

- `src/api/contract.ts#symbol:EndpointSpec`, `src/api/contract.ts#symbol:timeoutOf`, `src/api/contract.ts#symbol:ApiErrorBody` — contract shape, time limits and error codes.
- `src/api/client.ts#symbol:call`, `src/api/client.ts#symbol:ClientHooks`, `src/lib/abort.ts#symbol:anySignal`, `src/api/client.test.ts` — headers, deadline, error mapping, 401 handling.
- `src/api/error-text.ts#symbol:errorText` — the message shown for a failure.
- `src/api/queries.ts#symbol:keys`, `src/api/queries.ts#symbol:onRequestChanged`, `src/api/queries.ts#symbol:storeRequest`, `src/api/queries.ts#symbol:requestScope`, `src/api/query-client.ts#symbol:createQueryClient`, `src/api/query-client.ts#symbol:isRetryable`, `src/api/query-client.test.ts` — cache rules, ordering and retries.
- `src/api/refresh.ts#symbol:refreshOf`, `src/components/ui/load-failed.tsx#symbol:LoadFailed`, `src/components/ui/load-failed.tsx#symbol:RefreshFailed`, `src/app/pages.tsx#symbol:RouteErrorView`, `src/app/update-check.ts#symbol:isChunkLoadError` — how failures are shown.
- `src/api/openapi.test.ts`, `src/domain/registry.ts#symbol:named` — OpenAPI generation and its test.
- `src/domain/url.ts#symbol:isSafeUrl` — URL rules of the contract.
- `src/main.tsx#symbol:MOCK_START_TIMEOUT_MS`, `src/main.tsx#symbol:BOOT_RELOAD_KEY` — boot recovery.
- `src/mocks/handlers.ts#symbol:createHandlers`, `src/mocks/engine.ts#symbol:STATE_VERSION`, `src/mocks/engine.ts#symbol:MockState` — mock server and its state, saved drafts included.
- `src/api/queries.ts#symbol:storeSavedDraft`, `src/api/queries.ts#symbol:dropSavedDraft`, `src/features/drafts/sync-engine.ts#symbol:DraftSyncEngine`, `src/features/drafts/hooks.ts#symbol:useDraftSync`, `src/stores/draft.ts#symbol:draftsKey` — the drafts cache, the sync engine and the drafts kept on this device.
- `src/config/app.config.ts#symbol:appConfig` — template settings, `drafts.maxPerAccount` included.
- `src/mocks/handlers.ts#symbol:MOCK_RESPONSE_HEADER`, `src/mocks/browser.ts#symbol:reattachIfBypassed`, `src/mocks/handlers.test.ts`, `e2e/mock-api.spec.ts` — recovery after the mock worker restarts.
- `src/mocks/store.ts#symbol:REVISION_KEY`, `src/mocks/store.ts#symbol:stateProblem`, `src/mocks/store.ts#symbol:createMockStore`, `src/mocks/store.test.ts` — persistence, shape check and tabs.
- `src/mocks/signals.ts#symbol:reportMockStorageFull`, `src/mocks/signals.ts#symbol:takeMockStorageFull`, `src/mocks/signals.ts#symbol:MOCK_DATA_CHANGED_EVENT`, `src/app/demo-data-sync.tsx#symbol:DemoDataSync`, `src/app/demo-storage-notice.tsx#symbol:DemoStorageNotice` — the mock's signals to the app.
- `src/config/env.ts#symbol:env`, `src/config/env-check.ts#symbol:checkEnv`, `src/config/env-check.ts#symbol:isApiMock`, `src/config/env-check.test.ts`, `src/config/schema.ts#symbol:AppConfigSchema` — configuration and build settings.
- `src/lib/time-zone.ts#symbol:hqToday`, `src/lib/time-zone.ts#symbol:sameOffset`, `src/lib/time-zone.ts#symbol:dateInTimeZone`, `src/lib/format.ts#symbol:formatDate`, `src/lib/format.ts#symbol:formatWeekday`, `src/lib/format.ts#symbol:describeDateTime`, `src/components/ui/date-time.tsx#symbol:DateTimeText`, `src/mocks/engine.ts#symbol:businessDate` — time rules; `src/lib/format.test.ts` — date-only values read the same day in every viewing and machine time zone.
- `src/lib/use-media-query.ts#symbol:useMediaQuery`, `src/lib/use-media-query.ts#symbol:FIT_QUERY`, `src/lib/use-media-query.test.ts` — viewport gates; the test keeps `FIT_QUERY` equal to the `fit:` variant in `src/index.css`.
- `src/lib/scrollbar-width.ts#symbol:trackScrollbarWidth` — the scrollbar gutter the page bands pad by.
- `src/i18n/index.ts#symbol:initialLocale`, `src/i18n/en.ts` — language selection and the typed English messages.
- `src/app/nav.ts#symbol:NAV_ITEMS`, `src/app/nav.ts#symbol:phoneTabs`, `src/app/nav.test.ts`, `src/app/router.tsx#symbol:RouteHandle`, `src/app/router.tsx#symbol:permissionsFor` — navigation table, phone tabs per role, route handles and the permissions the menus read from them.
- `vite.config.ts`, `deploy/nginx.conf`, `src/config/zod-jitless.ts`, `src/config/nginx-csp.ts#symbol:pagePolicyOf`, `src/config/deploy-config.test.ts`, `deploy/csp-hashes.mjs`, `scripts/check-real-build.mjs` — chunks, serving rules, CSP and the real-backend build check.
- `src/app/update-check.ts#symbol:watchForUpdates`, `src/app/update-notice.tsx#symbol:UpdateNotice`, `src/app/update-check.test.ts`, `e2e/update.spec.ts` — new-version notice; `src/vite-env.d.ts` — `__BUILD_ID__`, `__API_MOCK__` and `VITE_*` types; `deploy/check-nginx.sh` — serving checks.

## Open Questions

- The mock engine re-implements server-side authorization from `src/domain`; a real backend has to implement the same checks, and nothing in this repository verifies a backend against the contract beyond the OpenAPI document.
- The nginx configuration is first exercised on a real nginx in the CI `nginx` job; the sub-path variant in `deploy/nginx.conf` is commented out and not run in CI.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
