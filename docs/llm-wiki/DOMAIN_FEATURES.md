---
title: Domain Features
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain_overview
project: ax-request-portal
last_updated: 2026-11-04
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/app/router.tsx
  - src/app/nav.ts
  - src/domain/roles.ts
evidence:
  - e2e/update.spec.ts
  - src/app/router.tsx#symbol:routes
  - src/app/nav.ts#symbol:NAV_ITEMS
  - src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS
  - src/api/contract.ts#symbol:api
related:
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/E2E_WORKFLOWS.md
  - docs/llm-wiki/GLOSSARY.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Domain Features

User-facing features by role. Each row names the domain document that holds the details and the E2E spec that proves the workflow end to end.

## Requester

| Feature | Domain | E2E |
| --- | --- | --- |
| File a request in seven steps with a saved draft and a non-blocking precheck | [Request Wizard](domains/11_wizard.md) | `requester.spec.ts` |
| File audit findings item by item, pasted from a table | [Request Wizard](domains/11_wizard.md) | `requester.spec.ts` |
| Confirm the AI's reading of the request (choices, a note, or "not quite" twice) | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| React to a preview of the change before it is merged | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| See own requests, filter by "your turn", open or closed | [My Requests](domains/08_requests.md) | `requester.spec.ts`, `smoke.spec.ts` |
| Answer a developer's questions; check each acceptance criterion; report an issue; cancel early | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| Follow the plain-language status of a request | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| See upcoming releases | [Release Schedule](domains/09_schedule.md) | `smoke.spec.ts` |

## Developer

| Feature | Domain | E2E |
| --- | --- | --- |
| Work queue filtered by turn, AI activity, waiting, open, closed | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Read the AI feasibility report with evidence, wiki trust, unconfirmed assumptions and project rules | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Confirm the report's assumptions before the first AI run; see the requester's preview reaction in code review | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Decide: run AI work, ask questions, reject | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Review the AI's merge request: approve or request a revision | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Regression checks queue | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Schedule a release and mark it done | [Developer Work](domains/12_work.md) | `developer.spec.ts` |

## Executive

| Feature | Domain | E2E |
| --- | --- | --- |
| Monthly dashboard: received (like-for-like comparison), in progress, done, AI cost, per-project bars, attention list | [Executive Dashboard](domains/03_dashboard.md) | `admin.spec.ts` |
| Everything a requester can do, plus reading all requests | [Auth](domains/02_auth.md) | — |

## Admin

| Feature | Domain | E2E |
| --- | --- | --- |
| Projects: repository, owners, change targets, rules to keep, wiki path, active flag | [Admin](domains/01_admin.md) | `admin.spec.ts` |
| Users: invite, change role, deactivate | [Admin](domains/01_admin.md) | `admin.spec.ts` |
| AI budget: monthly and per-request limits, alert threshold, spending by provider and model | [AI Operations](domains/13_ops.md) | `operator.spec.ts` |
| AI agents: provider keys (write-only), model per task, per-project overrides | [AI Operations](domains/13_ops.md) | `operator.spec.ts` |
| AI prices and exchange rate; AI usage by provider (Claude / GPT), day, model, task and request | [AI Operations](domains/13_ops.md) | `operator.spec.ts` |
| AI usage of one request, and the run button disabled at the per-request limit | [Request Detail](domains/04_detail.md), [Developer Work](domains/12_work.md) | `operator.spec.ts` |

## Everyone

| Feature | Domain | E2E |
| --- | --- | --- |
| Sign in, including one-click demo accounts in mock mode | [Login](domains/06_login.md) | `smoke.spec.ts` |
| Notifications inbox, rendered in the current language | [Notifications](domains/07_notifications.md) | `admin.spec.ts` |
| Language (Korean / English), theme (system / light / dark), notification preferences | [Settings](domains/10_settings.md) | `i18n.spec.ts`, `theme.spec.ts`, `admin.spec.ts` |
| Notice when a newer version is deployed, with a reload button | [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) | `update.spec.ts` |
| Same workflows on phone, tablet and desktop, down to 320 px | [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) | `layout.spec.ts`, `smoke.spec.ts` |

## API Services

The 35 endpoints of `src/api/contract.ts` are listed per domain in the domain documents; the generated reference is `docs/openapi.json`.

## Evidence

- `src/app/router.tsx#symbol:routes` — routes and their permissions.
- `src/app/nav.ts#symbol:NAV_ITEMS` — navigation per permission.
- `src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS` — what each role may do.
- `src/api/contract.ts#symbol:api` — the endpoint table.
- `e2e/update.spec.ts` — new-version notice.

## Open Questions

- Executives have no E2E test of their requester abilities; they are covered only through the permission table.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
