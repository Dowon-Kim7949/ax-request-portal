---
title: Glossary
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: glossary
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/domain/model.ts
  - src/domain/lifecycle.ts
  - src/domain/roles.ts
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
related:
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/index.md
visibility: public
contains_sensitive_info: false
---

# Glossary

## Summary

Terms as the code uses them. Identifiers are kept in English in both UI languages.

| Term | Meaning | Defined in |
| --- | --- | --- |
| Work request (`WorkRequest`) | One change asked for by a requester: project, type, targets, current and desired behaviour, 1–5 acceptance criteria, plus everything that happens to it. | `src/domain/model.ts` |
| Request type (`RequestType`) | `new_feature`, `change`, `bug`, `copy_design`, `non_code`. `non_code` requests get no engineering report. | `src/domain/model.ts` |
| Status (`RequestStatus`) | One of twelve lifecycle states, from `submitted` to `done` / `rejected` / `cancelled`. | `src/domain/model.ts` |
| Event / transition (`TRANSITIONS`) | One of thirteen moves between statuses, each owned by a party. | `src/domain/lifecycle.ts` |
| Party | Who performs an event: `requester`, `developer`, `ai`, `system`. | `src/domain/lifecycle.ts` |
| Transition command (`TransitionCommand`) | The ten events a person can send from the UI, with their payloads. | `src/domain/lifecycle.ts` |
| Turn (`turnOf`) | Whose move a status is: requester, developer, ai or none. Drives "your turn". | `src/domain/lifecycle.ts` |
| Stage (`STAGES`) | Seven progress stages shown in the stepper; several statuses share a stage. | `src/domain/lifecycle.ts` |
| Requester status (`RequesterStatus`) | Plain-language status shown to people without `report:read`. | `src/domain/lifecycle.ts` |
| Responsible developer | Holds `request:review` and is an admin, the assignee or a project owner (`isResponsibleDeveloper`). | `src/domain/lifecycle.ts` |
| Role | `requester`, `executive`, `developer`, `admin`. | `src/domain/model.ts` |
| Permission | One of thirteen capability strings such as `request:create` or `dashboard:view`; roles map to sets of them. | `src/domain/roles.ts` |
| Executive | A requester who may also read all requests and the dashboard. | `src/domain/roles.ts` |
| Operator | The person running the service's AI side: providers and keys, model per task, prices, AI budget and usage. Provisioned by the service, not by an admin. | `src/domain/roles.ts` |
| Provider | `anthropic` (Claude) or `openai` (GPT). | `src/domain/ai.ts` |
| Runtime | How a task drives the model: `api` for precheck and report, `claude_code` or `codex` for AI work. | `src/domain/ai.ts` |
| Usage entry | One booked AI call or agent run: provider, model, runtime, normalized tokens and estimated cost, priced once and never re-priced. | `src/domain/ai.ts` |
| Precheck (`PrecheckIssue`) | Advice on a draft before submission; never blocks. | `src/domain/precheck.ts` |
| Feasibility report (`FeasibilityReport`) | The AI's assessment before any work: verdict, evidence, impact, plan, verification, size, risks, open questions. | `src/domain/model.ts` |
| Verdict (`ReportVerdict`) | `feasible`, `conditional`, `out_of_scope`, `undetermined`. | `src/domain/model.ts` |
| Wiki trust (`WikiTrust`) | `high` / `medium` / `low`, derived from how many of the report's evidence documents are human-verified. | `src/domain/report.ts` |
| Work run (`WorkRun`) | One AI work attempt: phases, cost, result, merge request, change summary. | `src/domain/model.ts` |
| Merge request / MR | The AI's change for review; called PR when the project's provider is GitHub. | `src/features/detail/developer-panels.tsx` |
| Criterion check (`CriterionCheck`) | The requester's pass/fail per acceptance criterion during verification. | `src/domain/model.ts` |
| Regression check (`RegressionCheck`) | An existing feature to re-check after a change, from the report's impact. | `src/domain/model.ts` |
| Mock mode | Running against the in-browser MSW server instead of a backend (`VITE_API_MOCK`). | `src/config/env.ts` |
| Mock state (`MockState`) | The mock server's persisted data, versioned by `STATE_VERSION`. | `src/mocks/engine.ts` |
| Dirty | Mock data a person has edited; it no longer follows language changes. | `src/mocks/engine.ts` |
| Contract | The endpoint table in `src/api/contract.ts` and the generated `docs/openapi.json`. | `src/api/contract.ts` |

## Evidence

- `src/domain/model.ts#symbol:RequestStatus`, `src/domain/model.ts#symbol:FeasibilityReport`, `src/domain/model.ts#symbol:WikiTrust`, `src/domain/model.ts#symbol:PrecheckIssue`, `src/domain/model.ts#symbol:CriterionCheck`, `src/domain/model.ts#symbol:RegressionCheck`, `src/domain/model.ts#symbol:WorkRun` — model terms.
- `src/domain/lifecycle.ts#symbol:TRANSITIONS`, `src/domain/lifecycle.ts#symbol:TransitionCommand`, `src/domain/lifecycle.ts#symbol:RequesterStatus` — lifecycle terms.
- `src/domain/roles.ts#symbol:PERMISSIONS` — permissions.
- `src/mocks/engine.ts#symbol:MockState` — mock terms.

## Open Questions

- The UI translates statuses and roles; when talking to users, use the wording in `src/i18n/ko.ts` / `en.ts`, not these identifiers.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
