import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { configureClient } from '@/api/client'
import { createQueryClient } from '@/api/query-client'
import '@/i18n'
import { useSession } from '@/stores/session'
import { createTestApi } from '@/test/mock-api'
import SetupPage from './setup-page'

const START = new Date('2026-11-02T01:00:00.000Z')
const t = createTestApi(START)
const PASSPHRASE = 'a long enough passphrase'

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => t.server.close())
beforeEach(() => {
  configureClient({ getToken: () => useSession.getState().token, onUnauthorized: () => {} })
  useSession.setState({ token: null, user: null, ended: null })
})

/** A person an admin just added, and the token of their setup link. */
function newPerson(email: string) {
  const engine = t.store.engine
  const admin = engine.state.users.find((u) => u.role === 'admin')!
  const person = engine.createUser(admin, { name: '새사람', email, role: 'requester' })
  return { person, token: engine.createSetupLink(admin, person.id, START).token }
}

function openSetup(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/setup', element: <SetupPage /> },
      { path: '/login', element: <h1>login</h1> },
      { path: '/', element: <h1>home</h1> },
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

async function fill(password: string, confirm = password) {
  await userEvent.type(await screen.findByLabelText('새 비밀번호'), password)
  await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), confirm)
  await userEvent.click(screen.getByRole('button', { name: '비밀번호 정하고 로그인' }))
}

describe('SetupPage', () => {
  it('sets the password, signs the person in and goes home', async () => {
    const { person, token } = newPerson('setup-ok@example.com')
    const router = openSetup(`/setup#token=${token}`)
    // The token leaves the address bar at once.
    await screen.findByLabelText('새 비밀번호')
    expect(router.state.location.hash).toBe('')

    await fill(PASSPHRASE)
    expect(await screen.findByRole('heading', { name: 'home' })).toBeInTheDocument()
    expect(useSession.getState().user?.id).toBe(person.id)
    expect(t.store.engine.state.passwords[person.id]).toBe(PASSPHRASE)
  })

  it('checks the length and the repeat before sending anything', async () => {
    const { token } = newPerson('setup-check@example.com')
    openSetup(`/setup#token=${token}`)
    await fill('short')
    expect(await screen.findByText('12자 이상 입력해 주세요.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('새 비밀번호'))
    await userEvent.clear(screen.getByLabelText('새 비밀번호 확인'))
    await fill(PASSPHRASE, `${PASSPHRASE}!`)
    expect(await screen.findByText('두 비밀번호가 같지 않아요.')).toBeInTheDocument()
    expect(useSession.getState().token).toBeNull()
  })

  it("shows the server's answer for a spent link", async () => {
    const { token } = newPerson('setup-spent@example.com')
    t.store.engine.completeSetup(token, PASSPHRASE, START)
    openSetup(`/setup#token=${token}`)
    await fill(PASSPHRASE)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '링크가 올바르지 않거나 이미 쓰였거나 만료되었습니다',
    )
    expect(useSession.getState().token).toBeNull()
  })

  it('explains a link without its token', async () => {
    openSetup('/setup')
    expect(await screen.findByRole('alert')).toHaveTextContent('링크가 완전하지 않아요')
    expect(screen.queryByLabelText('새 비밀번호')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '로그인 화면으로' }))
    expect(await screen.findByRole('heading', { name: 'login' })).toBeInTheDocument()
  })
})
