---
title: Settings
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
  - src/features/settings
  - src/app/display-controls.tsx
  - src/app/preferences.ts
  - src/stores/preferences.ts
  - src/app/theme.ts
evidence:
  - src/features/settings/settings-page.tsx#symbol:SettingsPage
  - src/app/display-controls.tsx#symbol:LanguagePicker
  - src/app/display-controls.tsx#symbol:ThemePicker
  - src/app/preferences.ts#symbol:useSetLanguage
  - src/stores/preferences.ts#symbol:usePreferences
  - src/app/theme.ts#symbol:startThemeSync
  - src/api/queries.ts#symbol:useUpdateNotificationSettings
  - src/app/demo.ts#symbol:demoDataLanguage
related:
  - docs/llm-wiki/domains/07_notifications.md
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-04
---

# Settings

## Responsibility

One page at `/settings` (authentication only) for display (language, theme) and notification preferences. The old `/settings/notifications` route redirects here.

## Language

- `LanguagePicker` lists `appConfig.locales` and hides itself when there is only one.
- `useSetLanguage` (in `src/app/preferences.ts`, not to be confused with the store in `src/stores/preferences.ts`) persists the choice, regenerates untouched demo data in the new language, switches i18next and invalidates every query so server texts come back in the new language.
- When the demo data could not follow (the user edited it), a note explains that existing demo records stay in their original language.

## Theme

- `ThemePicker` offers `system`, `light`, `dark` as a radio group. The choice lives in `usePreferences` (persisted as `ax-request-portal:preferences`, only `theme` and `language`).
- `startThemeSync` applies it at runtime and follows the OS while `system` is chosen. The inline script in `index.html` reads the same storage key before React starts; changing the persisted shape breaks the no-flash start.

## Notification preferences

Four switches — in-app, e-mail, messenger, only when action is required. Each switch sends the whole settings object.

| Hook | Endpoint | Payload → response | Notes |
| --- | --- | --- | --- |
| `useNotificationSettings` | `GET /me/notification-settings` | → `NotificationSettings` | |
| `useUpdateNotificationSettings` | `PUT /me/notification-settings` | `NotificationSettings` → `NotificationSettings` | Writes the response into the cache (no refetch) and shows a toast; switches are disabled while saving. |

The settings apply when a notification is created, not retroactively (see [Notifications](07_notifications.md)).

## Evidence

- `src/features/settings/settings-page.tsx#symbol:SettingsPage` — page layout.
- `src/app/display-controls.tsx#symbol:LanguagePicker`, `src/app/display-controls.tsx#symbol:ThemePicker` — controls.
- `src/app/preferences.ts#symbol:useSetLanguage` — language switch sequence.
- `src/stores/preferences.ts#symbol:usePreferences` — persisted preferences.
- `src/app/theme.ts#symbol:startThemeSync` — runtime theme.
- `src/api/queries.ts#symbol:useUpdateNotificationSettings` — save behaviour.
- `src/app/demo.ts#symbol:demoDataLanguage` — demo-data language note.

## Open Questions

- E-mail and messenger switches have no delivery behind them in the template; a real backend decides whether to implement or remove them.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
