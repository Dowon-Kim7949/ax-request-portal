---
title: Release Schedule
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
  - src/features/schedule
evidence:
  - src/features/schedule/schedule-page.tsx#symbol:SchedulePage
  - src/features/schedule/schedule-page.tsx#symbol:DateGroup
  - src/features/schedule/month-view.tsx#symbol:MonthCalendar
  - src/features/schedule/month-grid.ts#symbol:monthWeeks
  - src/features/schedule/month-grid.ts#symbol:isMonth
  - src/lib/use-media-query.ts#symbol:useMediaQuery
  - src/lib/format.ts#symbol:formatWeekday
  - src/features/schedule/schedule-page.test.tsx
  - src/features/schedule/month-grid.test.ts
  - e2e/schedule.spec.ts
  - src/api/queries.ts#symbol:useReleases
  - src/lib/time-zone.ts#symbol:hqToday
  - src/components/ui/date-time.tsx#symbol:HqCalendarNote
  - src/mocks/engine.ts#symbol:businessDate
  - src/mocks/copy.ts#symbol:readableDate
  - src/domain/lifecycle.ts#symbol:releaseDateMissing
related:
  - docs/llm-wiki/domains/12_work.md
  - docs/llm-wiki/domains/04_detail.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-10
---

# Release Schedule

## Responsibility

A read-only calendar of scheduled releases at `/schedule` (`schedule:view`, held by every default role), shown as a list of dates or, on a tablet or a desktop, a month at a time. Dates are set by the responsible developer in the release panel on the request page ([Work](12_work.md)).

## Behaviour

- Release dates are days on the head-office business calendar ([Glossary](../GLOSSARY.md)): a scheduled date is a date-only value, and a release that happened is grouped by the day its `releasedAt` falls on at the head office (`businessDate` in the mock engine). "Today" is therefore `hqToday()`, not the device's date.
- A project filter (`Segmented`) is local state, not in the URL, and applies to both views.
- A viewer whose clock differs from the head office's sees `HqCalendarNote` ("dates follow head-office time") under the title.
- Dates are `YYYY-MM-DD` strings compared lexicographically and formatted without any time-zone shift.

### Views

- The view lives in the URL: `?view=month` is the month view, no `view` is the list. A "List | Month" `Segmented` beside the title switches it, replacing the history entry, so Back leaves the schedule instead of stepping through the views.
- The month view needs seven columns, so it exists from the `md` breakpoint (768 px, where the navigation becomes a rail or a sidebar) up: `useMediaQuery(TABLET_UP)`. A phone shows no switch and opens the list even from a `?view=month` link; turning a tablet across the breakpoint switches live.
- **List** (default): loads releases from 45 days before to 90 days after the head office's today and groups them by date into "this week" (today to +6 days), "later" and "past" (newest first). Empty sections are hidden. Each date lists its projects and requests (links to `/requests/:id`) with status badges; today is badged. Past dates are told apart by a muted background and a grey date, not by fading (reduced opacity breaks text contrast).
- **Month**: `?month=YYYY-MM` picks the month (any month, past or future); a missing or malformed value (`isMonth`) means the head office's current month, and stepping back to it drops the parameter. Previous / next month buttons and a "This month" button (disabled on the current month) replace the history entry like the switch. The month name beside the arrows is a polite live region.
- The month grid (`monthWeeks`) runs Sunday to Saturday over every week that holds a day of the month: four to six weeks, padded with the neighbouring months' days, whose releases also show. It loads exactly that range from `GET /releases`.
- Each day cell shows the day number (the month's name on the 1st), today in a filled circle, past days on the muted tint and the neighbouring months' numbers in grey. Releases are chips linking to `/requests/:id`: the project's icon and the title (truncated, full title as a tooltip), a check mark once `done`; done chips are neutral, scheduled ones brand-tinted. A day with more than three releases shows two and an "N more" button (`aria-expanded`) that unfolds the rest in place.
- While another month's (or the list's) data stands in during a load, the table is `aria-busy` and the "No releases this month." line is withheld, so an empty month is never claimed early.

## Rules that feed the calendar

- Moving a request from `release_scheduled` to `done` (`markReleased`) needs a saved scheduled date (guard `releaseUnscheduled`, `releaseDateMissing`); the release panel's button stays disabled until then ([Work](12_work.md)).
- The mock refuses a new scheduled date earlier than the head office's today: `400 bad_request` `releaseDateInPast`, whose message names that today. Sending the date already set is accepted.
- Server texts about a date — the `releaseDateSet` notification body and the `releaseDateInPast` error — write it with `readableDate` per language ("11월 5일 (목)", "Thu, Nov 5"), not as raw `YYYY-MM-DD`.

## Layout

- A `fit` route ([Frontend Profile](../profiles/frontend.md)): on a big screen the title (with the list or month switch), the head-office note, the project filter, the month stepper and the refresh notice stay in place, and the list or the month calendar scrolls ("배포 일정 내용").

## API Services

- `useReleases(from, to)` → `GET /releases?from=&to=` → `ReleaseScheduleItem[]` (`date`, `projectId`, `requests[]`). The list asks for today −45 to +90 days; the month view for its grid's first to last day, cached per range. Keeps previous data while a new range loads; no polling. A failed first load shows `LoadFailed` with retry; a failed refresh keeps the calendar and adds a `RefreshFailed` line. Any request change invalidates it through `onRequestChanged`.

## Evidence

- `src/features/schedule/schedule-page.tsx#symbol:SchedulePage`, `src/features/schedule/schedule-page.tsx#symbol:DateGroup` — view and month in the URL, ranges, grouping, filter, past and today styling.
- `src/features/schedule/month-view.tsx#symbol:MonthCalendar`, `src/features/schedule/month-grid.ts#symbol:monthWeeks`, `src/features/schedule/month-grid.ts#symbol:isMonth`, `src/lib/format.ts#symbol:formatWeekday` — the month grid, its cells and chips, the URL month check, weekday names.
- `src/lib/use-media-query.ts#symbol:useMediaQuery` — the tablet-and-up gate (`TABLET_UP`).
- `src/features/schedule/schedule-page.test.tsx`, `src/features/schedule/month-grid.test.ts`, `e2e/schedule.spec.ts` — month view on the head-office day, switching and stepping in the URL, the phone fallback, the folded busy day, the grid's weeks.
- `src/api/queries.ts#symbol:useReleases` — query.
- `src/lib/time-zone.ts#symbol:hqToday`, `src/components/ui/date-time.tsx#symbol:HqCalendarNote` — head-office today and the calendar note.
- `src/mocks/engine.ts#symbol:businessDate`, `src/domain/lifecycle.ts#symbol:releaseDateMissing` — business days in the mock; the release guard.
- `src/mocks/copy.ts#symbol:readableDate` — dates in server texts.

## Open Questions

- Which requests a requester may see on the calendar is decided by the mock server; the contract does not state it. A real backend must define that visibility rule.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- 2026-11-09: month view added (agent edit); re-review the Views section against the code.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
