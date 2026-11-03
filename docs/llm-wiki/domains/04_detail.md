---
title: Request Detail
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
  - src/features/detail/request-detail-page.tsx
  - src/features/detail/request-content.tsx
  - src/features/detail/requester-panels.tsx
  - src/domain/lifecycle.ts
evidence:
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
| `events` has `provideInfo` | `InfoAnswerCard` — requester answers the developer's questions |
| `events` has `confirmResult` | `VerificationCard` — requester checks each acceptance criterion |
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

Requester commands: `provideInfo { answer }`, `reportIssue { checks, note? }` (needs at least one failed criterion), `confirmResult { checks }` (needs every criterion passed), `cancel { reason? }`. Developer commands are listed in [Work](12_work.md).

## Evidence

- `src/features/detail/request-detail-page.tsx#symbol:RequestDetailPage` — the placement table above.
- `src/features/detail/ai-usage-card.tsx#symbol:AiUsageCard` — AI usage of the request; the server attaches `aiUsage` only for `report:read` (`src/mocks/engine.ts#symbol:present`).
- `src/features/detail/requester-panels.tsx#symbol:InfoAnswerCard`, `src/features/detail/requester-panels.tsx#symbol:VerificationCard`, `src/features/detail/requester-panels.tsx#symbol:StatusExplainer` — requester panels.
- `src/domain/lifecycle.ts#symbol:availableEvents`, `src/domain/lifecycle.ts#symbol:isResponsibleDeveloper`, `src/domain/lifecycle.ts#symbol:TransitionCommand` — rules the page relies on.
- `src/api/queries.ts#symbol:useRequest`, `src/api/queries.ts#symbol:useTransition`, `src/api/queries.ts#symbol:useSaveVerification` — API calls.

## Open Questions

- The page has no route permission; read access per request (own vs. all) is enforced only by the server. A real backend must implement the same rule as the mock engine.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
