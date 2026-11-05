---
title: Project Profile
tags:
  - llm-wiki
  - verified
status: verified
doc_type: project_profile
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - .nvmrc
  - .env.example
  - README.md
evidence:
  - package.json#L14-L16
  - package.json#L17-L30
  - src/config/app.config.ts#symbol:appConfig
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/log.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Project Profile

## Detected Project

- type: `frontend` (single-page application, no server code)
- confidence: explicit (`llm-wiki.config.json`)

## Summary

`ax-request-portal` is an MIT-licensed, public **template** for an AI-assisted work request portal: request intake, an AI feasibility report, a human decision, AI-made changes reviewed as a merge request, acceptance checks by the requester, release tracking, an executive dashboard and administration. It ships the front end and the API contract (`docs/openapi.json`); the backend is out of scope, and an in-browser mock API makes every screen usable without one. All people, projects and organisations in the seed data are fictional.

Every workflow must be completable on a phone, a tablet and a desktop; the UI is Korean by default with a full English translation, and has light and dark themes.

## Stack

React 19, TypeScript (strict), Vite 8 (Rolldown), React Router 8 (data router, SPA), TanStack Query, zustand, Tailwind CSS 4, Radix primitives, react-hook-form + Zod 4, i18next, MSW 3, Vitest 5 (jsdom), Playwright, oxlint, Prettier.

## Runtime and commands

- Node `^22.22.2 || ^24.15.0 || >=26.0.0` (`engines`); `.nvmrc` is 24. React Router 8 and jsdom 30 set the floor; CI verifies the lowest version of each line.
- `npm run dev` (mock mode by default), `npm run build`, `npm run preview`.
- `npm run verify` = lint → format check → typecheck → unit tests → build. `npm run test:e2e` runs Playwright against a production build. `npm run openapi` regenerates the contract document.
- `npx llm-wiki validate` checks this wiki (the CLI is a dev dependency; never call the unrelated npm package `llm-wiki` through `npx -y`).

## Deployment

- Static build served by nginx (`deploy/nginx.conf`, verified in CI by `deploy/check-nginx.sh`), or the GitHub Pages demo in mock mode.
- Environment: `VITE_BASE`, `VITE_API_MOCK`, `VITE_API_BASE_URL`, optional `VITE_BUILD_ID` (`.env.example`). Each build writes `version.json`; open tabs offer a reload when the deployed id differs.

## Evidence

- `package.json#L14-L16` — supported Node versions.
- `package.json#L17-L30` — scripts.
- `src/config/app.config.ts#symbol:appConfig` — template settings (brand, locales, roles).
- `README.md`, `.env.example`, `.nvmrc` — setup and environment.

## Open Questions

- The repository is a template: anything organisation-specific (brand, roles, request types, repository providers) is expected to change in `src/config/app.config.ts` and the seed, not in feature code.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
