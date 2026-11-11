---
title: Admin
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-11
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
  - src/api/queries.ts#symbol:useUpdateUser
  - src/api/queries.ts#symbol:useSaveTeam
  - src/app/hooks.ts#symbol:useTeamDirectory
  - src/mocks/engine.ts#symbol:createTeam
  - src/mocks/engine.ts#symbol:updateTeam
  - src/app/hooks.ts#symbol:useDirectory
  - src/domain/url.ts#symbol:WebUrl
related:
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/domains/03_dashboard.md
  - docs/llm-wiki/domains/13_ops.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-11
---

# Admin

## Responsibility

Administration of the organization's side of the workflow: projects (repositories, owners, change targets) and users (role and active flag). Each screen has its own permission; by default the `admin` role holds both. The AI side of the service (providers, models, prices, budget, usage) belongs to the `operator` role and is documented in [AI Operations](13_ops.md); `/admin/budget` now redirects to `/ops/budget`.

| Route | Page | Permission |
| --- | --- | --- |
| `/admin/projects` | `ProjectsPage` | `project:manage` |
| `/admin/users` | `UsersPage` | `user:manage` |

## Workflows

- **Projects**: list plus an edit sheet (`editing` is a project, `'new'` or `null`). Fields: name, description, icon, repository (`provider` + URL), wiki path (default `docs/llm-wiki`), owners, targets (name + wiki document), rules to keep (`constraints`: text + optional source such as "Security policy 3.2", at most 20) and an active switch. The AI checks every rule in its report and the work instructions carry them, so requesters never have to repeat them. Owner candidates are active developers and admins only. The provider decides whether review links say MR (GitLab) or PR (GitHub). The repository URL must be an absolute `http(s)` URL (`WebUrl`), in the form and in the contract. Each project card lists repository and owners as a `<dl>`; the target and rule counts sit outside it, because a `<dl>` holds only term–description pairs.
- Both screens show `LoadFailed` with a retry when their list cannot be loaded (never an empty list), and keep the list with a `RefreshFailed` line when a refresh fails (`useDirectory().projectsError` / `usersError`, `projectsStale` / `usersStale`).
- **Users**: one row per user with a role select and an active toggle; invitations open a sheet. The select offers `appConfig.enabledRoles` minus `operator`. An admin cannot change their own role or deactivate themselves, and cannot change an operator's row: the controls are disabled with a `title`, an operator row also says so in visible text, and the server rejects both.

## Layout

- Both screens are `fit` routes ([Frontend Profile](../profiles/frontend.md)): on a big screen the title, the add or invite button and the refresh notice stay in place and only the list scrolls ("프로젝트 목록", "사용자 목록"). The project and invitation forms open in sheets.

## API Services

| Hook | Endpoint | Payload → response | Errors and cache |
| --- | --- | --- | --- |
| `useDirectory` (`useProjects`, `useUsers`) | `GET /projects`, `GET /users` | → `Project[]`, `User[]` | 60 s stale time; shared with every page that shows names. |
| `useSaveProject` | `POST /projects` or `PUT /projects/{id}` (chosen by presence of `id`) | `ProjectInput` (name 1–60, description ≤ 300, repository, ≥ 1 owner, targets with optional id, constraints with optional id) → `Project` | Server: owners must be developers/admins (`ownersMustBeDevelopers`, 400), unknown id 404, missing target and constraint ids are generated; an empty rule text is 400. Invalidates projects. |
| `useCreateUser` | `POST /users` | `UserCreate { name, email, role, teamId? }` → `User` | Duplicate e-mail → 400 `emailTaken`; unknown team → 404 `teamNotFound`. Invalidates users. |
| `useUpdateUser` | `PATCH /users/{id}` | `UserPatch { role?, teamId? (null = no team), active? }` → `User` | Self-change of role or active → 400 `cannotChangeSelf` (one's own team may change); unknown team → 404. Invalidates users, and `GET /auth/me` too when the changed user is the one signed in. |
| `useTeamDirectory` (`useTeams`) | `GET /teams` | → `Team[]` by name | Readable by everyone signed in; `teamName(id)` gives the current name ("unknown team" once loaded without it). |
| `useSaveTeam` | `POST /teams`, `PATCH /teams/{id}` | `TeamInput { name }` → `Team` | `user:manage`. Name 1–40 characters, unique ignoring case (400 `teamNameTaken`). Invalidates teams. |

Creating a user with the `operator` role, or changing an operator, is refused with 403 `operatorProvisioned` (`createUser`, `updateUser`).

All calls carry the bearer token; mutation failures show `toast.error` with the localized server message.

## Domain rules

- Operator accounts are provisioned by the service (database, seed or an identity-provider group mapped to `operator`), never by an organization admin, so an admin cannot hand themselves the AI keys or the budget.
- Permissions are enforced twice: the route guard hides the page and the mock engine rejects the call. A real backend must do the same; hiding UI is not security.
- Teams are records (`Team { id, name }`); a user holds `teamId`. "Teams" on the users page opens a sheet to add a team and rename each one in place; there is no delete, because AI usage still points at old teams. The invitation sheet and each user's row pick the team from the list, "no team" first; an operator's row is locked. Renaming changes the name everywhere at once, since people and AI usage keep the id. Each AI usage entry keeps the team id its person had when it was booked, so moving someone does not move earlier AI spending ([AI Operations](13_ops.md)).

## Evidence

- `src/features/admin/projects-page.tsx#symbol:ProjectsPage`, `src/features/admin/users-page.tsx#symbol:UsersPage` — the two screens; `ASSIGNABLE_ROLES` in the users page leaves out `operator`.
- `src/api/queries.ts#symbol:useSaveProject`, `src/api/queries.ts#symbol:useUpdateUser` — create-or-update; refreshing the signed-in user.
- `src/app/hooks.ts#symbol:useDirectory` — shared lists with their load and refresh failures.
- `src/domain/url.ts#symbol:WebUrl` — repository URL rule.
- `src/mocks/engine.ts#symbol:saveProject`, `src/mocks/engine.ts#symbol:createUser`, `src/mocks/engine.ts#symbol:updateUser` — server-side rules, including the `operatorProvisioned` refusal.
- `src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS` — `admin` holds every permission except `OPERATOR_PERMISSIONS`.

## Open Questions

- None at the moment.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
