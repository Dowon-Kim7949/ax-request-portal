---
title: Frontend Profile
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: profile
project: ax-request-portal
last_updated: 2026-11-10
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
  - src/app/nav.test.ts
  - src/app/page.test.tsx
  - src/app/title.ts#symbol:usePageTitle
  - src/app/page.tsx#symbol:PageHeader
  - src/app/page.tsx#symbol:Page
  - src/app/page.tsx#symbol:PageScroll
  - src/app/scroll-memory.ts#symbol:useScrollMemory
  - src/lib/scrollbar-width.ts#symbol:trackScrollbarWidth
  - src/lib/use-media-query.ts#symbol:FIT_QUERY
  - e2e/fit.spec.ts
  - src/app/router.tsx#symbol:RouteHandle
  - src/app/shell.tsx#symbol:Glyph
  - src/app/demo-banner.tsx#symbol:DemoBanner
  - src/features/wizard/wizard-page.tsx#symbol:WizardForm
  - src/components/ui/load-failed.tsx#symbol:LoadFailed
  - src/components/ui/date-time.tsx#symbol:DateTimeText
  - src/app/pages.tsx#symbol:RouteErrorView
related:
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/COMPONENT_INVENTORY.md
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/E2E_WORKFLOWS.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-10
---

# Frontend Profile

## Summary

Front-end rules that apply to every screen. The deeper references are [Architecture Conventions](../ARCHITECTURE_CONVENTIONS.md), [Component Inventory](../COMPONENT_INVENTORY.md), [Accessibility](../WCAG.md) and [E2E Workflows](../E2E_WORKFLOWS.md).

## Responsive shell

- Three layouts from one navigation table: phone (bottom tab bar, four tabs plus a "more" sheet, with "new request" always the middle tab when the user may file one), tablet from `md` (76 px icon rail that expands as an overlay), desktop from `xl` (256 px sidebar).
- Every workflow must be completable at every size; the E2E projects (phone, tablet, desktop) enforce it. When a route needs the full phone height for its own action bar, it sets `handle.focus` to hide the tab bar.
- Single-column grids need `grid-cols-1`; without it a `nowrap` child widens the page beyond the phone viewport.
- Content width: the header and every page share `--page-max` (72rem, 90rem from `2xl`) and `--page-pad` through the `page-band` (bands that do not scroll) and `page-column` (inside a scroll region, or a whole page) utilities in `src/index.css`.
- Big screens (`fit:` variant and `FIT_QUERY`: at least 1280 × 720): a route whose handle sets `fit` fills the window under the header, and only its list scrolls ([Pages](#pages)). The scroll region spans the whole content column, so the wheel works over the side margins and the scrollbar sits at the window's edge. It reserves the scrollbar's width on both edges (`scrollbar-gutter: stable both-edges`), and the header and the page's fixed top pad by the same measured width (`--sbw`, `trackScrollbarWidth`), so all three keep the same edges. Smaller windows, a phone, a tablet and a 200 % zoom keep the window scroll; nothing clips, so a page that outgrows the window falls back to a window scrollbar. Pages without `fit` still scroll the window at every size.
- Top safe area (an iOS home-screen app draws under the status bar): the inset is padded once. In a mock build the `DemoBanner` strip above the header takes it, the header is `sticky top-[env(safe-area-inset-top)]` and a fixed, `aria-hidden` strip of the header's background covers the status bar once the banner has scrolled away; without the banner the header is `top-0 pt-safe`. Anything pinned below the header adds the inset to the header's height, e.g. the wizard's step bar at `top-[calc(3.5rem+env(safe-area-inset-top))]` (`4rem` from `md`).
- Decorative text inside a named control (initials, counters) is drawn with the shell's `Glyph` pattern, not as DOM text ([Accessibility](../WCAG.md), Label in Name). The account button is named "My account" (`sr-only`) plus the user's name, which is visible from `lg`.

## Pages

- Each page is a lazy route created with `page(load, handle?)`, where `handle` is a `RouteHandle` (`permission`, `focus`, `fit`); a declared permission wraps it in `RequirePermission` and also decides where a sign-in may return ([Auth](../domains/02_auth.md)). A page whose code fails to load triggers an immediate new-version check (`checkForUpdateNow`) before the error page (`RouteErrorView`) shows.
- Use `PageHeader` for the page heading and `usePageTitle` for the document title (`<page> · <brand>`). A chip about the whole page (the usage page's "estimate") goes in `badge`, on the title's row and centred on it; `actions` is for buttons, at the bottom right or wrapped below on a phone.
- A `fit` page is built from `Page` > `PageTop` (header, filters, page-wide notices such as `RefreshFailed`) + `PageScroll` (the list), and brings its own width and padding; the shell's `main` adds none. On a big screen `PageScroll` is a named, focusable region (Safari gives a keyboard no other way into a scroll area without links), with `relative` so visually hidden text stays inside it, and a line appears under `PageTop` once the list has scrolled (`data-scrolled`). `useScrollMemory` does for the region what `<ScrollRestoration>` does for the window: back and forward restore it per history entry and region `id`, any other navigation, a changed filter included, starts at the top. As of 2026-11-10 `/work` and `/notifications` are `fit`; the other pages scroll the window.
- Server state comes only from hooks in `src/api/queries.ts`; components never call `fetch` (the one other `fetch` is `src/app/update-check.ts`, which reads the static `version.json`, not the API). Client-only state lives in the component, in the URL (filters, wizard step) when it should survive a reload or be shareable, or in a zustand store when it is global.
- Errors: a query that loaded nothing renders `LoadFailed` (full or `compact`) with retry, never an empty state; a failed refresh keeps the data and adds `RefreshFailed` ([Architecture Conventions](../ARCHITECTURE_CONVENTIONS.md)). A failed mutation shows a toast with the localized server message (`errorText`). The raw text of an unexpected error reaches the page only in development.
- Times: timestamps through `DateTimeText`; date-only values through `formatDate`; "today" is `hqToday()` wherever it limits or groups dates.
- A form that can lose typing on navigation keeps a draft as it is typed and confirms leaving with `useBlocker` plus `beforeunload` only while the words are kept nowhere (the wizard, whose drafts are kept on the device and saved to the account). Playwright accepts `beforeunload` automatically only when no listener is registered.

## Checklist for a UI change

- Texts in both `ko.ts` and `en.ts` (the compiler enforces matching keys).
- Light and dark: use role tokens, add new text or boundary colours to `src/theme.test.ts`.
- Pointer, disabled and busy cursors, a visible focus ring, 44 px targets (`e2e/cursor.spec.ts` checks cursors).
- No horizontal scroll at 320 px, and notices or error states fully inside the viewport (`e2e/layout.spec.ts`).
- On a `fit` page at FHD and 1280 × 720: the window does not scroll, the list region is focusable and keeps its position on back, and header, top and list share their edges (`e2e/fit.spec.ts`).
- No serious or critical axe-core finding in light or dark (`e2e/axe.spec.ts`), and nothing the production CSP blocks (`e2e/csp.spec.ts`).
- A request mutation calls `onRequestChanged`.

## Evidence

- `src/app/shell.tsx#symbol:AppShell`, `src/app/shell.tsx#symbol:Glyph`, `src/app/demo-banner.tsx#symbol:DemoBanner` — layouts, focus routes, the safe-area rule and CSS-drawn glyphs.
- `src/app/nav.ts#symbol:phoneTabs`, `src/app/nav.test.ts` — phone tab selection per role.
- `src/app/router.tsx#symbol:page`, `src/app/router.tsx#symbol:RouteHandle` — lazy pages with permissions.
- `src/app/page.tsx#symbol:PageHeader`, `src/app/page.test.tsx`, `src/app/title.ts#symbol:usePageTitle` — page heading (with its title chip) and title.
- `src/app/page.tsx#symbol:Page`, `src/app/page.tsx#symbol:PageScroll`, `src/app/scroll-memory.ts#symbol:useScrollMemory`, `src/lib/scrollbar-width.ts#symbol:trackScrollbarWidth`, `src/lib/use-media-query.ts#symbol:FIT_QUERY`, `e2e/fit.spec.ts` — the big-screen layout, its scroll positions and edges.
- `src/app/update-check.ts#symbol:checkForUpdateNow`, `src/app/pages.tsx#symbol:RouteErrorView` — new-version check and the error page when a page fails to load.
- `src/components/ui/load-failed.tsx#symbol:LoadFailed`, `src/components/ui/date-time.tsx#symbol:DateTimeText` — failure and time display.
- `src/features/wizard/wizard-page.tsx#symbol:WizardForm` — draft writing, leave confirmation and the pinned step bar.

## Open Questions

- None beyond those listed in [Accessibility](../WCAG.md).

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
