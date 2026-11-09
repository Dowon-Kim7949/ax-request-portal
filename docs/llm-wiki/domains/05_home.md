---
title: Home
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-09
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/home
  - src/features/drafts/drafts-section.tsx
evidence:
  - src/features/home/home-page.tsx#symbol:HomePage
  - src/features/home/home-page.tsx#symbol:RequesterSection
  - src/features/home/home-page.tsx#symbol:DeveloperSection
  - src/domain/lifecycle.ts#symbol:turnOf
  - src/api/queries.ts#symbol:useRequests
  - src/app/hooks.ts#symbol:useDirectory
  - src/components/ui/load-failed.tsx#symbol:LoadFailed
  - src/api/refresh.ts#symbol:refreshOf
  - src/features/home/home-page.test.tsx
  - src/features/drafts/drafts-section.tsx#symbol:DraftsSection
related:
  - docs/llm-wiki/domains/08_requests.md
  - docs/llm-wiki/domains/12_work.md
  - docs/llm-wiki/domains/11_wizard.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-09
---

# Home

## Responsibility

The landing page at `/` (authentication only, no extra permission). It shows what needs the current user's attention and links onward; it owns no list, form or detail logic.

## Composition by permission

| Section | Shown when | Content |
| --- | --- | --- |
| Dashboard call-to-action | `dashboard:view` | Link to `/dashboard`. |
| `DeveloperSection` | `request:review` | Up to six requests whose turn is the developer's (`turnOf(status) === 'developer'`), with requester names; "see all" goes to `/work`. Followed by the saved drafts when the person also has `request:create` (developers and admins do). |
| `RequesterSection` | `request:create` and not `request:review` | Count of open requests (link to `/requests`), "your turn" cards (`turnOf === 'requester'`), the saved drafts under them, active projects that start a request at `/requests/new?project=<id>`, and a new-request button. |
| `AdminSection` | `project:manage` or `user:manage` | Links to the admin pages the user may open. |
| `OpsSection` | any of `usage:view`, `agent:manage`, `budget:manage` | This month's AI cost against the monthly limit (with `usage:view`, from `GET /ai/usage`) and links to the AI operations pages ([AI Operations](13_ops.md)). |

Developers and admins therefore never see the requester section.

## Saved drafts

`DraftsSection variant="home"` shows for everyone with `request:create`: in the requester section's left column under "your turn", and for reviewers (developers, admins) right after the developer queue. It is the same section as on [My Requests](08_requests.md) (rows from the account and this device, badges, `N/20`, delete with confirmation, the room held while the account's list is read) with the newest three rows only, and a "See all saved drafts" link to `/requests#drafts` beside the heading (44 px tall, shown even with three drafts or fewer). It is absent when there are no drafts, so a reviewer's home looks as before until they save one.

## API Services

- `useRequests({ scope: 'mine' })` and `useRequests({ scope: 'assigned' })` → `GET /requests?scope=…` → `WorkRequestSummary[]`. Lists poll every 4 s while any request is in a live status (`submitted`, `reporting`, `in_progress`).
- `useDirectory` → `GET /users`, `GET /projects` for names and project icons.
- `useDrafts` → `GET /drafts` → `SavedDraftSummary[]` for the saved drafts, merged with this device's; deleting a draft is the one change made from home (`useDiscardDraft`, [Request Wizard](11_wizard.md)).
- Loading shows skeletons.

## Load failures

- A failed first load never reads as "nothing to do". The open-request count becomes a plain "My requests" link, and "your turn", the service list and the developer queue show a compact `LoadFailed` with a retry instead of "0 in progress" or an empty list. The AI cost summary is a link, so it shows only the failure line, without a button; the usage screen offers the retry.
- A failed refresh (a poll, a return to the tab) keeps what was loaded and adds one `RefreshFailed` line per section (`refreshOf`; for the service list, `useDirectory().projectsStale`).

## Evidence

- `src/features/home/home-page.tsx#symbol:HomePage`, `src/features/home/home-page.tsx#symbol:RequesterSection`, `src/features/home/home-page.tsx#symbol:DeveloperSection` — composition rules.
- `src/domain/lifecycle.ts#symbol:turnOf` — whose turn a status is.
- `src/api/queries.ts#symbol:useRequests` — scopes and live polling.
- `src/app/hooks.ts#symbol:useDirectory`, `src/components/ui/load-failed.tsx#symbol:LoadFailed`, `src/api/refresh.ts#symbol:refreshOf`, `src/features/home/home-page.test.tsx` — load and refresh failures; the saved drafts on home.
- `src/features/drafts/drafts-section.tsx#symbol:DraftsSection` — the saved-drafts section.

## Open Questions

- None.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
