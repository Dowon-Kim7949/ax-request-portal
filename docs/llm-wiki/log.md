---
title: LLM-WIKI Change Log
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: change_log
project: ax-request-portal
last_updated: 2026-11-11
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - llm-wiki.config.json
evidence:

related:
  - docs/llm-wiki/index.md
visibility: public
contains_sensitive_info: false
---

# LLM-WIKI Change Log

This is an append-only change log. Do not edit existing entries; add new changes at the top.

## 2026-11-12 - Page preloading; the schedule says what may be opened; server search; notification channels; prices checked

- status: needs_review
- actor: claude-code
- scope: frontend, contract, mock, config
- changed:
  - src/app/page-preload.ts (new), src/app/router.tsx (`handle.preload`, `setPreloadRoutes`), src/app/shell.tsx (preload on intent and when idle), e2e/update.spec.ts
  - src/domain/model.ts (`ReleaseScheduleItem.requests[].canOpen`), src/api/contract.ts (`GET /releases` states it is company-wide), docs/openapi.json, src/mocks/engine.ts, src/features/schedule/
  - src/features/requests/my-requests-page.tsx (search through `q`)
  - src/config/schema.ts, src/config/app.config.ts (`notifications.channels`), src/features/settings/ (`notificationRows`)
  - src/config/ai.ts (Claude Sonnet 5.5 cache read 0.1, `asOf` 2026-11-12)
  - docs/llm-wiki/profiles/frontend.md, docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, docs/llm-wiki/E2E_WORKFLOWS.md, docs/llm-wiki/domains/08_requests.md, docs/llm-wiki/domains/09_schedule.md, docs/llm-wiki/domains/10_settings.md, docs/llm-wiki/domains/13_ops.md
  - docs/llm-wiki/domains/07_notifications.md, docs/llm-wiki/project-profile.md (a line each); status only, they cite a changed source and still hold: COMPONENT_INVENTORY, DOMAIN_FEATURES, GLOSSARY, WCAG, domains/00, 01, 02, 03, 11, 12
- summary:
  - Menu pages load ahead: on pointer, touch or focus over an item, and all of them once the browser is idle after the first screen (not when the viewer saves data).
  - The schedule is company-wide by contract. Each listed request carries `canOpen`; someone else's request is listed without a link instead of leading to a "not found" page.
  - My requests searches on the server (`q`, 250 ms after typing pauses); the filter's counts still count every request.
  - E-mail and messenger switches follow `notifications.channels`.
  - Seed prices re-checked against both providers' pricing pages: Claude Sonnet 5.5 cache reads are 0.05× input ($0.10); OpenAI lists a cache-write price per model, so none is derived any more.
- evidence:
  - src/app/page-preload.test.ts, src/mocks/calendar.test.ts, src/features/schedule/schedule-page.test.tsx, src/features/requests/my-requests-page.test.tsx, src/features/settings/notification-rows.test.ts
- caveats:
  - A demo browser that already holds mock data keeps its old Sonnet price until the data is reset; prices are operator data at runtime.

## 2026-11-12 - Navigation feedback and a page fade; the schedule's empty month and view switch

- status: needs_review
- actor: claude-code
- scope: frontend
- changed:
  - src/app/navigation-feedback.ts, src/app/navigation-progress.tsx (new), src/app/shell.tsx, src/index.css (`progress` animation)
  - src/components/ui/segmented.tsx (optional `icon`)
  - src/features/schedule/schedule-page.tsx, src/i18n/ko.ts, src/i18n/en.ts (`schedule.viewMonth`: 달력 / Calendar)
  - docs/llm-wiki/profiles/frontend.md, docs/llm-wiki/WCAG.md, docs/llm-wiki/COMPONENT_INVENTORY.md, docs/llm-wiki/domains/09_schedule.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, docs/llm-wiki/DOMAIN_FEATURES.md, docs/llm-wiki/E2E_WORKFLOWS.md (status only: they cite a changed source, and what they say still holds)
- summary:
  - A navigation pending for more than 150 ms (a page's code loading on its first visit) shows a thin progress bar at the top and marks `main` busy; a change of screen fades the page in over 160 ms. Both respect reduced motion.
  - The schedule's "No releases this month." moved onto the month's line, after "This month", as a status region. The view switch reads "List | Calendar" with icons.
- evidence:
  - src/app/navigation-feedback.test.tsx, src/features/schedule/schedule-page.test.tsx, e2e/schedule.spec.ts, e2e/a11y.spec.ts, e2e/axe.spec.ts
- caveats:
  - None.

## 2026-11-11 - Teams are records; AI usage follows a renamed team

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/domain/model.ts (`Team`, `TEAM_NAME_MAX`; `User.teamId` replaces `User.team`; `AiUsageReport.byTeam` / `byPerson` rows carry `teamId`), src/domain/ai.ts (`AiUsageEntry.teamId`, `AiCaller.teamId`), src/api/contract.ts (`TeamList`, `TeamInput`; `GET/POST /teams`, `PATCH /teams/{id}`; `UserCreate.teamId`, `UserPatch.teamId` with null for no team), docs/openapi.json
  - src/mocks/engine.ts (`teams`, `createTeam`, `updateTeam`, team checks on users; `STATE_VERSION` 8), src/mocks/seed.ts (`seedTeams`, team names per language), src/mocks/handlers.ts, src/mocks/store.ts, src/mocks/copy.ts (`teamNameTaken`, `teamNotFound`), src/mocks/browser.ts (demo accounts carry the team name)
  - src/api/queries.ts (`useTeams`, `useSaveTeam`), src/app/hooks.ts (`useTeamDirectory`), src/app/demo.ts, src/features/admin/users-page.tsx (teams sheet; team pickers), src/features/auth/login-page.tsx, src/features/ops/usage-page.tsx, src/features/ops/usage-charts.tsx, src/i18n/ko.ts, en.ts
  - src/mocks/api.test.ts, src/api/queries.test.tsx, src/domain/ai.test.ts, src/features/ops/usage-charts.test.tsx, src/stores/session.test.ts, e2e/admin.spec.ts, e2e/axe.spec.ts
  - docs/llm-wiki: domains/01_admin.md, domains/13_ops.md, domains/00_overview.md, domains/06_login.md, GLOSSARY.md, DOMAIN_FEATURES.md, E2E_WORKFLOWS.md, WCAG.md, ARCHITECTURE_CONVENTIONS.md; domains/02_auth.md, 03_dashboard.md, 04_detail.md, 05_home.md, 07_notifications.md, 08_requests.md, 09_schedule.md, 10_settings.md, 11_wizard.md and 12_work.md only back to needs_review (they cite a changed hub file, and none of their claims changed)
- summary:
  - Closes the AI Operations open question about free-text teams. A team is a record referred to by id; usage entries keep the team id of the moment, and the usage screen looks names up, so a rename keeps one row while a person who moves still leaves earlier calls with the old team.
  - Admins add and rename teams from the users page; teams are never deleted, because usage points at them. `User.team` is gone from the contract (a breaking change, made while no backend implements it).
- evidence:
  - src/mocks/api.test.ts ("lets admins add and rename teams", "books each call against the person who started it"), e2e/admin.spec.ts
- caveats:
  - Stored demo data from earlier versions is reseeded (`STATE_VERSION` 8).
  - The status-only documents must not be approved on 2026-11-11: they were approved that day, so a same-day approval makes them identical to main and fails the impact gate.

## 2026-11-10 - AI usage records who started each call; usage by team and by person

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/domain/ai.ts (`AiUsageEntry.userId`, `AiUsageEntry.team?`, `AiCaller`; `bookUsage` takes the caller), src/domain/model.ts (`AiUsageReport.byTeam`, `AiUsageReport.byPerson`), docs/openapi.json
  - src/mocks/engine.ts (`bookAi` takes the person; `startedBy`; `aiUsageReport` groups by team and person; `STATE_VERSION` 7), src/mocks/seed.ts (the usage history is the background requests' requesters' and their projects' developers')
  - src/features/ops/usage-page.tsx, src/features/ops/usage-charts.tsx (`TeamBars`, `PeopleList`, `TOP_PEOPLE`), src/i18n/ko.ts, en.ts (`usage.byTeam`, `byTeamNote`, `noTeam`, `byPerson`, `byPersonNote`, `otherPeople`; the subtitle)
  - src/domain/ai.test.ts, src/mocks/api.test.ts, src/features/ops/usage-charts.test.tsx, e2e/operator.spec.ts
  - docs/llm-wiki: domains/13_ops.md, ARCHITECTURE_CONVENTIONS.md, GLOSSARY.md, E2E_WORKFLOWS.md, DOMAIN_FEATURES.md, domains/01_admin.md, domains/11_wizard.md, domains/12_work.md; WCAG.md, domains/00_overview.md, 03_dashboard.md, 06_login.md, 07_notifications.md and 09_schedule.md only back to needs_review (they cite a changed hub file, and none of their claims changed)
- summary:
  - Closes the AI Operations open question "usage entries do not record who triggered the call". Every entry names the person whose action started it. The feasibility report made automatically on submission is the requester's, so there is no "system" row and the people add up to the month's total.
  - The team is copied onto each entry when it is booked: someone who changes team keeps earlier calls under the old one.
  - `/ops/usage` adds a team card (bars) and a person card (the ten who spent most, then everyone else in one row), side by side from `lg`. There is no team or person filter.
  - New open question: a team is free text, so renaming one starts a new row.
- evidence:
  - `api.test.ts` "books each call against the person who started it": a precheck and the automatic report are the requester's, a report after a team change carries the new team while the earlier ones keep the old, AI work is the developer's who ran it, and a person's row shows their latest team. The month's report: people and teams each add up to every call.
  - `npm run verify` passed (unit 645). E2E on three projects, the operator scenario and the operator groups of axe, fit, layout, theme, i18n and cursor: 13 passed.
- caveats:
  - Stored demo data from version 6 is discarded and reseeded once.
  - The request page's AI usage list does not show who started each call; the entries carry it for `report:read` viewers only.
- review notes:

## 2026-11-10 - The rail's menu as a dialog; menus read the routes' permissions; executives' requester E2E

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/app/shell.tsx (`Sidebar`: the tablet rail's menu is a Radix Dialog; `AppShell` takes `permissionsFor`), src/lib/use-media-query.ts (`SIDEBAR_UP`)
  - src/app/router.tsx (`permissionsFor`), src/app/nav.ts (`NavItem.permission` removed; `visibleNav(can, permissionsFor)`), src/app/nav.test.ts, src/app/shell.test.tsx, src/app/sign-out.test.tsx
  - e2e/a11y.spec.ts (the rail's menu), e2e/admin.spec.ts (an executive files a request)
  - docs/llm-wiki: WCAG.md, domains/02_auth.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, E2E_WORKFLOWS.md, profiles/frontend.md; COMPONENT_INVENTORY.md, domains/00_overview.md and 09_schedule.md only back to needs_review
- summary:
  - Three open questions are closed: WCAG (the rail's overlay and focus), Auth (`NavItem.permission` declared apart from the routes) and Domain Features (no E2E of an executive's requester abilities).
  - The tablet rail's expanded menu was a plain overlay. Focus stayed on the button behind it, Tab went on to the dimmed page, and Escape did nothing. It is now a modal Radix Dialog ("주 메뉴"), with the same look. It is closed when the window leaves the rail's widths.
  - The menus no longer declare permissions. An item shows when the page it links to would open, read from the routes' `handle.permission` (`permissionsFor`). The router passes the function to `AppShell` because importing it would close a module cycle.
  - An executive files a request, finds it in My requests, reads another person's request, and finds no developer queue in the menu or at its address.
- evidence:
  - Red, then green: `a11y.spec.ts` "the tablet rail" found no dialog before the change, then passed 3 of 3. The first green run failed on the outside click. Radix starts listening for outside clicks a tick after opening, so the test retries that click (a probe after 500 ms closed it).
  - `nav.test.ts`: every item links to a page of its own and shows exactly when its page would open, for every role.
  - The executive test passes on three projects. The same "no link" locator does find the queue for a developer on all three, so the check can fail.
  - `npm run verify` passed (unit 640). Full E2E on three projects: 244 passed, 0 failed.
- caveats:
  - The menu's dialog opens only at the rail's widths (`TABLET_UP` and below `SIDEBAR_UP`), and jsdom has no `matchMedia`, so only E2E exercises it.
- review notes:

## 2026-11-10 - UI: every page fits a big screen; the demo notice moves into the header

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/app/page.tsx (`PageColumns`, `PageScroll column`, `PagePlain`), src/index.css (`page-columns`; the line under a scrolled top for any region of the page), src/app/scroll-memory.ts (`preventScrollReset` and #hash moves keep the position)
  - src/app/router.tsx (`page()` sets `fit` on every route), src/app/guards.tsx (`RequirePermission` always in `PagePlain`)
  - every page under src/features: home, requests, wizard, detail, schedule, work (both queues), dashboard, admin (both), ops (all four), notifications, settings; src/i18n/ko.ts, en.ts (`common.listOf`, `common.contentOf`, `detail.sideLabel`)
  - src/app/demo-banner.tsx, src/app/shell.tsx (the demo notice: a strip on a phone, a box in the header from `md`), src/app/shell.test.tsx
  - e2e/fit.spec.ts (every screen of every role; the wizard's draft-id move), e2e/demo-banner.spec.ts (strip or box per viewport), e2e/drafts.spec.ts, e2e/requester.spec.ts and e2e/screens.spec.ts (wait for the step a picked type moves to)
  - docs/llm-wiki: profiles/frontend.md, COMPONENT_INVENTORY.md, WCAG.md, E2E_WORKFLOWS.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md, GLOSSARY.md, and domains 01-13 except 00
- summary:
  - Review of the pilot: `/work` cards go to three columns on a list of 1344 px or wider (a container query, so FHD and not a 1536 px window, where the details wrapped). The notifications column keeps a reading width at the left (`max-w-3xl`). The demo notice becomes a box at the left of the header from a tablet up, where the brand had moved to the sidebar; phones keep the strip.
  - Every `page()` route is now `fit`. Multi-panel pages scroll per column: the request page's body and its release-and-history side, and the dashboard's panels under its tiles. Usage keeps its tiles and dashboard its tiles and month stepper in place. Home keeps its greeting in place. My requests keeps its filter `sticky` at the top of its region once the drafts have scrolled by.
  - The wizard's step bar stays a direct child of `Page` so it is still pinned under the header on a phone. Its actions moved outside the form (linked with `form=`), so a big screen keeps them along the bottom of the window.
  - The region honours `preventScrollReset`, read from `UNSAFE_DataRouterStateContext` as the router's own restoration does. Without it, the wizard's `?draft=` move on the first save sent the step back to its top while the person was typing; the new fit test fails that way (scrollTop 0) when the check is removed.
- evidence:
  - Green: `npm run verify` (unit 638). `e2e/fit.spec.ts`: every screen of every role at 1920×1080 and 1280×720 shows no window scroll, named focusable regions, and equal edges for header, top and the outer edges of the columns.
  - Full E2E on three projects: 237 passed, 2 failed. Both were `drafts.spec.ts` on the tablet: a radio that moves to the next step, then "next" clicked while the router still showed the type step. The tests now wait for the step heading. drafts, fit, demo-banner and requester then passed 60 of 60 on three projects. The final full run gave 239 passed and 1 failed: the same race in `requester.spec.ts` "survives a reload", where the radio has no "auto-advances" comment. With the wait it passed 12 of 12. `screens.spec.ts` (README screenshots) got the same wait.
  - Screenshots checked by eye: detail, dashboard, usage, wizard at 1920 and 1280; the wizard on a phone (step bar pinned while scrolling) and a tablet.
- caveats:
  - A second `UNSAFE_` React Router context (`UNSAFE_DataRouterStateContext` in `scroll-memory.ts`) joins the one in `useLiveSearch`; check both when upgrading React Router's major version.
  - The not-found route stays outside `fit` and scrolls the window.
- review notes:

## 2026-11-10 - UI: big screens fit the window, only the list scrolls (pilot: /work, /notifications)

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/index.css (`fit:` variant, `--page-max` / `--page-pad` / `--page-gutter`, `page-band` / `page-column`, the line under a scrolled page top)
  - src/app/page.tsx (`Page`, `PageTop`, `PageScroll`), src/app/scroll-memory.ts (new), src/lib/scrollbar-width.ts (new), src/lib/use-media-query.ts (`FIT_QUERY`) and its test (new), src/main.tsx
  - src/app/shell.tsx (`data-fit`, header and `main` on the shared page width), src/app/router.tsx (`RouteHandle.fit`), src/app/guards.tsx (`RequirePermission` `fit`)
  - src/features/work/assigned-page.tsx, src/features/notifications/notifications-page.tsx, src/i18n/ko.ts, src/i18n/en.ts (region names)
  - e2e/fit.spec.ts (new), e2e/helpers.ts (`expectNoHorizontalScroll` also measures scroll regions), playwright.config.ts
  - e2e/requester.spec.ts (waits for the step between two "next" clicks)
  - docs/llm-wiki/profiles/frontend.md, ARCHITECTURE_CONVENTIONS.md, COMPONENT_INVENTORY.md, WCAG.md, E2E_WORKFLOWS.md, DOMAIN_FEATURES.md, domains/02_auth.md, 07_notifications.md, 12_work.md; domains/00_overview.md, 09_schedule.md and 11_wizard.md only back to needs_review (they cite changed files; nothing in them changed)
- summary:
  - From 1280 × 720 a route with `handle.fit` fills the window under the header: the page's top (title, filters, page-wide notices) stays in place and only its list scrolls, in a region as wide as the content column. Smaller windows, phones, tablets and a 200 % zoom keep the window scroll, and so do pages not yet converted.
  - The content width grows from 72rem to 90rem at `2xl` on every page, through shared variables that the header uses too.
  - The region reserves the scrollbar gutter on both edges; the header and the page top pad by the measured gutter (`--sbw`), so their edges match the list's with or without a scrollbar. The gutter is measured as `scrollbar-gutter` reserves it: headless Chromium hides `overflow: scroll` bars (0 px) but still reserves 15 px.
  - The region is `relative`: an `sr-only` text inside it (the unread marker) otherwise sat below the window and gave the page a scrollbar at 1280 × 720.
  - `useScrollMemory` restores the region per history entry on back and forward; any other navigation starts it at the top, as `<ScrollRestoration>` does for the window.
- evidence:
  - Green: `npm run verify` (unit 63 files / 637 passed). `e2e/fit.spec.ts` 7 passed. Full E2E on three projects without the axe groups for unrelated screens: 231 passed, 2 failed. The two failures were `requester.spec.ts` "audit findings" on WebKit; it clicked "next" twice without waiting, and a click during the step's async validation landed on the same step. That was 3 of 8 on the branch under load, and 0 of 8 and then 12 of 12 passing in later runs. With a wait for the step heading, phone, tablet and desktop pass 12 of 12.
  - Edges measured equal for header, page top and list at 1920×1080, 1280×720 and 1366×650. Screenshots at 1920×1080 and 1280×720 checked by eye.
- caveats:
  - Pilot only: the rest of the pages, the multi-panel ones (detail, dashboard, home: one scrolling region per column), the wizard's step bar and `#drafts` anchor, and the demo banner's "scrolls away" wording follow in the next change.
  - Card columns at `2xl` are unchanged (two on /work); whether the wider page wants three is left to review.
- review notes:

## 2026-11-10 - UI: "new request" as the middle phone tab; the usage page's chip beside its title

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/app/nav.ts (`phoneTabs`, `PHONE_PRIORITY`), src/app/nav.test.ts (new)
  - src/app/page.tsx (`PageHeader` `badge`), src/app/page.test.tsx (new), src/features/ops/usage-page.tsx
  - src/app/shell.tsx (`BottomNav`: every tab icon in a 32 px box)
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, profiles/frontend.md, domains/13_ops.md, COMPONENT_INVENTORY.md, WCAG.md
- summary:
  - The phone tab bar took the first four permitted items of one priority list, so "new request" moved between the second and fourth tab by role. It is now always the middle tab (third of five) for anyone with `request:create`; the other tabs keep the priority order. Requester and admin tabs change; the operator, who cannot file requests, keeps four priority tabs.
  - The usage page's "estimate" chip sat in `actions`, bottom-aligned after the wrapped description on a phone (440 px). `PageHeader` gains `badge`, shown on the title's row and centred on it; `actions` stays for buttons.
  - The "new request" circle (32 px) is larger than the other tab icons (24 px), which pushed its label lower; every tab icon now sits in a 32 px box.
- evidence:
  - Red: `nav.test.ts` "keeps new request in the middle" failed against the old order. `page.test.tsx` was written with the change (no red run). Green: unit 62 files / 636 passed; lint and typecheck pass. Scoped E2E (smoke; layout at 320 px for every role; axe requester, executive, admin and operator screens) 36 passed. Screenshots at 440 px (requester and admin tabs, the usage header) checked by eye.
- caveats:
  - Other pages' `actions` (buttons) keep their bottom alignment; only page-level status chips move to `badge`.
- review notes:
  - Re-review the navigation bullet in ARCHITECTURE_CONVENTIONS.md, the evidence line in DOMAIN_FEATURES.md, the layout and `PageHeader` bullets in profiles/frontend.md and the estimate bullet in 13_ops.md, the `BottomNav` row in COMPONENT_INVENTORY.md and the landmarks bullet in WCAG.md, then approve the six documents.

## 2026-11-10 - Feature: dates on the developer's work cards

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/components/request/request-card.tsx (`showDates`, `RequestDates`), src/components/request/request-card.test.tsx (new)
  - src/features/work/assigned-page.tsx
  - src/i18n/ko.ts, src/i18n/en.ts (`requests.wantedBy`, `requests.releaseOn`, `requests.pastDue`)
  - docs/llm-wiki/domains/12_work.md, domains/08_requests.md, COMPONENT_INVENTORY.md, WCAG.md, ARCHITECTURE_CONVENTIONS.md
- summary:
  - `/work` cards show the requester's wanted-by date and the release date when set. While the request is open, a date before the head office's today is marked past due, in words and in `danger-fg`. The fields were already in `WorkRequestSummary`; no contract change.
  - `showDates` is opt-in: the requester's list and home keep their cards unchanged.
  - A month view for `/work` was considered and dropped: the queue is ordered by whose turn it is, `desiredDate` is optional (3 of 19 seed scenarios), and release dates are already on the schedule's month view.
- evidence:
  - Red: `request-card.test.tsx` 4 of 6 failed before the dates row existed. Green: 6/6; all unit tests 60 files / 632 passed; lint, typecheck and format pass.
- caveats:
  - The past-due check uses the head office's today on the viewer's device clock (`hqToday`), the same rule as the schedule.
  - `ARCHITECTURE_CONVENTIONS.md` and `WCAG.md` cite the message files as a whole, so any new message key makes them stale for `impact.source_changed`; each gained one source-backed line.
- review notes:
  - Re-review the Assigned bullet in 12_work.md, the `RequestCard` row in COMPONENT_INVENTORY.md, the new bullets in 08_requests.md, WCAG.md and ARCHITECTURE_CONVENTIONS.md, then approve the five documents with `npx llm-wiki review --approve <path>` (one `--approve` per path).

## 2026-11-09 - Docs: cite formatKrw by line range in AI Operations

- status: needs_review
- actor: claude-code
- scope: docs
- changed:
  - docs/llm-wiki/domains/13_ops.md
- summary:
  - `13_ops.md` cited `src/lib/format.ts#symbol:formatKrw`, which `impact.source_changed` reads as the whole file, so any new formatter made it stale. It now cites `src/lib/format.ts#L162-L175`, compared region by region.
- evidence:
  - CI's wiki gate failed on PR #15 after a stamp-only re-approval left the document unchanged against main; `npx llm-wiki validate --strict --agent claude` and `impact --since main` pass after this change.
- caveats:
  - A line range moves when code above it changes; keep it on `formatKrw` when `format.ts` is edited above line 162.

## 2026-11-09 - Feature: a month view for the release schedule

- status: needs_review
- actor: claude-code
- scope: code, tests, docs
- changed:
  - src/features/schedule/schedule-page.tsx, src/features/schedule/month-view.tsx, src/features/schedule/month-grid.ts
  - src/features/schedule/schedule-page.test.tsx, src/features/schedule/month-grid.test.ts
  - src/lib/use-media-query.ts, src/lib/format.ts (`formatWeekday`), src/lib/format.test.ts
  - src/i18n/ko.ts, src/i18n/en.ts (`schedule.view*`, month navigation, `emptyMonth`, `more`, `less`)
  - e2e/schedule.spec.ts (new), e2e/axe.spec.ts and e2e/layout.spec.ts (`/schedule?view=month` visited)
  - docs/llm-wiki/domains/09_schedule.md, WCAG.md, E2E_WORKFLOWS.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md, GLOSSARY.md, domains/13_ops.md
- summary:
  - `/schedule` switches between the date list and a Sunday-first month table with `?view=month` (and `?month=YYYY-MM`), replacing the history entry. The month view loads exactly its grid's range from `GET /releases`; no contract change.
  - The month view exists from the `md` breakpoint up (`useMediaQuery(TABLET_UP)`); phones keep the list, even from a month link.
  - Days are head-office calendar days; a busy day folds after two releases behind an "N more" button.
- evidence:
  - Red: `schedule-page.test.tsx` could not load before `month-view.tsx` existed. Green: schedule unit tests 13/13; `npm run verify` passes (59 files / 625 tests, build, real-backend build check).
  - Scoped E2E (as agreed: only the screens worked on): `schedule.spec.ts` on phone, tablet and desktop, `axe.spec.ts` "requester screens" light and dark on phone and desktop, `layout.spec.ts` requester routes at 320 px (Korean and English) and on a landscape tablet — 10 passed.
- caveats:
  - The full E2E suite was not run locally; CI runs it.
  - `domains/13_ops.md` and `GLOSSARY.md` cite `src/lib/format.ts` as a whole file, so adding `formatWeekday` made them stale for `impact.source_changed`. 13_ops is moved back to `needs_review` with no content change; GLOSSARY gained one example. Both need a person's re-approval.
  - `schedule.spec.ts` fixes the head-office zone to `Asia/Seoul`, the template's `organization.timeZone`.
- review notes:
  - Re-review the Views section of 09_schedule.md, the month-view bullets in WCAG.md and the new rows in E2E_WORKFLOWS.md against the code, then approve the seven documents with `npx llm-wiki review --approve <path>`.

## 2026-11-09 - Fix: Korean day periods on older locale data; a draft-sync test race

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/lib/format.ts, src/lib/format.test.ts
  - src/features/drafts/sync-engine.test.ts
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
- summary:
  - `formatDateTime` maps the Korean day period to 오전 / 오후 through `formatToParts`, because CLDR 47 data (Node 22 and 24, Playwright's WebKit, browsers built on it) writes AM / PM. CI failed on that for Node 22.22.2, 24.15.0 and the phone and tablet E2E projects.
  - The sync-engine test API counts a delete once the server has answered, so a test that waits for it reads the account after the delete.
- evidence:
  - A test that feeds the old data's AM / PM fails without the mapping and passes with it; npx vitest run passes (57 files / 612 tests).
- caveats:
  - Only the Korean day period is mapped; other locale-data differences are not normalised.

## 2026-11-09 - Saved drafts on every home that may file requests; list step names; no unused draft hooks

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/features/home/home-page.tsx, src/features/home/home-page.test.tsx
  - src/features/drafts/rows.ts, src/features/drafts/drafts-section.tsx, src/features/drafts/drafts-section.test.tsx, src/i18n/ko.ts, src/i18n/en.ts (`wizard.checklist.name`)
  - src/api/queries.ts, src/api/queries.test.tsx
  - docs/llm-wiki: domains/05_home.md, domains/08_requests.md, domains/11_wizard.md
- summary:
  - Home shows the saved drafts to everyone with `request:create`: reviewers (developers, admins) get them after the developer queue, and only when they have a draft.
  - A draft row names the criteria step "Audit findings" for a `checklist` request, as its screen does.
  - Removed `useDraft`, `useCreateDraft`, `useUpdateDraft` and `DRAFT_MUTATION_KEY`, which only tests used; the sync engine orders each draft's saves itself.
- evidence:
  - npx vitest run on the changed areas passes; npm run lint, typecheck and format check pass.
- caveats:
  - Supersedes the caveat in the entry below that reviewers see their drafts on `/requests` only.

## 2026-11-09 - Feature: drafts saved to the account

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - Contract and mock: src/api/contract.ts (`DraftContent`, `SavedDraft*`, `RequestSubmission`, `DRAFT_ID_PATTERN`, error codes `conflict` / `limit_reached`, `EndpointSpec.conflict`, five `/drafts` endpoints: 41 in all), src/api/openapi.ts, docs/openapi.json, src/config/ (`drafts.maxPerAccount`), src/mocks/ (`MockState.drafts`, STATE_VERSION 6, `clientId`, per-account limit, `createRequest` deletes the named draft)
  - Client: src/api/queries.ts (`keys.drafts` / `keys.draft`, `useDrafts`, `storeSavedDraft`, `dropSavedDraft`), src/stores/draft.ts (drafts per person on this device, aliases, `clearDrafts`), src/stores/session.ts, src/features/drafts/ (sync engine, hooks, rows, saved-drafts section), src/features/wizard/ (`?draft=`, opening, save line, conflict and limit notices, submission with `draftId`), src/app/sign-out.tsx, src/app/shell.tsx, src/components/ui/sheet.tsx (focus return, `onCloseAutoFocus`), src/features/home/, src/features/requests/, src/i18n/
  - Tests: unit tests next to the code above (new: sync-core, sync-engine, rows, drafts-section, draft store, sign-out, sheet); e2e/drafts.spec.ts, e2e/helpers.ts (`seedSavedDrafts`, `keepDraftOffline`, `SEEDED_DRAFTS`), axe, i18n, requester and screens specs
  - docs/llm-wiki: domains/11_wizard.md, 08_requests.md, 05_home.md, 02_auth.md, 00_overview.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, GLOSSARY.md, E2E_WORKFLOWS.md, COMPONENT_INVENTORY.md, WCAG.md, profiles/frontend.md
  - README.md, README.ko.md
- summary:
  - A draft is written to this device as it is typed (`ax-request-portal:drafts:<userId>`) and saved to the account by a sync engine that sends one request at a time, a second after typing pauses and on step changes, leaving, hiding, start and reconnecting. The device keeps only what the account does not have yet.
  - Creates carry `clientId` so a lost answer makes no second draft; updates carry `baseVersion` and a `409 conflict` lets the person keep this screen's version or load the saved one; `409 limit_reached` (20 per account) keeps the draft on this device; a `404` continues it as a new draft.
  - The wizard names the draft in `?draft=` (a local id, then the server id), opens account drafts on any device, shows the save state under the progress bar and asks before leaving only when the words are kept nowhere. A submission names its draft and the server deletes it.
  - Saved drafts are listed on My requests (`#drafts`), on the requester's home and as a one-line notice on a new request, with badges for drafts on this device only and conflicts, continue and delete.
  - Signing out sends waiting drafts first (up to 3 s) and asks before deleting the ones only this device has; the account keeps its drafts. `Sheet` gives focus back to what opened it.
- evidence:
  - npx vitest run: 57 files / 611 tests pass; npx playwright test --list: 253 tests in 23 files.
  - npx llm-wiki validate --strict --agent claude passes.
- caveats:
  - The wizard's URL updates rely on React Router's `UNSAFE_DataRouterContext`.
  - Two tabs of one browser share one device copy of a draft (last writer wins on the device; typed words are protected by the conflict notice).
  - On home, the saved drafts are shown only in the requester section; people with `request:review` see them on `/requests` only.
  - The E2E offline emulation depends on the client reading the global `fetch` at each call.

## 2026-11-05 - Fix and feature: sessions, load failures, domain guards, deployment hardening, time zones

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - Sessions: src/stores/session.ts (end reasons), src/stores/draft.ts, src/app/session-sync.ts, src/app/guards.tsx, src/app/hooks.ts (`userCan`), src/app/router.tsx (pathless root, `RouteHandle`), src/features/auth/ (`post-login.ts`, expiry notice)
  - API and screens: src/api/ (client deadline, `timeoutOf`, `isRetryable`, `refresh.ts`, `error-text.ts`, mutation scopes, optimistic read), src/components/ui/load-failed.tsx, src/app/pages.tsx, every feature page, the wizard (debounced draft, leave confirmation, missing attachments)
  - Domain and mock: src/domain/ (`releaseDateMissing`, `checkBudgetLimits`, `url.ts`), src/mocks/ (STATE_VERSION 5, revision, `signals.ts`, attachment ownership, notification cap, `readableDate`), src/app/demo-data-sync.tsx, src/app/demo-storage-notice.tsx, docs/openapi.json
  - Deployment: src/config/env-check.ts, src/config/nginx-csp.ts, src/config/zod-jitless.ts, vite.config.ts (`__API_MOCK__`, `ax:drop-mock-worker`, `ax:preview-csp`), scripts/check-real-build.mjs, deploy/ (nginx.conf, check-nginx.sh, csp-hashes.mjs), src/app/demo-banner.tsx, .env.example, README.md
  - Time: src/config/app.config.ts (`organization`), src/lib/time-zone.ts, src/lib/format.ts, src/app/time-zone.ts, src/components/ui/date-time.tsx, src/features/settings/time-zone-section.tsx, src/stores/preferences.ts, the mock engine's business calendar
  - Tests: unit tests next to the code above; e2e/fixtures.ts and new specs auth, attachments, axe, csp, demo-banner, lifecycle, time-zone; layout.spec 320 px states; playwright.config.ts (time zone, `NOT_ON_TABLET`)
  - docs/llm-wiki: every document except index.md, back to `needs_review` (domains/00–13, ARCHITECTURE_CONVENTIONS, COMPONENT_INVENTORY, DOMAIN_FEATURES, E2E_WORKFLOWS, GLOSSARY, README, WCAG, project-profile, profiles/frontend)
- summary:
  - Signing out on purpose leads to `/login` without `next` and deletes the person's draft; a 401 ends the session only for the token it refused and keeps `next` with a notice; `resolvePostLoginPath` is the one reader of `next` (in-app, existing, not `/login`, permitted by `handle.permission`); tabs follow each other's sign-ins and sign-outs.
  - Every call has an endpoint time limit (30 s, uploads 120 s) and fails as an `ApiError`; only network, timeout and 5xx are retried; screens show `LoadFailed` when nothing loaded and keep data with `RefreshFailed` when a refresh fails; changes to one request run in order.
  - `markReleased` needs a scheduled date; budget limits share one rule; every URL in the contract passes `isSafeUrl`; the mock keeps tabs consistent through a revision, refuses someone else's attachment and caps notifications at 200 per person.
  - `vite build` refuses wrong build settings; a real-backend build carries no mock; nginx sends a strict CSP (inline script by hash), `Permissions-Policy` and COOP, and every E2E spec runs under that CSP; demo builds show a banner.
  - Timestamps show in the viewing time zone with head-office time where the clocks differ; date-only values never shift; "today" and totals follow the head-office business calendar; Settings has a time-zone card.
  - Accessibility: an axe-core scan of every main screen (phone and desktop, light and dark) with no excluded rules; decorative text in named controls is CSS-drawn (`Glyph`); `<dl>` groups hold only `<dt>`/`<dd>`; past schedule dates use a muted background instead of opacity.
  - E2E: the tablet `theme.spec` and desktop `admin.spec` time-outs came from cold starts between screens (now `openInApp` and `COLD_START_TIMEOUT`); WebKit on Windows stops animation frames for idle pages, so `e2e/fixtures.ts` keeps a frame loop running there; `lifecycle.spec` follows one request through every step on three viewports.
  - Corrected while re-reviewing: the contract has 36 endpoints (not 35); `operator` added to the glossary's roles; the feature list separates admin and operator features.
- evidence:
  - npm run verify (lint, format, typecheck, 44 unit test files / 437 tests, build, check:real-build) passes; full E2E 175 tests: 152 passed, 23 skipped by design (browser-specific or opt-in), 0 failed.
  - npx llm-wiki validate --strict --agent claude and npx llm-wiki impact --since main --strict pass.
- caveats:
  - The session's end reason lives in memory only: after reloading the login screen, only the permission check applies to `next`.
  - The nginx configuration is first run on a real nginx in the CI `nginx` job; the sub-path variant is a commented example.
  - The frame-loop fixture is installed for WebKit on Windows only; WebKit on Linux was not measured.
  - A viewer behind the head office's clock (e.g. North America) cannot pick their local "today" once the head office's date has moved on; the date inputs say so.

## 2026-11-04 - Feature: notice when a newer version is deployed

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - vite.config.ts (build id, `__BUILD_ID__`, `ax:version-file` plugin writing `version.json`), src/vite-env.d.ts, .env.example (`VITE_BUILD_ID`)
  - src/app/update-check.ts, src/app/update-notice.tsx (new), src/App.tsx, src/app/router.tsx (`page()` checks on a failed chunk load), src/i18n/ko.ts, src/i18n/en.ts (`update.*`)
  - deploy/check-nginx.sh (check 7: `version.json` present and `no-cache`), deploy/nginx.conf (comment only)
  - tests: src/app/update-check.test.ts, e2e/update.spec.ts (new)
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, E2E_WORKFLOWS.md, DOMAIN_FEATURES.md, COMPONENT_INVENTORY.md, WCAG.md, project-profile.md, profiles/frontend.md, domains/00_overview.md (status only: its claims still hold, re-review after the router change)
- summary:
  - Open tabs compare their build id with the deployed `version.json` when they become visible, every 5 minutes, and when page code fails to load; a newer id shows one persistent top-center toast with a 44 px reload button. Nothing reloads by itself.
- evidence:
  - e2e/update.spec.ts failed before the change (no notice) and passes after it on desktop/Chromium; src/app/update-check.test.ts covers once-per-build, unreadable files and shared requests.
  - node_modules/vite/dist/node/chunks/node.js (`handlePreloadError`): `vite:preloadError` fires only for imports that go through the preload helper, hence the extra check in `page()`.
- caveats:
  - The E2E spec runs only in Chromium: WebKit cannot route requests that pass through the mock's service worker. The phone layout was checked by screenshot at 390 px in Chromium.
  - On GitHub Pages a rerun of the deploy workflow for the same commit keeps the same id, so it is not announced.

## 2026-11-04 - Fix: mock API stops answering after its service worker restarts

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/mocks/handlers.ts (`MOCK_RESPONSE_HEADER` on every mock response), src/mocks/browser.ts (`reattachIfBypassed`), src/api/client.ts (`recover` hook, `ClientHooks` exported), src/main.tsx (wires the hook in mock mode)
  - tests: src/api/client.test.ts, src/mocks/handlers.test.ts (new), e2e/mock-api.spec.ts (worker-restart regression)
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, docs/llm-wiki/E2E_WORKFLOWS.md (both back to `needs_review`)
- summary:
  - A tab left alone in the mock-mode demo showed an error on every screen until a reload: the browser stopped the idle MSW worker, the restarted worker forgot the page (`activeClientIds` is in memory) and passed `/api` calls to the network, where GitHub Pages answers `404`.
  - A response without the mock's mark now makes the client re-send MSW's `MOCK_ACTIVATE`, wait for `MOCKING_ENABLED` (3 s at most) and resend the request once.
- evidence:
  - public/mockServiceWorker.js (`activeClientIds`, the bypass when it is empty), node_modules/msw/lib/browser/index.js (5 s `KEEPALIVE_REQUEST` timer)
  - e2e/mock-api.spec.ts failed before the fix with the same error screen and passes after it (desktop/Chromium).
- caveats:
  - `MOCK_ACTIVATE` / `MOCKING_ENABLED` are MSW's internal worker protocol; the E2E test is the guard on MSW upgrades and runs only in Chromium (CDP).
  - `domains/02_auth.md` cites `src/api/client.ts` and `src/mocks/handlers.ts` by symbol (compared file by file); its claims still hold, but once it is `verified` the impact gate will ask for it to be re-reviewed.

## 2026-11-04 - Feature: scope check, report assumptions and project rules, preview feedback, audit-finding requests

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/domain/model.ts, src/domain/lifecycle.ts, src/domain/precheck.ts, src/api/contract.ts, src/api/queries.ts, src/config/ (workflow.scopeCheck, request type `checklist`), docs/openapi.json
  - src/mocks/ (engine, ai, seed, handlers, copy, browser; STATE_VERSION 4), src/features/detail/ (scope-panels, preview-panels, developer-panels, request-content, request-detail-page), src/features/wizard/, src/features/admin/projects-page.tsx, src/i18n/, src/components/request/
  - unit tests (lifecycle, precheck, wizard schema, mock API, seed) and e2e (requester, developer, admin, plus the route sweeps in cursor, i18n, layout and theme)
  - docs/llm-wiki/domains/00_overview, 01_admin, 04_detail, 07_notifications, 11_wizard, 12_work, GLOSSARY.md, DOMAIN_FEATURES.md, E2E_WORKFLOWS.md, ARCHITECTURE_CONVENTIONS.md
- summary:
  - New status `scope_check` (requester's turn) between the report and developer review, with events `scopeReady`, `approveScope` and `reviseScope` (at most twice, counted against the per-request AI limit); reports with nothing to confirm still go straight to `review`.
  - Reports list unconfirmed assumptions and check every project rule (`Project.constraints`); the first `runWork` needs every assumption confirmed.
  - Work runs carry a preview; the requester's reaction (`PUT /requests/{id}/preview-feedback`) is advisory and does not change the status.
  - Request type `checklist`: audit findings, each one an acceptance criterion; the wizard imports them from a pasted table.

## 2026-11-03 - Feature: operator role, AI agents and provider-aware AI usage (Claude / GPT)

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/domain/ai.ts, src/config/ai.ts, src/domain/roles.ts, src/domain/model.ts, src/api/contract.ts, docs/openapi.json (35 endpoints)
  - src/mocks/ (engine, ai, seed, handlers, copy), src/features/ops/, src/features/detail/, src/features/admin/users-page.tsx, src/features/home/home-page.tsx, src/components/ai/, src/app/ (nav, router, shell)
  - e2e/operator.spec.ts and the role sweeps in admin, cursor, i18n, layout and theme specs
  - docs/llm-wiki/domains/13_ops.md (new), 00_overview, 01_admin, 02_auth, 04_detail, 05_home, 06_login, 12_work, index.md, DOMAIN_FEATURES.md, GLOSSARY.md, COMPONENT_INVENTORY.md, E2E_WORKFLOWS.md, ARCHITECTURE_CONVENTIONS.md
- summary:
  - New `operator` role holds `budget:manage`, `agent:manage` and `usage:view`; `admin` keeps people and projects and cannot assign or edit operators. The AI budget moved to `/ops/budget` (`/admin/budget` redirects).
  - AI usage is booked per call from each provider's own usage shape, normalized to one token shape and priced with the operator's table; developers see it per request and the run buttons are disabled at the per-request limit.
  - The per-request-limit open question in 01_admin is resolved and removed.
- evidence:
  - src/domain/ai.test.ts, src/mocks/api.test.ts ("AI budget", "AI operations"), src/lib/chart.test.ts, e2e/operator.spec.ts
- caveats:
  - Default prices were checked on 2026-11-03; OpenAI cache-write prices other than GPT-6 Astra are derived (1.25× input), and the exchange rate is a placeholder.
  - Codex `input_tokens` is assumed to include cached tokens, as in the Responses API.
  - Per-user ChatGPT or Claude subscription sign-in is not offered; see the open questions in domains/13_ops.md.

## 2026-11-03 - Fix: skip link, reduced motion, per-request AI limit, dashboard alert threshold

- status: needs_review
- actor: claude-code
- scope: code, docs
- changed:
  - src/app/shell.tsx (SkipLink, focusable main), src/index.css (reduced-motion rule), src/i18n/ko.ts, src/i18n/en.ts (nav.skipToContent)
  - src/mocks/engine.ts (requestSpentKrw, limit check on runWork / requestRevision, aiAlertThresholdPct in the dashboard), src/mocks/copy.ts (requestBudgetExceeded)
  - src/domain/model.ts (DashboardSummary.aiAlertThresholdPct), docs/openapi.json (regenerated), src/features/dashboard/dashboard-page.tsx
  - src/mocks/api.test.ts (AI budget tests), e2e/a11y.spec.ts (new)
  - docs/llm-wiki/WCAG.md, domains/01_admin.md, domains/03_dashboard.md, domains/12_work.md, E2E_WORKFLOWS.md
- summary:
  - Closed four open questions recorded when the wiki was written. The dashboard contract gains `aiAlertThresholdPct`; a backend implementing the contract must return it.
  - The per-request limit is checked against spending already booked, not an estimate of the next run; 0 means no limit.
- evidence:
  - src/app/shell.tsx#symbol:SkipLink, src/index.css#L190-L203, src/mocks/engine.ts#symbol:requestSpentKrw, src/domain/model.ts#symbol:DashboardSummary
  - Red before the change, green after: src/mocks/api.test.ts "AI budget" (2 tests) and e2e/a11y.spec.ts (2 tests)
- caveats:
  - The skip link is tested on the desktop project only; WebKit does not tab to links by default.
  - The request page does not show how much of the per-request limit a request has used.

## 2026-11-03 - Wiki written from the code; governance raised to standard

- status: needs_review
- actor: claude-code
- scope: docs
- changed:
  - docs/llm-wiki/index.md, README.md, project-profile.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, GLOSSARY.md
  - docs/llm-wiki/COMPONENT_INVENTORY.md, WCAG.md, E2E_WORKFLOWS.md, profiles/frontend.md
  - docs/llm-wiki/domains/00_overview.md through 12_work.md
  - llm-wiki.config.json (mode `standard`, `impact.source_changed: error`), .github/workflows/llm-wiki.yml
- summary:
  - Replaced every placeholder with source-backed content in English. Domain documents follow the detected feature folders; `06_login` covers the screen and `02_auth` the session, guards and permissions.
  - Documents are `visibility: public` because the repository is public.
- evidence:
  - src/domain/lifecycle.ts, src/api/contract.ts, src/app/router.tsx, src/features/, src/mocks/, e2e/
- caveats:
  - Everything is `needs_review`; the CI gate on stale documents protects only `verified` documents, so it guards nothing until a person approves them.
  - Gaps found while writing, recorded as open questions: no skip link and no reduced-motion handling (WCAG.md); `perRequestLimitKrw` is not enforced and the dashboard's 80 % cost warning ignores `alertThresholdPct` (domains/01_admin.md).

## 2026-11-03 - LLM-WIKI initial documents created

- status: needs_review
- actor: llm-wiki-cli
- scope: docs
- changed:
  - docs/llm-wiki/
- summary:
  - Created the initial LLM-WIKI document structure with `llm-wiki init --write`.
- evidence:
  - package.json
- caveats:
  - This is a CLI-generated draft and requires human review.

