---
title: LLM-WIKI Change Log
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: change_log
project: ax-request-portal
last_updated: 2026-11-09
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - llm-wiki.config.json
evidence:

related:
  - docs/llm-wiki/index.md
visibility: public
contains_sensitive_info: false
---

# LLM-WIKI Change Log

This is an append-only change log. Do not edit existing entries; add new changes at the top.

## 2026-11-09 - Fix: Korean day periods on older locale data; a draft-sync test race

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/lib/format.ts, src/lib/format.test.ts
  - src/features/drafts/sync-engine.test.ts
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
- summary:
  - `formatDateTime` maps the Korean day period to 오전 / 오후 through `formatToParts`, because CLDR 47 data (Node 22 and 24, Playwright's WebKit, browsers built on it) writes AM / PM. CI failed on that for Node 22.22.2, 24.15.0 and the phone and tablet E2E projects.
  - The sync-engine test API counts a delete once the server has answered, so a test that waits for it reads the account after the delete.
- evidence:
  - A test that feeds the old data's AM / PM fails without the mapping and passes with it; npx vitest run passes (57 files / 612 tests).
- caveats:
  - Only the Korean day period is mapped; other locale-data differences are not normalised.

## 2026-11-09 - Saved drafts on every home that may file requests; list step names; no unused draft hooks

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/features/home/home-page.tsx, src/features/home/home-page.test.tsx
  - src/features/drafts/rows.ts, src/features/drafts/drafts-section.tsx, src/features/drafts/drafts-section.test.tsx, src/i18n/ko.ts, src/i18n/en.ts (`wizard.checklist.name`)
  - src/api/queries.ts, src/api/queries.test.tsx
  - docs/llm-wiki: domains/05_home.md, domains/08_requests.md, domains/11_wizard.md
- summary:
  - Home shows the saved drafts to everyone with `request:create`: reviewers (developers, admins) get them after the developer queue, and only when they have a draft.
  - A draft row names the criteria step "Audit findings" for a `checklist` request, as its screen does.
  - Removed `useDraft`, `useCreateDraft`, `useUpdateDraft` and `DRAFT_MUTATION_KEY`, which only tests used; the sync engine orders each draft's saves itself.
- evidence:
  - npx vitest run on the changed areas passes; npm run lint, typecheck and format check pass.
- caveats:
  - Supersedes the caveat in the entry below that reviewers see their drafts on `/requests` only.

## 2026-11-09 - Feature: drafts saved to the account

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - Contract and mock: src/api/contract.ts (`DraftContent`, `SavedDraft*`, `RequestSubmission`, `DRAFT_ID_PATTERN`, error codes `conflict` / `limit_reached`, `EndpointSpec.conflict`, five `/drafts` endpoints: 41 in all), src/api/openapi.ts, docs/openapi.json, src/config/ (`drafts.maxPerAccount`), src/mocks/ (`MockState.drafts`, STATE_VERSION 6, `clientId`, per-account limit, `createRequest` deletes the named draft)
  - Client: src/api/queries.ts (`keys.drafts` / `keys.draft`, `useDrafts`, `storeSavedDraft`, `dropSavedDraft`), src/stores/draft.ts (drafts per person on this device, aliases, `clearDrafts`), src/stores/session.ts, src/features/drafts/ (sync engine, hooks, rows, saved-drafts section), src/features/wizard/ (`?draft=`, opening, save line, conflict and limit notices, submission with `draftId`), src/app/sign-out.tsx, src/app/shell.tsx, src/components/ui/sheet.tsx (focus return, `onCloseAutoFocus`), src/features/home/, src/features/requests/, src/i18n/
  - Tests: unit tests next to the code above (new: sync-core, sync-engine, rows, drafts-section, draft store, sign-out, sheet); e2e/drafts.spec.ts, e2e/helpers.ts (`seedSavedDrafts`, `keepDraftOffline`, `SEEDED_DRAFTS`), axe, i18n, requester and screens specs
  - docs/llm-wiki: domains/11_wizard.md, 08_requests.md, 05_home.md, 02_auth.md, 00_overview.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, GLOSSARY.md, E2E_WORKFLOWS.md, COMPONENT_INVENTORY.md, WCAG.md, profiles/frontend.md
  - README.md, README.ko.md
- summary:
  - A draft is written to this device as it is typed (`ax-request-portal:drafts:<userId>`) and saved to the account by a sync engine that sends one request at a time, a second after typing pauses and on step changes, leaving, hiding, start and reconnecting. The device keeps only what the account does not have yet.
  - Creates carry `clientId` so a lost answer makes no second draft; updates carry `baseVersion` and a `409 conflict` lets the person keep this screen's version or load the saved one; `409 limit_reached` (20 per account) keeps the draft on this device; a `404` continues it as a new draft.
  - The wizard names the draft in `?draft=` (a local id, then the server id), opens account drafts on any device, shows the save state under the progress bar and asks before leaving only when the words are kept nowhere. A submission names its draft and the server deletes it.
  - Saved drafts are listed on My requests (`#drafts`), on the requester's home and as a one-line notice on a new request, with badges for drafts on this device only and conflicts, continue and delete.
  - Signing out sends waiting drafts first (up to 3 s) and asks before deleting the ones only this device has; the account keeps its drafts. `Sheet` gives focus back to what opened it.
- evidence:
  - npx vitest run: 57 files / 611 tests pass; npx playwright test --list: 253 tests in 23 files.
  - npx llm-wiki validate --strict --agent claude passes.
- caveats:
  - The wizard's URL updates rely on React Router's `UNSAFE_DataRouterContext`.
  - Two tabs of one browser share one device copy of a draft (last writer wins on the device; typed words are protected by the conflict notice).
  - On home, the saved drafts are shown only in the requester section; people with `request:review` see them on `/requests` only.
  - The E2E offline emulation depends on the client reading the global `fetch` at each call.

## 2026-11-05 - Fix and feature: sessions, load failures, domain guards, deployment hardening, time zones

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - Sessions: src/stores/session.ts (end reasons), src/stores/draft.ts, src/app/session-sync.ts, src/app/guards.tsx, src/app/hooks.ts (`userCan`), src/app/router.tsx (pathless root, `RouteHandle`), src/features/auth/ (`post-login.ts`, expiry notice)
  - API and screens: src/api/ (client deadline, `timeoutOf`, `isRetryable`, `refresh.ts`, `error-text.ts`, mutation scopes, optimistic read), src/components/ui/load-failed.tsx, src/app/pages.tsx, every feature page, the wizard (debounced draft, leave confirmation, missing attachments)
  - Domain and mock: src/domain/ (`releaseDateMissing`, `checkBudgetLimits`, `url.ts`), src/mocks/ (STATE_VERSION 5, revision, `signals.ts`, attachment ownership, notification cap, `readableDate`), src/app/demo-data-sync.tsx, src/app/demo-storage-notice.tsx, docs/openapi.json
  - Deployment: src/config/env-check.ts, src/config/nginx-csp.ts, src/config/zod-jitless.ts, vite.config.ts (`__API_MOCK__`, `ax:drop-mock-worker`, `ax:preview-csp`), scripts/check-real-build.mjs, deploy/ (nginx.conf, check-nginx.sh, csp-hashes.mjs), src/app/demo-banner.tsx, .env.example, README.md
  - Time: src/config/app.config.ts (`organization`), src/lib/time-zone.ts, src/lib/format.ts, src/app/time-zone.ts, src/components/ui/date-time.tsx, src/features/settings/time-zone-section.tsx, src/stores/preferences.ts, the mock engine's business calendar
  - Tests: unit tests next to the code above; e2e/fixtures.ts and new specs auth, attachments, axe, csp, demo-banner, lifecycle, time-zone; layout.spec 320 px states; playwright.config.ts (time zone, `NOT_ON_TABLET`)
  - docs/llm-wiki: every document except index.md, back to `needs_review` (domains/00–13, ARCHITECTURE_CONVENTIONS, COMPONENT_INVENTORY, DOMAIN_FEATURES, E2E_WORKFLOWS, GLOSSARY, README, WCAG, project-profile, profiles/frontend)
- summary:
  - Signing out on purpose leads to `/login` without `next` and deletes the person's draft; a 401 ends the session only for the token it refused and keeps `next` with a notice; `resolvePostLoginPath` is the one reader of `next` (in-app, existing, not `/login`, permitted by `handle.permission`); tabs follow each other's sign-ins and sign-outs.
  - Every call has an endpoint time limit (30 s, uploads 120 s) and fails as an `ApiError`; only network, timeout and 5xx are retried; screens show `LoadFailed` when nothing loaded and keep data with `RefreshFailed` when a refresh fails; changes to one request run in order.
  - `markReleased` needs a scheduled date; budget limits share one rule; every URL in the contract passes `isSafeUrl`; the mock keeps tabs consistent through a revision, refuses someone else's attachment and caps notifications at 200 per person.
  - `vite build` refuses wrong build settings; a real-backend build carries no mock; nginx sends a strict CSP (inline script by hash), `Permissions-Policy` and COOP, and every E2E spec runs under that CSP; demo builds show a banner.
  - Timestamps show in the viewing time zone with head-office time where the clocks differ; date-only values never shift; "today" and totals follow the head-office business calendar; Settings has a time-zone card.
  - Accessibility: an axe-core scan of every main screen (phone and desktop, light and dark) with no excluded rules; decorative text in named controls is CSS-drawn (`Glyph`); `<dl>` groups hold only `<dt>`/`<dd>`; past schedule dates use a muted background instead of opacity.
  - E2E: the tablet `theme.spec` and desktop `admin.spec` time-outs came from cold starts between screens (now `openInApp` and `COLD_START_TIMEOUT`); WebKit on Windows stops animation frames for idle pages, so `e2e/fixtures.ts` keeps a frame loop running there; `lifecycle.spec` follows one request through every step on three viewports.
  - Corrected while re-reviewing: the contract has 36 endpoints (not 35); `operator` added to the glossary's roles; the feature list separates admin and operator features.
- evidence:
  - npm run verify (lint, format, typecheck, 44 unit test files / 437 tests, build, check:real-build) passes; full E2E 175 tests: 152 passed, 23 skipped by design (browser-specific or opt-in), 0 failed.
  - npx llm-wiki validate --strict --agent claude and npx llm-wiki impact --since main --strict pass.
- caveats:
  - The session's end reason lives in memory only: after reloading the login screen, only the permission check applies to `next`.
  - The nginx configuration is first run on a real nginx in the CI `nginx` job; the sub-path variant is a commented example.
  - The frame-loop fixture is installed for WebKit on Windows only; WebKit on Linux was not measured.
  - A viewer behind the head office's clock (e.g. North America) cannot pick their local "today" once the head office's date has moved on; the date inputs say so.

## 2026-11-04 - Feature: notice when a newer version is deployed

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - vite.config.ts (build id, `__BUILD_ID__`, `ax:version-file` plugin writing `version.json`), src/vite-env.d.ts, .env.example (`VITE_BUILD_ID`)
  - src/app/update-check.ts, src/app/update-notice.tsx (new), src/App.tsx, src/app/router.tsx (`page()` checks on a failed chunk load), src/i18n/ko.ts, src/i18n/en.ts (`update.*`)
  - deploy/check-nginx.sh (check 7: `version.json` present and `no-cache`), deploy/nginx.conf (comment only)
  - tests: src/app/update-check.test.ts, e2e/update.spec.ts (new)
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, E2E_WORKFLOWS.md, DOMAIN_FEATURES.md, COMPONENT_INVENTORY.md, WCAG.md, project-profile.md, profiles/frontend.md, domains/00_overview.md (status only: its claims still hold, re-review after the router change)
- summary:
  - Open tabs compare their build id with the deployed `version.json` when they become visible, every 5 minutes, and when page code fails to load; a newer id shows one persistent top-center toast with a 44 px reload button. Nothing reloads by itself.
- evidence:
  - e2e/update.spec.ts failed before the change (no notice) and passes after it on desktop/Chromium; src/app/update-check.test.ts covers once-per-build, unreadable files and shared requests.
  - node_modules/vite/dist/node/chunks/node.js (`handlePreloadError`): `vite:preloadError` fires only for imports that go through the preload helper, hence the extra check in `page()`.
- caveats:
  - The E2E spec runs only in Chromium: WebKit cannot route requests that pass through the mock's service worker. The phone layout was checked by screenshot at 390 px in Chromium.
  - On GitHub Pages a rerun of the deploy workflow for the same commit keeps the same id, so it is not announced.

## 2026-11-04 - Fix: mock API stops answering after its service worker restarts

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/mocks/handlers.ts (`MOCK_RESPONSE_HEADER` on every mock response), src/mocks/browser.ts (`reattachIfBypassed`), src/api/client.ts (`recover` hook, `ClientHooks` exported), src/main.tsx (wires the hook in mock mode)
  - tests: src/api/client.test.ts, src/mocks/handlers.test.ts (new), e2e/mock-api.spec.ts (worker-restart regression)
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, docs/llm-wiki/E2E_WORKFLOWS.md (both back to `needs_review`)
- summary:
  - A tab left alone in the mock-mode demo showed an error on every screen until a reload: the browser stopped the idle MSW worker, the restarted worker forgot the page (`activeClientIds` is in memory) and passed `/api` calls to the network, where GitHub Pages answers `404`.
  - A response without the mock's mark now makes the client re-send MSW's `MOCK_ACTIVATE`, wait for `MOCKING_ENABLED` (3 s at most) and resend the request once.
- evidence:
  - public/mockServiceWorker.js (`activeClientIds`, the bypass when it is empty), node_modules/msw/lib/browser/index.js (5 s `KEEPALIVE_REQUEST` timer)
  - e2e/mock-api.spec.ts failed before the fix with the same error screen and passes after it (desktop/Chromium).
- caveats:
  - `MOCK_ACTIVATE` / `MOCKING_ENABLED` are MSW's internal worker protocol; the E2E test is the guard on MSW upgrades and runs only in Chromium (CDP).
  - `domains/02_auth.md` cites `src/api/client.ts` and `src/mocks/handlers.ts` by symbol (compared file by file); its claims still hold, but once it is `verified` the impact gate will ask for it to be re-reviewed.

## 2026-11-04 - Feature: scope check, report assumptions and project rules, preview feedback, audit-finding requests

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/domain/model.ts, src/domain/lifecycle.ts, src/domain/precheck.ts, src/api/contract.ts, src/api/queries.ts, src/config/ (workflow.scopeCheck, request type `checklist`), docs/openapi.json
  - src/mocks/ (engine, ai, seed, handlers, copy, browser; STATE_VERSION 4), src/features/detail/ (scope-panels, preview-panels, developer-panels, request-content, request-detail-page), src/features/wizard/, src/features/admin/projects-page.tsx, src/i18n/, src/components/request/
  - unit tests (lifecycle, precheck, wizard schema, mock API, seed) and e2e (requester, developer, admin, plus the route sweeps in cursor, i18n, layout and theme)
  - docs/llm-wiki/domains/00_overview, 01_admin, 04_detail, 07_notifications, 11_wizard, 12_work, GLOSSARY.md, DOMAIN_FEATURES.md, E2E_WORKFLOWS.md, ARCHITECTURE_CONVENTIONS.md
- summary:
  - New status `scope_check` (requester's turn) between the report and developer review, with events `scopeReady`, `approveScope` and `reviseScope` (at most twice, counted against the per-request AI limit); reports with nothing to confirm still go straight to `review`.
  - Reports list unconfirmed assumptions and check every project rule (`Project.constraints`); the first `runWork` needs every assumption confirmed.
  - Work runs carry a preview; the requester's reaction (`PUT /requests/{id}/preview-feedback`) is advisory and does not change the status.
  - Request type `checklist`: audit findings, each one an acceptance criterion; the wizard imports them from a pasted table.

## 2026-11-03 - Feature: operator role, AI agents and provider-aware AI usage (Claude / GPT)

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/domain/ai.ts, src/config/ai.ts, src/domain/roles.ts, src/domain/model.ts, src/api/contract.ts, docs/openapi.json (35 endpoints)
  - src/mocks/ (engine, ai, seed, handlers, copy), src/features/ops/, src/features/detail/, src/features/admin/users-page.tsx, src/features/home/home-page.tsx, src/components/ai/, src/app/ (nav, router, shell)
  - e2e/operator.spec.ts and the role sweeps in admin, cursor, i18n, layout and theme specs
  - docs/llm-wiki/domains/13_ops.md (new), 00_overview, 01_admin, 02_auth, 04_detail, 05_home, 06_login, 12_work, index.md, DOMAIN_FEATURES.md, GLOSSARY.md, COMPONENT_INVENTORY.md, E2E_WORKFLOWS.md, ARCHITECTURE_CONVENTIONS.md
- summary:
  - New `operator` role holds `budget:manage`, `agent:manage` and `usage:view`; `admin` keeps people and projects and cannot assign or edit operators. The AI budget moved to `/ops/budget` (`/admin/budget` redirects).
  - AI usage is booked per call from each provider's own usage shape, normalized to one token shape and priced with the operator's table; developers see it per request and the run buttons are disabled at the per-request limit.
  - The per-request-limit open question in 01_admin is resolved and removed.
- evidence:
  - src/domain/ai.test.ts, src/mocks/api.test.ts ("AI budget", "AI operations"), src/lib/chart.test.ts, e2e/operator.spec.ts
- caveats:
  - Default prices were checked on 2026-11-03; OpenAI cache-write prices other than GPT-6 Astra are derived (1.25× input), and the exchange rate is a placeholder.
  - Codex `input_tokens` is assumed to include cached tokens, as in the Responses API.
  - Per-user ChatGPT or Claude subscription sign-in is not offered; see the open questions in domains/13_ops.md.

## 2026-11-03 - Fix: skip link, reduced motion, per-request AI limit, dashboard alert threshold

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/app/shell.tsx (SkipLink, focusable main), src/index.css (reduced-motion rule), src/i18n/ko.ts, src/i18n/en.ts (nav.skipToContent)
  - src/mocks/engine.ts (requestSpentKrw, limit check on runWork / requestRevision, aiAlertThresholdPct in the dashboard), src/mocks/copy.ts (requestBudgetExceeded)
  - src/domain/model.ts (DashboardSummary.aiAlertThresholdPct), docs/openapi.json (regenerated), src/features/dashboard/dashboard-page.tsx
  - src/mocks/api.test.ts (AI budget tests), e2e/a11y.spec.ts (new)
  - docs/llm-wiki/WCAG.md, domains/01_admin.md, domains/03_dashboard.md, domains/12_work.md, E2E_WORKFLOWS.md
- summary:
  - Closed four open questions recorded when the wiki was written. The dashboard contract gains `aiAlertThresholdPct`; a backend implementing the contract must return it.
  - The per-request limit is checked against spending already booked, not an estimate of the next run; 0 means no limit.
- evidence:
  - src/app/shell.tsx#symbol:SkipLink, src/index.css#L190-L203, src/mocks/engine.ts#symbol:requestSpentKrw, src/domain/model.ts#symbol:DashboardSummary
  - Red before the change, green after: src/mocks/api.test.ts "AI budget" (2 tests) and e2e/a11y.spec.ts (2 tests)
- caveats:
  - The skip link is tested on the desktop project only; WebKit does not tab to links by default.
  - The request page does not show how much of the per-request limit a request has used.

## 2026-11-03 - Wiki written from the code; governance raised to standard

- status: needs_review
- actor: claude-code
- scope: docs
- changed:
  - docs/llm-wiki/index.md, README.md, project-profile.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, GLOSSARY.md
  - docs/llm-wiki/COMPONENT_INVENTORY.md, WCAG.md, E2E_WORKFLOWS.md, profiles/frontend.md
  - docs/llm-wiki/domains/00_overview.md through 12_work.md
  - llm-wiki.config.json (mode `standard`, `impact.source_changed: error`), .github/workflows/llm-wiki.yml
- summary:
  - Replaced every placeholder with source-backed content in English. Domain documents follow the detected feature folders; `06_login` covers the screen and `02_auth` the session, guards and permissions.
  - Documents are `visibility: public` because the repository is public.
- evidence:
  - src/domain/lifecycle.ts, src/api/contract.ts, src/app/router.tsx, src/features/, src/mocks/, e2e/
- caveats:
  - Everything is `needs_review`; the CI gate on stale documents protects only `verified` documents, so it guards nothing until a person approves them.
  - Gaps found while writing, recorded as open questions: no skip link and no reduced-motion handling (WCAG.md); `perRequestLimitKrw` is not enforced and the dashboard's 80 % cost warning ignores `alertThresholdPct` (domains/01_admin.md).

## 2026-11-03 - LLM-WIKI initial documents created

- status: needs_review
- actor: llm-wiki-cli
- scope: docs
- changed:
  - docs/llm-wiki/
- summary:
  - Created the initial LLM-WIKI document structure with `llm-wiki init --write`.
- evidence:
  - package.json
- caveats:
  - This is a CLI-generated draft and requires human review.

