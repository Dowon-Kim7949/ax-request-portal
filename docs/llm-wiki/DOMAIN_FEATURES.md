---
title: Domain Features
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain_overview
project: ax-request-portal
last_updated: 2026-11-10
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/app/router.tsx
  - src/app/nav.ts
  - src/domain/roles.ts
evidence:
  - e2e/update.spec.ts
  - e2e/time-zone.spec.ts
  - e2e/auth.spec.ts
  - e2e/lifecycle.spec.ts
  - e2e/attachments.spec.ts
  - e2e/demo-banner.spec.ts
  - e2e/axe.spec.ts
  - e2e/csp.spec.ts
  - e2e/schedule.spec.ts
  - e2e/drafts.spec.ts
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
reviewed_at: 2026-11-10
---

# Domain Features

User-facing features by role. Each row names the domain document that holds the details and the E2E spec that proves the workflow end to end.

## Requester

| Feature | Domain | E2E |
| --- | --- | --- |
| File a request in seven steps with a non-blocking precheck | [Request Wizard](domains/11_wizard.md) | `requester.spec.ts` |
| Drafts are kept on this device as they are typed and saved to the account (up to 20), so they continue after a reload, without a connection and on another device; the wizard shows where the draft stands and asks which version to keep after a conflict | [Request Wizard](domains/11_wizard.md) | `requester.spec.ts`, `drafts.spec.ts` |
| Saved drafts listed on home, on My requests and on a new request: continue one at the step it was left, or delete it | [My Requests](domains/08_requests.md), [Home](domains/05_home.md) | `drafts.spec.ts` |
| Leaving asks first only when the draft is kept nowhere; a submission finishes even if the wizard is left and deletes its saved draft; attachments the server cannot find are named | [Request Wizard](domains/11_wizard.md) | — (unit tests) |
| Open an attachment in a new tab (images, PDF) or download it | [Request Detail](domains/04_detail.md) | `attachments.spec.ts` |
| File audit findings item by item, pasted from a table | [Request Wizard](domains/11_wizard.md) | `requester.spec.ts` |
| Confirm the AI's reading of the request (choices, a note, or "not quite" twice) | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| React to a preview of the change before it is merged | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| See own requests, filter by "your turn", open or closed | [My Requests](domains/08_requests.md) | `requester.spec.ts`, `smoke.spec.ts` |
| Answer a developer's questions; check each acceptance criterion; report an issue; cancel early | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| Follow the plain-language status of a request | [Request Detail](domains/04_detail.md) | `requester.spec.ts` |
| See upcoming releases as a list, or a month at a time on a tablet or a desktop | [Release Schedule](domains/09_schedule.md) | `smoke.spec.ts`, `schedule.spec.ts` |

## Developer

| Feature | Domain | E2E |
| --- | --- | --- |
| Work queue filtered by turn, AI activity, waiting, open, closed | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Read the AI feasibility report with evidence, wiki trust, unconfirmed assumptions and project rules | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Confirm the report's assumptions before the first AI run; see the requester's preview reaction in code review | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Decide: run AI work, ask questions, reject | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Review the AI's merge request: approve or request a revision | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Regression checks queue | [Developer Work](domains/12_work.md) | `developer.spec.ts` |
| Schedule a release (not before the head office's today) and mark it done once a date is saved | [Developer Work](domains/12_work.md) | `developer.spec.ts`, `lifecycle.spec.ts` |
| One request from intake to release, handed between requester and developer | [Domain Overview](domains/00_overview.md) | `lifecycle.spec.ts` |

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

## Operator

| Feature | Domain | E2E |
| --- | --- | --- |
| AI budget: monthly and per-request limits, alert threshold, spending by provider and model | [AI Operations](domains/13_ops.md) | `operator.spec.ts` |
| AI agents: provider keys (write-only), model per task, per-project overrides | [AI Operations](domains/13_ops.md) | `operator.spec.ts` |
| AI prices and exchange rate; AI usage by provider (Claude / GPT), day, model, task and request | [AI Operations](domains/13_ops.md) | `operator.spec.ts` |
| AI usage of one request, and the run button disabled at the per-request limit | [Request Detail](domains/04_detail.md), [Developer Work](domains/12_work.md) | `operator.spec.ts` |

## Everyone

| Feature | Domain | E2E |
| --- | --- | --- |
| Sign in, including one-click demo accounts in mock mode | [Login](domains/06_login.md) | `smoke.spec.ts` |
| Signing out sends drafts still on their way first and asks before deleting the ones only this device has; the next sign-in starts at home; after an expiry the same person returns to the page they had open; a link someone may not open goes home; tabs follow each other's sign-ins and sign-outs | [Auth](domains/02_auth.md), [Login](domains/06_login.md) | `auth.spec.ts`, `drafts.spec.ts` |
| Times in the viewer's own time zone, with head-office time beside them where the clocks differ; dates and monthly totals on the head office's calendar; choose the time zone and turn head-office time off in Settings | [Settings](domains/10_settings.md), [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) | `time-zone.spec.ts` |
| A demo build says so on every screen | [Login](domains/06_login.md), [Component Inventory](COMPONENT_INVENTORY.md) | `demo-banner.spec.ts` |
| Data that could not be loaded says so and offers a retry; a failed refresh keeps what is on screen | [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) | `layout.spec.ts` (320 px) |
| Notifications inbox, rendered in the current language | [Notifications](domains/07_notifications.md) | `admin.spec.ts` |
| Language (Korean / English), theme (system / light / dark), notification preferences | [Settings](domains/10_settings.md) | `i18n.spec.ts`, `theme.spec.ts`, `admin.spec.ts` |
| Notice when a newer version is deployed, with a reload button | [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) | `update.spec.ts` |
| Same workflows on phone, tablet and desktop, down to 320 px | [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) | `layout.spec.ts`, `smoke.spec.ts` |
| Every main screen free of serious accessibility findings, light and dark; nothing blocked by the production security policy | [Accessibility](WCAG.md), [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) | `axe.spec.ts`, `csp.spec.ts` |

## API Services

The 41 endpoints of `src/api/contract.ts` are listed per domain in the domain documents; the generated reference is `docs/openapi.json`.

## Evidence

- `src/app/router.tsx#symbol:routes` — routes and their permissions.
- `src/app/nav.ts#symbol:NAV_ITEMS` — navigation per permission; on a phone, "new request" is the middle tab for every role that can file one (`src/app/nav.test.ts`).
- `src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS` — what each role may do.
- `src/api/contract.ts#symbol:api` — the endpoint table.
- `e2e/update.spec.ts` — new-version notice.
- `e2e/time-zone.spec.ts`, `e2e/auth.spec.ts`, `e2e/lifecycle.spec.ts`, `e2e/attachments.spec.ts`, `e2e/demo-banner.spec.ts`, `e2e/axe.spec.ts`, `e2e/csp.spec.ts`, `e2e/schedule.spec.ts` — the features added to the tables above.
- `e2e/drafts.spec.ts` — saved drafts: listed, continued, on another device, deleted, submitted, and signing out.

## Open Questions

- Executives have no E2E test of their requester abilities; they are covered only through the permission table.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
