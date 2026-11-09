---
title: E2E Workflows
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: e2e_workflows
project: ax-request-portal
last_updated: 2026-11-09
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - playwright.config.ts
  - e2e
  - src/test/setup.ts
  - src/test/mock-api.ts
  - src/test/session.ts
evidence:
  - .github/workflows/ci.yml#L45-L47
  - e2e/fixtures.ts#symbol:keepFramesRunning
  - e2e/helpers.ts#symbol:openLoginScreen
  - e2e/helpers.ts#symbol:loginAs
  - e2e/helpers.ts#symbol:expectSignedIn
  - e2e/helpers.ts#symbol:openInApp
  - e2e/helpers.ts#symbol:signOut
  - e2e/helpers.ts#symbol:switchRole
  - e2e/helpers.ts#symbol:COLD_START_TIMEOUT
  - e2e/helpers.ts#symbol:seedSavedDrafts
  - e2e/helpers.ts#symbol:keepDraftOffline
  - e2e/helpers.ts#symbol:SEEDED_DRAFTS
  - e2e/drafts.spec.ts
  - src/components/ui/sheet.test.tsx
  - e2e/boot.spec.ts
  - e2e/mock-api.spec.ts
  - e2e/update.spec.ts
  - e2e/csp.spec.ts
  - e2e/axe.spec.ts
  - e2e/lifecycle.spec.ts
  - e2e/layout.spec.ts
  - src/test/mock-api.ts#symbol:createTestApi
  - src/test/session.ts#symbol:signInAs
  - src/config/nginx-csp.ts#symbol:hasPagePolicy
  - vite.config.ts
related:
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# E2E Workflows

## Summary

Every user workflow is tested end to end against the production build with the in-browser mock API, on three device projects. Unit tests (Vitest + jsdom) cover the domain engine, the mock API, configuration, i18n and the contrast table. CI runs both on every push to `main` and every pull request.

## Playwright setup

- Projects in `playwright.config.ts`: `phone` (iPhone 14, WebKit), `tablet` (iPad gen 7, WebKit) and `desktop` (Desktop Chrome at 1440×900, Chromium). `layout.spec.ts` and `cursor.spec.ts` run on desktop only (they set their own viewports or need a fine pointer); `axe.spec.ts` skips the tablet (`NOT_ON_TABLET`).
- `locale` is pinned to `ko-KR`, `colorScheme` to `light` and `timezoneId` to `Asia/Seoul` (the head office's): Playwright defaults to `en-US` and the machine's zone, and the Korean UI in head-office time is the default under test. English runs (`loginAsEnglish`, `i18n.spec.ts`), dark runs (`theme.spec.ts`) and other zones (`time-zone.spec.ts`) are explicit.
- The web server is `npm run build && npm run preview -- --port 4173 --strictPort`; tests always hit a production build, never the dev server. Locally an already running preview on port 4173 is reused (`reuseExistingServer` outside CI): make sure it serves the current build and nothing else holds the port. Retries are 2 on CI and 0 locally; traces are kept on first retry.
- `vite preview` sends the Content-Security-Policy of `deploy/nginx.conf` to every response except `mockServiceWorker.js` (`hasPagePolicy`, the `ax:preview-csp` plugin), so every spec runs under the production policy.
- Specs import `test` and `expect` from `e2e/fixtures.ts`, not from `@playwright/test`. Its automatic fixture keeps a `requestAnimationFrame` loop running in every page, only for WebKit on Windows: that port can stop producing frames for an idle page on a busy machine, and Playwright's "stable" check before each click or fill then waits until the test times out. A context a test creates itself needs `keepFramesRunning(context, browserName)`.
- CI installs both `chromium` and `webkit` because phone and tablet are WebKit.

## Specs and the workflows they own

| Spec | Workflow verified |
| --- | --- |
| `lifecycle.spec.ts` | One request from intake to release in one browser on all three viewports: the requester files it and confirms the AI's reading, the developer confirms the report's assumptions, runs the work and approves the merge request after the real-time mock AI (report 6 s, work 20 s), the requester checks every criterion, the developer finds "Released" disabled until a date is saved, then schedules and marks the release; roles change with `switchRole`, and every request is opened from a list, not a deep link. |
| `requester.spec.ts` | Requester files a request through the wizard, and audit findings pasted from a table; the draft is saved to the account and the reload keeps the same `?draft=` address, step and words; confirms acceptance criteria; answers a developer's questions; reacts to a preview in code review (#1024); confirms the AI's reading with choices and a note, and sends it back once (#1028). |
| `drafts.spec.ts` | Saved drafts: typing saves a draft, which is listed on home and My requests and continues at the same step and words (the new-request notice leads to `#drafts`); another device (a new browser context with only the mock data copied) lists and continues it; signing out with a draft the account could not take asks first, leaves no draft key in `localStorage`, and the account still has its drafts after signing in again; deleting from the list moves focus to the section heading; a submitted draft leaves the list; at 320 px nothing scrolls sideways and targets are 44 px; on desktop pointer cursors, the focus ring and a busy, Escape-proof sheet while deleting; dark colours. |
| `auth.spec.ts` | Signing out of an admin page and in as a requester starts at home; a deep link opened signed out returns there after signing in; a `next` the new user may not open lands on home; a signed-in visit to `/login?next=/login` goes home once. |
| `attachments.spec.ts` | A PNG attached in the wizard is kept inline by the demo and, from the request page, opens in a new tab through a `blob:` URL. |
| `time-zone.spec.ts` | A viewer in Los Angeles sees local time with Korea time beside it on detail screens, can turn Korea time off, and a zone picked in Settings wins over the device; a viewer in Seoul sees nothing added; date-only values read the same date in both zones. |
| `developer.spec.ts` | Developer reads the report's assumptions and a rule conflict (#1026), ticks the assumption to enable the run, runs AI work and approves the merge request, sees the preview and that the requester has not reacted (#1024), asks questions, requests a revision and sees the rework, marks a release done; the assigned and regression queues fit the screen. |
| `admin.spec.ts` | Executive reads the dashboard; admin changes a role and adds a project with a rule to keep, and cannot assign or change the operator role; notifications are read and their settings changed. |
| `operator.spec.ts` | Operator replaces a provider key (only the last four characters come back), moves a task to another model, cannot disconnect a provider in use, edits the exchange rate, reads the usage dashboard and its table view, and sets the budget at `/admin/budget` → `/ops/budget`; a developer then sees the request's AI usage and the run button disabled with the reason. |
| `smoke.spec.ts` | Login screen fits each viewport; per-device navigation (phone tab bar, tablet rail, desktop sidebar) reaches My requests and Schedule. |
| `layout.spec.ts` | No horizontal scroll on any route for any role at 320 px and on a landscape tablet, in Korean and English. At 320 px, the notices and error states that only appear in some conditions (demo banner, time-zone settings and a detail screen with both clocks, session-expired notice, compact and full `LoadFailed`) lie inside the viewport and do not clip their text. |
| `demo-banner.spec.ts` | A demo build says so on the login screen and on signed-in screens, without a close button and without widening a phone screen. |
| `csp.spec.ts` | The page carries the production policy, and walking the requester's, operator's and executive's screens (one test each) raises no CSP violation event and no console error. |
| `axe.spec.ts` | axe-core finds nothing serious or critical on the login screen and every role's main screens, light and dark, and on the saved drafts (home, the expanded list with both badges, the delete sheet, the new-request notice) (see [Accessibility](WCAG.md)). |
| `i18n.spec.ts` | With an English browser no Korean text appears on any role's screens (elements with an explicit `lang` excluded); a request can be filed in English; the saved drafts (list, badges, delete sheet, new-request notice) are in English; switching language at runtime works; edited demo data keeps its language. |
| `theme.spec.ts` | System dark mode applies before first paint; no horizontal scroll in dark mode; an explicit light choice persists; the login-screen toggle works. |
| `a11y.spec.ts` | The skip link is the first tab stop and focuses `main` (desktop only: WebKit does not tab to links by default); nothing animates under `prefers-reduced-motion: reduce`. |
| `cursor.spec.ts` | Computed cursor of every visible interactive element matches the contract, including inside open dialogs. |
| `mock-api.spec.ts` | The service-worker mock answers contract calls such as `POST /api/auth/login` in the browser; after the worker is stopped (as a browser does to an idle tab), the next screen still loads its data (Chromium only). |
| `update.spec.ts` | A newer `version.json` shows the new-version toast when the tab becomes visible and its reload button loads the page; a page chunk that 404s after a deployment shows the same toast and the chunk-failure error page, whose button ("Load again") is not confused with the toast's reload button (Chromium only). |
| `boot.spec.ts` | Reloading during the first load still ends on a usable screen (regression for WebKit refusing the MSW worker registration). |
| `screens.spec.ts` | Only with `SCREENS=1`: captures screens for manual review; not an assertion suite. |
| `readme-images.spec.ts` | Only with `README_IMAGES=1`: regenerates the README screenshots in `docs/images/`. |

## Helpers and traps

- `openLoginScreen` (used by `loginAs` / `loginAsEnglish`) clears the persisted session (`ax-request-portal:session`) while on `/favicon.svg`, a same-origin static file where the app is not running. Clearing it inside the app does not stick: an in-flight `/auth/me` response writes the session back through the auth guard. Retrying the clear made it worse.
- Signing in moves on twice (the sign-in call's success, then the login screen's own redirect once it sees the session), and the URL changes before the screen does. `loginAs` therefore waits until the login form has gone (`expectSignedIn`) before the test moves on; a move made in between can be overtaken.
- Move between screens after signing in with `openInApp(page, path)`: it pushes a history entry and a `popstate` the way the back and forward buttons do, then waits until the old screen's `h1` has gone. `page.goto` restarts the app and its mock (2–4 s in WebKit under a parallel run); use it only where the start itself is under test, and give a first screen after a full load `COLD_START_TIMEOUT` (10 s, above the app's own 8 s `MOCK_START_TIMEOUT_MS`).
- `signOut(page, viewport)` uses the phone's "more" sheet or the account menu; `switchRole` signs out (to `/login` without `next`) and starts again from a demo button, as a person handing the device over would.
- `loginAs` picks a demo account by its Korean role label, so renaming those labels breaks the suite.
- Reproducing conditions from a static page (`/favicon.svg`, the app not running): a load failure — store one request's title in `ax-request-portal:mock-db` as a number, which the client rejects as `contract_violation` and does not retry, so `LoadFailed` shows at once; a session expiry — replace the stored token with `mock-token.no-such-user`, so the next call is a `401`.
- `boot.spec.ts` navigates with `waitUntil: 'commit'` and tolerates an `interrupted` navigation, because the app's own recovery may reload the page once; it then asserts the end state (a visible `h1`, no page errors other than the service-worker ones). Leave the login screen only after the app has started: leaving it during the first load races WebKit's service-worker installation.
- The worker-restart test in `mock-api.spec.ts` stops the service worker with the Chrome DevTools Protocol (`ServiceWorker.stopAllWorkers`), so it is skipped in the WebKit projects (phone, tablet). It then opens a screen whose data is not cached yet, without reloading, because a reload would register the worker again and hide the bug.
- `update.spec.ts` fakes a deployment by routing `version.json` and a page chunk on both the page and its context: with the mock's service worker in between, Chromium shows a request the worker passes on only to context routes, and WebKit shows it to neither, so the spec skips WebKit. It waits for each `version.json` response, because checks made while one is in flight share its answer.
- The wizard registers `beforeunload` while something is written. Playwright accepts that dialog automatically only when no listener is registered, so a test that reloads or leaves a filled wizard must handle the dialog.
- Saved drafts: `seedSavedDrafts` (signed in, then reload) makes four account drafts plus, on this device, newer words over one of them that was saved elsewhere since (a conflict) and a draft the account does not have; titles per language are `SEEDED_DRAFTS`. `keepDraftOffline` makes saving one draft fail like a lost connection by wrapping `window.fetch` in an init script: `page.route` does not see requests the mock's service worker answers. It relies on the client looking up the global `fetch` at each call (`src/api/client.ts`).
- A draft is saved to the account about a second after typing stops (`DRAFT_SYNC_DELAY_MS`); wait for "계정에 저장됨" before reloading or switching device.
- `.all()` on a locator does not wait. Wait for the page heading first, then collect elements.
- A WebKit project can fail once with "browser has been closed" right after `playwright install`; a rerun passes.
- Resolved: `theme.spec.ts` on the tablet and `admin.spec.ts` on the desktop used to time out after 5 s in parallel runs. The cause was the cold start of `page.goto` between screens; they now walk with `openInApp` and wait `COLD_START_TIMEOUT` for the first screen.

## Unit tests

- Vitest runs in jsdom (`vite.config.ts`, `src/**/*.test.{ts,tsx}`), with tests next to the code they cover.
- `src/test/setup.ts` pre-seeds the preferences store with Korean and the light theme, because jsdom reports `en-US`, and skips that in files that opt into `@vitest-environment node` (no `localStorage` there). English behaviour has dedicated tests (`src/i18n/i18n.test.ts`, `src/mocks/language.test.ts`).
- The upload tests (`src/mocks/attachments.test.ts`) run in the Node environment: jsdom's `fetch` cannot parse multipart bodies.
- `src/test/session.ts` signs a person in through the mock API (`signInAs`) and makes a query client without retries for screen tests.
- Screen tests that wait for a draft to reach the account allow 4 s (`SYNCED` in `wizard-page.test.tsx`) because of the 1 s sync delay.
- `createTestApi` (`src/test/mock-api.ts`) builds an in-memory mock store with a fixed clock and an MSW node server with zero latency; `advance(seconds)` moves time so AI report and AI work stages complete deterministically.
- `src/App.test.tsx` imports the mock API modules in `beforeAll`: when the login screen's dynamic import grew to include the browser mocks, Linux CI alone hit a Vitest `EnvironmentTeardownError`.

## Evidence

- `e2e/fixtures.ts#symbol:keepFramesRunning` — the WebKit-on-Windows frame loop.
- `e2e/helpers.ts#symbol:openLoginScreen`, `e2e/helpers.ts#symbol:loginAs`, `e2e/helpers.ts#symbol:expectSignedIn` — session clearing on a static file, demo login by role label, waiting for both moves.
- `e2e/helpers.ts#symbol:openInApp`, `e2e/helpers.ts#symbol:COLD_START_TIMEOUT`, `e2e/helpers.ts#symbol:signOut`, `e2e/helpers.ts#symbol:switchRole` — moving inside the app and changing roles.
- `e2e/boot.spec.ts` — interrupted first load.
- `e2e/mock-api.spec.ts` — mock API in the browser and recovery after its worker restarts.
- `e2e/update.spec.ts` — new-version notice.
- `e2e/csp.spec.ts`, `src/config/nginx-csp.ts#symbol:hasPagePolicy`, `vite.config.ts` — the production policy under test; Vitest environment and include pattern.
- `e2e/axe.spec.ts`, `e2e/lifecycle.spec.ts`, `e2e/layout.spec.ts` — accessibility scan, the whole lifecycle, conditional states at 320 px.
- `e2e/drafts.spec.ts`, `e2e/helpers.ts#symbol:seedSavedDrafts`, `e2e/helpers.ts#symbol:keepDraftOffline`, `e2e/helpers.ts#symbol:SEEDED_DRAFTS` — saved drafts and how their states are set up.
- `src/components/ui/sheet.test.tsx` — a component-level test of `Sheet`'s focus return.
- `src/test/mock-api.ts#symbol:createTestApi`, `src/test/session.ts#symbol:signInAs` — deterministic mock API and signed-in screens for unit tests.
- `playwright.config.ts` — projects, locale, time zone, web server; `.github/workflows/ci.yml#L45-L47` — browsers installed and the suite run in CI.

## Open Questions

- Few component-level tests exist (`DateTimeText`, `Sheet`, the saved-drafts section, some screens through `src/test/session.ts`); most UI behaviour is covered through E2E.
- Cursor, focus-ring and 320 px checks for the saved drafts live in `drafts.spec.ts`, not in `cursor.spec.ts` / `layout.spec.ts`.
- `fixtures.ts` keeps frames running only on Windows; WebKit on Linux (CI) was not measured for the same stall.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
