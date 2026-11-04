---
title: Home
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-03
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/home
evidence:
  - src/features/home/home-page.tsx#symbol:HomePage
  - src/features/home/home-page.tsx#symbol:RequesterSection
  - src/features/home/home-page.tsx#symbol:DeveloperSection
  - src/domain/lifecycle.ts#symbol:turnOf
  - src/api/queries.ts#symbol:useRequests
related:
  - docs/llm-wiki/domains/08_requests.md
  - docs/llm-wiki/domains/12_work.md
  - docs/llm-wiki/domains/11_wizard.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Home

## Responsibility

The landing page at `/` (authentication only, no extra permission). It shows what needs the current user's attention and links onward; it owns no list, form or detail logic.

## Composition by permission

| Section | Shown when | Content |
| --- | --- | --- |
| Dashboard call-to-action | `dashboard:view` | Link to `/dashboard`. |
| `DeveloperSection` | `request:review` | Up to six requests whose turn is the developer's (`turnOf(status) === 'developer'`), with requester names; "see all" goes to `/work`. |
| `RequesterSection` | `request:create` and not `request:review` | Count of open requests (link to `/requests`), "your turn" cards (`turnOf === 'requester'`), active projects that start a request at `/requests/new?project=<id>`, and a new-request button. |
| `AdminSection` | `project:manage` or `user:manage` | Links to the admin pages the user may open. |
| `OpsSection` | any of `usage:view`, `agent:manage`, `budget:manage` | This month's AI cost against the monthly limit (with `usage:view`, from `GET /ai/usage`) and links to the AI operations pages ([AI Operations](13_ops.md)). |

Developers and admins therefore never see the requester section.

## API Services

- `useRequests({ scope: 'mine' })` and `useRequests({ scope: 'assigned' })` → `GET /requests?scope=…` → `WorkRequestSummary[]`. Lists poll every 4 s while any request is in a live status (`submitted`, `reporting`, `in_progress`).
- `useDirectory` → `GET /users`, `GET /projects` for names and project icons.
- No mutations and no error branch; loading shows skeletons.

## Evidence

- `src/features/home/home-page.tsx#symbol:HomePage`, `src/features/home/home-page.tsx#symbol:RequesterSection`, `src/features/home/home-page.tsx#symbol:DeveloperSection` — composition rules.
- `src/domain/lifecycle.ts#symbol:turnOf` — whose turn a status is.
- `src/api/queries.ts#symbol:useRequests` — scopes and live polling.

## Open Questions

- A failed request list renders nothing rather than an error state.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
