---
title: Developer Work
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
  - src/mocks/ai.ts#symbol:generateScope
  - src/features/detail/preview-panels.tsx#symbol:FeedbackBadge
  - src/domain/report.ts#symbol:deriveWikiTrust
  - src/domain/model.ts#symbol:FeasibilityReport
  - src/domain/lifecycle.ts#symbol:releaseDateMissing
  - src/mocks/engine.ts#symbol:updateRelease
  - src/mocks/engine.ts#symbol:updateRegression
  - src/domain/url.ts#symbol:isSafeUrl
  - src/mocks/calendar.test.ts
related:
  - docs/llm-wiki/domains/04_detail.md
  - docs/llm-wiki/domains/09_schedule.md
  - docs/llm-wiki/GLOSSARY.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Developer Work

## Responsibility

Everything a developer does: the assigned queue (`/work`, `request:review`), the regression queue (`/work/regression`, `regression:view`) and the developer panels on the request page — feasibility report, decision, AI work and merge-request review, regression checks and release.

## Queues

- **Assigned** (`AssignedPage`): filters `myTurn` (default), `ai`, `waiting`, `open`, `closed`, applied on the client with `turnOf` and `isTerminal`; filter and project are kept in `?filter=&project=`. The server returns only requests the user is responsible for unless the user is an admin.
- **Regression** (`RegressionPage`): open requests that have regression checks, cards with pending checks first, each card editable in place. Project names come from `useDirectory().projectName` (the id when the list is missing).
- Both queues show `LoadFailed` with a retry when nothing could be loaded, and keep the list with a `RefreshFailed` line when a poll fails.

## Panels on the request page

- `ReportPanel` — the AI feasibility report (`FeasibilityReport`), with the model that wrote it (`generatedBy`): verdict (`feasible`, `conditional`, `out_of_scope`, `undetermined`), summary, wiki trust, evidence (wiki documents with their verified flag, code files; expandable), impact (changed screens, features to re-check — the regression candidates), plan, verification method per acceptance criterion, size (`S`/`M`/`L`), risks and open questions; unconfirmed assumptions (facts the plan relies on that neither the code nor a reviewed wiki confirmed) and every project rule with how the plan keeps it (`constraintChecks`, a copy of the rule at writing time; a conflict is highlighted and makes the verdict `conditional`). Shown only to users with `report:read` and not for `non_code` requests.
- `DecisionCard` — shown while `runWork` is available: run AI work (on the first run each report assumption must be ticked before the button is enabled; the server refuses otherwise with `assumptionsUnchecked`, and the run records them as `checkedAssumptions`; optional instructions; disabled with the reason beside it once the request reaches its per-request AI limit, `useAiRunLimit` → `overRequestLimit`, the same rule the server enforces), ask the requester (1–5 questions, prefilled from the report's open questions) or reject (reason required). On a rework after `changes_requested` it lists the failed criteria and prefills the instructions with them.
- `WorkPanel` — the AI run: phases `queued → editing → testing → opening_mr → finished` with `aria-current="step"`, attempts, cost, the coding agent and model (`work.agent`, e.g. Claude Agent · Claude Opus 5.5), result, change summary (merge request number, files, lines, wiki documents touched). In `code_review` the developer approves the merge (`approveMerge`), opens the MR, or asks for a revision (`requestRevision { note }`; disabled at the per-request limit like the run button). The project's provider decides the wording: PR for GitHub, MR otherwise. The preview and merge-request links are shown only when their URL passes `isSafeUrl(url, 'link')`. When the run has a preview, the panel shows it with the requester's reaction (waiting, looks good, change something + note); "revise" then starts from the requester's note, and approving over a change request asks once more.
- `RegressionChecks` — pass/fail per check, saved one at a time. A request that is `done`, `rejected` or `cancelled` refuses changes (409 `requestClosed`).
- `ReleasePanel` — release date and note; setting a date notifies the requester. The date input's minimum is the head office's today (`hqToday`), and a person on another clock sees that date as a hint; the server refuses a new date before it (400 `releaseDateInPast`) but accepts the date already set. "Released" (`markReleased`) needs a saved scheduled date: until then the button is disabled with the reason below it (linked by `aria-describedby`), and the server refuses it with 409 `guard_failed` (`releaseUnscheduled`, `releaseDateMissing`). With a date it asks for confirmation in a sheet.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useRequests({ scope: 'assigned', projectId? })` | `GET /requests` | → `WorkRequestSummary[]` | Needs `request:review`; 4 s polling while live. |
| `useRegressionQueue` | `GET /regression-checks` | → `{ requestId, title, projectId, status, checks[] }[]` | Needs `regression:view`. |
| `useTransition(id)` | `POST /requests/{id}/transitions` | `runWork { instructions? ≤ 2000, checkedAssumptions? }`, `requestInfo { questions 1–5 }`, `reject { reason ≤ 1000 }`, `requestRevision { note }`, `approveMerge`, `markReleased` → `WorkRequest` | 409 for a transition not allowed now; 409 `guard_failed` for `runWork` / `requestRevision` once the request has used its per-request AI budget (see [Admin](01_admin.md)) and for `markReleased` without a scheduled date. Errors show as a toast with the server message. `onRequestChanged`. |
| `useUpdateRegression(id)` | `PUT /requests/{id}/regression` | `{ checks: [{ id, result }] }` → `WorkRequest` | 403 unless responsible; 409 `requestClosed` once the request is closed; failure toast only. |
| `useUpdateRelease(id)` | `PUT /requests/{id}/release` | `{ scheduledDate?, note? ≤ 500 }` → `WorkRequest` | 400 `releaseDateInPast` for a new date before the head office's today. `onRequestChanged`. |

Every change to one request (the hooks above plus the requester's) runs in the mutation scope `request:<id>`, one after another ([Request Detail](04_detail.md)).

## The mock AI

`src/mocks/ai.ts` stands in for the model calls: `generateReport` writes a deterministic report (assumptions for screens without a wiki doc and for unreviewed evidence docs; every project rule as kept — the simulated AI never finds a conflict, the seed shows one on #1026), `generateScope` writes the requester's scope in the same call (no extra cost: a screen question for "other" targets, an extent question for the first neighbour the change shares code with, suggested answer "only what I asked for"), `finishWork` produces the run result with a fictional preview (a `preview.example.com` URL and an SVG screenshot), and the timings come from `appConfig.mock` (`reportSeconds`, `workSeconds`). The file states that a real backend replaces these with model calls and keeps the returned shapes, which are the contract. Wiki trust is derived, not chosen: no evidence → low, all evidence documents human-verified → high, at least half → medium (`deriveWikiTrust`); a `feasible` verdict on low trust is flagged as not backed by evidence.

## Evidence

- `src/features/work/assigned-page.tsx#symbol:AssignedPage`, `src/features/work/regression-page.tsx#symbol:RegressionPage` — queues.
- `src/features/detail/developer-panels.tsx#symbol:DecisionCard`, `src/features/detail/developer-panels.tsx#symbol:WorkPanel`, `src/features/detail/developer-panels.tsx#symbol:ReportPanel`, `src/features/detail/developer-panels.tsx#symbol:RegressionChecks`, `src/features/detail/developer-panels.tsx#symbol:ReleasePanel` — panels.
- `src/mocks/engine.ts#symbol:listRequests`, `src/mocks/engine.ts#symbol:regressionQueue` — server-side scoping.
- `src/mocks/ai.ts#symbol:generateReport`, `src/mocks/ai.ts#symbol:generateScope`, `src/domain/report.ts#symbol:deriveWikiTrust` — mock AI, the requester's scope and the trust rule.
- `src/features/detail/preview-panels.tsx#symbol:FeedbackBadge` — the requester's preview reaction in the work panel.
- `src/domain/model.ts#symbol:FeasibilityReport` — report fields.
- `src/domain/lifecycle.ts#symbol:releaseDateMissing`, `src/mocks/engine.ts#symbol:updateRelease`, `src/mocks/engine.ts#symbol:updateRegression`, `src/mocks/calendar.test.ts` — release and regression rules.
- `src/domain/url.ts#symbol:isSafeUrl` — which preview and merge-request links are shown.
- `src/features/detail/ai-limit.ts#symbol:useAiRunLimit` — the per-request limit check shared by both buttons; the model per task is chosen in [AI Operations](13_ops.md).

## Open Questions

- The merge request and test results are simulated; the real integration (repository provider API, CI status) is outside this template.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
