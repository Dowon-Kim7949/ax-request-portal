---
title: Release Schedule
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-05
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/schedule
evidence:
  - src/features/schedule/schedule-page.tsx#symbol:SchedulePage
  - src/features/schedule/schedule-page.tsx#symbol:DateGroup
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
reviewed_at: 2026-11-04
---

# Release Schedule

## Responsibility

A read-only calendar of scheduled releases at `/schedule` (`schedule:view`, held by every default role). Dates are set by the responsible developer in the release panel on the request page ([Work](12_work.md)).

## Behaviour

- Release dates are days on the head-office business calendar ([Glossary](../GLOSSARY.md)): a scheduled date is a date-only value, and a release that happened is grouped by the day its `releasedAt` falls on at the head office (`businessDate` in the mock engine). "Today" is therefore `hqToday()`, not the device's date.
- Loads releases from 45 days before to 90 days after that today and groups them by date into "this week" (today to +6 days), "later" and "past" (newest first). Empty sections are hidden.
- A project filter (`Segmented`) is local state, not in the URL.
- Each date lists its projects and requests (links to `/requests/:id`) with status badges; today is badged. Past dates are told apart by a muted background and a grey date, not by fading (reduced opacity breaks text contrast).
- A viewer whose clock differs from the head office's sees `HqCalendarNote` ("dates follow head-office time") under the title.
- Dates are `YYYY-MM-DD` strings compared lexicographically and formatted without any time-zone shift.

## Rules that feed the calendar

- Moving a request from `release_scheduled` to `done` (`markReleased`) needs a saved scheduled date (guard `releaseUnscheduled`, `releaseDateMissing`); the release panel's button stays disabled until then ([Work](12_work.md)).
- The mock refuses a new scheduled date earlier than the head office's today: `400 bad_request` `releaseDateInPast`, whose message names that today. Sending the date already set is accepted.
- Server texts about a date — the `releaseDateSet` notification body and the `releaseDateInPast` error — write it with `readableDate` per language ("11월 5일 (목)", "Thu, Nov 5"), not as raw `YYYY-MM-DD`.

## API Services

- `useReleases(from, to)` → `GET /releases?from=&to=` → `ReleaseScheduleItem[]` (`date`, `projectId`, `requests[]`). Keeps previous data; no polling. A failed first load shows `LoadFailed` with retry; a failed refresh keeps the calendar and adds a `RefreshFailed` line. Any request change invalidates it through `onRequestChanged`.

## Evidence

- `src/features/schedule/schedule-page.tsx#symbol:SchedulePage`, `src/features/schedule/schedule-page.tsx#symbol:DateGroup` — range, grouping, filter, past and today styling.
- `src/api/queries.ts#symbol:useReleases` — query.
- `src/lib/time-zone.ts#symbol:hqToday`, `src/components/ui/date-time.tsx#symbol:HqCalendarNote` — head-office today and the calendar note.
- `src/mocks/engine.ts#symbol:businessDate`, `src/domain/lifecycle.ts#symbol:releaseDateMissing` — business days in the mock; the release guard.
- `src/mocks/copy.ts#symbol:readableDate` — dates in server texts.

## Open Questions

- Which requests a requester may see on the calendar is decided by the mock server; the contract does not state it. A real backend must define that visibility rule.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
