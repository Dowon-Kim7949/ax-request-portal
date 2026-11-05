import { useCallback, useMemo } from 'react'
import { useProjects, useUsers } from '@/api/queries'
import { appConfig } from '@/config/app.config'
import type { Project, User } from '@/domain/model'
import { hasPermission, type Permission } from '@/domain/roles'
import { useSession } from '@/stores/session'

/** The signed-in user. Only call inside routes guarded by <RequireAuth>. */
export function useCurrentUser(): User {
  const user = useSession((s) => s.user)
  if (!user) throw new Error('useCurrentUser() outside an authenticated route')
  return user
}

/**
 * What a user may do under the configured role table (`appConfig.rolePermissions`).
 * The one rule behind `useCan` and the post-login redirect.
 */
export function userCan(user: Pick<User, 'role'> | null | undefined, permission: Permission): boolean {
  return hasPermission(user, permission, appConfig.rolePermissions)
}

export function useCan(): (permission: Permission) => boolean {
  const user = useSession((s) => s.user)
  return useCallback((p: Permission) => userCan(user, p), [user])
}

/** Lookup tables for names and projects used all over the UI. */
export function useDirectory() {
  const users = useUsers()
  const projects = useProjects()
  return useMemo(() => {
    const userMap = new Map<string, User>((users.data ?? []).map((u) => [u.id, u]))
    const projectMap = new Map<string, Project>((projects.data ?? []).map((p) => [p.id, p]))
    return {
      user: (id: string | undefined) => (id ? userMap.get(id) : undefined),
      project: (id: string | undefined) => (id ? projectMap.get(id) : undefined),
      projects: projects.data ?? [],
      users: users.data ?? [],
      loading: users.isPending || projects.isPending,
    }
  }, [users.data, projects.data, users.isPending, projects.isPending])
}

/** Requesters see plain-language statuses; people who handle requests see the precise one. */
export function useSeesTechnicalStatus(): boolean {
  const can = useCan()
  return can('request:review')
}
