---
title: Component Inventory
tags:
  - llm-wiki
  - verified
status: verified
doc_type: component_inventory
project: ax-request-portal
last_updated: 2026-11-10
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/components/ui
  - src/components/request
  - src/components/ai
  - src/lib/cn.ts
evidence:
  - src/App.tsx
  - src/app/update-notice.tsx#symbol:UpdateNotice
  - src/components/ui/button.tsx#symbol:Button
  - src/components/ui/badge.tsx#symbol:Badge
  - src/components/ui/card.tsx#symbol:Card
  - src/components/ui/controls.tsx#symbol:SwitchRow
  - src/components/ui/feedback.tsx#symbol:ErrorState
  - src/components/ui/field.tsx#symbol:Field
  - src/components/ui/segmented.tsx#symbol:Segmented
  - src/components/ui/sheet.tsx#symbol:Sheet
  - src/components/request/request-card.tsx#symbol:RequestCard
  - src/components/request/status.tsx#symbol:StatusBadge
  - src/components/request/status.tsx#symbol:Stepper
  - src/components/request/timeline.tsx#symbol:Timeline
  - src/components/ui/load-failed.tsx#symbol:LoadFailed
  - src/components/ui/load-failed.tsx#symbol:RefreshFailed
  - src/components/ui/date-time.tsx#symbol:DateTimeText
  - src/components/ui/date-time.tsx#symbol:HqCalendarNote
  - src/components/ui/date-time.test.tsx
  - src/components/ui/month-stepper.tsx#symbol:MonthStepper
  - src/app/time-zone.ts#symbol:useTimeView
  - src/app/time-zone.ts#symbol:useHqCalendarNote
  - src/app/demo-banner.tsx#symbol:DemoBanner
  - src/app/demo-storage-notice.tsx#symbol:DemoStorageNotice
  - src/app/demo-data-sync.tsx#symbol:DemoDataSync
  - src/app/shell.tsx#symbol:Glyph
  - src/app/page.tsx#symbol:Page
  - src/app/page.tsx#symbol:PageTop
  - src/app/page.tsx#symbol:PageScroll
  - src/app/page.tsx#symbol:PageColumns
  - src/app/page.tsx#symbol:PagePlain
  - src/app/scroll-memory.ts#symbol:useScrollMemory
  - src/app/shell.tsx#symbol:BottomNav
  - src/features/wizard/steps.tsx#symbol:MissingAttachments
  - src/features/detail/attachment-link.tsx#symbol:AttachmentLink
  - src/components/ui/sheet.test.tsx
  - src/features/drafts/drafts-section.tsx#symbol:DraftsSection
  - src/features/drafts/drafts-section.tsx#symbol:DraftsNotice
  - src/features/wizard/draft-status.tsx#symbol:DraftStatusBar
  - src/features/wizard/draft-status.tsx#symbol:ConflictNotice
  - src/features/wizard/draft-status.tsx#symbol:LimitNotice
  - vite.config.ts
related:
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/profiles/frontend.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-10
---

# Component Inventory

## Summary

Shared UI lives in two folders. `src/components/ui/` holds design-system primitives with no domain knowledge; `src/components/request/` holds widgets that know the work-request model (status, timeline, card). Feature pages under `src/features/*` compose both and own their own page-specific components (for example the panels in `src/features/detail/`).

The primitives are written by hand in the shadcn style (Tailwind classes, `class-variance-authority` variants, `cn()` = `clsx` + `tailwind-merge`) but the shadcn CLI is not used: it rewrote `src/index.css`, which holds the theme tokens. Only two primitives sit on Radix, through the single `radix-ui` package: `Button` uses `Slot` for `asChild`, and `Sheet` uses `Dialog`. Everything else (select, switch, segmented control) is a native element or hand-written ARIA. A Radix dropdown menu was removed to cut about 16 KB gzip from the shell bundle.

## Primitives (`src/components/ui`)

| Component | Built on | Notes |
| --- | --- | --- |
| `Button` (`buttonVariants`) | cva + Radix `Slot` | `variant` (default `primary`), `size` (default `md`, `icon` = 44 px square; only `sm` is below the 44 px touch target), `block`, `loading` shows a spinner and sets `aria-busy`. `asChild` renders the child element (a `Link`) with button styling; `Slot` accepts exactly one child. |
| `Badge` (`BadgeTone`) | cva | Tones: `neutral`, `brand`, `ai`, `action`, `warning`, `success`, `danger`, `strong`. |
| `Card`, `CardHeader`, `CardTitle` | plain elements | Section/heading wrappers, no variants. |
| `Select`, `SwitchRow`, `Meter` | native / ARIA | `Select` is a native `<select>`; `SwitchRow` is a `role="switch"` button with `aria-checked`; `Meter` shows usage against a warning threshold (AI budget). |
| `Spinner`, `Skeleton`, `ListSkeleton`, `EmptyState`, `ErrorState` | plain elements | `Spinner` is `role="status"`, `ErrorState` is `role="alert"` and takes a retry action. |
| `LoadFailed` | `ErrorState` / plain elements | Data that could not be loaded: a title, the API's message (`errorText`) and a retry button (`loading` while `retrying`). Full variant = `ErrorState` (`role="alert"`) when the screen has nothing else; `compact` = one line inside a section, a polite `role="status"` with a visually hidden full stop between title and body. Use it wherever "nothing here" would otherwise show. |
| `RefreshFailed` | plain elements | A refresh failed while earlier data stays on screen: "may be out of date" and a retry. Always rendered as a polite `role="status"`, visually hidden (`sr-only`) until `failed`, so screen readers hear the line appear and it takes no room meanwhile. Props usually come from `refreshOf(...queries)`. |
| `DateTimeText`, `HqCalendarNote` | `<time>` | `DateTimeText iso variant` renders a timestamp in the viewing time zone inside `<time dateTime>`: `compact` (lists, cards: local time, full form in the tooltip), `full` (detail screens, timelines: adds the zone and head-office time when the clocks differ), `date` (the date it falls on; `calendar="viewer"` by default, `calendar="hq"` for business days such as a release day, whose tooltip always adds head-office time; optional `weekday`). `sentence={(time) => t(key, { time })}` keeps a translated sentence's word order. `HqCalendarNote` is the "dates follow head-office time" line, rendered only for viewers on another clock. Both re-render when Settings change (`useTimeView`). |
| `Input`, `Textarea`, `Label`, `Field`, `AdviceText` | native | `Field` wires label, hint and error with `useId`; the error is a `role="alert"` paragraph. `AdviceText` renders precheck advice next to a field. |
| `Segmented` | ARIA radio group | Generic over the value type; options are `role="radio"` with `aria-checked`, optional count badges. Used for list filters, theme and language. |
| `Sheet` | Radix `Dialog` | Bottom sheet on phones, centered dialog on larger screens; focus trap and Escape come from Radix. Close button is 44 px. Opened from state, not a Radix trigger, so it remembers what had focus when it opened (a layout effect, before Radix moves focus in) and gives focus back to it on closing. `onCloseAutoFocus(event)` runs first: call `preventDefault()` and move focus yourself when that element is gone (a deleted row). |
| `StatTile` | plain elements | Label, value, an optional short note (muted or warning with an icon) and optional children such as a `Meter` or a description. Used by the executive dashboard and the AI usage dashboard. |
| `MonthStepper` | buttons | Previous / next month above a monthly dashboard; "next" is disabled at the current month of the head-office calendar, and `HqCalendarNote` sits beside it. |

## App-level pieces (`src/app`)

| Component | Purpose |
| --- | --- |
| `DemoBanner` | Mock builds only (`env.apiMock`); cannot be dismissed. `bar`: on a phone, a slim warning-tone strip above the sticky header of the signed-in shell, an `aside` landmark named "Demo mode"; it scrolls away with the page and takes the top safe-area inset (hidden from `md`). `inline`: a small boxed `<p>`, under the login screen's tagline and, from `md`, at the left of the shell's header where the brand was. |
| `Page`, `PageTop`, `PageScroll`, `PageColumns`, `PagePlain` (`page.tsx`) | The parts of a `fit` route, which every `page()` route is ([Frontend Profile](profiles/frontend.md)). `PageColumns` puts `PageScroll column`s side by side, each scrolling on its own; `PagePlain` gives a whole-page loading, failed, forbidden or not-found state the page width. `PageTop` holds what stays in place (header, filters, page-wide notices); `PageScroll` the list, which on a big screen is a named, focusable region that scrolls on its own, remembers its position per history entry (`useScrollMemory`) and marks `data-scrolled` for the line under the top. Below the big-screen size they are plain blocks with the page width and padding. |
| `DemoStorageNotice`, `DemoDataSync` | Mock builds only, rendered once in `App.tsx`. The first shows one toast when the demo data can no longer be saved; the second invalidates every query when another tab changed the demo data ([Architecture Conventions](ARCHITECTURE_CONVENTIONS.md)). |
| `Glyph` (local to `shell.tsx`) | Decorative text drawn by CSS (`content: attr(data-glyph)`, `aria-hidden`) inside a control whose name already says it: the brand initials, the unread count on the bell, the account initial. As DOM text it would become part of the visible label, which must be contained in the accessible name (WCAG 2.5.3). Reuse the pattern for any initial or counter inside a named control. |
| `BottomNav` (local to `shell.tsx`) | The phone tab bar: the tabs `phoneTabs` picks, then "more", which opens a `Sheet` with the remaining items and the account actions. "New request" is drawn as a brand-coloured circle; every other icon sits in a box of the same 32 px, so all labels line up. |

Page-local components worth knowing: `MissingAttachments` (wizard, an alert naming attachments the server could not find, see [Request Wizard](domains/11_wizard.md)) and `AttachmentLink` (request page, opens or downloads an attachment safely, see [Request Detail](domains/04_detail.md)).

## Draft pieces (`src/features/drafts`, `src/features/wizard`)

Feature-local, listed here because three screens share them.

| Component | Notes |
| --- | --- |
| `DraftsSection` | The saved-drafts section, `variant="page"` on My requests (section `id="drafts"`, three rows then "show all") or `"home"` (three rows and a "see all" link). Renders only for `request:create` and only when there is something to show; rows, badges, deleting and the room held while loading are in [My Requests](domains/08_requests.md). |
| `DraftsNotice` | "Saved drafts: N · Continue" on a new, empty request, in the wizard's save line. |
| `DraftStatusBar` | The wizard's save line under the progress bar: save state, "delete draft", and an `idle` slot for `DraftsNotice` before anything is saved, so the form does not move. |
| `ConflictNotice`, `LimitNotice` | The wizard's notices for a draft saved elsewhere meanwhile and for a full account; they describe the step heading through `StepNotice` ([Request Wizard](domains/11_wizard.md)). |

## Request widgets (`src/components/request`)

| Component | Purpose |
| --- | --- |
| `RequestCard` | Whole card is one link to `/requests/:id`; props `request`, `myTurn` (shows the "your turn" badge), `showRequester`, `showDates` (adds the wanted-by and release dates, flagged past due while the request is open; only the developer queue passes it). |
| `StatusBadge` | Status label and tone for one lifecycle status. |
| `Stepper` | Phase progress for a request; the current phase carries `aria-current="step"`. |
| `Timeline` | Renders a request's timeline entries; each time is a `DateTimeText variant="full"`. |
| `ProjectIcon` | Project avatar used in cards and pickers. |

## AI widgets (`src/components/ai`)

| Component | Purpose |
| --- | --- |
| `ProviderSwatch` | The provider's colour key (`PROVIDER_FILL` in `provider.ts`); always next to the provider or model name, never alone. |
| `ModelName` | Swatch plus the model's display name from `useModelLabel` (operator labels when the price table is readable, else template defaults, else the id). |
| `TokenLine` | "input · cache read · cache write · output (reasoning)" counts of one `TokenUsage`. |

## Conventions

- Add a primitive to `ui/` only when it is domain-free; anything that reads `WorkRequest` belongs in `request/` or the feature folder.
- Every interactive primitive must keep the global cursor and focus contract described in [WCAG](WCAG.md); `e2e/cursor.spec.ts` fails if a new clickable element shows the wrong cursor.
- Keep touch targets at 44 px (`h-11` / `size-11`) unless there is a documented exception.
- A failed load is never shown as an empty state: use `LoadFailed` / `RefreshFailed` as described in [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md). Show timestamps through `DateTimeText` (or `formatDateTime` / `describeDateTime` for a plain string), never `Date#toLocaleString` in the local zone.
- Toasts: one `sonner` `Toaster` (top-center, follows the theme) in `src/App.tsx`; call `toast.*`. Sonner's styles are not in a Tailwind layer, so overriding them through `classNames` needs `!` utilities (`UpdateNotice` sizes its action button that way).
- `vite.config.ts` puts `radix-ui` and `class-variance-authority` in a fixed `vendor-ui` chunk; a new heavy UI dependency should be placed in a vendor group deliberately.

## Evidence

- `src/components/ui/button.tsx#symbol:Button` — variants, `asChild` via `Slot`, loading state.
- `src/components/ui/badge.tsx#symbol:Badge` — tone list.
- `src/components/ui/card.tsx#symbol:Card` — plain wrapper.
- `src/components/ui/controls.tsx#symbol:SwitchRow` — switch semantics; `Select` and `Meter` live in the same file.
- `src/components/ui/feedback.tsx#symbol:ErrorState` — alert role and retry; spinners and skeletons in the same file.
- `src/components/ui/field.tsx#symbol:Field` — label/hint/error wiring.
- `src/components/ui/segmented.tsx#symbol:Segmented` — radio-group semantics.
- `src/components/ui/sheet.tsx#symbol:Sheet`, `src/components/ui/sheet.test.tsx` — Radix Dialog as sheet/dialog, and its focus return.
- `src/features/drafts/drafts-section.tsx#symbol:DraftsSection`, `src/features/drafts/drafts-section.tsx#symbol:DraftsNotice`, `src/features/wizard/draft-status.tsx#symbol:DraftStatusBar`, `src/features/wizard/draft-status.tsx#symbol:ConflictNotice`, `src/features/wizard/draft-status.tsx#symbol:LimitNotice` — draft pieces.
- `src/components/request/request-card.tsx#symbol:RequestCard`, `src/components/request/status.tsx#symbol:StatusBadge`, `src/components/request/status.tsx#symbol:Stepper`, `src/components/request/timeline.tsx#symbol:Timeline` — request widgets.
- `src/components/ui/load-failed.tsx#symbol:LoadFailed`, `src/components/ui/load-failed.tsx#symbol:RefreshFailed` — load and refresh failures.
- `src/components/ui/date-time.tsx#symbol:DateTimeText`, `src/components/ui/date-time.tsx#symbol:HqCalendarNote`, `src/components/ui/date-time.test.tsx`, `src/app/time-zone.ts#symbol:useTimeView`, `src/app/time-zone.ts#symbol:useHqCalendarNote`, `src/components/ui/month-stepper.tsx#symbol:MonthStepper` — times and the business calendar.
- `src/app/demo-banner.tsx#symbol:DemoBanner`, `src/app/demo-storage-notice.tsx#symbol:DemoStorageNotice`, `src/app/demo-data-sync.tsx#symbol:DemoDataSync` — demo-mode pieces.
- `src/app/shell.tsx#symbol:Glyph` — CSS-drawn decorative text.
- `src/app/page.tsx#symbol:Page`, `src/app/page.tsx#symbol:PageTop`, `src/app/page.tsx#symbol:PageScroll`, `src/app/page.tsx#symbol:PageColumns`, `src/app/page.tsx#symbol:PagePlain`, `src/app/scroll-memory.ts#symbol:useScrollMemory` — the big-screen page parts.
- `src/app/shell.tsx#symbol:BottomNav` — the phone tab bar.
- `src/features/wizard/steps.tsx#symbol:MissingAttachments`, `src/features/detail/attachment-link.tsx#symbol:AttachmentLink` — page-local components named above.
- `vite.config.ts` — `vendor-ui` chunk group.
- `src/App.tsx` — the single `Toaster`; `src/app/update-notice.tsx#symbol:UpdateNotice` — a toast overriding sonner's action button size.

## Open Questions

- Only `DateTimeText` and `Sheet` have component-level unit tests (`src/components/ui/date-time.test.tsx`, `src/components/ui/sheet.test.tsx`); the other primitives are covered through screen tests and E2E. Decide whether primitives need their own tests before the inventory grows.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
