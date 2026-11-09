---
title: Glossary
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: glossary
project: ax-request-portal
last_updated: 2026-11-09
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/domain/model.ts
  - src/domain/lifecycle.ts
  - src/domain/roles.ts
  - src/lib/time-zone.ts
evidence:
  - src/domain/model.ts#symbol:RequestStatus
  - src/domain/model.ts#symbol:FeasibilityReport
  - src/domain/model.ts#symbol:WikiTrust
  - src/domain/model.ts#symbol:PrecheckIssue
  - src/domain/model.ts#symbol:CriterionCheck
  - src/domain/model.ts#symbol:RegressionCheck
  - src/domain/model.ts#symbol:WorkRun
  - src/domain/lifecycle.ts#symbol:TRANSITIONS
  - src/domain/lifecycle.ts#symbol:TransitionCommand
  - src/domain/lifecycle.ts#symbol:RequesterStatus
  - src/domain/roles.ts#symbol:PERMISSIONS
  - src/mocks/engine.ts#symbol:MockState
  - src/config/app.config.ts#symbol:appConfig
  - src/lib/time-zone.ts#symbol:hqToday
  - src/lib/time-zone.ts#symbol:resolveViewTimeZone
  - src/lib/format.ts#symbol:describeDateTime
  - src/config/env-check.ts#symbol:isApiMock
  - src/app/demo-banner.tsx#symbol:DemoBanner
  - src/stores/session.ts#symbol:SessionEndReason
  - src/domain/url.ts#symbol:UrlKind
  - src/api/contract.ts#symbol:SavedDraft
  - src/stores/draft.ts#symbol:LocalDraft
  - src/features/drafts/sync-engine.ts#symbol:DraftSyncEngine
related:
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/index.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Glossary

## Summary

Terms as the code uses them. Identifiers are kept in English in both UI languages.

| Term | Meaning | Defined in |
| --- | --- | --- |
| Work request (`WorkRequest`) | One change asked for by a requester: project, type, targets, current and desired behaviour, 1–5 acceptance criteria (or audit findings), plus everything that happens to it. | `src/domain/model.ts` |
| Request type (`RequestType`) | `new_feature`, `change`, `bug`, `copy_design`, `non_code`, `checklist`. `non_code` requests get no engineering report; `checklist` requests list audit findings. | `src/domain/model.ts` |
| Audit finding (`ChecklistItem`) | One finding of a `checklist` request: number, clause, finding, what counts as fixed. Each becomes one acceptance criterion. | `src/domain/model.ts` |
| Status (`RequestStatus`) | One of thirteen lifecycle states, from `submitted` to `done` / `rejected` / `cancelled`. | `src/domain/model.ts` |
| Event / transition (`TRANSITIONS`) | One of sixteen moves between statuses, each owned by a party. | `src/domain/lifecycle.ts` |
| Scope check (`scope_check`, `ScopeProposal`) | The requester confirms the AI's reading of the request before a developer reviews it: summary, what changes, what does not, choices where the request reads two ways. | `src/domain/model.ts` |
| Assumption (`ReportAssumption`) | A fact the report's plan relies on that neither the code nor a reviewed wiki confirmed; the developer confirms each before the first AI run. | `src/domain/model.ts` |
| Project rule (`ProjectConstraint`) | A rule every change to a project must keep (security, data, operations), kept by the project and checked in every report (`ConstraintCheck`). | `src/domain/model.ts` |
| Preview (`WorkPreview`, `PreviewFeedback`) | Screens and a link of the change before the merge, and the requester's advisory reaction to them. | `src/domain/model.ts` |
| Party | Who performs an event: `requester`, `developer`, `ai`, `system`. | `src/domain/lifecycle.ts` |
| Transition command (`TransitionCommand`) | The twelve events a person can send from the UI, with their payloads. | `src/domain/lifecycle.ts` |
| Turn (`turnOf`) | Whose move a status is: requester, developer, ai or none. Drives "your turn". | `src/domain/lifecycle.ts` |
| Stage (`STAGES`) | Seven progress stages shown in the stepper; several statuses share a stage. | `src/domain/lifecycle.ts` |
| Requester status (`RequesterStatus`) | Plain-language status shown to people without `report:read`. | `src/domain/lifecycle.ts` |
| Responsible developer | Holds `request:review` and is an admin, the assignee or a project owner (`isResponsibleDeveloper`). | `src/domain/lifecycle.ts` |
| Role | `requester`, `executive`, `developer`, `admin`, `operator`. | `src/domain/model.ts` |
| Permission | One of thirteen capability strings such as `request:create` or `dashboard:view`; roles map to sets of them. | `src/domain/roles.ts` |
| Executive | A requester who may also read all requests and the dashboard. | `src/domain/roles.ts` |
| Operator | The person running the service's AI side: providers and keys, model per task, prices, AI budget and usage. Provisioned by the service, not by an admin. | `src/domain/roles.ts` |
| Provider | `anthropic` (Claude) or `openai` (GPT). | `src/domain/ai.ts` |
| Runtime | How a task drives the model: `api` for precheck and report, `claude_code` or `codex` for AI work. | `src/domain/ai.ts` |
| Usage entry | One booked AI call or agent run: provider, model, runtime, normalized tokens and estimated cost, priced once and never re-priced. | `src/domain/ai.ts` |
| Precheck (`PrecheckIssue`) | Advice on a draft before submission; never blocks. | `src/domain/precheck.ts` |
| Saved draft (`SavedDraft`; "임시 저장" / "Saved drafts") | An unsubmitted request saved to the person's account: step, content (`DraftContent`) and a `version` that grows with every save. Continued on any device; deleted by the server when a request names it (`draftId`). At most `drafts.maxPerAccount` (20) per account. | `src/api/contract.ts` |
| Draft on this device (`LocalDraft`) | What the person wrote that the account does not have yet, kept in `localStorage` per person and deleted once the account holds the same. Keyed by a local id (`local-…`) until the server saves it, then by the server id. Shown as "This device only" when it cannot reach the account. | `src/stores/draft.ts` |
| Draft sync | Sending drafts on this device to the account (`DraftSyncEngine`): one request at a time, a second after typing pauses and on step changes, leaving, hiding, start and reconnecting. | `src/features/drafts/sync-engine.ts` |
| Draft conflict | The account's draft was saved elsewhere (another device or tab) since the version this device's copy was written over (`409 conflict`); nothing is sent until the person keeps this screen's version or loads the saved one. | `src/features/drafts/sync-core.ts` |
| Feasibility report (`FeasibilityReport`) | The AI's assessment before any work: verdict, evidence, impact, plan, verification, size, risks, open questions. | `src/domain/model.ts` |
| Verdict (`ReportVerdict`) | `feasible`, `conditional`, `out_of_scope`, `undetermined`. | `src/domain/model.ts` |
| Wiki trust (`WikiTrust`) | `high` / `medium` / `low`, derived from how many of the report's evidence documents are human-verified. | `src/domain/report.ts` |
| Work run (`WorkRun`) | One AI work attempt: phases, cost, result, merge request, change summary. | `src/domain/model.ts` |
| Merge request / MR | The AI's change for review; called PR when the project's provider is GitHub. | `src/features/detail/developer-panels.tsx` |
| Criterion check (`CriterionCheck`) | The requester's pass/fail per acceptance criterion during verification. | `src/domain/model.ts` |
| Regression check (`RegressionCheck`) | An existing feature to re-check after a change, from the report's impact. | `src/domain/model.ts` |
| Mock mode / demo mode | A build whose `VITE_API_MOCK` is not `false` (`isApiMock`): the in-browser MSW server answers every call and the data stays in each browser's `localStorage`. Every screen says so with the demo banner (`DemoBanner`). | `src/config/env-check.ts` |
| Mock state (`MockState`) | The mock server's persisted data, versioned by `STATE_VERSION`. | `src/mocks/engine.ts` |
| Dirty | Mock data a person has edited (uploads and read notifications included); it no longer follows language changes. | `src/mocks/engine.ts` |
| Contract | The endpoint table in `src/api/contract.ts` and the generated `docs/openapi.json`. | `src/api/contract.ts` |
| Head office / head-office time zone | The organization's home time zone, `appConfig.organization.timeZone` (`Asia/Seoul` in the template), named per language by `timeZoneLabel` ("한국" / "Korea"). | `src/config/app.config.ts` |
| Business calendar | The head office's calendar. "Today" (`hqToday`) for date limits and grouping, and every day or month total (dashboard, AI usage, budget), follow it in the UI and the API, wherever the viewer is. | `src/lib/time-zone.ts` |
| Viewing time zone | The time zone timestamps are shown in on this device: the one chosen in Settings, else the device's (`resolveViewTimeZone`). Never derived from the IP address. | `src/lib/time-zone.ts` |
| Head-office time (shown beside local time) | On detail screens, "local time (zone) · Korea time", added only when the viewing time zone reads a different clock from the head office at that instant and the viewer keeps "show head-office time" on (`describeDateTime`). | `src/lib/format.ts` |
| Date-only value | A `YYYY-MM-DD` calendar date (desired date, scheduled release date). Shown as written in every time zone; never converted. | `src/lib/format.ts` |
| Session end reason (`SessionEndReason`) | Why a session ended in this tab: `signedOut` (on purpose: the next sign-in starts at home, the drafts kept on this device are deleted) or `expired` (a 401: the login screen keeps `next` and says so). | `src/stores/session.ts` |
| Load failure / refresh failure | Nothing could be loaded (`LoadFailed`) versus a refresh failed while earlier data stays on screen (`RefreshFailed`). | `src/components/ui/load-failed.tsx` |
| Safe URL (`UrlKind`) | A URL the API may hand to the browser for its kind: `web`, `link`, `file` or `image` (`isSafeUrl`). | `src/domain/url.ts` |

## Evidence

- `src/domain/model.ts#symbol:RequestStatus`, `src/domain/model.ts#symbol:FeasibilityReport`, `src/domain/model.ts#symbol:WikiTrust`, `src/domain/model.ts#symbol:PrecheckIssue`, `src/domain/model.ts#symbol:CriterionCheck`, `src/domain/model.ts#symbol:RegressionCheck`, `src/domain/model.ts#symbol:WorkRun` — model terms.
- `src/domain/lifecycle.ts#symbol:TRANSITIONS`, `src/domain/lifecycle.ts#symbol:TransitionCommand`, `src/domain/lifecycle.ts#symbol:RequesterStatus` — lifecycle terms.
- `src/domain/roles.ts#symbol:PERMISSIONS` — permissions.
- `src/mocks/engine.ts#symbol:MockState`, `src/config/env-check.ts#symbol:isApiMock`, `src/app/demo-banner.tsx#symbol:DemoBanner` — mock and demo terms.
- `src/config/app.config.ts#symbol:appConfig`, `src/lib/time-zone.ts#symbol:hqToday`, `src/lib/time-zone.ts#symbol:resolveViewTimeZone`, `src/lib/format.ts#symbol:describeDateTime` — time terms.
- `src/stores/session.ts#symbol:SessionEndReason`, `src/domain/url.ts#symbol:UrlKind` — session and URL terms.
- `src/api/contract.ts#symbol:SavedDraft`, `src/stores/draft.ts#symbol:LocalDraft`, `src/features/drafts/sync-engine.ts#symbol:DraftSyncEngine` — draft terms.

## Open Questions

- The UI translates statuses and roles; when talking to users, use the wording in `src/i18n/ko.ts` / `en.ts`, not these identifiers.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
