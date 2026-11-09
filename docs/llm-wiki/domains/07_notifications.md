---
title: Notifications
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-05
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
  - src/mocks/copy.ts#symbol:readableDate
  - src/mocks/engine.ts#symbol:NOTIFICATIONS_PER_USER_MAX
  - src/mocks/engine.ts#symbol:trimNotifications
  - src/mocks/engine.ts#symbol:DEFAULT_NOTIFICATION_SETTINGS
  - src/api/queries.test.tsx
related:
  - docs/llm-wiki/domains/10_settings.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-09
---

# Notifications

## Responsibility

The in-app inbox at `/notifications` (authentication only). Preferences are edited in [Settings](10_settings.md).

## Behaviour

- Clicking a notification marks it read and, when it refers to a request, opens `/requests/:id`. "Mark all read" appears only when something is unread. Unread items are bold with a dot and announce their state with screen-reader text.
- Marking read is optimistic: the dot in the list and the count on the shell's notifications link change at once. If the server refuses, only the items this action marked are put back and a toast says so ("Could not mark as read"); this also works after leaving the screen.
- Each item shows a relative time; its `title` holds the full local time (and head-office time when the viewer's clock differs, see [Glossary](../GLOSSARY.md)).
- A failed first load shows `LoadFailed`; a failed poll keeps the list with a `RefreshFailed` line.

## Stored as key and parameters

The mock stores `{ id, userId, requestId, key, params, createdAt }` — never the rendered text. `renderNotification(lang, key, params, requestId)` builds title and body on every read in the language of the request's `Accept-Language`, so switching language also translates notifications already received. Adding a notification type means adding a `NotificationKey` and its text in both languages in `src/mocks/copy.ts`; who receives which notification per status is in `notifyStatus`. `scope_check` asks the requester (`scopeCheck`, action required); entering `review` tells the developers `scopeApproved` after an approval and `reportReady` otherwise; a rewrite after "not quite" notifies no one. `code_review` also tells the requester a preview is ready (`previewReady`, not action required), and their reaction reaches the developers as `previewGood` or `previewChange` (action required).

Dates inside server texts are calendar dates written for people with `readableDate` ("11월 5일 (목)" / "Thu, Nov 5"), not raw `YYYY-MM-DD`; the `releaseDateSet` body uses it.

The mock keeps only each person's newest `NOTIFICATIONS_PER_USER_MAX` (200) notifications (`trimNotifications`), so stored demo data stops growing. Reading a notification counts as an edit of the demo data (`dirty`), so switching language no longer rebuilds it.

Delivery rules at creation time: nothing is stored when the recipient has turned off in-app notifications, or has "only when action is required" on and the notification does not require action; the actor never notifies themselves. Changing settings therefore does not affect notifications already stored. A person with no saved settings gets `DEFAULT_NOTIFICATION_SETTINGS`. E-mail and messenger channels are settings only; the mock delivers nothing on them.

## API Services

| Hook | Endpoint | Payload → response | Notes |
| --- | --- | --- | --- |
| `useNotifications` | `GET /notifications` | → `Notification[]` (newest 100) | Only with a session; polls every 15 s. |
| `useMarkNotificationRead(id)` | `POST /notifications/{id}/read` | → `Notification` | Someone else's or unknown id → 404. |
| `useMarkNotificationRead('all')` | `POST /notifications/read-all` | → 204 | Both update the cache first (`onMutate`), roll back what they marked on error and invalidate the notifications query when settled. |

## Evidence

- `src/features/notifications/notifications-page.tsx#symbol:NotificationsPage` — inbox.
- `src/api/queries.ts#symbol:useNotifications`, `src/api/queries.ts#symbol:useMarkNotificationRead`, `src/api/queries.test.tsx` — polling, optimistic read and rollback.
- `src/mocks/engine.ts#symbol:notify`, `src/mocks/engine.ts#symbol:notifyStatus`, `src/mocks/engine.ts#symbol:markRead` — storage, recipients, ownership check.
- `src/mocks/engine.ts#symbol:NOTIFICATIONS_PER_USER_MAX`, `src/mocks/engine.ts#symbol:trimNotifications`, `src/mocks/engine.ts#symbol:DEFAULT_NOTIFICATION_SETTINGS` — the per-person cap and default settings.
- `src/mocks/copy.ts#symbol:renderNotification`, `src/mocks/copy.ts#symbol:NotificationKey`, `src/mocks/copy.ts#symbol:readableDate` — render-on-read texts and dates in them.

## Open Questions

- A real backend has to choose the same storage model (key + parameters) to keep notifications following the UI language.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
