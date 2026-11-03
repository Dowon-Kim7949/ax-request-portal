---
title: Component Inventory
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: component_inventory
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/components/ui
  - src/components/request
  - src/components/ai
  - src/lib/cn.ts
evidence:
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
  - vite.config.ts
related:
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/profiles/frontend.md
visibility: public
contains_sensitive_info: false
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
| `Input`, `Textarea`, `Label`, `Field`, `AdviceText` | native | `Field` wires label, hint and error with `useId`; the error is a `role="alert"` paragraph. `AdviceText` renders precheck advice next to a field. |
| `Segmented` | ARIA radio group | Generic over the value type; options are `role="radio"` with `aria-checked`, optional count badges. Used for list filters, theme and language. |
| `Sheet` | Radix `Dialog` | Bottom sheet on phones, centered dialog on larger screens; focus trap and Escape come from Radix. Close button is 44 px. |
| `StatTile` | plain elements | Label, value, an optional short note (muted or warning with an icon) and optional children such as a `Meter` or a description. Used by the executive dashboard and the AI usage dashboard. |
| `MonthStepper` | buttons | Previous / next month above a monthly dashboard; "next" is disabled at the current month. |

## Request widgets (`src/components/request`)

| Component | Purpose |
| --- | --- |
| `RequestCard` | Whole card is one link to `/requests/:id`; props `request`, `myTurn` (shows the "your turn" badge), `showRequester`. |
| `StatusBadge` | Status label and tone for one lifecycle status. |
| `Stepper` | Phase progress for a request; the current phase carries `aria-current="step"`. |
| `Timeline` | Renders a request's timeline entries. |
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
- `vite.config.ts` puts `radix-ui` and `class-variance-authority` in a fixed `vendor-ui` chunk; a new heavy UI dependency should be placed in a vendor group deliberately.

## Evidence

- `src/components/ui/button.tsx#symbol:Button` — variants, `asChild` via `Slot`, loading state.
- `src/components/ui/badge.tsx#symbol:Badge` — tone list.
- `src/components/ui/card.tsx#symbol:Card` — plain wrapper.
- `src/components/ui/controls.tsx#symbol:SwitchRow` — switch semantics; `Select` and `Meter` live in the same file.
- `src/components/ui/feedback.tsx#symbol:ErrorState` — alert role and retry; spinners and skeletons in the same file.
- `src/components/ui/field.tsx#symbol:Field` — label/hint/error wiring.
- `src/components/ui/segmented.tsx#symbol:Segmented` — radio-group semantics.
- `src/components/ui/sheet.tsx#symbol:Sheet` — Radix Dialog as sheet/dialog.
- `src/components/request/request-card.tsx#symbol:RequestCard`, `src/components/request/status.tsx#symbol:StatusBadge`, `src/components/request/status.tsx#symbol:Stepper`, `src/components/request/timeline.tsx#symbol:Timeline` — request widgets.
- `vite.config.ts` — `vendor-ui` chunk group.

## Open Questions

- There are no component-level unit tests (`*.test.tsx` under `src/components`); components are covered through E2E. Decide whether primitives need their own tests before the inventory grows.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
