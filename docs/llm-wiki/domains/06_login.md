---
title: Login
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-10
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/auth/login-page.tsx
  - src/features/auth/post-login.ts
  - src/app/demo.ts
  - src/app/display-controls.tsx
evidence:
  - src/features/auth/login-page.tsx#symbol:LoginPage
  - src/features/auth/login-page.tsx#symbol:ANNOUNCE_DELAY_MS
  - src/features/auth/post-login.ts#symbol:resolvePostLoginPath
  - src/features/auth/post-login.ts#symbol:parseInAppPath
  - src/features/auth/post-login.test.ts
  - src/features/auth/login-page.test.tsx
  - src/app/demo-banner.tsx#symbol:DemoBanner
  - src/app/demo.ts#symbol:loadDemoAccounts
  - src/mocks/seed.ts#symbol:DEMO_PASSWORD
  - src/app/display-controls.tsx#symbol:QuickDisplayToggles
related:
  - docs/llm-wiki/domains/02_auth.md
  - docs/llm-wiki/domains/10_settings.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-11
---

# Login

## Responsibility

The `/login` screen: e-mail and password sign-in plus, in mock mode, one-click demo accounts. Session handling and guards belong to [Auth](02_auth.md).

## Workflow

1. The screen reads once, when it mounts, how the previous session in this tab ended (`useSession` `ended`); signing in resets it in the store, and the redirect that follows must still see it.
2. If a token already exists the page navigates away immediately, through the same resolver as a sign-in.
3. The form (react-hook-form + zod) validates the e-mail inline; a server error is shown in a `role="alert"` paragraph with the localized server message.
4. On success it navigates with `replace` to `resolvePostLoginPath(next, user)`, the only reader of `?next=` (form, demo buttons and the already-signed-in redirect all use it). It returns `next` only when every rule holds, and `/` otherwise:
   - `parseInAppPath`: starts with exactly one `/` (not `//`), has no backslash or control character, and parses to the same origin.
   - It matches a route other than the catch-all `*`, and no matched route is `/login` (in any case, trailing slash or percent-encoded form).
   - The new user holds every matched route's `handle.permission` (`userCan`, so `appConfig.rolePermissions` applies). A `handle.redirectTo` (an old address) is followed, at most three times, and the destination is checked the same way.
   - After a session ended in this tab, `next` is the page that person had open: only the same user returns to it; anyone else starts at home.
5. Demo accounts (mock mode only) are one button per role — requester, executive, developer, admin, operator (`operator@example.com`) — labelled with the role, name and team. The hint shows the shared demo password. Buttons are disabled while a login is in flight.

## Session expiry notice

When the previous session ended as `expired` (a `401`, here or in another tab), the screen shows "Your session expired. Sign in again to return to where you were." (`auth.sessionExpired`) above the form. The visible paragraph is `aria-hidden` and is linked to the e-mail field through `aria-describedby`; a separate, initially empty `sr-only` `role="status"` receives the same text `ANNOUNCE_DELAY_MS` (100 ms) after mounting, because screen readers ignore a live region that arrives with its text already in it. After a sign-out on purpose there is no notice and no `next`.

## Demo data and language

- `loadDemoAccounts` imports the mock modules dynamically behind the `__API_MOCK__` build constant, so a real-backend build drops the import and never ships the seed. It reloads when the UI language changes, because demo names are generated per language.
- In mock mode a small demo-mode note (`DemoBanner variant="inline"`, "Demo mode · Data stays in this browser only") sits under the tagline, inside the brand block, so it never overlaps the corner toggles at 320 px. The same boxed note sits at the left of the signed-in header from a tablet up; a phone shows the strip above the header instead.
- `QuickDisplayToggles` in the corner switches language and light/dark before signing in.

## API Services

- `useLogin` → `POST /auth/login` (public), `{ email, password }` → `Session`. See [Auth](02_auth.md) for cache and session effects.

## Accessibility

- `autoComplete="username"` / `inputMode="email"` and `autoComplete="current-password"`; the demo section is a labelled region and button icons are `aria-hidden`.
- The expiry notice is announced once (the delayed status) and is the e-mail field's description, not read twice while browsing the page.

## Evidence

- `src/features/auth/login-page.tsx#symbol:LoginPage`, `src/features/auth/login-page.tsx#symbol:ANNOUNCE_DELAY_MS` — form, demo buttons, expiry notice.
- `src/features/auth/post-login.ts#symbol:resolvePostLoginPath`, `src/features/auth/post-login.ts#symbol:parseInAppPath` — the `next` rules.
- `src/features/auth/post-login.test.ts`, `src/features/auth/login-page.test.tsx` — redirect cases and the notice.
- `src/app/demo.ts#symbol:loadDemoAccounts` — mock-only dynamic loading.
- `src/app/demo-banner.tsx#symbol:DemoBanner` — demo-mode note.
- `src/mocks/seed.ts#symbol:DEMO_PASSWORD` — the shared demo password (demo data, not a secret).
- `src/app/display-controls.tsx#symbol:QuickDisplayToggles` — language and theme toggles.

## Open Questions

- E2E tests select demo accounts by their Korean role labels; renaming those strings breaks `e2e/helpers.ts`.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
