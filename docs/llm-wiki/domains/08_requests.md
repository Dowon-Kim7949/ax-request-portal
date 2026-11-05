---
title: My Requests
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
  - src/features/requests
  - src/components/request/request-card.tsx
evidence:
  - src/features/requests/my-requests-page.tsx#symbol:MyRequestsPage
  - src/api/queries.ts#symbol:useRequests
  - src/api/queries.ts#symbol:onRequestChanged
  - src/domain/lifecycle.ts#symbol:isTerminal
  - src/components/request/request-card.tsx#symbol:RequestCard
  - src/components/ui/load-failed.tsx#symbol:LoadFailed
  - src/api/refresh.ts#symbol:refreshOf
related:
  - docs/llm-wiki/domains/11_wizard.md
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/12_work.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# My Requests

## Responsibility

The requester's own list at `/requests` (`request:read:own`). The developer queue is [Work](12_work.md); one request's page is [Request Detail](04_detail.md).

## Behaviour

- Filters `open` (default), `myTurn`, `closed`, `all`, applied on the client with `isTerminal` and `turnOf(status) === 'requester'`. The filter is kept in `?filter=` (replace navigation); an unknown value falls back to `open`. Counts on each filter come from the full list.
- Search is local state: a title substring or an exact `#id` (a leading `#` is stripped). The server's `q` parameter is not used.
- Empty states differ: no requests at all shows a "new request" call-to-action, an empty filter result says so.
- The new-request button is hidden below `sm`; phones reach the wizard from the navigation.

## API Services

- `useRequests({ scope: 'mine' })` → `GET /requests?scope=mine` → `WorkRequestSummary[]`. Keeps previous data while refetching and polls every 4 s while any request is live. A failed first load shows `LoadFailed` (the API's message and a retry); a failed poll keeps the list on screen with a `RefreshFailed` line above it. There is no toast.
- The list never changes itself: other domains' mutations call `onRequestChanged`, which invalidates every request list.

## Evidence

- `src/features/requests/my-requests-page.tsx#symbol:MyRequestsPage` — filters, search, empty states.
- `src/api/queries.ts#symbol:useRequests`, `src/api/queries.ts#symbol:onRequestChanged` — fetching, polling, invalidation.
- `src/domain/lifecycle.ts#symbol:isTerminal` — closed statuses.
- `src/components/request/request-card.tsx#symbol:RequestCard` — list item.
- `src/components/ui/load-failed.tsx#symbol:LoadFailed`, `src/api/refresh.ts#symbol:refreshOf` — load and refresh failures.

## Open Questions

- Search is client-side over the loaded list; with a real backend and many requests it should move to the server's `q` parameter.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
