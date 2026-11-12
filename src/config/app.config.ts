/**
 * ─────────────────────────────────────────────────────────────
 *  Template configuration — start customizing here.
 * ─────────────────────────────────────────────────────────────
 *  Branding, languages, roles/permissions, request types, workflow and mock timing.
 *  Colors live in src/index.css (@theme), texts in src/i18n/.
 *  The object is validated at startup; an invalid edit fails fast.
 */
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { AppConfigSchema, type AppConfig } from './schema'

export const appConfig: AppConfig = AppConfigSchema.parse({
  brand: {
    name: { ko: 'AX 업무 요청', en: 'AX Request Portal' },
    shortName: 'AX',
    tagline: {
      ko: '요청서 작성부터 진행 현황, 결과 확인, 배포 일정 안내까지 한곳에서',
      en: 'From the request form to progress, result checks and release dates, in one place',
    },
  },
  /**
   * Head office. Branches elsewhere (e.g. North America) see times in their own
   * time zone with head-office time next to it; dates and totals follow this one.
   * Change both fields together: an IANA name and how people call the place.
   */
  organization: {
    timeZone: 'Asia/Seoul',
    timeZoneLabel: { ko: '한국', en: 'Korea' },
  },
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
  enabledRoles: ['requester', 'executive', 'developer', 'admin', 'operator'],
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  requestTypes: ['new_feature', 'change', 'bug', 'copy_design', 'checklist', 'non_code'],
  workflow: {
    scopeCheck: true,
  },
  /** Unsubmitted requests saved to each account, to continue on any device */
  drafts: {
    maxPerAccount: 20,
  },
  /** Remove a channel your backend does not send: its switch leaves the settings screen. */
  notifications: {
    channels: ['email', 'messenger'],
  },
  mock: {
    reportSeconds: 6,
    workSeconds: 20,
  },
} satisfies AppConfig)
