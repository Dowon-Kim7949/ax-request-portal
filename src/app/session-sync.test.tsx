/**
 * Session lifecycle through the real guard, hooks and client against the mock
 * API: signing out, a 401, and sign-ins and sign-outs made in other tabs.
 */
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { call, configureClient } from '@/api/client'
import { api, type Session } from '@/api/contract'
import { useLogout } from '@/api/queries'
import { createQueryClient } from '@/api/query-client'
import { DEMO_PASSWORD } from '@/mocks/seed'
import { SESSION_STORAGE_KEY, useSession } from '@/stores/session'
import { createTestApi } from '@/test/mock-api'
import { RequireAuth, SessionSync } from './guards'
import { expireSession } from './session-sync'

const t = createTestApi()
let qc: QueryClient

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => t.server.close())
beforeEach(() => {
  qc = createQueryClient()
  configureClient({ getToken: () => useSession.getState().token, onUnauthorized: () => expireSession(qc) })
  useSession.setState({ token: null, user: null, ended: null })
})

const signIn = (email: string) => call(api.login, { body: { email, password: DEMO_PASSWORD } })

function SignOutButton() {
  const logout = useLogout()
  return (
    <button type="button" onClick={() => logout.mutate()}>
      sign out
    </button>
  )
}

const routes: RouteObject[] = [
  {
    element: (
      <>
        <SessionSync />
        <Outlet />
      </>
    ),
    children: [
      { path: '/login', element: <h1>login</h1> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <SignOutButton />
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <h1>home</h1> },
          { path: 'admin/users', element: <h1>users</h1> },
        ],
      },
    ],
  },
]

async function openAt(path: string, heading: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { name: heading })
  // Something the previous person saw, to check the cache is emptied.
  qc.setQueryData(['probe'], 'cached')
  return router
}

const where = (router: ReturnType<typeof createMemoryRouter>) =>
  router.state.location.pathname + router.state.location.search

function storeInOtherTab(session: Session | null) {
  const newValue = JSON.stringify({ state: session ?? { token: null, user: null }, version: 0 })
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key: SESSION_STORAGE_KEY, newValue, storageArea: localStorage }),
    )
  })
}

describe('ending a session', () => {
  it('signing out goes to the login screen without next', async () => {
    useSession.getState().setSession(await signIn('admin@example.com'))
    const router = await openAt('/admin/users', 'users')

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }))

    await screen.findByRole('heading', { name: 'login' })
    expect(where(router)).toBe('/login')
    expect(useSession.getState()).toMatchObject({
      token: null,
      user: null,
      ended: { reason: 'signedOut', userId: 'u-han' },
    })
    expect(qc.getQueryData(['probe'])).toBeUndefined()
  })

  it('a 401 keeps next, so the same person returns to the page, and empties the cache', async () => {
    const { user } = await signIn('admin@example.com')
    qc.setQueryData(['before'], 'cached')
    // A token the server no longer accepts: the guard's /auth/me call answers 401.
    useSession.getState().setSession({ token: t.tokenFor('u-gone'), user })
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/users?tab=all'] })
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await screen.findByRole('heading', { name: 'login' })
    expect(where(router)).toBe(`/login?next=${encodeURIComponent('/admin/users?tab=all')}`)
    expect(useSession.getState().ended).toEqual({ reason: 'expired', userId: user.id })
    expect(qc.getQueryData(['before'])).toBeUndefined()
  })

  it('a 401 arriving after signing out does not turn the sign-out into an expiry', () => {
    useSession.getState().clear('signedOut')
    expireSession(qc)
    expect(useSession.getState().ended?.reason).toBe('signedOut')
  })
})

describe('other tabs', () => {
  it('a sign-out in another tab signs this tab out too, without next', async () => {
    useSession.getState().setSession(await signIn('admin@example.com'))
    const router = await openAt('/admin/users', 'users')

    storeInOtherTab(null)

    await screen.findByRole('heading', { name: 'login' })
    expect(where(router)).toBe('/login')
    expect(useSession.getState()).toMatchObject({ token: null, ended: { reason: 'signedOut' } })
    expect(qc.getQueryData(['probe'])).toBeUndefined()
  })

  it('a sign-in as someone else takes the new session, empties the cache and goes home', async () => {
    useSession.getState().setSession(await signIn('admin@example.com'))
    const router = await openAt('/admin/users', 'users')
    const requester = await signIn('planner@example.com')

    storeInOtherTab(requester)

    await screen.findByRole('heading', { name: 'home' })
    expect(where(router)).toBe('/')
    expect(useSession.getState().user?.id).toBe(requester.user.id)
    expect(useSession.getState().token).toBe(requester.token)
    expect(qc.getQueryData(['probe'])).toBeUndefined()
  })

  it('a new sign-in by the same person only refreshes the token', async () => {
    const admin = await signIn('admin@example.com')
    useSession.getState().setSession(admin)
    const router = await openAt('/admin/users', 'users')

    storeInOtherTab({ ...admin, token: `${admin.token}-renewed` })

    expect(useSession.getState().token).toBe(`${admin.token}-renewed`)
    expect(where(router)).toBe('/admin/users')
    expect(qc.getQueryData(['probe'])).toBe('cached')
  })

  it('a signed-out tab takes a sign-in made in another tab', async () => {
    const router = await openAt('/login', 'login')
    const admin = await signIn('admin@example.com')

    storeInOtherTab(admin)

    expect(useSession.getState()).toMatchObject({ token: admin.token, ended: null })
    expect(where(router)).toBe('/login') // the login screen moves on by itself (resolvePostLoginPath)
  })

  it('ignores other keys', async () => {
    useSession.getState().setSession(await signIn('admin@example.com'))
    const router = await openAt('/admin/users', 'users')
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'something-else', newValue: null, storageArea: localStorage }),
      )
    })
    expect(where(router)).toBe('/admin/users')
    expect(useSession.getState().token).not.toBeNull()
  })
})
