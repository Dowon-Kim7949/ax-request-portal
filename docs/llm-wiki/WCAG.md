---
title: Accessibility (WCAG)
tags:
  - llm-wiki
  - verified
status: verified
doc_type: wcag
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/index.css
  - src/theme.test.ts
  - index.html
  - src/app/theme.ts
  - src/app/shell.tsx
  - e2e/cursor.spec.ts
  - e2e/layout.spec.ts
  - e2e/theme.spec.ts
  - e2e/a11y.spec.ts
evidence:
  - src/theme.test.ts#symbol:PAIRS
  - src/theme.test.ts#L37-L39
  - src/index.css#L154-L188
  - src/index.css#L190-L203
  - src/app/shell.tsx#symbol:SkipLink
  - src/i18n/en.ts#symbol:skipToContent
  - src/i18n/ko.ts#symbol:skipToContent
  - index.html#L13-L31
  - src/app/theme.ts#symbol:applyTheme
  - src/components/ui/button.tsx#L66-L67
  - src/components/request/status.tsx#symbol:Stepper
  - src/features/wizard/steps.tsx#symbol:StepTitle
related:
  - docs/llm-wiki/COMPONENT_INVENTORY.md
  - docs/llm-wiki/E2E_WORKFLOWS.md
  - docs/llm-wiki/profiles/frontend.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Accessibility (WCAG)

## Summary

The target is WCAG 2.2 AA on phone, tablet and desktop. Colour contrast is enforced by a unit test; the cursor contract, 320 px reflow, the skip link and reduced motion by E2E tests; the rest (semantics, focus, live regions) by convention in the components.

## Colour and contrast

- Colours are design tokens in `src/index.css` (`@theme` block for light, `.dark` block for dark). Roles, not hues, are named: `brand-600` / `*-600` are fills that carry white text, `accent` and `*-fg` are text and icon colours, `*-50` / `*-100` are tints, `ink-900…400` is body text, `field` is a control border, `line` is decoration only, `inverse` / `on-inverse` is the inverted surface. One colour cannot serve both as a fill under white text and as text on a light surface in both themes, which is why the roles are split.
- `src/theme.test.ts` checks 43 foreground/background pairs in both themes: text pairs at 4.5:1 (`TEXT`) and non-text marks (control borders, chart marks, focus colours) at 3:1 (`UI`, SC 1.4.11). It also asserts that every token it checks is defined in each theme.
- The test reads `src/index.css` with regular expressions: it expects `#rrggbb` values and the `.dark { … }` block closed by a two-space-indented brace. Writing tokens as `oklch()`, short hex, or reformatting that block makes the test report missing tokens rather than check contrast.
- Adding a token that carries text or a control boundary means adding its pair to `PAIRS`.

## Dark mode

- An inline script in `index.html` runs before React, reads the persisted preference (`ax-request-portal:preferences`, falling back to `prefers-color-scheme`) and sets the `dark` class, `color-scheme` and background colour, so there is no light flash. Changing the persisted shape of the preferences store breaks this script silently.
- After start-up `src/app/theme.ts` (`applyTheme`, `startThemeSync`) keeps the class, `color-scheme` and `meta[name=theme-color]` in sync with the store and, for the `system` choice, with the OS setting.

## Interaction states

- Global cursor contract in `src/index.css`: buttons, `summary`, selects and ARIA widgets (`button`, `switch`, `radio`, `checkbox`, `tab`, `option`, `menuitem` roles) get `pointer`; `:disabled` and `[aria-disabled=true]` get `not-allowed`; `[aria-busy=true]` gets `progress` and wins because it comes last. Tailwind v4 no longer gives buttons a pointer, which is why the rule exists. `e2e/cursor.spec.ts` checks the computed cursor of every visible interactive element on every screen.
- `Button` sets `aria-busy` while `loading`, so the busy cursor and screen-reader state come from one prop.
- Focus is shown by one global `:focus-visible` outline (2 px, offset 2 px, brand colour).
- Form controls use 16 px text on coarse pointers so iOS does not zoom on focus.
- Reduced motion: under `prefers-reduced-motion: reduce` every animation and transition finishes in 0.01 ms and smooth scrolling is off (`src/index.css`). Near-zero rather than `none`, so `animationend` / `transitionend` handlers still run. `e2e/a11y.spec.ts` counts elements that would move and expects none under reduce.
- Touch targets are 44 px (`h-11` / `size-11`); the phone tab bar is taller. `Button size="sm"` is the documented exception.

## Semantics and focus management

- Skip link: `SkipLink` is the first tab stop on every signed-in screen; it is visually hidden until focused and moves focus to `<main id="main" tabIndex={-1}>` in code, so the URL hash and the router are not touched. The login screen has no navigation to skip. `e2e/a11y.spec.ts` checks it on the desktop project only: WebKit (phone and tablet projects) does not tab to links by default.
- Landmarks come from the shell: `header`, `main`, a labelled `nav` for the sidebar/rail and a separately labelled `nav` for the phone tab bar. Icon-only links carry `aria-label` (the notifications link includes the unread count).
- `aria-current="step"` marks the current phase in `Stepper` and in the AI work panel; toggle groups use `aria-pressed` or `role="radio"` + `aria-checked`; switches use `role="switch"`.
- Live regions: `aria-live="polite"` for precheck results in the wizard and the status explainer on the detail page; `role="status"` for spinners and the boot screen; `role="alert"` for `ErrorState`, field errors and login errors.
- Wizard steps move focus to the step heading (`StepTitle`, `tabIndex=-1`) in a layout effect, before paint. A passive effect stole focus after the user had started typing and dropped the input.
- `Sheet` (Radix Dialog) traps focus and closes on Escape.

## Reflow

- `e2e/layout.spec.ts` visits every route for every role at 320×568 and on a landscape tablet and asserts no horizontal scroll, including the English UI. A CSS grid without `grid-cols-1` let `nowrap` children overflow at phone width; keep that class on single-column grids.

## Evidence

- `src/theme.test.ts#symbol:PAIRS` — the 43 checked pairs; `src/theme.test.ts#L37-L39` — the 4.5:1 and 3:1 thresholds.
- `src/index.css#L154-L188` — focus outline and cursor contract; `src/index.css#L190-L203` — reduced-motion rule.
- `src/app/shell.tsx#symbol:SkipLink` — skip link and the focusable `main`; `src/i18n/en.ts#symbol:skipToContent` — its label, with `src/i18n/ko.ts#symbol:skipToContent` for Korean.
- `index.html#L13-L31` — pre-paint theme script.
- `src/app/theme.ts#symbol:applyTheme` — runtime theme sync.
- `src/components/ui/button.tsx#L66-L67` — `disabled` and `aria-busy` while loading.
- `src/components/request/status.tsx#symbol:Stepper` — `aria-current="step"`.
- `src/features/wizard/steps.tsx#symbol:StepTitle` — focus target for step changes.
- `e2e/cursor.spec.ts`, `e2e/layout.spec.ts`, `e2e/theme.spec.ts`, `e2e/a11y.spec.ts` — the automated checks.

## Open Questions

- Whether the desktop sidebar's expanded overlay traps focus has not been checked.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
