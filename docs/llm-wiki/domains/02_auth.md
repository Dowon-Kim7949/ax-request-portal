---
title: Auth
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
  - src/features/auth
  - src/app/guards.tsx
  - src/stores/session.ts
  - src/domain/roles.ts
  - src/app/hooks.ts
evidence:
  - src/app/guards.tsx#symbol:RequireAuth
  - src/app/guards.tsx#symbol:RequirePermission
  - src/stores/session.ts#symbol:useSession
  - src/api/queries.ts#symbol:useLogin
  - src/api/queries.ts#symbol:useMe
  - src/api/queries.ts#symbol:useLogout
  - src/api/client.ts#symbol:configureClient
  - src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS
  - src/app/hooks.ts#symbol:useCan
  - src/mocks/handlers.ts#symbol:TOKEN_PREFIX
related:
  - docs/llm-wiki/domains/06_login.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
visibility: public
contains_sensitive_info: false
---

# Auth

## Responsibility

Who the user is and what they may do: the session, the auth and permission guards, and the role-to-permission table. The login screen itself is documented in [Login](06_login.md); the logout button lives in the app shell.

## Session

- `useSession` (zustand `persist`, key `ax-request-portal:session`) keeps `token` and `user` so a reload does not log the user out. It is a cache: `GET /auth/me` is the source of truth, and `RequireAuth` writes its result back with `setUser`.
- The API client is configured once in `main.tsx` (`configureClient`) with `getToken` and `onUnauthorized`. Any `401` from a non-public endpoint clears the session, which makes `RequireAuth` redirect to the login page.
- In mock mode the token has the shape `Bearer mock-token.<userId>`; a real backend issues its own token and the client does not inspect it.

## Guards

- `RequireAuth` wraps every route under `/`. Without a token or user it replaces the location with `/login?next=<path+query>` (no `next` for `/`).
- `RequirePermission` wraps a lazy page when its route declares a permission. A missing permission renders an `ErrorState` ("forbidden") with a link home instead of redirecting, so a shared deep link explains itself.

## Roles and permissions

`DEFAULT_ROLE_PERMISSIONS` maps four roles to eleven permissions; `appConfig.rolePermissions` may override it, and `useCan` reads the effective table.

| Role | Permissions |
| --- | --- |
| `requester` | `request:create`, `request:read:own`, `schedule:view` |
| `executive` | requester's + `request:read:all`, `dashboard:view` |
| `developer` | `request:create`, `request:read:own`, `request:read:all`, `request:review`, `report:read`, `regression:view`, `schedule:view` |
| `admin` | all, including `project:manage`, `user:manage`, `budget:manage` |

The config schema refuses a configuration without `admin` or without any active role holding `user:manage`.

## API Services

| Hook | Endpoint | Payload → response | Notes |
| --- | --- | --- | --- |
| `useLogin` | `POST /auth/login` (public) | `{ email, password }` → `Session { token, user }` | Clears the whole query cache, then stores the session, so no data from a previous user survives. |
| `useMe` | `GET /auth/me` | → `User` | Enabled only with a token. |
| `useLogout` | `POST /auth/logout` (204) | — | `onSettled` clears the session and the cache even if the call fails. |

## Evidence

- `src/app/guards.tsx#symbol:RequireAuth`, `src/app/guards.tsx#symbol:RequirePermission` — redirect and forbidden behaviour.
- `src/stores/session.ts#symbol:useSession` — persisted session.
- `src/api/queries.ts#symbol:useLogin`, `src/api/queries.ts#symbol:useMe`, `src/api/queries.ts#symbol:useLogout` — session hooks.
- `src/api/client.ts#symbol:configureClient` — token and 401 wiring.
- `src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS`, `src/app/hooks.ts#symbol:useCan` — permission table and lookup.
- `src/mocks/handlers.ts#symbol:TOKEN_PREFIX` — mock token format.

## Open Questions

- Hiding pages and buttons is not enforcement. The mock engine re-checks every permission; a real backend must do the same for every endpoint in `src/api/contract.ts`.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
