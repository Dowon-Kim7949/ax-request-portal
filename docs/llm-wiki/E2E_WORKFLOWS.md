---
title: E2E Workflows
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: e2e_workflows
project: ax-request-portal
last_updated: 2026-11-04
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - playwright.config.ts
  - e2e
  - src/test/setup.ts
  - src/test/mock-api.ts
evidence:
  - .github/workflows/ci.yml#L45-L47
  - e2e/helpers.ts#symbol:openLoginScreen
  - e2e/helpers.ts#symbol:loginAs
  - e2e/boot.spec.ts
  - src/test/mock-api.ts#symbol:createTestApi
  - vite.config.ts
related:
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
visibility: public
contains_sensitive_info: false
---

# E2E Workflows

## Summary

Every user workflow is tested end to end against the production build with the in-browser mock API, on three device projects. Unit tests (Vitest + jsdom) cover the domain engine, the mock API, configuration, i18n and the contrast table. CI runs both on every push to `main` and every pull request.

## Playwright setup

- Projects in `playwright.config.ts`: `phone` (iPhone 14, WebKit), `tablet` (iPad gen 7, WebKit) and `desktop` (Desktop Chrome at 1440×900, Chromium). `layout.spec.ts` and `cursor.spec.ts` run on desktop only (they set their own viewports or need a fine pointer).
- `locale` is pinned to `ko-KR` and `colorScheme` to `light`: Playwright defaults to `en-US`, and the Korean UI is the default under test. English runs are explicit (`loginAsEnglish`, `i18n.spec.ts`).
- The web server is `npm run build && npm run preview -- --port 4173 --strictPort`; tests always hit a production build, never the dev server. Retries are 2 on CI and 0 locally; traces are kept on first retry.
- CI installs both `chromium` and `webkit` because phone and tablet are WebKit.

## Specs and the workflows they own

| Spec | Workflow verified |
| --- | --- |
| `requester.spec.ts` | Requester files a request through the wizard, and audit findings pasted from a table; the draft survives a reload; confirms acceptance criteria; answers a developer's questions; reacts to a preview in code review (#1024); confirms the AI's reading with choices and a note, and sends it back once (#1028). |
| `developer.spec.ts` | Developer reads the report's assumptions and a rule conflict (#1026), ticks the assumption to enable the run, runs AI work and approves the merge request, sees the preview and that the requester has not reacted (#1024), asks questions, requests a revision and sees the rework, marks a release done; the assigned and regression queues fit the screen. |
| `admin.spec.ts` | Executive reads the dashboard; admin changes a role and adds a project with a rule to keep, and cannot assign or change the operator role; notifications are read and their settings changed. |
| `operator.spec.ts` | Operator replaces a provider key (only the last four characters come back), moves a task to another model, cannot disconnect a provider in use, edits the exchange rate, reads the usage dashboard and its table view, and sets the budget at `/admin/budget` → `/ops/budget`; a developer then sees the request's AI usage and the run button disabled with the reason. |
| `smoke.spec.ts` | Login screen fits each viewport; per-device navigation (phone tab bar, tablet rail, desktop sidebar) reaches My requests and Schedule. |
| `layout.spec.ts` | No horizontal scroll on any route for any role at 320 px and on a landscape tablet, in Korean and English. |
| `i18n.spec.ts` | With an English browser no Korean text appears on any role's screens (elements with an explicit `lang` excluded); a request can be filed in English; switching language at runtime works; edited demo data keeps its language. |
| `theme.spec.ts` | System dark mode applies before first paint; no horizontal scroll in dark mode; an explicit light choice persists; the login-screen toggle works. |
| `a11y.spec.ts` | The skip link is the first tab stop and focuses `main` (desktop only: WebKit does not tab to links by default); nothing animates under `prefers-reduced-motion: reduce`. |
| `cursor.spec.ts` | Computed cursor of every visible interactive element matches the contract, including inside open dialogs. |
| `mock-api.spec.ts` | The service-worker mock answers contract calls such as `POST /api/auth/login` in the browser. |
| `boot.spec.ts` | Reloading during the first load still ends on a usable screen (regression for WebKit refusing the MSW worker registration). |
| `screens.spec.ts` | Only with `SCREENS=1`: captures screens for manual review; not an assertion suite. |
| `readme-images.spec.ts` | Only with `README_IMAGES=1`: regenerates the README screenshots in `docs/images/`. |

## Helpers and traps

- `openLoginScreen` clears the persisted session (`ax-request-portal:session`) while on `/favicon.svg`, a same-origin static file where the app is not running. Clearing it inside the app does not stick: an in-flight `/auth/me` response writes the session back through the auth guard. Retrying the clear made it worse.
- `loginAs` picks a demo account by its Korean role label, so renaming those labels breaks the suite.
- `boot.spec.ts` navigates with `waitUntil: 'commit'` and tolerates an `interrupted` navigation, because the app's own recovery may reload the page once; it then asserts the end state (a visible `h1`, no page errors other than the service-worker ones).
- `.all()` on a locator does not wait. Wait for the page heading first, then collect elements.
- A WebKit project can fail once with "browser has been closed" right after `playwright install`; a rerun passes.

## Unit tests

- Vitest runs in jsdom (`vite.config.ts`, `src/**/*.test.{ts,tsx}`), with tests next to the code they cover.
- `src/test/setup.ts` pre-seeds the preferences store with Korean and the light theme, because jsdom reports `en-US`. English behaviour has dedicated tests (`src/i18n/i18n.test.ts`, `src/mocks/language.test.ts`).
- `createTestApi` (`src/test/mock-api.ts`) builds an in-memory mock store with a fixed clock and an MSW node server with zero latency; `advance(seconds)` moves time so AI report and AI work stages complete deterministically.
- `src/App.test.tsx` imports the mock API modules in `beforeAll`: when the login screen's dynamic import grew to include the browser mocks, Linux CI alone hit a Vitest `EnvironmentTeardownError`.

## Evidence

- `e2e/helpers.ts#symbol:openLoginScreen` — session clearing on a static file and why.
- `e2e/helpers.ts#symbol:loginAs` — demo login by role label.
- `e2e/boot.spec.ts` — interrupted first load.
- `src/test/mock-api.ts#symbol:createTestApi` — deterministic mock API for unit tests.
- `vite.config.ts` — Vitest environment and include pattern.
- `playwright.config.ts` — projects, locale, web server; `.github/workflows/ci.yml#L45-L47` — browsers installed and the suite run in CI.

## Open Questions

- No component-level tests exist; UI behaviour is covered only through E2E.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
