---
title: Executive Dashboard
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/dashboard
evidence:
  - src/features/dashboard/dashboard-page.tsx#symbol:DashboardPage
  - src/features/dashboard/dashboard-page.tsx#symbol:ProjectBars
  - src/api/queries.ts#symbol:useDashboard
  - src/domain/model.ts#symbol:DashboardSummary
  - src/mocks/engine.ts#symbol:dashboard
  - src/mocks/engine.ts#symbol:isDelayed
related:
  - docs/llm-wiki/domains/01_admin.md
  - docs/llm-wiki/WCAG.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Executive Dashboard

## Responsibility

A monthly overview at `/dashboard` for whoever holds `dashboard:view` — by default the `executive` and `admin` roles. Executives are requesters with this extra permission (and `request:read:all`); they do not get developer tools.

## Content

- Month navigation; "next month" is disabled at the current month.
- Four tiles: received, in progress, done, AI cost.
- Per-project bars of done and in-progress requests, releases scheduled this week, and an attention list (requests waiting for information, delayed requests with links).

## Metric definitions

- **Received** compares like with like: for the current month it is compared with the same number of days of the previous month (up to today's day of month); for a past month, with the whole previous month. The tile shows the signed difference.
- **In progress** and **delayed** are "now" values and do not depend on the selected month (`isDelayed` decides delay). **Done** counts releases in the month. Average lead time is omitted when nothing was done.
- **AI cost** is the month's spending as a share of the monthly budget; the tile and its meter turn to the warning tone at the budget's alert threshold (`aiAlertThresholdPct`, the same `alertThresholdPct` the budget screen uses).

## Charts

Bars are plain CSS, no chart library: done uses `brand-600`, in progress `ai-500` (both contrast-checked as non-text marks in `src/theme.test.ts`), bars are 12 px high with a 2 px gap, lengths are relative to the largest project, and zero segments are not drawn. Each segment is focusable (`tabIndex=0`, `role="img"`, an `aria-label` with project, series and value) and its tooltip opens on hover and on focus, so the numbers are reachable by keyboard and screen reader. Reuse the same two tokens for these series elsewhere, and add any new series colour to the contrast table first.

## API Services

- `useDashboard(month)` → `GET /dashboard/summary?month=YYYY-MM` → `DashboardSummary`. Keeps the previous month visible while the next one loads (`opacity-60`, `aria-busy`). The server checks `dashboard:view`. Invalidated by every request change (`onRequestChanged`) and by budget updates.

## Evidence

- `src/features/dashboard/dashboard-page.tsx#symbol:DashboardPage`, `src/features/dashboard/dashboard-page.tsx#symbol:ProjectBars` — tiles, bars, accessibility.
- `src/api/queries.ts#symbol:useDashboard` — query.
- `src/domain/model.ts#symbol:DashboardSummary` — field definitions.
- `src/mocks/engine.ts#symbol:dashboard`, `src/mocks/engine.ts#symbol:isDelayed` — how the mock computes each metric.

## Open Questions

- None.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
