---
title: Notifications
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-04
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/notifications
  - src/mocks/copy.ts
evidence:
  - src/features/notifications/notifications-page.tsx#symbol:NotificationsPage
  - src/api/queries.ts#symbol:useNotifications
  - src/api/queries.ts#symbol:useMarkNotificationRead
  - src/mocks/engine.ts#symbol:notify
  - src/mocks/engine.ts#symbol:notifyStatus
  - src/mocks/engine.ts#symbol:markRead
  - src/mocks/copy.ts#symbol:renderNotification
  - src/mocks/copy.ts#symbol:NotificationKey
related:
  - docs/llm-wiki/domains/10_settings.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
visibility: public
contains_sensitive_info: false
---

# Notifications

## Responsibility

The in-app inbox at `/notifications` (authentication only). Preferences are edited in [Settings](10_settings.md).

## Behaviour

- Clicking a notification marks it read and, when it refers to a request, opens `/requests/:id`. "Mark all read" appears only when something is unread. Unread items are bold with a dot and announce their state with screen-reader text.
- The unread count also appears on the shell's notifications link.

## Stored as key and parameters

The mock stores `{ id, userId, requestId, key, params, createdAt }` — never the rendered text. `renderNotification(lang, key, params, requestId)` builds title and body on every read in the language of the request's `Accept-Language`, so switching language also translates notifications already received. Adding a notification type means adding a `NotificationKey` and its text in both languages in `src/mocks/copy.ts`; who receives which notification per status is in `notifyStatus`. `scope_check` asks the requester (`scopeCheck`, action required); entering `review` tells the developers `scopeApproved` after an approval and `reportReady` otherwise; a rewrite after "not quite" notifies no one. `code_review` also tells the requester a preview is ready (`previewReady`, not action required), and their reaction reaches the developers as `previewGood` or `previewChange` (action required).

Delivery rules at creation time: nothing is stored when the recipient has turned off in-app notifications, or has "only when action is required" on and the notification does not require action; the actor never notifies themselves. Changing settings therefore does not affect notifications already stored. E-mail and messenger channels are settings only; the mock delivers nothing on them.

## API Services

| Hook | Endpoint | Payload → response | Notes |
| --- | --- | --- | --- |
| `useNotifications` | `GET /notifications` | → `Notification[]` (newest 100) | Only with a session; polls every 15 s. |
| `useMarkNotificationRead(id)` | `POST /notifications/{id}/read` | → `Notification` | Someone else's or unknown id → 404. |
| `useMarkNotificationRead('all')` | `POST /notifications/read-all` | → 204 | Both invalidate the notifications query. |

## Evidence

- `src/features/notifications/notifications-page.tsx#symbol:NotificationsPage` — inbox.
- `src/api/queries.ts#symbol:useNotifications`, `src/api/queries.ts#symbol:useMarkNotificationRead` — polling and read calls.
- `src/mocks/engine.ts#symbol:notify`, `src/mocks/engine.ts#symbol:notifyStatus`, `src/mocks/engine.ts#symbol:markRead` — storage, recipients, ownership check.
- `src/mocks/copy.ts#symbol:renderNotification`, `src/mocks/copy.ts#symbol:NotificationKey` — render-on-read texts.

## Open Questions

- A real backend has to choose the same storage model (key + parameters) to keep notifications following the UI language.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
