import type { Role, User } from './model'

export const PERMISSIONS = [
  /** File a new request */
  'request:create',
  /** See requests I filed */
  'request:read:own',
  /** See every request (dashboards, developer queues) */
  'request:read:all',
  /** Developer actions: request info, reject, run AI work, review the merge request, release */
  'request:review',
  /** Full feasibility report. Without it only the plain-language summary is shown. */
  'report:read',
  'regression:view',
  'schedule:view',
  'dashboard:view',
  'project:manage',
  'user:manage',
  'budget:manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const REQUESTER: Permission[] = ['request:create', 'request:read:own', 'schedule:view']

/**
 * Default permission sets. Override them in `src/config/app.config.ts`
 * (e.g. drop `executive` and give `dashboard:view` to `admin` only).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  requester: REQUESTER,
  executive: [...REQUESTER, 'request:read:all', 'dashboard:view'],
  developer: [
    'request:create',
    'request:read:own',
    'request:read:all',
    'request:review',
    'report:read',
    'regression:view',
    'schedule:view',
  ],
  admin: [...PERMISSIONS],
}

export type RolePermissions = Record<Role, readonly Permission[]>

export function hasPermission(
  user: Pick<User, 'role'> | null | undefined,
  permission: Permission,
  rolePermissions: RolePermissions = DEFAULT_ROLE_PERMISSIONS,
): boolean {
  if (!user) return false
  return rolePermissions[user.role].includes(permission)
}
