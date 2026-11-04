---
title: Login
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/auth/login-page.tsx
  - src/app/demo.ts
  - src/app/display-controls.tsx
evidence:
  - src/features/auth/login-page.tsx#symbol:LoginPage
  - src/features/auth/login-page.tsx#symbol:safeNext
  - src/app/demo.ts#symbol:loadDemoAccounts
  - src/mocks/seed.ts#symbol:DEMO_PASSWORD
  - src/app/display-controls.tsx#symbol:QuickDisplayToggles
related:
  - docs/llm-wiki/domains/02_auth.md
  - docs/llm-wiki/domains/10_settings.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Login

## Responsibility

The `/login` screen: e-mail and password sign-in plus, in mock mode, one-click demo accounts. Session handling and guards belong to [Auth](02_auth.md).

## Workflow

1. If a token already exists the page navigates away immediately.
2. The form (react-hook-form + zod) validates the e-mail inline; a server error is shown in a `role="alert"` paragraph with the localized server message.
3. On success it navigates to `next` with `replace`. `safeNext` accepts only paths that start with `/` and not `//`, so `?next=` cannot redirect to another site.
4. Demo accounts (mock mode only) are one button per role — requester, executive, developer, admin, operator (`operator@example.com`) — labelled with the role, name and team. The hint shows the shared demo password. Buttons are disabled while a login is in flight.

## Demo data and language

- `loadDemoAccounts` imports the mock modules dynamically and only when `env.apiMock` is true, so a real-backend build never loads the seed. It reloads when the UI language changes, because demo names are generated per language.
- `QuickDisplayToggles` in the corner switches language and light/dark before signing in.

## API Services

- `useLogin` → `POST /auth/login` (public), `{ email, password }` → `Session`. See [Auth](02_auth.md) for cache and session effects.

## Accessibility

- `autoComplete="username"` / `inputMode="email"` and `autoComplete="current-password"`; the demo section is a labelled region and button icons are `aria-hidden`.

## Evidence

- `src/features/auth/login-page.tsx#symbol:LoginPage`, `src/features/auth/login-page.tsx#symbol:safeNext` — form, demo buttons, redirect guard.
- `src/app/demo.ts#symbol:loadDemoAccounts` — mock-only dynamic loading.
- `src/mocks/seed.ts#symbol:DEMO_PASSWORD` — the shared demo password (demo data, not a secret).
- `src/app/display-controls.tsx#symbol:QuickDisplayToggles` — language and theme toggles.

## Open Questions

- E2E tests select demo accounts by their Korean role labels; renaming those strings breaks `e2e/helpers.ts`.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
