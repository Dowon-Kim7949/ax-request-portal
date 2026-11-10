import type { ComponentType } from 'react'
import { createBrowserRouter, matchRoutes, Navigate, Outlet, type RouteObject } from 'react-router'
import { env } from '@/config/env'
import type { Permission } from '@/domain/roles'
import { BootScreen } from './boot'
import { LOGIN_PATH, RequireAuth, RequirePermission, SessionSync } from './guards'
import { NotFoundPage, RouteErrorPage } from './pages'
import { checkForUpdateNow } from './update-check'
import { AppShell } from './shell'

export interface RouteHandle {
  /** Hide the phone tab bar so a multi-step flow has the whole screen */
  focus?: boolean
  /**
   * The page is built from `Page` parts (src/app/page.tsx): on a big screen it
   * fills the window and only its lists scroll. The shell then leaves the
   * page's width and padding to those parts. Every `page()` route is; only
   * the not-found page (a route of its own) is not.
   */
  fit?: boolean
  /**
   * Needed to open the route. The single source for both the page guard
   * (`RequirePermission`) and the post-login redirect, which sends a person
   * home instead of to a page they cannot open.
   */
  permission?: Permission
  /** An old address that forwards here; the post-login redirect follows it */
  redirectTo?: string
}

/**
 * Lazy route: the page module loads on first visit, behind `handle.permission` when set.
 * Its page is built from `Page` parts (`handle.fit`).
 */
function page(
  load: () => Promise<{ default: ComponentType }>,
  options?: Omit<RouteHandle, 'fit'>,
): Pick<RouteObject, 'handle' | 'lazy'> {
  const handle: RouteHandle = { ...options, fit: true }
  const permission = handle.permission
  return {
    handle,
    lazy: async () => {
      const { default: Page } = await load().catch((err: unknown) => {
        // The usual cause is a deployment that removed this tab's chunk: say so next to the error page.
        checkForUpdateNow()
        throw err
      })
      return {
        Component: permission
          ? () => (
              <RequirePermission permission={permission}>
                <Page />
              </RequirePermission>
            )
          : Page,
      }
    },
  }
}

/** An old address kept for bookmarks. */
function moved(to: string): Pick<RouteObject, 'handle' | 'element'> {
  return { handle: { redirectTo: to } satisfies RouteHandle, element: <Navigate to={to} replace /> }
}

/**
 * The permissions a page needs: the `handle.permission` of every route its path
 * matches. The menus show an item only when its page would open (`visibleNav`),
 * so a route's permission is declared once, here, for the guard, the
 * post-login redirect and the navigation alike.
 */
export function permissionsFor(path: string): Permission[] {
  return (matchRoutes(routes, path) ?? []).flatMap((m) => {
    const permission = (m.route.handle as RouteHandle | undefined)?.permission
    return permission ? [permission] : []
  })
}

export const routes: RouteObject[] = [
  {
    // Pathless root: every route, the login screen included, gets a friendly error page and the tab sync.
    element: (
      <>
        <SessionSync />
        <Outlet />
      </>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: LOGIN_PATH, HydrateFallback: BootScreen, ...page(() => import('@/features/auth/login-page')) },
      {
        path: '/',
        HydrateFallback: BootScreen,
        element: (
          <RequireAuth>
            <AppShell permissionsFor={permissionsFor} />
          </RequireAuth>
        ),
        // Errors below the shell stay here, so the root (and the tab sync) keeps running.
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, ...page(() => import('@/features/home/home-page')) },
          {
            path: 'requests',
            ...page(() => import('@/features/requests/my-requests-page'), { permission: 'request:read:own' }),
          },
          {
            path: 'requests/new',
            ...page(() => import('@/features/wizard/wizard-page'), {
              permission: 'request:create',
              focus: true,
            }),
          },
          { path: 'requests/:id', ...page(() => import('@/features/detail/request-detail-page')) },
          {
            path: 'schedule',
            ...page(() => import('@/features/schedule/schedule-page'), { permission: 'schedule:view' }),
          },
          {
            path: 'work',
            ...page(() => import('@/features/work/assigned-page'), { permission: 'request:review' }),
          },
          {
            path: 'work/regression',
            ...page(() => import('@/features/work/regression-page'), { permission: 'regression:view' }),
          },
          {
            path: 'dashboard',
            ...page(() => import('@/features/dashboard/dashboard-page'), { permission: 'dashboard:view' }),
          },
          {
            path: 'admin/projects',
            ...page(() => import('@/features/admin/projects-page'), { permission: 'project:manage' }),
          },
          {
            path: 'admin/users',
            ...page(() => import('@/features/admin/users-page'), { permission: 'user:manage' }),
          },
          // The AI budget moved to the operator's screens; keep old bookmarks working.
          { path: 'admin/budget', ...moved('/ops/budget') },
          {
            path: 'ops/usage',
            ...page(() => import('@/features/ops/usage-page'), { permission: 'usage:view' }),
          },
          {
            path: 'ops/agents',
            ...page(() => import('@/features/ops/agents-page'), { permission: 'agent:manage' }),
          },
          {
            path: 'ops/pricing',
            ...page(() => import('@/features/ops/pricing-page'), { permission: 'agent:manage' }),
          },
          {
            path: 'ops/budget',
            ...page(() => import('@/features/ops/budget-page'), { permission: 'budget:manage' }),
          },
          {
            path: 'notifications',
            ...page(() => import('@/features/notifications/notifications-page')),
          },
          { path: 'settings', ...page(() => import('@/features/settings/settings-page')) },
          { path: 'settings/notifications', ...moved('/settings') },
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
]

export function createRouter() {
  return createBrowserRouter(routes, { basename: env.base.replace(/\/$/, '') || '/' })
}
