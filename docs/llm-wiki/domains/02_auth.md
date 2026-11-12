---
title: Auth
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-10
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/auth
  - src/app/guards.tsx
  - src/stores/session.ts
  - src/domain/roles.ts
  - src/app/hooks.ts
  - src/app/session-sync.ts
  - src/stores/draft.ts
  - src/app/sign-out.tsx
evidence:
  - src/app/guards.tsx#symbol:RequireAuth
  - src/app/guards.tsx#symbol:RequirePermission
  - src/app/guards.tsx#symbol:SessionSync
  - src/stores/session.ts#symbol:useSession
  - src/stores/session.ts#symbol:sessionChangeFrom
  - src/stores/draft.ts#symbol:clearDrafts
  - src/app/sign-out.tsx#symbol:useSignOut
  - src/features/drafts/sync.ts#symbol:flushDraftsBeforeSignOut
  - src/app/sign-out.test.tsx
  - src/app/session-sync.ts#symbol:expireSession
  - src/app/session-sync.ts#symbol:useSessionSync
  - src/app/router.tsx#symbol:RouteHandle
  - src/app/router.tsx#symbol:permissionsFor
  - src/features/auth/post-login.ts#symbol:resolvePostLoginPath
  - src/app/hooks.ts#symbol:userCan
  - src/api/queries.ts#symbol:useLogin
  - src/api/queries.ts#symbol:useMe
  - src/api/queries.ts#symbol:useLogout
  - src/api/client.ts#symbol:configureClient
  - src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS
  - src/app/hooks.ts#symbol:useCan
  - src/mocks/handlers.ts#symbol:TOKEN_PREFIX
  - src/stores/session.test.ts
  - src/app/session-sync.test.tsx
  - e2e/auth.spec.ts
related:
  - docs/llm-wiki/domains/06_login.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-12
---

# Auth

## Responsibility

Who the user is and what they may do: the session, the auth and permission guards, and the role-to-permission table. The login screen itself is documented in [Login](06_login.md); the logout button lives in the app shell.

## Session

- `useSession` (zustand `persist`, key `SESSION_STORAGE_KEY` = `ax-request-portal:session`) keeps `token` and `user` so a reload does not log the user out. It is a cache: `GET /auth/me` is the source of truth, and `RequireAuth` writes its result back with `setUser`.
- `clear(reason)` always takes why the session ended: `signedOut` (the person left, here or in another tab) or `expired` (the server stopped accepting the token). The store keeps `ended { reason, userId }` in memory only; the next `setSession` resets it.
- The persisted value of a signed-out session carries `endReason`, so other tabs end theirs the same way. When the store hydrates, `merge` drops it: a tab opened later starts without history, and `ended` exists only in the tab where the session ended.
- Signing out on purpose (`clear('signedOut')`) also deletes everything this device keeps of that person's drafts (`clearDrafts`, `src/stores/draft.ts`), because someone else may use the device next; with no user left in the store it uses `ended.userId`, so a sign-out right after an expiry still deletes them. An expiry keeps the drafts for when they sign in again. The drafts saved to the account stay there ([Request Wizard](11_wizard.md)).
- The shell's sign-out button goes through `useSignOut` (`src/app/sign-out.tsx`): with drafts on this device it first sends them to the account for at most `DRAFT_SETTLE_TIMEOUT_MS` (3 s, a loading toast meanwhile; `flushDraftsBeforeSignOut`). When some still cannot reach the account (no connection, a full account, a conflict), a sheet says how many drafts on this device only would be deleted, with Cancel and Sign out; Cancel gives focus back to the account button. On phones the "more" sheet closes first. A sign-out from another tab deletes the drafts without asking.
- The API client is configured once in `main.tsx` (`configureClient`) with `getToken` and `onUnauthorized(token)`. A `401` from a non-public endpoint calls `expireSession(queryClient, token)` with the token the refused request carried: only a refusal of the current token clears the whole query cache and the session (`clear('expired')`). A late `401` for a session that already ended, or for an earlier session after a new sign-in, changes nothing.
- In mock mode the token has the shape `Bearer mock-token.<userId>`; a real backend issues its own token and the client does not inspect it.

## Tabs

`SessionSync` (rendered once, in the pathless root route) runs `useSessionSync`. It listens to `storage` events on the session key and to `pageshow` from the back/forward cache, and re-reads the stored session once right after it starts listening, for a change made while the tab was still booting. `sessionChangeFrom` turns the stored value into one change:

| Change | This tab |
| --- | --- |
| `signedOut` | Clears the query cache and the session (`clear('signedOut')`); the login screen opens without `next`. |
| `expired` | The same as its own `401`: `clear('expired')`, so `next` and the expiry notice stay. |
| `signedIn` | This tab was signed out: takes the session; the login screen moves on by itself. |
| `switchedUser` | Takes the new session, clears the previous person's cache, goes home and shows a toast (`auth.switchedAccount`). |
| `refreshed` | Same person, new token or profile: updates it without moving. |

## Guards

- Every route sits under a pathless root route whose `errorElement` is `RouteErrorPage`; `/` keeps its own `errorElement`, so an error below the shell leaves the root (and the tab sync) running.
- `RequireAuth` wraps every route under `/`. Without a token or user it replaces the location with `/login?next=<path+query+hash>` (no `next` for `/`), except after a sign-out on purpose (`ended.reason === 'signedOut'`), which goes to plain `/login`: the next person to sign in starts at home.
- A route's permission is declared once, as `handle.permission` (`RouteHandle` in `src/app/router.tsx`). `page()` wraps the lazy page in `RequirePermission`, the post-login redirect (`resolvePostLoginPath`, see [Login](06_login.md)) reads the same handles, and so do the menus (`permissionsFor`, `visibleNav`: an item shows only when its page would open). A missing permission renders an `ErrorState` ("forbidden") with a link home instead of redirecting, so a shared deep link explains itself; it is wrapped in `PagePlain`, the page width and padding the shell leaves to `fit` pages, which every `page()` route is ([Frontend Profile](../profiles/frontend.md)).
- Old addresses (`/admin/budget`, `/settings/notifications`) are `moved(to)` routes: a `<Navigate>` plus `handle.redirectTo`, which the post-login redirect follows to check the destination's permission.

## Roles and permissions

`DEFAULT_ROLE_PERMISSIONS` maps five roles to thirteen permissions; `appConfig.rolePermissions` may override it. `userCan(user, permission)` in `src/app/hooks.ts` reads the effective table; `useCan` and the post-login redirect both use it.

| Role | Permissions |
| --- | --- |
| `requester` | `request:create`, `request:read:own`, `schedule:view` |
| `executive` | requester's + `request:read:all`, `dashboard:view` |
| `developer` | `request:create`, `request:read:own`, `request:read:all`, `request:review`, `report:read`, `regression:view`, `schedule:view` |
| `admin` | all except `OPERATOR_PERMISSIONS`, including `project:manage`, `user:manage` |
| `operator` | `OPERATOR_PERMISSIONS`: `budget:manage`, `agent:manage`, `usage:view` — the service's AI operations, no request permissions ([AI Operations](13_ops.md)) |

The config schema refuses a configuration without `admin`, or without an enabled role holding `user:manage`, `agent:manage` or `budget:manage`. Operator accounts are provisioned by the service; an admin cannot create or change one (403 `operatorProvisioned`).

## API Services

| Hook | Endpoint | Payload → response | Notes |
| --- | --- | --- | --- |
| `useLogin` | `POST /auth/login` (public) | `{ email, password }` → `Session { token, user }` | Clears the whole query cache, then stores the session, so no data from a previous user survives. |
| `useMe` | `GET /auth/me` | → `User` | Enabled only with a token. |
| `useLogout` | `POST /auth/logout` (204) | — | `onSettled` clears the cache and calls `clear('signedOut')` even if the call fails. The button is in the account menu (tablet and desktop) or the phone's "more" sheet. |

## Evidence

- `src/app/guards.tsx#symbol:RequireAuth`, `src/app/guards.tsx#symbol:RequirePermission`, `src/app/guards.tsx#symbol:SessionSync` — redirect, forbidden behaviour and the tab sync's mount point.
- `src/stores/session.ts#symbol:useSession`, `src/stores/session.ts#symbol:sessionChangeFrom`, `src/stores/draft.ts#symbol:clearDrafts` — persisted session, end reasons, how another tab's write is read, the drafts deleted on sign-out.
- `src/app/sign-out.tsx#symbol:useSignOut`, `src/features/drafts/sync.ts#symbol:flushDraftsBeforeSignOut`, `src/app/sign-out.test.tsx` — drafts sent before signing out, and the question about the ones that could not be.
- `src/app/session-sync.ts#symbol:expireSession`, `src/app/session-sync.ts#symbol:useSessionSync` — 401 handling and tab synchronisation.
- `src/app/router.tsx#symbol:RouteHandle`, `src/features/auth/post-login.ts#symbol:resolvePostLoginPath` — route permissions and the redirect that reads them.
- `src/api/queries.ts#symbol:useLogin`, `src/api/queries.ts#symbol:useMe`, `src/api/queries.ts#symbol:useLogout` — session hooks.
- `src/api/client.ts#symbol:configureClient` — token and 401 wiring.
- `src/domain/roles.ts#symbol:DEFAULT_ROLE_PERMISSIONS`, `src/app/hooks.ts#symbol:userCan`, `src/app/hooks.ts#symbol:useCan` — permission table and lookup.
- `src/mocks/handlers.ts#symbol:TOKEN_PREFIX` — mock token format.
- `src/stores/session.test.ts`, `src/app/session-sync.test.tsx`, `e2e/auth.spec.ts` — end reasons, tab sync, sign-out and deep-link redirects.

## Open Questions

- Hiding pages and buttons is not enforcement. The mock engine re-checks every permission; a real backend must do the same for every endpoint in `src/api/contract.ts`.
- `ended` lives only in memory: after a reload of the login screen, or in a newly opened tab, the "only the same person returns to `next`" rule no longer applies and only the permission check does (as for a deep link).

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
