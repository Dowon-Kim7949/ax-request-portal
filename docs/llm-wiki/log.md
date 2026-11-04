---
title: LLM-WIKI Change Log
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: change_log
project: ax-request-portal
last_updated: 2026-11-04
author: cli-generated
last_edited_by: llm-wiki-cli
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

