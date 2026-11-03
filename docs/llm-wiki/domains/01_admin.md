---
title: Admin
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
  - src/features/admin
evidence:
  - src/features/admin/projects-page.tsx#symbol:ProjectsPage
  - src/features/admin/users-page.tsx#symbol:UsersPage
  - src/features/admin/budget-page.tsx#symbol:BudgetPage
  - src/api/queries.ts#symbol:useSaveProject
  - src/api/queries.ts#symbol:useUpdateBudget
  - src/mocks/engine.ts#symbol:saveProject
  - src/mocks/engine.ts#symbol:updateUser
  - src/mocks/engine.ts#symbol:budget
  - src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS
related:
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/domains/03_dashboard.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
visibility: public
contains_sensitive_info: false
---

# Admin

## Responsibility

Administration of the three things the request workflow depends on: projects (repositories, owners, change targets), users (role and active flag) and the monthly AI budget. Each screen has its own permission, and by default only the `admin` role holds all three.

| Route | Page | Permission |
| --- | --- | --- |
| `/admin/projects` | `ProjectsPage` | `project:manage` |
| `/admin/users` | `UsersPage` | `user:manage` |
| `/admin/budget` | `BudgetPage` | `budget:manage` |

## Workflows

- **Projects**: list plus an edit sheet (`editing` is a project, `'new'` or `null`). Fields: name, description, icon, repository (`provider` + URL), wiki path (default `docs/llm-wiki`), owners, targets (name + wiki document) and an active switch. Owner candidates are active developers and admins only. The provider decides whether review links say MR (GitLab) or PR (GitHub).
- **Users**: one row per user with a role select (`appConfig.enabledRoles`) and an active toggle; invitations open a sheet. An admin cannot change their own role or deactivate themselves: the controls are disabled with a `title`, and the server rejects it too.
- **Budget**: spending this month, a `Meter` against the monthly limit, spending per model tier (light / heavy) and a limit form. An "over" badge appears once spending reaches `alertThresholdPct`.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useDirectory` (`useProjects`, `useUsers`) | `GET /projects`, `GET /users` | → `Project[]`, `User[]` | 60 s stale time; shared with every page that shows names. |
| `useSaveProject` | `POST /projects` or `PUT /projects/{id}` (chosen by presence of `id`) | `ProjectInput` (name 1–60, description ≤ 300, repository, ≥ 1 owner, targets with optional id) → `Project` | Server: owners must be developers/admins (`ownersMustBeDevelopers`, 400), unknown id 404, missing target ids are generated. Invalidates projects. |
| `useCreateUser` | `POST /users` | `UserCreate { name, email, role, team? }` → `User` | Duplicate e-mail → 400 `emailTaken`. Invalidates users. |
| `useUpdateUser` | `PATCH /users/{id}` | `UserPatch { role?, team?, active? }` → `User` | Self-change → 400 `cannotChangeSelf`. Invalidates users. |
| `useBudget` | `GET /budget` | → `Budget { month, monthlyLimitKrw, perRequestLimitKrw, alertThresholdPct, spentKrw, byModel[] }` | Inline `ErrorState` with retry. |
| `useUpdateBudget` | `PUT /budget` | `BudgetInput { monthlyLimitKrw, perRequestLimitKrw, alertThresholdPct 1–100 }` → `Budget` | Writes the budget into the cache and invalidates the dashboard. |

All calls carry the bearer token; mutation failures show `toast.error` with the localized server message.

## Domain rules

- The mock server sums AI costs per month from three sources: a finished feasibility report (heavy model), finished AI work (heavy model) and each precheck (light model). Amounts are KRW, rounded.
- Permissions are enforced twice: the route guard hides the page and the mock engine rejects the call. A real backend must do the same; hiding UI is not security.

## Evidence

- `src/features/admin/projects-page.tsx#symbol:ProjectsPage`, `src/features/admin/users-page.tsx#symbol:UsersPage`, `src/features/admin/budget-page.tsx#symbol:BudgetPage` — the three screens.
- `src/api/queries.ts#symbol:useSaveProject`, `src/api/queries.ts#symbol:useUpdateBudget` — create-or-update and budget cache handling.
- `src/mocks/engine.ts#symbol:saveProject`, `src/mocks/engine.ts#symbol:updateUser`, `src/mocks/engine.ts#symbol:budget` — server-side rules and cost aggregation.
- `src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS` — who holds the admin permissions.

## Open Questions

- `perRequestLimitKrw` is stored and shown, but no code was found that enforces it on a single request.
- The dashboard's AI-cost warning uses a fixed 80 % and ignores `alertThresholdPct`; decide whether they should be the same setting.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
