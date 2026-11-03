---
title: Developer Work
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
  - src/features/work
  - src/features/detail/developer-panels.tsx
  - src/mocks/ai.ts
evidence:
  - src/features/work/assigned-page.tsx#symbol:AssignedPage
  - src/features/work/regression-page.tsx#symbol:RegressionPage
  - src/features/detail/developer-panels.tsx#symbol:DecisionCard
  - src/features/detail/developer-panels.tsx#symbol:WorkPanel
  - src/features/detail/developer-panels.tsx#symbol:ReportPanel
  - src/features/detail/developer-panels.tsx#symbol:RegressionChecks
  - src/features/detail/developer-panels.tsx#symbol:ReleasePanel
  - src/mocks/engine.ts#symbol:listRequests
  - src/mocks/engine.ts#symbol:regressionQueue
  - src/mocks/ai.ts#symbol:generateReport
  - src/domain/report.ts#symbol:deriveWikiTrust
  - src/domain/model.ts#symbol:FeasibilityReport
related:
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/09_schedule.md
  - docs/llm-wiki/GLOSSARY.md
visibility: public
contains_sensitive_info: false
---

# Developer Work

## Responsibility

Everything a developer does: the assigned queue (`/work`, `request:review`), the regression queue (`/work/regression`, `regression:view`) and the developer panels on the request page — feasibility report, decision, AI work and merge-request review, regression checks and release.

## Queues

- **Assigned** (`AssignedPage`): filters `myTurn` (default), `ai`, `waiting`, `open`, `closed`, applied on the client with `turnOf` and `isTerminal`; filter and project are kept in `?filter=&project=`. The server returns only requests the user is responsible for unless the user is an admin.
- **Regression** (`RegressionPage`): open requests that have regression checks, cards with pending checks first, each card editable in place.

## Panels on the request page

- `ReportPanel` — the AI feasibility report (`FeasibilityReport`): verdict (`feasible`, `conditional`, `out_of_scope`, `undetermined`), summary, wiki trust, evidence (wiki documents with their verified flag, code files; expandable), impact (changed screens, features to re-check — the regression candidates), plan, verification method per acceptance criterion, size (`S`/`M`/`L`), risks and open questions. Shown only to users with `report:read` and not for `non_code` requests.
- `DecisionCard` — shown while `runWork` is available: run AI work (optional instructions), ask the requester (1–5 questions, prefilled from the report's open questions) or reject (reason required). On a rework after `changes_requested` it lists the failed criteria and prefills the instructions with them.
- `WorkPanel` — the AI run: phases `queued → editing → testing → opening_mr → finished` with `aria-current="step"`, attempts, cost, result, change summary (merge request number, files, lines, wiki documents touched). In `code_review` the developer approves the merge (`approveMerge`), opens the MR, or asks for a revision (`requestRevision { note }`). The project's provider decides the wording: PR for GitHub, MR otherwise.
- `RegressionChecks` — pass/fail per check, saved one at a time.
- `ReleasePanel` — release date (not in the past) and note; setting a date notifies the requester. "Released" (`markReleased`) needs a confirmation sheet.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useRequests({ scope: 'assigned', projectId? })` | `GET /requests` | → `WorkRequestSummary[]` | Needs `request:review`; 4 s polling while live. |
| `useRegressionQueue` | `GET /regression-checks` | → `{ requestId, title, projectId, status, checks[] }[]` | Needs `regression:view`. |
| `useTransition(id)` | `POST /requests/{id}/transitions` | `runWork { instructions? ≤ 2000 }`, `requestInfo { questions 1–5 }`, `reject { reason ≤ 1000 }`, `requestRevision { note }`, `approveMerge`, `markReleased` → `WorkRequest` | 409 for a transition not allowed now. `onRequestChanged`. |
| `useUpdateRegression(id)` | `PUT /requests/{id}/regression` | `{ checks: [{ id, result }] }` → `WorkRequest` | 403 unless responsible; failure toast only. |
| `useUpdateRelease(id)` | `PUT /requests/{id}/release` | `{ scheduledDate?, note? ≤ 500 }` → `WorkRequest` | `onRequestChanged`. |

## The mock AI

`src/mocks/ai.ts` stands in for the model calls: `generateReport` writes a deterministic report, `finishWork` produces the run result, and the timings come from `appConfig.mock` (`reportSeconds`, `workSeconds`). The file states that a real backend replaces these with model calls and keeps the returned shapes, which are the contract. Wiki trust is derived, not chosen: no evidence → low, all evidence documents human-verified → high, at least half → medium (`deriveWikiTrust`); a `feasible` verdict on low trust is flagged as not backed by evidence.

## Evidence

- `src/features/work/assigned-page.tsx#symbol:AssignedPage`, `src/features/work/regression-page.tsx#symbol:RegressionPage` — queues.
- `src/features/detail/developer-panels.tsx#symbol:DecisionCard`, `src/features/detail/developer-panels.tsx#symbol:WorkPanel`, `src/features/detail/developer-panels.tsx#symbol:ReportPanel`, `src/features/detail/developer-panels.tsx#symbol:RegressionChecks`, `src/features/detail/developer-panels.tsx#symbol:ReleasePanel` — panels.
- `src/mocks/engine.ts#symbol:listRequests`, `src/mocks/engine.ts#symbol:regressionQueue` — server-side scoping.
- `src/mocks/ai.ts#symbol:generateReport`, `src/domain/report.ts#symbol:deriveWikiTrust` — mock AI and trust rule.
- `src/domain/model.ts#symbol:FeasibilityReport` — report fields.

## Open Questions

- The merge request and test results are simulated; the real integration (repository provider API, CI status) is outside this template.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
