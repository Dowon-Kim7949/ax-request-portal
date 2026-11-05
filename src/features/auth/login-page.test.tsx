import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { configureClient } from '@/api/client'
import { createQueryClient } from '@/api/query-client'
import '@/i18n'
import { DEMO_PASSWORD } from '@/mocks/seed'
import { useSession } from '@/stores/session'
import { createTestApi } from '@/test/mock-api'
import LoginPage from './login-page'

const t = createTestApi()

// The login screen imports the mock API modules on mount to list the demo
// accounts. Load them first, or that import can outlive the test environment.
beforeAll(async () => {
  await import('@/mocks/browser')
  t.server.listen({ onUnhandledFrame: 'error' })
})
afterAll(() => t.server.close())
beforeEach(() => {
  configureClient({ getToken: () => useSession.getState().token, onUnauthorized: () => {} })
  useSession.setState({ token: null, user: null, ended: null })
})

function openLogin(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <h1>home</h1> },
      { path: '/admin/users', element: <h1>users</h1> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

async function submit(email: string) {
  await userEvent.type(await screen.findByLabelText('이메일'), email)
  await userEvent.type(screen.getByLabelText('비밀번호'), DEMO_PASSWORD)
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))
}

const next = (path: string) => `/login?next=${encodeURIComponent(path)}`

describe('LoginPage', () => {
  it('returns to next when the new user may open it', async () => {
    const router = openLogin(next('/admin/users'))
    await submit('admin@example.com')
    expect(await screen.findByRole('heading', { name: 'users' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users')
  })

  it('goes home when the new user may not open next', async () => {
    const router = openLogin(next('/admin/users'))
    await submit('planner@example.com')
    expect(await screen.findByRole('heading', { name: 'home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('sends a signed-in visitor home when next is the login screen, without looping', async () => {
    useSession.setState({
      token: t.tokenFor('u-han'),
      user: { id: 'u-han', name: '한운영', email: 'admin@example.com', role: 'admin', active: true },
    })
    const router = openLogin(next('/login?next=/login'))
    expect(await screen.findByRole('heading', { name: 'home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('after an expiry, returns the same person to next', async () => {
    useSession.setState({ ended: { reason: 'expired', userId: 'u-han' } })
    const router = openLogin(next('/admin/users'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('로그인이 만료됐어요.'))
    await submit('admin@example.com')
    expect(await screen.findByRole('heading', { name: 'users' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users')
  })

  it('after an expiry, starts someone else at home even if they may open next', async () => {
    useSession.setState({ ended: { reason: 'expired', userId: 'u-park' } })
    const router = openLogin(next('/admin/users'))
    await submit('admin@example.com')
    expect(await screen.findByRole('heading', { name: 'home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('announces the expiry once the screen is up, and describes the first field with it', async () => {
    useSession.setState({ ended: { reason: 'expired', userId: 'u-han' } })
    openLogin(next('/admin/users'))
    // Shown at once; the status starts empty, so screen readers notice the text arriving.
    expect(screen.getByText(/로그인이 만료됐어요/)).toBeVisible()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('로그인이 만료됐어요.'))
    expect(await screen.findByLabelText('이메일')).toHaveAccessibleDescription(/로그인이 만료됐어요/)
    // Read once: the visible copy is hidden from screen readers, which hear the status.
    expect(
      screen.getAllByText(/로그인이 만료됐어요/).filter((el) => el.getAttribute('aria-hidden') !== 'true'),
    ).toHaveLength(1)
  })

  it('shows no expiry notice after signing out', async () => {
    useSession.setState({ ended: { reason: 'signedOut', userId: 'u-han' } })
    openLogin('/login')
    await screen.findByLabelText('이메일')
    expect(screen.queryByText(/로그인이 만료됐어요/)).not.toBeInTheDocument()
  })
})
