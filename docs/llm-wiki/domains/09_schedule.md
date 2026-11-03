---
title: Release Schedule
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/schedule
evidence:
  - src/features/schedule/schedule-page.tsx#symbol:SchedulePage
  - src/api/queries.ts#symbol:useReleases
  - src/lib/format.ts#symbol:toLocalDate
related:
  - docs/llm-wiki/domains/12_work.md
  - docs/llm-wiki/domains/04_detail.md
visibility: public
contains_sensitive_info: false
---

# Release Schedule

## Responsibility

A read-only calendar of scheduled releases at `/schedule` (`schedule:view`, held by every default role). Dates are set by the responsible developer in the release panel on the request page ([Work](12_work.md)).

## Behaviour

- Loads releases from 45 days ago to 90 days ahead and groups them by date into "this week" (today to +6 days), "later" and "past" (newest first). Empty sections are hidden.
- A project filter (`Segmented`) is local state, not in the URL.
- Each date lists its projects and requests (links to `/requests/:id`) with status badges; past dates are dimmed and today is badged.
- Dates are `YYYY-MM-DD` strings compared lexicographically, computed in the browser's local time zone with `toLocalDate`.

## API Services

- `useReleases(from, to)` → `GET /releases?from=&to=` → `ReleaseScheduleItem[]` (`date`, `projectId`, `requests[]`). Keeps previous data; no polling. Errors show `ErrorState` with retry. Any request change invalidates it through `onRequestChanged`.

## Evidence

- `src/features/schedule/schedule-page.tsx#symbol:SchedulePage` — range, grouping, filter.
- `src/api/queries.ts#symbol:useReleases` — query.
- `src/lib/format.ts#symbol:toLocalDate` — local date strings.

## Open Questions

- Which requests a requester may see on the calendar is decided by the mock server; the contract does not state it. A real backend must define that visibility rule.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
