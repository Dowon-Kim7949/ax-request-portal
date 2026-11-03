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
  /** AI budget: monthly and per-request limits, alert threshold */
  'budget:manage',
  /** AI providers and keys, model per task and project, price table */
  'agent:manage',
  /** AI usage and cost by provider, model, task and request */
  'usage:view',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const REQUESTER: Permission[] = ['request:create', 'request:read:own', 'schedule:view']

/** What the service operator holds; an organization admin does not. */
export const OPERATOR_PERMISSIONS: Permission[] = ['budget:manage', 'agent:manage', 'usage:view']

/**
 * Default permission sets. Override them in `src/config/app.config.ts`
 * (e.g. drop `executive` and give `dashboard:view` to `admin` only). The
 * operator runs the service (AI providers, prices, budget, usage) and holds
 * no request permissions; an organization admin manages people and projects.
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
  admin: PERMISSIONS.filter((p) => !OPERATOR_PERMISSIONS.includes(p)),
  operator: OPERATOR_PERMISSIONS,
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
