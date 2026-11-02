import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { env } from '@/config/env'
import type { Permission } from '@/domain/roles'
import { BootScreen } from './boot'
import { RequireAuth, RequirePermission } from './guards'
import { NotFoundPage, RouteErrorPage } from './pages'
import { AppShell } from './shell'

export interface RouteHandle {
  /** Hide the phone tab bar so a multi-step flow has the whole screen */
  focus?: boolean
}

/** Lazy route: the page module loads on first visit, optionally behind a permission. */
function page(
  load: () => Promise<{ default: ComponentType }>,
  permission?: Permission,
): { lazy: () => Promise<{ Component: ComponentType }> } {
  return {
    lazy: async () => {
      const { default: Page } = await load()
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

export const routes: RouteObject[] = [
  { path: '/login', HydrateFallback: BootScreen, ...page(() => import('@/features/auth/login-page')) },
  {
    path: '/',
    HydrateFallback: BootScreen,
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, ...page(() => import('@/features/home/home-page')) },
      { path: 'requests', ...page(() => import('@/features/requests/my-requests-page'), 'request:read:own') },
      {
        path: 'requests/new',
        handle: { focus: true } satisfies RouteHandle,
        ...page(() => import('@/features/wizard/wizard-page'), 'request:create'),
      },
      { path: 'requests/:id', ...page(() => import('@/features/detail/request-detail-page')) },
      { path: 'schedule', ...page(() => import('@/features/schedule/schedule-page'), 'schedule:view') },
      { path: 'work', ...page(() => import('@/features/work/assigned-page'), 'request:review') },
      {
        path: 'work/regression',
        ...page(() => import('@/features/work/regression-page'), 'regression:view'),
      },
      { path: 'dashboard', ...page(() => import('@/features/dashboard/dashboard-page'), 'dashboard:view') },
      { path: 'admin/projects', ...page(() => import('@/features/admin/projects-page'), 'project:manage') },
      { path: 'admin/users', ...page(() => import('@/features/admin/users-page'), 'user:manage') },
      { path: 'admin/budget', ...page(() => import('@/features/admin/budget-page'), 'budget:manage') },
      { path: 'notifications', ...page(() => import('@/features/notifications/notifications-page')) },
      { path: 'settings', ...page(() => import('@/features/settings/settings-page')) },
      { path: 'settings/notifications', element: <Navigate to="/settings" replace /> },
      { path: '*', Component: NotFoundPage },
    ],
  },
]

export function createRouter() {
  return createBrowserRouter(routes, { basename: env.base.replace(/\/$/, '') || '/' })
}
