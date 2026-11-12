---
title: Settings
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain
project: ax-request-portal
last_updated: 2026-11-12
author: cli-generated
last_edited_by: claude-code
wiki_block_version: v1
source_files:
  - src/features/settings
  - src/app/display-controls.tsx
  - src/app/preferences.ts
  - src/stores/preferences.ts
  - src/app/theme.ts
  - src/lib/time-zone.ts
evidence:
  - src/features/settings/settings-page.tsx#symbol:SettingsPage
  - src/app/display-controls.tsx#symbol:LanguagePicker
  - src/app/display-controls.tsx#symbol:ThemePicker
  - src/app/preferences.ts#symbol:useSetLanguage
  - src/stores/preferences.ts#symbol:usePreferences
  - src/app/theme.ts#symbol:startThemeSync
  - src/api/queries.ts#symbol:useUpdateNotificationSettings
  - src/app/demo.ts#symbol:demoDataLanguage
  - src/features/settings/time-zone-section.tsx#symbol:TimeZoneSection
  - src/features/settings/time-zone-section.tsx#symbol:TimeZonePicker
  - src/lib/time-zone.ts#symbol:deviceTimeZone
  - src/lib/time-zone.ts#symbol:resolveViewTimeZone
  - src/lib/time-zone.ts#symbol:listTimeZones
  - src/lib/time-zone.ts#symbol:currentZoneName
  - src/app/time-zone.ts#symbol:useTimeView
  - src/features/settings/time-zone-section.test.tsx
  - src/stores/preferences.test.ts
related:
  - docs/llm-wiki/domains/07_notifications.md
  - docs/llm-wiki/WCAG.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/GLOSSARY.md
visibility: public
contains_sensitive_info: false
reviewed_by: Kim Dowon
reviewed_at: 2026-11-12
---

# Settings

## Responsibility

One page at `/settings` (authentication only) for display (language, theme, time zone) and notification preferences. The old `/settings/notifications` route redirects here.

## Language

- `LanguagePicker` lists `appConfig.locales` and hides itself when there is only one.
- `useSetLanguage` (in `src/app/preferences.ts`, not to be confused with the store in `src/stores/preferences.ts`) persists the choice, regenerates untouched demo data in the new language, switches i18next and invalidates every query so server texts come back in the new language.
- When the demo data could not follow (the user edited it), a note explains that existing demo records stay in their original language.

## Theme

- `ThemePicker` offers `system`, `light`, `dark` as a radio group. The choice lives in `usePreferences` (persisted per device as `ax-request-portal:preferences`: `theme`, `language`, `timeZone`, `showHqTime`). Its `merge` checks each saved value's type and keeps the default for anything missing or wrong, so data from an older version still loads.
- `startThemeSync` applies it at runtime and follows the OS while `system` is chosen. The inline script in `index.html` reads the same storage key before React starts; changing the persisted shape breaks the no-flash start.

## Time zone

The "Time zone" card decides how timestamps are shown on this device ([Glossary](../GLOSSARY.md): viewing time zone, head-office time).

- **Automatic** (`timeZone: 'auto'`, the default) follows the device's time zone (`deviceTimeZone`, from `Intl`, never from the IP address) and names it with its abbreviation.
- **Choose** shows a search field and a native `<select>` of every zone the browser knows (`listTimeZones`: `Intl.supportedValuesOf`, or a short fallback list, plus UTC, the head office's and the device's), sorted by UTC offset; each option shows the offset, the IANA id and the region's generic name. Search matches every word against that label, and an old IANA id finds its current name too (`currentZoneName`, e.g. `Asia/Calcutta` → `Asia/Kolkata`). There is no search by country name. The number of matches is a polite live region.
- **Show head-office time** (`showHqTime`, on by default) adds head-office time to detailed timestamps when the viewing time zone reads a different clock.
- A preview shows a sample timestamp as a list and as a detail screen would show it. It is not a live region (every arrow key on the select would be read out); the select names it through `aria-describedby`. When the chosen zone has the head office's offset, a line says nothing will be added.
- A saved zone the browser does not know falls back to the device's (`resolveViewTimeZone`). `useTimeView` re-renders every `DateTimeText` when the choice changes. On a phone the two modes and the controls stack vertically.

## Notification preferences

Up to four switches — in-app, e-mail, messenger, only when action is required. E-mail and messenger appear only when `notifications.channels` in `src/config/app.config.ts` lists them (both by default), with a note that the backend sends them; a deployment whose backend sends neither shows the two in-app switches and no note (`notificationRows`). The contract keeps every field either way. Each switch sends the whole settings object.

| Hook | Endpoint | Payload → response | Notes |
| --- | --- | --- | --- |
| `useNotificationSettings` | `GET /me/notification-settings` | → `NotificationSettings` | A person without saved settings (for example a user invited later) gets the defaults. A failed first load shows `LoadFailed`; a failed refresh keeps the switches with a `RefreshFailed` line. |
| `useUpdateNotificationSettings` | `PUT /me/notification-settings` | `NotificationSettings` → `NotificationSettings` | Writes the response into the cache (no refetch) and shows a toast; switches are disabled while saving. |

The settings apply when a notification is created, not retroactively (see [Notifications](07_notifications.md)).

## Layout

- A `fit` route ([Frontend Profile](../profiles/frontend.md)): the title stays in place and the sections scroll ("설정 내용"), kept to `max-w-2xl` at the left.

## Evidence

- `src/features/settings/settings-page.tsx#symbol:SettingsPage` — page layout.
- `src/app/display-controls.tsx#symbol:LanguagePicker`, `src/app/display-controls.tsx#symbol:ThemePicker` — controls.
- `src/app/preferences.ts#symbol:useSetLanguage` — language switch sequence.
- `src/stores/preferences.ts#symbol:usePreferences`, `src/stores/preferences.test.ts` — persisted preferences and how older data is read.
- `src/app/theme.ts#symbol:startThemeSync` — runtime theme.
- `src/features/settings/time-zone-section.tsx#symbol:TimeZoneSection`, `src/features/settings/time-zone-section.tsx#symbol:TimeZonePicker`, `src/features/settings/time-zone-section.test.tsx` — the time-zone card.
- `src/lib/time-zone.ts#symbol:deviceTimeZone`, `src/lib/time-zone.ts#symbol:resolveViewTimeZone`, `src/lib/time-zone.ts#symbol:listTimeZones`, `src/lib/time-zone.ts#symbol:currentZoneName`, `src/app/time-zone.ts#symbol:useTimeView` — detection, fallback, the zone list and the view the components read.
- `src/api/queries.ts#symbol:useUpdateNotificationSettings` — save behaviour.
- `src/app/demo.ts#symbol:demoDataLanguage` — demo-data language note.

## Open Questions

- E-mail and messenger switches have no delivery behind them in the template: a real backend implements the channels it keeps and removes the others from `notifications.channels`.

## Review Notes

- Keep this document as `needs_review` until it has been reviewed.
- Once reviewed, approve it with `llm-wiki review --approve <path>`. An agent does not approve its own edits.
