# AX Request Portal

[![CI](https://github.com/Dowon-Kim7949/ax-request-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/Dowon-Kim7949/ax-request-portal/actions/workflows/ci.yml)
[![Pages demo](https://github.com/Dowon-Kim7949/ax-request-portal/actions/workflows/pages.yml/badge.svg)](https://dowon-kim7949.github.io/ax-request-portal/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**English** · [한국어](README.ko.md)

A responsive React template for an **AI-assisted work request portal**. People who don't write code (planning, sales, management) file structured requests. An AI checks whether each request can be done, a developer decides, the AI does the work up to a merge request, and people verify and release it.

> **AI executes, people decide.** The AI never merges, never approves its own wiki edits, and never moves a request past a human checkpoint.

**[Live demo](https://dowon-kim7949.github.io/ax-request-portal/)**: runs entirely in your browser against a mock API. Sign in with one tap as requester, executive, developer, admin or operator (password `demo`). Use "reset demo data" in the account menu to start over. The demo speaks English or Korean (it follows your browser; switch on the sign-in screen or in Settings) and has light and dark themes.

|                                 Requester (phone)                                  |                                           Wizard (phone)                                            |                                           QA checklist (phone)                                           |
| :--------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------: |
| <img src="docs/images/phone-home.png" width="230" alt="Requester home on a phone"> | <img src="docs/images/phone-wizard.png" width="230" alt="Request wizard, acceptance criteria step"> | <img src="docs/images/phone-verify.png" width="230" alt="Checking a result against acceptance criteria"> |

|                                           Developer review (desktop)                                           |                             Executive dashboard (tablet)                              |
| :------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------: |
| <img src="docs/images/desktop-review.png" width="520" alt="Developer reviewing AI work and the merge request"> | <img src="docs/images/tablet-dashboard.png" width="300" alt="Company-wide dashboard"> |

|                                     Dark mode (phone)                                     |                                       English (phone)                                       |
| :---------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: |
| <img src="docs/images/phone-home-dark.png" width="230" alt="Requester home in dark mode"> | <img src="docs/images/phone-verify-en.png" width="230" alt="Checking a result, in English"> |

## What's inside

- **Every screen works on phones, tablets and desktops.** One permission-driven nav table renders a tab bar on phones, an icon rail on tablets and a sidebar on desktops. The e2e suite runs every flow on all three, plus a 320 px phone and a landscape tablet.
- **A request lifecycle you can trust.** One transition table decides who can move a request where. The UI shows buttons from it, the mock API enforces it, and a backend can port it as-is.
- **One API contract, three consumers.** `src/api/contract.ts` produces the typed client, the mock API handlers and [`docs/openapi.json`](docs/openapi.json). The client validates every response, so a drifting backend fails loudly.
- **Works with no backend.** An in-browser mock API (MSW) with fictional demo data and a simulated AI that writes reports and opens merge requests in seconds. Progress survives reloads.
- **Drafts that follow the person.** The request wizard keeps what is typed on the device at once and saves it to the account a second later, so a request half-written on a phone continues on a laptop, after a reload or without a connection. Saved drafts are listed on the home screen and under My requests. A version saved elsewhere in the meantime is never overwritten silently: the wizard asks which one to keep. Signing out asks before deleting drafts that never reached the account.
- **AI usage you can account for, on Claude and GPT.** An operator picks the model for each AI task (Claude or GPT through their APIs; a Claude agent built on the Claude Agent SDK, or Codex, for AI work), per project if needed, and keeps the price table and exchange rate. Every AI call is booked from the provider's own token report, normalized (Claude and OpenAI count cached tokens differently) and priced once. Developers see what each request cost and why a run is blocked at its limit; the operator gets a usage dashboard by provider, day, model, task and request. Costs are estimates; the bill is in each provider's console. Provider keys are write-only.
- **Plain language for non-developers.** Requesters see "checking / needs your answer / please check the result". Developers see the precise state. All copy lives in one dictionary per language.
- **English and Korean.** The language follows the browser until the user picks one. Dates and amounts follow it too. Every API call sends `Accept-Language`, and the mock API answers in it the way a real backend should: errors, notifications and the simulated AI's reports come back in the user's language. The type checker fails if the two dictionaries drift apart.
- **Light and dark.** The theme follows the system unless the user chooses one. It is applied by a tiny script in `<head>` before the app loads, so a dark page never flashes white. Colors are role tokens (text, fill, border, status) with their own dark values, and a unit test checks the text and control color pairs the UI uses against WCAG AA in both themes.

## Request lifecycle

```mermaid
stateDiagram-v2
  direction LR
  [*] --> submitted
  submitted --> reporting: AI starts report
  reporting --> review: report ready
  review --> in_progress: developer runs work
  review --> info_needed: developer asks
  info_needed --> reporting: requester answers
  review --> rejected
  info_needed --> rejected
  in_progress --> code_review: AI opens MR
  code_review --> in_progress: revision requested
  code_review --> verification: developer approves
  verification --> changes_requested: requester reports a failed criterion
  changes_requested --> in_progress
  verification --> release_scheduled: every criterion passed
  release_scheduled --> done: released
  submitted --> cancelled
  reporting --> cancelled
  review --> cancelled
  info_needed --> cancelled
```

The table lives in [`src/domain/lifecycle.ts`](src/domain/lifecycle.ts). Unit tests check that every status is reachable, no open status is a dead end, and only the right person can fire each event. AI and system events are never accepted from clients.

## Roles

| Role      | Can                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requester | File requests through a one-question-per-screen wizard, answer the developer's questions, check the result against the acceptance criteria, see the release schedule |
| Executive | Everything a requester can, plus the company-wide dashboard                                                                                                          |
| Developer | Read the AI's feasibility report, run the AI, ask or reject, review the AI's merge request, record regression checks, schedule and mark releases                     |
| Admin     | Projects (repository, wiki, owners, screens), users and roles                                                                                                        |
| Operator  | Runs the service's AI: provider keys, model per task and project, prices and exchange rate, AI budget, usage dashboard                                               |

Roles are permission sets in [`src/domain/roles.ts`](src/domain/roles.ts). To drop the executive role, remove it from `enabledRoles` in the config and give `dashboard:view` to someone else. Operator accounts are created by the service (database, seed or an identity-provider group), never by an admin; the demo has one (`operator@example.com`).

## Getting started

Click **Use this template** on GitHub, or:

```bash
git clone https://github.com/Dowon-Kim7949/ax-request-portal.git
cd ax-request-portal
npm ci
npm run dev
```

Open the printed URL and pick a demo account. Node 22.22.2+, 24.15+ or 26+ is required (`.nvmrc` pins 24; React Router 8 and jsdom 30 set that floor). CI checks the floor of each line: 22.22.2, 24.15.0 and 26.0.0.

| Script             | What it does                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `npm run dev`      | Dev server with the mock API                                                                  |
| `npm run build`    | Production build into `dist/`                                                                 |
| `npm run verify`   | oxlint, Prettier check, typecheck, unit tests, build, real-backend build check (what CI runs) |
| `npm run test:e2e` | Playwright on phone (WebKit), tablet (WebKit) and desktop (Chromium)                          |
| `npm run openapi`  | Regenerate `docs/openapi.json` after changing the contract                                    |

## Make it yours

| Change                                                                       | Where                                                                                                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Name, short logo text, tagline, enabled roles, request types, mock AI timing | [`src/config/app.config.ts`](src/config/app.config.ts) (validated at startup)                                         |
| Offered languages and the fallback language                                  | `locales` and `defaultLocale` in [`src/config/app.config.ts`](src/config/app.config.ts)                               |
| Colors, radius, font                                                         | `@theme` (light) and `.dark` blocks in [`src/index.css`](src/index.css), checked by `src/theme.test.ts`               |
| Every piece of UI text                                                       | [`src/i18n/en.ts`](src/i18n/en.ts) and [`src/i18n/ko.ts`](src/i18n/ko.ts)                                             |
| Who can do what                                                              | [`src/domain/roles.ts`](src/domain/roles.ts) and [`src/domain/lifecycle.ts`](src/domain/lifecycle.ts)                 |
| Demo data                                                                    | [`src/mocks/seed.ts`](src/mocks/seed.ts) (built by running the real lifecycle, so it can't contain impossible states) |

### Add a language

1. Copy `src/i18n/en.ts` to `src/i18n/<code>.ts` and translate it. It is typed against the Korean dictionary, so a missing or extra key is a compile error, and `src/i18n/i18n.test.ts` checks that every `{{placeholder}}` survives.
2. Add the code to `LOCALES`, `LOCALE_LABEL` and `INTL_LOCALE` in [`src/i18n/locales.ts`](src/i18n/locales.ts), and to `resources` in [`src/i18n/index.ts`](src/i18n/index.ts).
3. Add it to `locales` and give `brand.name` and `brand.tagline` a value for it in the config.

The mock backend's own texts (errors, notifications, simulated AI reports, demo data, the submission check) exist in English and Korean only, and fall back to Korean for other languages. A real backend replaces all of them.

## Environment variables

Set at build time, in the environment or in `.env.local` (copy [`.env.example`](.env.example)).

| Variable            | Default    | Meaning                                                                                                 |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`         | `/`        | Public path the app is served from, e.g. `/ax/` for `https://host/ax/`                                  |
| `VITE_API_MOCK`     | `true`     | `true` or unset: demo mode on the in-browser mock API. `false`: call the backend at `VITE_API_BASE_URL` |
| `VITE_API_BASE_URL` | none       | Required when `VITE_API_MOCK=false`: a same-origin path such as `/api`, or a full `https://` URL        |
| `VITE_BUILD_ID`     | the commit | Written to `version.json`; open tabs offer a reload when the deployed id changes                        |

- **Demo mode is visible.** With the mock API, whatever people enter stays in their own browser. The login screen and every signed-in screen show a small "Demo mode · Data stays in this browser only" banner that cannot be closed, so a demo build deployed by mistake is obvious. A real-backend build never shows it.
- **Bad settings fail the build.** `vite build` stops with a message when `VITE_API_MOCK` is anything but `true`, `false` or unset, or when `VITE_API_MOCK=false` comes without a usable `VITE_API_BASE_URL` (missing, not a URL or path, credentials, a query string, `.` or `..` path segments, the path the app itself is served from, or the `.env.example` placeholder). A fresh clone still builds as is, in demo mode. The dev server prints the same findings as warnings. The rules live in [`src/config/env-check.ts`](src/config/env-check.ts).
- **A real-backend build ships no mock:** neither `mockServiceWorker.js` nor the mock API and its demo data (accounts, password) end up in `dist/`. `npm run verify` builds one and checks ([`scripts/check-real-build.mjs`](scripts/check-real-build.mjs)).
- **A backend on another origin** (`VITE_API_BASE_URL=https://api.your-company.com`) must also be allowed by the page: add its origin to `connect-src` in the Content-Security-Policy in [`deploy/nginx.conf`](deploy/nginx.conf) (and to `img-src` if it serves attachments or preview screenshots), and allow the app's origin in the backend's CORS settings. The build prints this reminder. A same-origin `/api` needs neither.

## Connect a real backend

1. Implement the endpoints in [`docs/openapi.json`](docs/openapi.json). Requests carry `Authorization: Bearer <token>` from `POST /auth/login`. Errors use the `ApiError` body (`code`, `message`, optional `issues`). A transition that doesn't fit the current status is a `409`. Saved drafts (`/drafts`) belong to the person who wrote them: an update over an old `baseVersion` is `409 conflict`, a create beyond `drafts.maxPerAccount` in [`src/config/app.config.ts`](src/config/app.config.ts) is `409 limit_reached`, and a request created with a `draftId` deletes that draft. Requests also carry `Accept-Language`: write error messages, notifications and AI text in that language.
2. Apply the same visibility rules as the mock API. A person may open a request they filed, one they develop, or any with `request:read:all`; any other id is a `404`. The release schedule (`GET /releases`) is company-wide, but each listed request carries `canOpen` by that same rule, and the screen links only those. My requests searches with `q` (a title substring or an exact `#id`), so search on the server. List in `notifications.channels` (in [`src/config/app.config.ts`](src/config/app.config.ts)) only the channels your backend sends besides in-app; the settings screen offers a switch for each listed one.
3. Enforce the lifecycle on the server. [`src/domain/lifecycle.ts`](src/domain/lifecycle.ts) and [`src/domain/report.ts`](src/domain/report.ts) are plain TypeScript with no browser dependency. Port them or import them.
4. Run the two AI jobs server-side: the feasibility report (read-only access to the code and wiki) and the work run (branch → tests → merge request). The UI polls a request while its status is `submitted`, `reporting` or `in_progress`.
5. Build against it:

   ```bash
   VITE_API_MOCK=false VITE_API_BASE_URL=/api npm run build
   ```

With `VITE_API_MOCK=false` the mock code is not in the build and the demo banner is gone. See [Environment variables](#environment-variables).

## Deploy with nginx

```bash
npm run build
cp -r dist/* /usr/share/nginx/html/
cp deploy/nginx.conf /etc/nginx/conf.d/ax-request-portal.conf   # set server_name, root
nginx -t && nginx -s reload
```

[`deploy/nginx.conf`](deploy/nginx.conf):

- sends unknown paths to `index.html` so deep links work;
- caches `/assets/*` for a year (file names are content-hashed);
- never caches `index.html`, `version.json` or the service worker;
- answers a missing asset with `404` instead of HTML, and doesn't let that `404` be cached;
- sends security headers on every response: a Content-Security-Policy, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`.

The Content-Security-Policy allows the app's own files, the Pretendard web font from `cdn.jsdelivr.net`, and the one inline script in `index.html` (it applies the saved theme before the first paint) by its SHA-256 hash. `npm run preview` sends the same policy, read from this file, so every E2E test runs under it and `e2e/csp.spec.ts` fails on any violation. Three things to keep in step with it:

- **Changing that inline script** changes its hash. Print the new one with `node deploy/csp-hashes.mjs index.html` and replace it in `script-src`. The unit tests and the nginx check fail until you do.
- **A backend on another origin** goes into `connect-src`, e.g. `connect-src 'self' https://api.your-company.com`.
- **Images from another origin** go into `img-src`: attachment thumbnails and preview screenshots are shown from the URLs the API returns, so add the backend, file store or preview hosts that serve them, e.g. `img-src 'self' data: blob: https://api.your-company.com`. The demo keeps them in the browser (`data:`, `blob:`), so it needs nothing more.

`Strict-Transport-Security` is left as a commented example: set it where TLS terminates (nginx itself or the load balancer in front of it). The file also has a commented `/api` reverse proxy and a complete sub-path variant (build with `VITE_BASE=/ax/`). The CI `nginx` job serves a demo build and then a real-backend build with this exact file in `nginx:stable-alpine` and checks all of the above with [`deploy/check-nginx.sh`](deploy/check-nginx.sh); run the same script against your own deployment, sub-path included (`bash deploy/check-nginx.sh https://host/ax`). CI does not exercise the sub-path variant itself.

Vendor code is split into stable chunks (`vendor-react`, `vendor-router`, …), so an app-only release changes about 15 KB gzip and browsers keep the rest cached. UI copy for both languages has its own `messages` chunk (12 KB gzip), so a wording change doesn't invalidate app code either.

## GitHub Pages demo

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds in mock mode with `VITE_BASE=/<repository>/` and publishes on every push to `main`. In a repository made from this template, set **Settings → Pages → Source** to **GitHub Actions**. For a user site or a custom domain, set `VITE_BASE` to `/`.

Pages has no SPA fallback, so the workflow copies `index.html` to `404.html`. A deep link such as `/requests/1024` therefore opens the right screen but with HTTP status `404`: browsers show it normally, while link checkers and crawlers report it as missing. The nginx deployment answers the same path with `200`.

## Project layout

```
src/
  domain/      lifecycle, roles, models (Zod), report and precheck rules
  api/         contract, typed client, TanStack Query hooks, OpenAPI builder
  mocks/       in-browser backend: engine, simulated AI, seed, MSW handlers, server texts
  config/      template config and build-time env
  app/         router, guards, responsive shell, navigation, theme and language
  components/  ui primitives (Radix-based) and request widgets
  features/    one folder per screen
  i18n/        UI copy, one dictionary per language
e2e/           Playwright specs (run on three viewports)
deploy/        nginx config and its checks
docs/          openapi.json, README images, llm-wiki/ (agent knowledge base)
```

[`docs/llm-wiki/`](docs/llm-wiki/index.md) is a code-grounded knowledge base for coding agents (and people): request lifecycle, architecture, every domain with its API calls, accessibility and test conventions. `CLAUDE.md` points agents at it. It is maintained with [llm-wiki-governance](https://www.npmjs.com/package/llm-wiki-governance): `npx llm-wiki validate` checks every evidence reference, and once a person approves a document (`npx llm-wiki review --approve <path>`) CI fails any pull request that changes the code it cites without updating it.

## Quality gates

- `npm run verify`: oxlint with warnings as errors, Prettier, strict TypeScript (`noUncheckedIndexedAccess`), 612 unit tests (including WCAG contrast in both themes and dictionary parity), production build.
- E2E: 253 tests on phone, tablet and desktop, including the skip link and reduced motion. Every flow runs on all three. Every main screen of every role is checked at 320 px (in both languages) and on a landscape tablet. Separate runs walk each role's screens in English, failing on any leftover Korean, and in dark mode. Horizontal overflow is checked after data has loaded.
- CI runs verify, e2e, the nginx check and the LLM-WIKI checks on every push and pull request. Dependabot keeps dependencies and actions current.

## Known limits

- Sign-in in mock mode accepts the demo password for any seeded account. Real authentication belongs to your backend.
- E-mail and messenger notifications are only preferences here. Sending them is the backend's job.
- Demo data is written in the language that was active when it was created. Untouched data follows a language switch; once you change something it stays as written, and "reset demo data" rebuilds it in the current language. User-written text is never translated.
- Right-to-left languages are not handled.

## License

[MIT](LICENSE)
