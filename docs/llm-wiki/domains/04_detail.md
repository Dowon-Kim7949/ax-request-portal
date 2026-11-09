---
title: Request Detail
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-05
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/detail/request-detail-page.tsx
  - src/features/detail/request-content.tsx
  - src/features/detail/requester-panels.tsx
  - src/features/detail/scope-panels.tsx
  - src/features/detail/preview-panels.tsx
  - src/features/detail/attachment-link.tsx
  - src/domain/lifecycle.ts
  - src/domain/url.ts
evidence:
  - src/features/detail/scope-panels.tsx#symbol:ScopeCheckCard
  - src/features/detail/scope-panels.tsx#symbol:ScopeSummaryCard
  - src/features/detail/preview-panels.tsx#symbol:PreviewCard
  - src/api/queries.ts#symbol:usePreviewFeedback
  - src/features/detail/request-detail-page.tsx#symbol:RequestDetailPage
  - src/features/detail/requester-panels.tsx#symbol:InfoAnswerCard
  - src/features/detail/requester-panels.tsx#symbol:VerificationCard
  - src/features/detail/requester-panels.tsx#symbol:StatusExplainer
  - src/domain/lifecycle.ts#symbol:availableEvents
  - src/domain/lifecycle.ts#symbol:isResponsibleDeveloper
  - src/domain/lifecycle.ts#symbol:TransitionCommand
  - src/api/queries.ts#symbol:useRequest
  - src/api/queries.ts#symbol:useTransition
  - src/api/queries.ts#symbol:useSaveVerification
  - src/api/queries.ts#symbol:storeRequest
  - src/api/queries.ts#symbol:requestScope
  - src/features/detail/attachment-link.tsx#symbol:AttachmentLink
  - src/features/detail/request-content.tsx#symbol:ReleaseCard
  - src/domain/url.ts#symbol:isSafeUrl
  - src/domain/url.ts#symbol:opensInline
  - src/components/ui/date-time.tsx#symbol:DateTimeText
  - src/features/detail/attachment-link.test.tsx
  - src/features/detail/request-content.test.tsx
  - e2e/attachments.spec.ts
  - e2e/time-zone.spec.ts
related:
  - docs/llm-wiki/domains/12_work.md
  - docs/llm-wiki/domains/11_wizard.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/GLOSSARY.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-09
---

# Request Detail

## Responsibility

One request at `/requests/:id` (authentication only; who may read which request is decided by the server). The page shows status, content and timeline and places the action panels each role may use. Transition rules live in `src/domain/lifecycle.ts`; the developer panels are described in [Work](12_work.md).

## Panel placement

The page computes two things and lets them decide everything:

- `events = availableEvents({ user, request, project, rolePermissions })` — the lifecycle events this user may fire now (status and permission combined).
- `technical = can('report:read')` — whether to show engineering detail. Without it (requester, executive) a plain-language `StatusExplainer` replaces the report, AI work and regression panels.

| Condition | Panel |
| --- | --- |
| `events` has `runWork` | `DecisionCard` (run AI work, ask, reject) |
| `events` has `approveScope` | `ScopeCheckCard` — requester confirms the AI's reading: summary, what changes, what does not, choices (the AI's suggestion is marked, never preselected), an optional note; "not quite" sends it back with a note while `scopeRevisionsLeft` > 0 |
| `events` has `provideInfo` | `InfoAnswerCard` — requester answers the developer's questions |
| `events` has `confirmResult` | `VerificationCard` — requester checks each acceptance criterion |
| requester, `code_review` and the run has a `preview` | `PreviewCard` — screenshots and the preview link; "looks good" or "change something" (note required). Optional and advisory: the status does not change |
| the request has a `scope`, the requester is not being asked, status is not `submitted` / `reporting` | `ScopeSummaryCard` — the scope as confirmed (or still waiting), with the choices and the note |
| `events` has `cancel` | Cancel action (sheet) |
| `technical` and the request has a work run | `WorkPanel` |
| `technical` and regression checks exist | `RegressionChecks` (editable when responsible and not terminal) |
| `technical` and type is not `non_code` | `ReportPanel` |
| responsible developer and status is release-editable | `ReleasePanel`, otherwise the read-only release card |
| `technical` and the response carries `aiUsage` | `AiUsageCard` — spent vs. the per-request limit and every AI call with model, runtime, tokens and estimated cost |
| always | request content and `Timeline` |

"Responsible" (`isResponsibleDeveloper`) means holding `request:review` and being an admin, the assignee or a project owner. Back navigation goes to `/requests` for the requester, `/work` for reviewers and `/` otherwise.

## Loading, names and times

- A non-numeric id renders the not-found page, and so does a 404 — also when it arrives on a refresh while a copy is on screen (the request is gone or no longer visible to this person).
- Nothing loaded at all: a full `LoadFailed` with a retry. A failed refresh keeps the request on screen with a `RefreshFailed` line above it.
- The requester's name and the project's name come from `useDirectory().userName` / `projectName`: when the lists cannot be loaded they read "unknown user" and the project id, never a blank.
- "Filed on" is the date in the viewer's time zone (`DateTimeText variant="date"`). The timeline, the report's time, the scope confirmation and the preview's expiry use `variant="full"`: local time, plus the zone abbreviation and head-office time when the viewer's clock differs ([Glossary](../GLOSSARY.md)). The AI usage list uses `compact`, with the full form in the tooltip.
- The release card shows the released day on the head-office business calendar (`calendar="hq"`, with the weekday; the tooltip has local and head-office time), so it matches the schedule and the dashboard. Scheduled and desired dates are date-only values and read the same in every time zone. A viewer on another clock also gets `HqCalendarNote` under the card.

## Attachments

`AttachmentLink` checks every URL again before rendering (`isSafeUrl(url, 'file')`): an unsafe one is plain text with "Cannot be opened". Images and PDFs (`opensInline`) open in a new tab; anything else (SVG and HTML included) downloads, so an upload never runs as a page of the portal. A `data:` URL (the demo's small uploads) is opened through a `blob:` URL made on click, because browsers refuse to open `data:` URLs in a tab; a blocked pop-up falls back to a download. Preview screenshots, the preview link and the merge-request link are hidden when their URL is not safe.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useRequest(id)` | `GET /requests/{id}` | → `WorkRequest` (with report, work, checklist, regression, timeline) | Polls every 2 s while live. |
| `useTransition(id)` | `POST /requests/{id}/transitions` | `TransitionCommand` → `WorkRequest` | A transition not allowed in the current status is 409; a failed guard is 409 `guard_failed`; acting out of turn is 403. Success calls `onRequestChanged`. |
| `useSaveVerification(id)` | `PUT /requests/{id}/verification` | `{ checks }` → `WorkRequest` | Saved on every check click. Only the answer to the latest save is stored in the detail cache; when the saves settle, request lists are invalidated (and the detail too if the last save failed). Failure shows a toast. |
| `usePreviewFeedback(id)` | `PUT /requests/{id}/preview-feedback` | `PreviewFeedbackInput { verdict: looks_good, note? }` or `{ verdict: needs_change, note }` → `WorkRequest` | Requester only (403 `requesterOnlyPreview`); only in `code_review` with a preview (409 `noPreviewNow`). Notifies the developers; a new run starts without the reaction. `onRequestChanged`. |

Every change to one request — transitions, the acceptance checklist, preview feedback, regression checks and the release schedule — runs in the TanStack mutation scope `request:<id>`, so the server applies them in the order they were made; a later button shows its loading state until the earlier call ends. `storeRequest` never replaces a cached request with an answer whose `updatedAt` is older.

Requester commands: `approveScope { choices, note? }` (every question answered), `reviseScope { note }` (at most twice; also refused once the request has used its per-request AI limit, because it rewrites the report), `provideInfo { answer }` (never refused by the limit, or the requester would be stuck), `reportIssue { checks, note? }` (needs at least one failed criterion), `confirmResult { checks }` (needs every criterion passed), `cancel { reason? }`. Developer commands are listed in [Work](12_work.md).

For a `checklist` request the request content lists each finding (number, clause, finding, what counts as fixed) above the acceptance criteria made from them.

## Evidence

- `src/features/detail/request-detail-page.tsx#symbol:RequestDetailPage` — the placement table above, not-found and load failures.
- `src/features/detail/ai-usage-card.tsx#symbol:AiUsageCard` — AI usage of the request; the server attaches `aiUsage` only for `report:read` (`src/mocks/engine.ts#symbol:present`).
- `src/features/detail/scope-panels.tsx#symbol:ScopeCheckCard`, `src/features/detail/scope-panels.tsx#symbol:ScopeSummaryCard` — the scope the requester confirms and everyone reads.
- `src/features/detail/preview-panels.tsx#symbol:PreviewCard`, `src/api/queries.ts#symbol:usePreviewFeedback` — the requester's preview reaction.
- `src/features/detail/requester-panels.tsx#symbol:InfoAnswerCard`, `src/features/detail/requester-panels.tsx#symbol:VerificationCard`, `src/features/detail/requester-panels.tsx#symbol:StatusExplainer` — requester panels.
- `src/domain/lifecycle.ts#symbol:availableEvents`, `src/domain/lifecycle.ts#symbol:isResponsibleDeveloper`, `src/domain/lifecycle.ts#symbol:TransitionCommand` — rules the page relies on.
- `src/api/queries.ts#symbol:useRequest`, `src/api/queries.ts#symbol:useTransition`, `src/api/queries.ts#symbol:useSaveVerification`, `src/api/queries.ts#symbol:storeRequest`, `src/api/queries.ts#symbol:requestScope` — API calls, ordering and the cache rule.
- `src/features/detail/attachment-link.tsx#symbol:AttachmentLink`, `src/domain/url.ts#symbol:isSafeUrl`, `src/domain/url.ts#symbol:opensInline`, `src/features/detail/attachment-link.test.tsx`, `e2e/attachments.spec.ts` — opening attachments safely.
- `src/features/detail/request-content.tsx#symbol:ReleaseCard`, `src/components/ui/date-time.tsx#symbol:DateTimeText`, `src/features/detail/request-content.test.tsx`, `e2e/time-zone.spec.ts` — dates and times on the page.

## Open Questions

- The page has no route permission; read access per request (own vs. all) is enforced only by the server. A real backend must implement the same rule as the mock engine.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
