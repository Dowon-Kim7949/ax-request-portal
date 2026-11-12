import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjects, useTeams, useUsers } from '@/api/queries'
import { appConfig } from '@/config/app.config'
import type { Project, Team, User } from '@/domain/model'
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

/**
 * Team names by id. Records keep a team's id, so a renamed team shows its new
 * name everywhere; read the name through `teamName` (never blank once loaded).
 */
export function useTeamDirectory() {
  const { t } = useTranslation()
  const teams = useTeams()
  const { refetch } = teams
  return useMemo(() => {
    const map = new Map<string, Team>((teams.data ?? []).map((x) => [x.id, x]))
    return {
      teams: teams.data ?? [],
      teamName: (id: string) => map.get(id)?.name ?? (teams.isPending ? '' : t('common.unknownTeam')),
      loading: teams.isPending,
      error: teams.data ? null : teams.error,
      stale: teams.isRefetchError,
      retrying: teams.isFetching,
      retry: () => void refetch(),
    }
  }, [t, teams.data, teams.isPending, teams.error, teams.isRefetchError, teams.isFetching, refetch])
}

/**
 * Lookup tables for names and projects used all over the UI. When a list
 * cannot be loaded, lookups come back empty: show names through `userName` /
 * `projectName` (never blank) and offer `retry` where the list itself is shown.
 */
export function useDirectory() {
  const { t } = useTranslation()
  const users = useUsers()
  const projects = useProjects()
  const { refetch: refetchUsers } = users
  const { refetch: refetchProjects } = projects
  return useMemo(() => {
    const userMap = new Map<string, User>((users.data ?? []).map((u) => [u.id, u]))
    const projectMap = new Map<string, Project>((projects.data ?? []).map((p) => [p.id, p]))
    return {
      user: (id: string | undefined) => (id ? userMap.get(id) : undefined),
      project: (id: string | undefined) => (id ? projectMap.get(id) : undefined),
      /** The person's name; "unknown user" once the list has loaded (or failed) without them */
      userName: (id: string | undefined) =>
        (id ? userMap.get(id)?.name : undefined) ?? (users.isPending ? '' : t('common.unknownUser')),
      /** The project's name, or its id when the list does not have it */
      projectName: (id: string) => projectMap.get(id)?.name ?? id,
      projects: projects.data ?? [],
      users: users.data ?? [],
      loading: users.isPending || projects.isPending,
      // Only when there is nothing to show: a failed background refresh keeps the list it had.
      /** Why the user list could not be loaded (null while there is one) */
      usersError: users.data ? null : users.error,
      /** Why the project list could not be loaded (null while there is one) */
      projectsError: projects.data ? null : projects.error,
      /** Refreshing the user list failed: the one on show is from an earlier load (RefreshFailed) */
      usersStale: users.isRefetchError,
      /** Refreshing the project list failed: the one on show is from an earlier load (RefreshFailed) */
      projectsStale: projects.isRefetchError,
      retrying: users.isFetching || projects.isFetching,
      /** Loads again whichever list failed */
      retry: () => {
        if (users.isError) void refetchUsers()
        if (projects.isError) void refetchProjects()
      },
    }
  }, [
    t,
    users.data,
    projects.data,
    users.isPending,
    projects.isPending,
    users.isError,
    projects.isError,
    users.isRefetchError,
    projects.isRefetchError,
    users.error,
    projects.error,
    users.isFetching,
    projects.isFetching,
    refetchUsers,
    refetchProjects,
  ])
}

/** Requesters see plain-language statuses; people who handle requests see the precise one. */
export function useSeesTechnicalStatus(): boolean {
  const can = useCan()
  return can('request:review')
}
