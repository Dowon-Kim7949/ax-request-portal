---
title: Frontend Profile
tags:
  - llm-wiki
  - verified
status: verified
doc_type: profile
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/app/shell.tsx
  - src/app/router.tsx
  - src/app/page.tsx
  - src/index.css
evidence:
  - src/app/update-check.ts#symbol:checkForUpdateNow
  - src/app/shell.tsx#symbol:AppShell
  - src/app/router.tsx#symbol:page
  - src/app/nav.ts#symbol:phoneTabs
  - src/app/title.ts#symbol:usePageTitle
  - src/app/page.tsx#symbol:PageHeader
related:
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/COMPONENT_INVENTORY.md
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/E2E_WORKFLOWS.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Frontend Profile

## Summary

Front-end rules that apply to every screen. The deeper references are [Architecture Conventions](../ARCHITECTURE_CONVENTIONS.md), [Component Inventory](../COMPONENT_INVENTORY.md), [Accessibility](../WCAG.md) and [E2E Workflows](../E2E_WORKFLOWS.md).

## Responsive shell

- Three layouts from one navigation table: phone (bottom tab bar, up to four tabs plus a "more" sheet), tablet from `md` (76 px icon rail that expands as an overlay), desktop from `xl` (256 px sidebar).
- Every workflow must be completable at every size; the E2E projects (phone, tablet, desktop) enforce it. When a route needs the full phone height for its own action bar, it sets `handle.focus` to hide the tab bar.
- Single-column grids need `grid-cols-1`; without it a `nowrap` child widens the page beyond the phone viewport.

## Pages

- Each page is a lazy route created with `page(load, permission?)`; a declared permission wraps it in `RequirePermission`. A page whose code fails to load triggers an immediate new-version check (`checkForUpdateNow`) before the error page shows.
- Use `PageHeader` for the page heading and `usePageTitle` for the document title (`<page> · <brand>`).
- Server state comes only from hooks in `src/api/queries.ts`; components never call `fetch` (the one other `fetch` is `src/app/update-check.ts`, which reads the static `version.json`, not the API). Client-only state lives in the component, in the URL (filters, wizard step) when it should survive a reload or be shareable, or in a zustand store when it is global.
- Errors: a failed query renders `ErrorState` with retry; a failed mutation shows a toast with the localized server message.

## Checklist for a UI change

- Texts in both `ko.ts` and `en.ts` (the compiler enforces matching keys).
- Light and dark: use role tokens, add new text or boundary colours to `src/theme.test.ts`.
- Pointer, disabled and busy cursors, a visible focus ring, 44 px targets (`e2e/cursor.spec.ts` checks cursors).
- No horizontal scroll at 320 px (`e2e/layout.spec.ts`).
- A request mutation calls `onRequestChanged`.

## Evidence

- `src/app/shell.tsx#symbol:AppShell` — layouts and focus routes.
- `src/app/nav.ts#symbol:phoneTabs` — phone tab selection.
- `src/app/router.tsx#symbol:page` — lazy pages with permissions.
- `src/app/page.tsx#symbol:PageHeader`, `src/app/title.ts#symbol:usePageTitle` — page heading and title.
- `src/app/update-check.ts#symbol:checkForUpdateNow` — new-version check when a page fails to load.

## Open Questions

- None beyond those listed in [Accessibility](../WCAG.md).

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
