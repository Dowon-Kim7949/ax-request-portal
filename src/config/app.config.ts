/**
 * ─────────────────────────────────────────────────────────────
 *  Template configuration — start customizing here.
 * ─────────────────────────────────────────────────────────────
 *  Branding, roles/permissions, request types and mock timing.
 *  Colors live in src/index.css (@theme), texts in src/i18n/.
 *  The object is validated at startup; an invalid edit fails fast.
 */
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { AppConfigSchema, type AppConfig } from './schema'

export const appConfig: AppConfig = AppConfigSchema.parse({
  brand: {
    name: 'AX 업무 요청',
    shortName: 'AX',
    tagline: '요청서 작성부터 진행 현황, 결과 확인, 배포 일정 안내까지 한곳에서',
  },
  locale: 'ko',
  enabledRoles: ['requester', 'executive', 'developer', 'admin'],
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  requestTypes: ['new_feature', 'change', 'bug', 'copy_design', 'non_code'],
  mock: {
    reportSeconds: 6,
    workSeconds: 20,
  },
} satisfies AppConfig)
