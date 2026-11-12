---
title: Project Profile
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: project_profile
project: ax-request-portal
last_updated: 2026-11-12
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - .nvmrc
  - .env.example
  - README.md
evidence:
  - package.json#L14-L16
  - package.json#L17-L31
  - src/config/app.config.ts#symbol:appConfig
  - src/config/env-check.ts#symbol:checkEnv
  - scripts/check-real-build.mjs
  - deploy/nginx.conf
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/log.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-12
---

# Project Profile

## Detected Project

- type: `frontend` (single-page application, no server code)
- confidence: explicit (`llm-wiki.config.json`)

## Summary

`ax-request-portal` is an MIT-licensed, public **template** for an AI-assisted work request portal: request intake, an AI feasibility report, a human decision, AI-made changes reviewed as a merge request, acceptance checks by the requester, release tracking, an executive dashboard and administration. It ships the front end and the API contract (`docs/openapi.json`); the backend is out of scope, and an in-browser mock API makes every screen usable without one. All people, projects and organisations in the seed data are fictional.

Every workflow must be completable on a phone, a tablet and a desktop; the UI is Korean by default with a full English translation, and has light and dark themes. Times show in each viewer's time zone, with head-office time beside them where the clocks differ; "today" and monthly totals follow the head office's business calendar (`organization.timeZone`).

## Stack

React 19, TypeScript (strict), Vite 8 (Rolldown), React Router 8 (data router, SPA), TanStack Query, zustand, Tailwind CSS 4, Radix primitives, react-hook-form + Zod 4 (jitless), i18next, MSW 3, Vitest 5 (jsdom), Playwright with axe-core, oxlint, Prettier.

## Runtime and commands

- Node `^22.22.2 || ^24.15.0 || >=26.0.0` (`engines`); `.nvmrc` is 24. React Router 8 and jsdom 30 set the floor; CI verifies the lowest version of each line.
- `npm run dev` (mock mode by default), `npm run build`, `npm run preview`.
- `npm run verify` = lint → format check → typecheck → unit tests → build → `check:real-build` (a real-backend build must contain no mock code, service worker or demo accounts). `npm run test:e2e` runs Playwright against a production build served by `vite preview`, under the production Content-Security-Policy. `npm run openapi` regenerates the contract document.
- `npx llm-wiki validate` checks this wiki (the CLI is a dev dependency; never call the unrelated npm package `llm-wiki` through `npx -y`).

## Deployment

- Static build served by nginx (`deploy/nginx.conf`, verified in CI by `deploy/check-nginx.sh`), or the GitHub Pages demo in mock mode.
- A real backend implements `docs/openapi.json` and follows the steps in `README.md` ("Connect a real backend"): the mock's rules for drafts, request visibility (`canOpen` on the release schedule), server search (`q`) and the notification channels it sends (`notifications.channels`), then the lifecycle and the two AI jobs.
- Environment: `VITE_BASE`, `VITE_API_MOCK`, `VITE_API_BASE_URL`, optional `VITE_BUILD_ID` (`.env.example`). `vite build` fails on a wrong value: `VITE_API_MOCK` other than `true` / `false` / unset, or `false` without a usable `VITE_API_BASE_URL` (placeholder host, credentials, query, `.`/`..` segments, or the same path as the app's `VITE_BASE`). A fresh clone builds in demo mode, and a demo build shows a demo-mode banner on every screen. Each build writes `version.json`; open tabs offer a reload when the deployed id differs.
- nginx sends a strict Content-Security-Policy (the inline theme script by hash), `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `nosniff`, `X-Frame-Options` and `Referrer-Policy` on every response. A backend or image host on another origin must be added to `connect-src` / `img-src`; HSTS belongs on the TLS-terminating proxy (a commented example is included). A real-backend build ships no `mockServiceWorker.js`.

## Evidence

- `package.json#L14-L16` — supported Node versions.
- `package.json#L17-L31` — scripts.
- `src/config/app.config.ts#symbol:appConfig` — template settings (brand, organization time zone, locales, roles).
- `src/config/env-check.ts#symbol:checkEnv`, `scripts/check-real-build.mjs` — build-setting rules; the real-backend build check.
- `deploy/nginx.conf` — serving rules and security headers.
- `README.md`, `.env.example`, `.nvmrc` — setup and environment.

## Open Questions

- The repository is a template: anything organisation-specific (brand, head-office time zone, roles, request types, notification channels, repository providers) is expected to change in `src/config/app.config.ts` and the seed, not in feature code.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
