---
title: My Requests
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
  - src/features/requests
  - src/components/request/request-card.tsx
  - src/features/drafts/drafts-section.tsx
  - src/features/drafts/rows.ts
evidence:
  - src/features/requests/my-requests-page.tsx#symbol:MyRequestsPage
  - src/api/queries.ts#symbol:useRequests
  - src/api/queries.ts#symbol:onRequestChanged
  - src/domain/lifecycle.ts#symbol:isTerminal
  - src/components/request/request-card.tsx#symbol:RequestCard
  - src/components/ui/load-failed.tsx#symbol:LoadFailed
  - src/api/refresh.ts#symbol:refreshOf
  - src/features/drafts/drafts-section.tsx#symbol:DraftsSection
  - src/features/drafts/drafts-section.tsx#symbol:DraftsNotice
  - src/features/drafts/rows.ts#symbol:mergeDraftRows
  - src/features/drafts/rows.ts#symbol:localRow
  - src/features/drafts/rows.ts#symbol:DRAFTS_SHOWN
  - src/features/drafts/hooks.ts#symbol:useDraftRows
  - src/features/drafts/hooks.ts#symbol:useDiscardDraft
  - src/stores/draft.ts#symbol:lastDraftCount
  - src/api/queries.ts#symbol:useDrafts
  - src/features/drafts/drafts-section.test.tsx
  - src/features/drafts/rows.test.ts
  - e2e/drafts.spec.ts
related:
  - docs/llm-wiki/domains/11_wizard.md
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/12_work.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-10
---

# My Requests

## Responsibility

The requester's own list at `/requests` (`request:read:own`), with their saved drafts above it. The developer queue is [Work](12_work.md); one request's page is [Request Detail](04_detail.md).

## Behaviour

- Filters `open` (default), `myTurn`, `closed`, `all`, applied on the client with `isTerminal` and `turnOf(status) === 'requester'`. The filter is kept in `?filter=` (replace navigation); an unknown value falls back to `open`. Counts on each filter come from the full list.
- Search is local state: a title substring or an exact `#id` (a leading `#` is stripped). The server's `q` parameter is not used.
- Empty states differ: no requests at all shows a "new request" call-to-action, an empty filter result says so.
- The new-request button is hidden below `sm`; phones reach the wizard from the navigation.
- Cards here do not show the wanted-by or release date (`RequestCard` without `showDates`); the requester sees both on the request page and the release date on the schedule.

## Saved drafts

- `DraftsSection variant="page"` (`src/features/drafts/drafts-section.tsx`) sits under the page header, above the filters and search, as the section `id="drafts"` (`DRAFTS_SECTION_ID`) that `DRAFTS_LIST_PATH` (`/requests#drafts`) leads to. It renders only for `request:create`, and only when there is a draft or the account's list could not be read (that is not "none").
- Rows come from `useDraftRows`: the account's list (`useDrafts`) with this device's drafts laid over it (`mergeDraftRows`), most recently written first. A draft both have shows this device's newer words; a draft only this device has gets its own row. A row's state (`localRow`) is `saved`, `saving` (on its way or scheduled: no badge, so rows do not flicker on every save), `local` (unsent or no room in the account: badge "This device only") or `conflict` (badge "Conflict").
- The heading carries `N/20`: N is how many drafts the account holds (`appConfig.drafts.maxPerAccount` is the limit), not the number of rows, since drafts on this device only take no account slot; screen readers hear it as a sentence. It is shown once the account's list has been read.
- A row: optional badge, the title ("Untitled draft" when empty, clamped to two lines), then "step n of 7 · step name (`wizard.<step>.name`; for a `checklist` request the criteria step is `wizard.checklist.name`, "Audit findings", as on its screen) · service · saved time" (`DateTimeText` compact; on phones the time moves beside the actions), a "Continue" link to `continuePath` (`/requests/new?draft=<id>&step=<step>`, its accessible name includes the title) and a trash icon button named "Delete <title>".
- The page shows the newest `DRAFTS_SHOWN` (3) rows in one card with dividers; a last row button "Show all N" / "Show fewer" expands it (`aria-expanded`, `aria-controls`).
- Deleting asks in a sheet that names the draft and where it is deleted from (this device and the account, or this device only). While deleting, the confirm button is busy, Cancel is disabled and Escape does nothing; a failure shows a toast and keeps the sheet open (this device's copy is gone by then, the account's row stays to try again). After a delete, focus goes to the section heading (`tabIndex=-1`), or to `#main` when the section is gone (through `Sheet`'s `onCloseAutoFocus`); the sheet is rendered outside the section for that reason.
- While the account's list is read, this device's rows show at once; with none, the section holds room for as many rows as it showed last time (`lastDraftCount`, up to 3, remembered per person in `ax-request-portal:drafts-seen:<userId>` and deleted on sign-out), so nothing below jumps. A failed first load shows a compact `LoadFailed` with retry next to this device's rows; a failed refresh shows `RefreshFailed`.
- Opened at `#drafts`, the section scrolls itself into view once it renders (the router's scroll restoration runs before the data arrives), with a scroll margin for the sticky header. Focus does not move.
- `DraftsNotice` (same file): on a new, empty request the wizard's save line shows "Saved drafts: N · Continue", linking to `/requests#drafts`; the open draft is not counted.

## API Services

- `useRequests({ scope: 'mine' })` → `GET /requests?scope=mine` → `WorkRequestSummary[]`. Keeps previous data while refetching and polls every 4 s while any request is live. A failed first load shows `LoadFailed` (the API's message and a retry); a failed poll keeps the list on screen with a `RefreshFailed` line above it. There is no toast.
- The list never changes itself: other domains' mutations call `onRequestChanged`, which invalidates every request list.
- `useDrafts` → `GET /drafts` → `SavedDraftSummary[]` (the caller's drafts, most recently changed first; `request:create`), key `keys.drafts()`. A save (by the sync or a hook) puts the answer into that list at once and then reads it again (`storeSavedDraft`), so a row neither disappears nor shows an old title when this device's copy is deleted in the same moment; a delete or a submission takes the row out at once (`dropSavedDraft`). Deleting goes through `useDiscardDraft` → `DELETE /drafts/{id}` (a `404` counts as deleted) after this device's copy is gone, then retries drafts waiting for room ([Request Wizard](11_wizard.md)).

## Evidence

- `src/features/requests/my-requests-page.tsx#symbol:MyRequestsPage` — filters, search, empty states.
- `src/api/queries.ts#symbol:useRequests`, `src/api/queries.ts#symbol:onRequestChanged` — fetching, polling, invalidation.
- `src/domain/lifecycle.ts#symbol:isTerminal` — closed statuses.
- `src/components/request/request-card.tsx#symbol:RequestCard` — list item.
- `src/components/ui/load-failed.tsx#symbol:LoadFailed`, `src/api/refresh.ts#symbol:refreshOf` — load and refresh failures.
- `src/features/drafts/drafts-section.tsx#symbol:DraftsSection`, `src/features/drafts/drafts-section.tsx#symbol:DraftsNotice`, `src/features/drafts/drafts-section.test.tsx` — the saved-drafts section and the notice on a new request.
- `src/features/drafts/rows.ts#symbol:mergeDraftRows`, `src/features/drafts/rows.ts#symbol:localRow`, `src/features/drafts/rows.ts#symbol:DRAFTS_SHOWN`, `src/features/drafts/rows.test.ts`, `src/features/drafts/hooks.ts#symbol:useDraftRows` — rows from the account and this device.
- `src/features/drafts/hooks.ts#symbol:useDiscardDraft`, `src/stores/draft.ts#symbol:lastDraftCount`, `src/api/queries.ts#symbol:useDrafts` — deleting, the room held while loading, the account's list.
- `e2e/drafts.spec.ts` — saved drafts listed, continued, deleted, on another device, after signing out, at 320 px and in dark mode.

## Open Questions

- Search is client-side over the loaded list; with a real backend and many requests it should move to the server's `q` parameter.
- `N/20` counts the account's drafts, so with drafts on this device only it can be lower than the number of rows (for example 4/20 with five rows).
- A local-only draft on its way to the server has no badge until the send fails or times out.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
