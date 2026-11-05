import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/api/query-client'
import '@/i18n'
import { routes, type RouteHandle } from './router'

describe('routes', () => {
  it('put every route, the login screen included, under one root with an error page', () => {
    expect(routes).toHaveLength(1)
    const [root] = routes
    expect(root?.path).toBeUndefined()
    expect(root?.errorElement).toBeTruthy()
    for (const path of ['/login', '/', '/admin/users', '/no-such-page']) {
      expect(matchRoutes(routes, path)?.[0]?.route).toBe(root)
    }
  })

  it('declare each page permission in the route handle', () => {
    const permissionOf = (path: string) =>
      (matchRoutes(routes, path)?.at(-1)?.route.handle as RouteHandle | undefined)?.permission
    expect(permissionOf('/admin/users')).toBe('user:manage')
    expect(permissionOf('/requests/new')).toBe('request:create')
    expect(permissionOf('/requests/1017')).toBeUndefined()
  })

  it('show the friendly error page when the login screen cannot load', async () => {
    // A deployment that removed the chunk this tab still points to.
    const [root] = routes
    const router = createMemoryRouter(
      [
        {
          element: root?.element,
          errorElement: root?.errorElement,
          children: [{ path: '/login', lazy: () => Promise.reject(new Error('chunk is gone')) }],
        },
      ],
      { initialEntries: ['/login'] },
    )
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <QueryClientProvider client={createQueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      )
      // The app's own error page (RouteErrorPage), not React Router's English default.
      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.queryByText(/Unexpected Application Error/i)).not.toBeInTheDocument()
    } finally {
      quiet.mockRestore()
    }
  })
})
