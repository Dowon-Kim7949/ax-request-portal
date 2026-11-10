---
title: Accessibility (WCAG)
tags:
  - llm-wiki
  - verified
status: verified
doc_type: wcag
project: ax-request-portal
last_updated: 2026-11-10
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
  - e2e/fit.spec.ts
  - e2e/theme.spec.ts
  - e2e/a11y.spec.ts
  - e2e/axe.spec.ts
evidence:
  - src/app/page.tsx#symbol:PageScroll
  - src/app/update-notice.tsx#symbol:UpdateNotice
  - src/components/request/request-card.tsx#symbol:RequestDates
  - src/components/ui/sheet.tsx#symbol:Sheet
  - src/components/ui/sheet.test.tsx
  - src/features/wizard/draft-status.tsx#symbol:DraftStatusBar
  - src/theme.test.ts#symbol:PAIRS
  - src/theme.test.ts#L37-L39
  - src/index.css#L200-L234
  - src/index.css#L236-L249
  - src/app/shell.tsx#symbol:SkipLink
  - src/app/shell.tsx#symbol:Sidebar
  - src/i18n/en.ts#symbol:skipToContent
  - src/i18n/ko.ts#symbol:skipToContent
  - index.html#L13-L31
  - src/app/theme.ts#symbol:applyTheme
  - src/components/ui/button.tsx#L66-L67
  - src/components/request/status.tsx#symbol:Stepper
  - src/features/wizard/steps.tsx#symbol:StepTitle
  - src/features/wizard/steps.tsx#symbol:ReviewStep
  - src/app/shell.tsx#symbol:Glyph
  - src/app/demo-banner.tsx#symbol:DemoBanner
  - src/components/ui/load-failed.tsx#symbol:LoadFailed
  - src/components/ui/load-failed.tsx#symbol:RefreshFailed
  - src/features/auth/login-page.tsx#symbol:ANNOUNCE_DELAY_MS
  - src/features/settings/time-zone-section.tsx#symbol:TimeZonePicker
  - src/features/schedule/schedule-page.tsx#symbol:DateGroup
  - src/features/schedule/month-view.tsx#symbol:MonthCalendar
  - src/features/admin/projects-page.tsx#symbol:ProjectsPage
  - playwright.config.ts#L17-L18
related:
  - docs/llm-wiki/COMPONENT_INVENTORY.md
  - docs/llm-wiki/E2E_WORKFLOWS.md
  - docs/llm-wiki/profiles/frontend.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-10
---

# Accessibility (WCAG)

## Summary

The target is WCAG 2.2 AA on phone, tablet and desktop. Colour contrast is enforced by a unit test; the cursor contract, 320 px reflow, the skip link and reduced motion by E2E tests; an axe-core scan covers every main screen in both themes; the rest (semantics, focus, live regions) by convention in the components.

## Colour and contrast

- Colours are design tokens in `src/index.css` (`@theme` block for light, `.dark` block for dark). Roles, not hues, are named: `brand-600` / `*-600` are fills that carry white text, `accent` and `*-fg` are text and icon colours, `*-50` / `*-100` are tints, `ink-900…400` is body text, `field` is a control border, `line` is decoration only, `inverse` / `on-inverse` is the inverted surface. One colour cannot serve both as a fill under white text and as text on a light surface in both themes, which is why the roles are split.
- `src/theme.test.ts` checks 43 foreground/background pairs in both themes: text pairs at 4.5:1 (`TEXT`) and non-text marks (control borders, chart marks, focus colours) at 3:1 (`UI`, SC 1.4.11). It also asserts that every token it checks is defined in each theme.
- The test reads `src/index.css` with regular expressions: it expects `#rrggbb` values and the `.dark { … }` block closed by a two-space-indented brace. Writing tokens as `oklch()`, short hex, or reformatting that block makes the test report missing tokens rather than check contrast.
- Adding a token that carries text or a control boundary means adding its pair to `PAIRS`.
- Colour is never the only signal (SC 1.4.1): a past-due date on a developer's work card is `danger-fg` text and also says "지남" / "past due" (`RequestDates`).
- Never dim text with `opacity` to mark something as past or secondary: the blended colour is no longer a checked pair and usually fails 4.5:1. Use a role tint and a checked text colour instead (past dates on the schedule sit on `bg-muted` with an `ink-400` date, in the list and in the month view).

## Dark mode

- An inline script in `index.html` runs before React, reads the persisted preference (`ax-request-portal:preferences`, falling back to `prefers-color-scheme`) and sets the `dark` class, `color-scheme` and background colour, so there is no light flash. Changing the persisted shape of the preferences store breaks this script silently.
- After start-up `src/app/theme.ts` (`applyTheme`, `startThemeSync`) keeps the class, `color-scheme` and `meta[name=theme-color]` in sync with the store and, for the `system` choice, with the OS setting.

## Interaction states

- Global cursor contract in `src/index.css`: buttons, `summary`, selects and ARIA widgets (`button`, `switch`, `radio`, `checkbox`, `tab`, `option`, `menuitem` roles) get `pointer`; `:disabled` and `[aria-disabled=true]` get `not-allowed`; `[aria-busy=true]` gets `progress` and wins because it comes last. Tailwind v4 no longer gives buttons a pointer, which is why the rule exists. `e2e/cursor.spec.ts` checks the computed cursor of every visible interactive element on every screen.
- `Button` sets `aria-busy` while `loading`, so the busy cursor and screen-reader state come from one prop.
- Focus is shown by one global `:focus-visible` outline (2 px, offset 2 px, brand colour).
- Form controls use 16 px text on coarse pointers so iOS does not zoom on focus.
- Reduced motion: under `prefers-reduced-motion: reduce` every animation and transition finishes in 0.01 ms and smooth scrolling is off (`src/index.css`). Near-zero rather than `none`, so `animationend` / `transitionend` handlers still run. `e2e/a11y.spec.ts` counts elements that would move and expects none under reduce.
- Touch targets are 44 px (`h-11` / `size-11`); the phone tab bar is taller. `Button size="sm"` is the documented exception. Sonner's toast action button is 24 px; a toast whose action matters on a phone raises it to 44 px (`UpdateNotice`).

## Semantics and focus management

- Skip link: `SkipLink` is the first tab stop on every signed-in screen; it is visually hidden until focused and moves focus to `<main id="main" tabIndex={-1}>` in code, so the URL hash and the router are not touched. The login screen has no navigation to skip. `e2e/a11y.spec.ts` checks it on the desktop project only: WebKit (phone and tablet projects) does not tab to links by default.
- Landmarks come from the shell: `header`, `main`, a labelled `nav` for the sidebar/rail and a separately labelled `nav` for the phone tab bar, where "new request" keeps the middle place on every account that has it (consistent navigation, SC 3.2.3; `phoneTabs`). In a mock build the phone's demo strip above the header is a labelled `aside` ("Demo mode"), because it sits outside `header` and `main`; from `md` the notice is a plain paragraph inside `header` and the strip is hidden (`display: none`, so it is not read twice). Neither has anything focusable, so the skip link stays the first tab stop. On the login screen the demo note is a plain paragraph inside `main`. Icon-only links carry `aria-label` (the notifications link includes the unread count, "알림 (N)").
- Label in Name (2.5.3): the visible text of a control must be part of its accessible name. Decorative text inside a control whose name already says it — the brand initials, the unread counter on the bell, the account initial — is drawn by CSS with the shell's `Glyph` (`content: attr(data-glyph)`, `aria-hidden`), not as DOM text. The account button is named by a visually hidden "My account" plus the user's name, visible from `lg`.
- A `<dl>` group holds only `<dt>` and `<dd>`: the wizard's review rows keep their edit button inside the `<dd>`, and a project card's target and rule counts sit outside its `<dl>`.
- The schedule's month view is a `<table>` (caption: the month), not an ARIA `grid`: screen readers move by week and day with their table commands, and no arrow-key handling is owed. Column headers show short weekday names and give screen readers the full ones; each cell starts with its full date, hidden visually, beside the visible day number (hidden from the accessibility tree). Release chips are links named "#id title, service, status"; a day's overflow is a button with `aria-expanded` and `aria-controls`; the table is `aria-busy` while another range's data stands in; the month name beside the arrows is a polite live region.
- `aria-current="step"` marks the current phase in `Stepper` and in the AI work panel; `aria-current="date"` marks today's cell in the schedule's month view; toggle groups use `aria-pressed` or `role="radio"` + `aria-checked`; switches use `role="switch"`.
- Live regions: `aria-live="polite"` for precheck results in the wizard, the status explainer on the detail page and the number of time-zone search matches; `role="status"` for spinners and the boot screen; `role="alert"` for `ErrorState` (and so the full `LoadFailed`), field errors, login errors and the wizard's missing-attachment notice.
- A compact `LoadFailed` is a polite `role="status"` (a screen can hold several; a run of alerts helps nobody), with a visually hidden full stop between its title and its message so they are read as two sentences. `RefreshFailed` is always in the DOM as an `sr-only` polite status and gets its text when a refresh fails, so the line is announced when it appears.
- A screen reader ignores a live region that arrives with its text already in it. The login screen's session-expiry notice is therefore injected 100 ms after mounting into an empty `sr-only` `role="status"`; the visible copy is `aria-hidden` and is the e-mail field's description, so it is heard once.
- The time-zone preview in Settings is not a live region (each arrow key on the select would be read out); the select points to it with `aria-describedby`.
- Wizard steps move focus to the step heading (`StepTitle`, `tabIndex=-1`) in a layout effect, before paint. A passive effect stole focus after the user had started typing and dropped the input.
- The tablet rail's full menu (md up to xl) is a modal Radix Dialog named "주 메뉴": opening moves focus into it, Tab stays inside, Escape or a click on the dimmed page closes it, focus goes back to the expand button (`aria-expanded`, `aria-haspopup="dialog"`), and the page behind is hidden from assistive technology meanwhile. A window resized past the rail's widths closes it rather than leaving focus in a hidden dialog. `e2e/a11y.spec.ts` checks it on a landscape tablet. Before, it was a plain overlay: Tab went on to the dimmed page behind, and Escape did nothing.
- `Sheet` (Radix Dialog) traps focus and closes on Escape. On closing it gives focus back to what had it when it opened; when that is gone the caller moves focus (after deleting a saved draft: the section heading, or `main` when the section went with it). A sheet that must not close mid-operation keeps Escape from closing it (deleting a saved draft).
- Saved drafts: the wizard's save line tells screen readers only when the draft stops reaching the account, once; a conflict or full-account notice describes the step heading, so it is heard when the heading takes focus. A count shown as `N/20` is read as a sentence (visually hidden text). See [Request Wizard](domains/11_wizard.md) and [My Requests](domains/08_requests.md).

## Reflow

- `e2e/layout.spec.ts` visits every route for every role at 320×568 and on a landscape tablet and asserts no horizontal scroll, including the English UI, and the schedule's month view on the landscape tablet. A CSS grid without `grid-cols-1` let `nowrap` children overflow at phone width; keep that class on single-column grids.
- At 320 px it also opens the notices and error states that only appear in some conditions — the demo banner (login and signed in), the time-zone settings and a detail screen with both clocks far from the head office, the session-expired notice, and a compact and a full `LoadFailed` — and checks that each one lies inside the viewport and that its own text is not clipped.
- Big screens: a `fit` page ([Frontend Profile](profiles/frontend.md)) scrolls its list inside a region rather than the window only from 1280 × 720; a narrower or shorter window, and a 200 % zoom of a 1080p screen, get the ordinary window scroll, so zoom and reflow behave as on every other page (SC 1.4.4, 1.4.10). Nothing clips: content that outgrows the window gives it a scrollbar instead of being cut off.
- Keyboard access to each such region (SC 2.1.1): it is `tabIndex=0` with `role="region"` and a name ("배정된 요청 목록", "알림 목록", "{title} 목록" / "{title} 내용" through `common.listOf` / `common.contentOf`, the request page's "#1024 내용" and "배포와 진행 기록"), because Safari does not let a keyboard into a scroll area that has no focusable content of its own, and a long text with no links in it would be out of reach; its focus ring is drawn inside it (`-outline-offset-2`), and its top padding keeps the first row's ring from being clipped. Back restores its position, as the router does for the window. `e2e/fit.spec.ts` checks that PageDown scrolls a focused list.

## Automated scan

- `e2e/axe.spec.ts` runs `@axe-core/playwright` on the login screen and every main screen of every role, in the light and the dark theme, with reduced motion so no scan catches a half-faded colour. Tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`. Findings of impact `serious` or `critical` fail the test (soft assertions, so one run lists every screen). A screen state that lives in the URL query, such as `/schedule?view=month`, is visited as its own entry, after a different screen (`openInApp` waits for the heading to change); the scan does not otherwise reach it.
- It runs in the phone and desktop projects; the tablet project skips it (`NOT_ON_TABLET` in `playwright.config.ts`): same engine and components as the phone, no findings of its own.
- `EXCLUDED_RULES` is empty: everything the first scan found was fixed. A rule added there needs its reason next to it.

## Evidence

- `src/theme.test.ts#symbol:PAIRS` — the 43 checked pairs; `src/theme.test.ts#L37-L39` — the 4.5:1 and 3:1 thresholds.
- `src/index.css#L200-L234` — focus outline and cursor contract; `src/index.css#L236-L249` — reduced-motion rule.
- `src/components/request/request-card.tsx#symbol:RequestDates` — a past-due date in words as well as colour.
- `src/app/page.tsx#symbol:PageScroll`, `e2e/fit.spec.ts` — the big-screen list region: when it applies, its name and keyboard access.
- `src/app/shell.tsx#symbol:Sidebar`, `e2e/a11y.spec.ts` — the tablet rail's menu as a modal dialog.
- `src/app/shell.tsx#symbol:SkipLink` — skip link and the focusable `main`; `src/i18n/en.ts#symbol:skipToContent` — its label, with `src/i18n/ko.ts#symbol:skipToContent` for Korean.
- `index.html#L13-L31` — pre-paint theme script.
- `src/app/theme.ts#symbol:applyTheme` — runtime theme sync.
- `src/components/ui/button.tsx#L66-L67` — `disabled` and `aria-busy` while loading.
- `src/components/request/status.tsx#symbol:Stepper` — `aria-current="step"`.
- `src/features/wizard/steps.tsx#symbol:StepTitle` — focus target for step changes.
- `src/components/ui/sheet.tsx#symbol:Sheet`, `src/components/ui/sheet.test.tsx` — focus given back when a sheet closes; `src/features/wizard/draft-status.tsx#symbol:DraftStatusBar` — the save line's announcements.
- `e2e/cursor.spec.ts`, `e2e/layout.spec.ts`, `e2e/theme.spec.ts`, `e2e/a11y.spec.ts`, `e2e/axe.spec.ts` — the automated checks; `playwright.config.ts#L17-L18` — which projects skip which specs.
- `src/app/shell.tsx#symbol:Glyph`, `src/app/demo-banner.tsx#symbol:DemoBanner` — CSS-drawn glyphs and the banner landmark.
- `src/components/ui/load-failed.tsx#symbol:LoadFailed`, `src/components/ui/load-failed.tsx#symbol:RefreshFailed`, `src/features/auth/login-page.tsx#symbol:ANNOUNCE_DELAY_MS`, `src/features/settings/time-zone-section.tsx#symbol:TimeZonePicker` — status semantics and the delayed announcement.
- `src/features/wizard/steps.tsx#symbol:ReviewStep`, `src/features/admin/projects-page.tsx#symbol:ProjectsPage`, `src/features/schedule/schedule-page.tsx#symbol:DateGroup` — `<dl>` structure and the muted past dates.
- `src/features/schedule/month-view.tsx#symbol:MonthCalendar` — the month view's table semantics, `aria-current="date"` and the folded day.
- `src/app/update-notice.tsx#symbol:UpdateNotice` — 44 px toast action.

## Open Questions

- None at the moment.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
