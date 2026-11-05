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
  configureClient({
    getToken: () => useSession.getState().token,
    onUnauthorized: (token) => expireSession(qc, token),
  })
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

function storeInOtherTab(session: Session | null, endReason: 'signedOut' | 'expired' = 'signedOut') {
  const newValue = JSON.stringify({ state: session ?? { token: null, user: null, endReason }, version: 0 })
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
    useSession.getState().setSession({ token: 'token-a', user: { id: 'u-han' } as Session['user'] })
    useSession.getState().clear('signedOut')
    expireSession(qc, 'token-a')
    expect(useSession.getState().ended?.reason).toBe('signedOut')
  })

  it("a late 401 to the previous session's request leaves the next session alone", async () => {
    const admin = await signIn('admin@example.com')
    const requester = await signIn('planner@example.com')
    useSession.getState().setSession(admin)
    qc.setQueryData(['probe'], 'cached')
    // Signed out and in as someone else while a request with the first token was on its way.
    useSession.getState().clear('signedOut')
    useSession.getState().setSession(requester)
    expireSession(qc, admin.token)
    expect(useSession.getState()).toMatchObject({ token: requester.token, user: { id: requester.user.id } })
    expect(qc.getQueryData(['probe'])).toBe('cached')
    // Through the client: a refusal of the current token still ends the session.
    useSession.getState().setSession({ token: t.tokenFor('u-gone'), user: requester.user })
    await expect(call(api.me)).rejects.toMatchObject({ status: 401 })
    expect(useSession.getState().ended).toEqual({ reason: 'expired', userId: requester.user.id })
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

  it('an expiry in another tab is an expiry here too: next and the notice stay', async () => {
    useSession.getState().setSession(await signIn('admin@example.com'))
    const router = await openAt('/admin/users?tab=all', 'users')

    storeInOtherTab(null, 'expired')

    await screen.findByRole('heading', { name: 'login' })
    expect(where(router)).toBe(`/login?next=${encodeURIComponent('/admin/users?tab=all')}`)
    expect(useSession.getState()).toMatchObject({
      token: null,
      ended: { reason: 'expired', userId: 'u-han' },
    })
    expect(qc.getQueryData(['probe'])).toBeUndefined()
  })

  it('takes up a sign-out made while this tab was starting, instead of saving the old session again', async () => {
    const admin = await signIn('admin@example.com')
    useSession.getState().setSession(admin)
    // Another tab signed out before this one listened: storage says so, the store still has the session.
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ state: { token: null, user: null, endReason: 'signedOut' }, version: 0 }),
    )
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/users'] })
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await screen.findByRole('heading', { name: 'login' })
    expect(where(router)).toBe('/login')
    expect(useSession.getState()).toMatchObject({ token: null, ended: { reason: 'signedOut' } })
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toContain(admin.token)
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
