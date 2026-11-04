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
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
  enabledRoles: ['requester', 'executive', 'developer', 'admin', 'operator'],
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  requestTypes: ['new_feature', 'change', 'bug', 'copy_design', 'non_code'],
  workflow: {
    scopeCheck: true,
  },
  mock: {
    reportSeconds: 6,
    workSeconds: 20,
  },
} satisfies AppConfig)
