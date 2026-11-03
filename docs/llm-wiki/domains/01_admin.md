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
  - src/api/queries.ts#symbol:useSaveProject
  - src/mocks/engine.ts#symbol:saveProject
  - src/mocks/engine.ts#symbol:createUser
  - src/mocks/engine.ts#symbol:updateUser
  - src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS
related:
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/domains/03_dashboard.md
  - docs/llm-wiki/domains/13_ops.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
visibility: public
contains_sensitive_info: false
---

# Admin

## Responsibility

Administration of the organization's side of the workflow: projects (repositories, owners, change targets) and users (role and active flag). Each screen has its own permission; by default the `admin` role holds both. The AI side of the service (providers, models, prices, budget, usage) belongs to the `operator` role and is documented in [AI Operations](13_ops.md); `/admin/budget` now redirects to `/ops/budget`.

| Route | Page | Permission |
| --- | --- | --- |
| `/admin/projects` | `ProjectsPage` | `project:manage` |
| `/admin/users` | `UsersPage` | `user:manage` |

## Workflows

- **Projects**: list plus an edit sheet (`editing` is a project, `'new'` or `null`). Fields: name, description, icon, repository (`provider` + URL), wiki path (default `docs/llm-wiki`), owners, targets (name + wiki document) and an active switch. Owner candidates are active developers and admins only. The provider decides whether review links say MR (GitLab) or PR (GitHub).
- **Users**: one row per user with a role select and an active toggle; invitations open a sheet. The select offers `appConfig.enabledRoles` minus `operator`. An admin cannot change their own role or deactivate themselves, and cannot change an operator's row: the controls are disabled with a `title`, an operator row also says so in visible text, and the server rejects both.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useDirectory` (`useProjects`, `useUsers`) | `GET /projects`, `GET /users` | → `Project[]`, `User[]` | 60 s stale time; shared with every page that shows names. |
| `useSaveProject` | `POST /projects` or `PUT /projects/{id}` (chosen by presence of `id`) | `ProjectInput` (name 1–60, description ≤ 300, repository, ≥ 1 owner, targets with optional id) → `Project` | Server: owners must be developers/admins (`ownersMustBeDevelopers`, 400), unknown id 404, missing target ids are generated. Invalidates projects. |
| `useCreateUser` | `POST /users` | `UserCreate { name, email, role, team? }` → `User` | Duplicate e-mail → 400 `emailTaken`. Invalidates users. |
| `useUpdateUser` | `PATCH /users/{id}` | `UserPatch { role?, team?, active? }` → `User` | Self-change → 400 `cannotChangeSelf`. Invalidates users. |

Creating a user with the `operator` role, or changing an operator, is refused with 403 `operatorProvisioned` (`createUser`, `updateUser`).

All calls carry the bearer token; mutation failures show `toast.error` with the localized server message.

## Domain rules

- Operator accounts are provisioned by the service (database, seed or an identity-provider group mapped to `operator`), never by an organization admin, so an admin cannot hand themselves the AI keys or the budget.
- Permissions are enforced twice: the route guard hides the page and the mock engine rejects the call. A real backend must do the same; hiding UI is not security.

## Evidence

- `src/features/admin/projects-page.tsx#symbol:ProjectsPage`, `src/features/admin/users-page.tsx#symbol:UsersPage` — the two screens; `ASSIGNABLE_ROLES` in the users page leaves out `operator`.
- `src/api/queries.ts#symbol:useSaveProject` — create-or-update.
- `src/mocks/engine.ts#symbol:saveProject`, `src/mocks/engine.ts#symbol:createUser`, `src/mocks/engine.ts#symbol:updateUser` — server-side rules, including the `operatorProvisioned` refusal.
- `src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS` — `admin` holds every permission except `OPERATOR_PERMISSIONS`.

## Open Questions

- None at the moment.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
