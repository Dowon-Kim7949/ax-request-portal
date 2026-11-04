---
title: Request Detail
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-04
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/detail/request-detail-page.tsx
  - src/features/detail/request-content.tsx
  - src/features/detail/requester-panels.tsx
  - src/features/detail/scope-panels.tsx
  - src/features/detail/preview-panels.tsx
  - src/domain/lifecycle.ts
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
related:
  - docs/llm-wiki/domains/12_work.md
  - docs/llm-wiki/domains/11_wizard.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/GLOSSARY.md
visibility: public
contains_sensitive_info: false
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

"Responsible" (`isResponsibleDeveloper`) means holding `request:review` and being an admin, the assignee or a project owner. Back navigation goes to `/requests` for the requester, `/work` for reviewers and `/` otherwise. A non-numeric id or a 404 renders the not-found page.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useRequest(id)` | `GET /requests/{id}` | → `WorkRequest` (with report, work, checklist, regression, timeline) | Polls every 2 s while live. |
| `useTransition(id)` | `POST /requests/{id}/transitions` | `TransitionCommand` → `WorkRequest` | A transition not allowed in the current status is 409; a failed guard is 409 `guard_failed`; acting out of turn is 403. Success calls `onRequestChanged`. |
| `useSaveVerification(id)` | `PUT /requests/{id}/verification` | `{ checks }` → `WorkRequest` | Saved on every check click; updates only the detail cache. Failure shows a toast. |
| `usePreviewFeedback(id)` | `PUT /requests/{id}/preview-feedback` | `PreviewFeedbackInput { verdict: looks_good, note? }` or `{ verdict: needs_change, note }` → `WorkRequest` | Requester only (403 `requesterOnlyPreview`); only in `code_review` with a preview (409 `noPreviewNow`). Notifies the developers; a new run starts without the reaction. `onRequestChanged`. |

Requester commands: `approveScope { choices, note? }` (every question answered), `reviseScope { note }` (at most twice; also refused once the request has used its per-request AI limit, because it rewrites the report), `provideInfo { answer }` (never refused by the limit, or the requester would be stuck), `reportIssue { checks, note? }` (needs at least one failed criterion), `confirmResult { checks }` (needs every criterion passed), `cancel { reason? }`. Developer commands are listed in [Work](12_work.md).

For a `checklist` request the request content lists each finding (number, clause, finding, what counts as fixed) above the acceptance criteria made from them.

## Evidence

- `src/features/detail/request-detail-page.tsx#symbol:RequestDetailPage` — the placement table above.
- `src/features/detail/ai-usage-card.tsx#symbol:AiUsageCard` — AI usage of the request; the server attaches `aiUsage` only for `report:read` (`src/mocks/engine.ts#symbol:present`).
- `src/features/detail/scope-panels.tsx#symbol:ScopeCheckCard`, `src/features/detail/scope-panels.tsx#symbol:ScopeSummaryCard` — the scope the requester confirms and everyone reads.
- `src/features/detail/preview-panels.tsx#symbol:PreviewCard`, `src/api/queries.ts#symbol:usePreviewFeedback` — the requester's preview reaction.
- `src/features/detail/requester-panels.tsx#symbol:InfoAnswerCard`, `src/features/detail/requester-panels.tsx#symbol:VerificationCard`, `src/features/detail/requester-panels.tsx#symbol:StatusExplainer` — requester panels.
- `src/domain/lifecycle.ts#symbol:availableEvents`, `src/domain/lifecycle.ts#symbol:isResponsibleDeveloper`, `src/domain/lifecycle.ts#symbol:TransitionCommand` — rules the page relies on.
- `src/api/queries.ts#symbol:useRequest`, `src/api/queries.ts#symbol:useTransition`, `src/api/queries.ts#symbol:useSaveVerification` — API calls.

## Open Questions

- The page has no route permission; read access per request (own vs. all) is enforced only by the server. A real backend must implement the same rule as the mock engine.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
