import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { env } from '@/config/env'
import type { Permission } from '@/domain/roles'
import { RequireAuth, RequirePermission } from './guards'
import { ComingSoonPage, NotFoundPage, RouteErrorPage } from './pages'
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

const soon = (permission?: Permission): { Component: ComponentType } => ({
  Component: permission
    ? () => (
        <RequirePermission permission={permission}>
          <ComingSoonPage />
        </RequirePermission>
      )
    : ComingSoonPage,
})

export const routes: RouteObject[] = [
  { path: '/login', ...page(() => import('@/features/auth/login-page')) },
  {
    path: '/',
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
      { path: 'work', ...soon('request:review') },
      { path: 'work/regression', ...soon('regression:view') },
      { path: 'dashboard', ...soon('dashboard:view') },
      { path: 'admin/projects', ...soon('project:manage') },
      { path: 'admin/users', ...soon('user:manage') },
      { path: 'admin/budget', ...soon('budget:manage') },
      { path: 'notifications', ...soon() },
      { path: 'settings/notifications', ...soon() },
      { path: '*', Component: NotFoundPage },
    ],
  },
]

export function createRouter() {
  return createBrowserRouter(routes, { basename: env.base.replace(/\/$/, '') || '/' })
}
