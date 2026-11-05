import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { call } from '@/api/client'
import { api } from '@/api/contract'
import { SessionSync } from '@/app/guards'
import { DEMO_PASSWORD } from '@/mocks/seed'
import { SESSION_STORAGE_KEY, useSession } from '@/stores/session'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { EMPTY_VALUES, loadDraft, saveDraft, type WizardValues } from './schema'
import WizardPage from './wizard-page'

const t = createTestApi()
const USER = 'u-kim'
const DRAFT_KEY = `ax-request-portal:draft:${USER}`
const REVIEW = '/requests/new?step=6'

/** A request ready to submit; the second criterion is vague, so the check has advice. */
const READY: WizardValues = {
  ...EMPTY_VALUES,
  projectId: 'p-portal',
  type: 'change',
  targetIds: ['t-notice'],
  title: '공지사항 검색 추가',
  currentBehavior: '공지가 많아 찾기 어렵다',
  desiredBehavior: '제목으로 공지를 검색하고 싶다',
  acceptanceCriteria: [
    { text: '검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다' },
    { text: '깔끔하게' },
  ],
}

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  localStorage.removeItem(DRAFT_KEY)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  await signInAs(USER)
})
afterEach(() => {
  t.server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => t.server.close())

function renderWizard(at: string) {
  const router = createMemoryRouter(
    [
      {
        // As in the app: the root route follows sign-ins made in other tabs.
        element: (
          <>
            <SessionSync />
            <Outlet />
          </>
        ),
        children: [
          { path: '/', element: <h1>홈 화면</h1> },
          { path: '/requests/new', element: <WizardPage /> },
          { path: '/requests/:id', element: <h1>요청 상세</h1> },
        ],
      },
    ],
    { initialEntries: [at] },
  )
  render(
    <QueryClientProvider client={testQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

/** A promise the test resolves when it wants a held-back answer to go out. */
function gate() {
  let open!: () => void
  const closed = new Promise<void>((resolve) => (open = resolve))
  return { closed, open }
}

describe('submitting', () => {
  it('deletes the draft once the request is created, even if the wizard was left meanwhile', async () => {
    saveDraft(USER, READY)
    const hold = gate()
    // Hold the answer back, then let the mock create the request as usual.
    t.server.use(
      http.post('*/api/requests', async () => {
        await hold.closed
      }),
    )
    const router = renderWizard(REVIEW)
    expect(await screen.findByText(/확인해 보면 좋은 점 \d+개/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))
    expect(await screen.findByRole('button', { name: '제출 중…' })).toBeInTheDocument()

    // Leaving while it is sent asks nothing: the submission carries on without the screen.
    await act(() => router.navigate('/'))
    expect(screen.getByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull()

    hold.open()
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the new request and leaves no draft behind', async () => {
    saveDraft(USER, READY)
    renderWizard(REVIEW)
    await screen.findByText(/확인해 보면 좋은 점 \d+개/)
    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))

    expect(await screen.findByRole('heading', { name: '요청 상세' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })
})

describe('the submission check', () => {
  it('says when it could not run, drops the earlier advice and can run again', async () => {
    saveDraft(USER, READY)
    const router = renderWizard(REVIEW)
    expect(await screen.findByText(/확인해 보면 좋은 점 \d+개/)).toBeInTheDocument()

    t.server.use(
      http.post('*/api/requests/precheck', () =>
        HttpResponse.json({ code: 'internal', message: 'down' }, { status: 500 }),
      ),
    )
    await act(() => router.navigate('/requests/new?step=5'))
    await act(() => router.navigate(REVIEW))

    expect(await screen.findByText(/점검을 하지 못했어요/)).toBeInTheDocument()
    expect(screen.queryByText(/확인해 보면 좋은 점/)).toBeNull()
    expect(screen.getByRole('button', { name: '요청 제출' })).toBeEnabled()

    t.server.resetHandlers()
    await userEvent.click(screen.getByRole('button', { name: '다시 점검하기' }))
    expect(await screen.findByText(/확인해 보면 좋은 점 \d+개/)).toBeInTheDocument()
    expect(screen.queryByText(/점검을 하지 못했어요/)).toBeNull()
  })
})

describe('leaving', () => {
  it('asks before leaving what was written, and keeps the draft either way', async () => {
    saveDraft(USER, { ...READY, title: '' })
    const router = renderWizard('/requests/new?step=3')
    await userEvent.type(await screen.findByLabelText('요청 제목'), '사진이 안 올라감')

    await act(() => router.navigate('/'))
    const dialog = await screen.findByRole('dialog', { name: '작성을 멈추고 나갈까요?' })
    expect(dialog).toHaveTextContent('초안으로 저장돼 있어요')
    // Asking wrote the pending draft at once.
    expect(loadDraft(USER)?.title).toBe('사진이 안 올라감')

    await userEvent.click(screen.getByRole('button', { name: '계속 쓰기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByLabelText('요청 제목')).toHaveValue('사진이 안 올라감')

    await act(() => router.navigate('/'))
    await userEvent.click(await screen.findByRole('button', { name: '나가기' }))
    expect(await screen.findByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(loadDraft(USER)?.title).toBe('사진이 안 올라감')
  })

  it('moves on without asking when another tab signs in as someone else', async () => {
    saveDraft(USER, { ...READY, title: '' })
    renderWizard('/requests/new?step=3')
    await userEvent.type(await screen.findByLabelText('요청 제목'), '사진이 안 올라감')
    const other = await call(api.login, { body: { email: 'admin@example.com', password: DEMO_PASSWORD } })

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_STORAGE_KEY,
          newValue: JSON.stringify({ state: other, version: 0 }),
          storageArea: localStorage,
        }),
      )
    })

    expect(await screen.findByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useSession.getState().user?.id).toBe(other.user.id)
    // What was written stays the first person's draft, not the new person's.
    expect(loadDraft(USER)?.title).toBe('사진이 안 올라감')
    expect(loadDraft(other.user.id)).toBeNull()
  })

  it('does not ask when nothing has been written', async () => {
    const router = renderWizard('/requests/new?project=p-portal')
    expect(await screen.findByRole('heading', { name: '어떤 종류의 요청인가요?' })).toBeInTheDocument()
    await act(() => router.navigate('/'))
    expect(screen.getByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps writing the draft, a moment after typing stops', async () => {
    saveDraft(USER, { ...READY, title: '' })
    renderWizard('/requests/new?step=3')
    await userEvent.type(await screen.findByLabelText('요청 제목'), '검색')
    await waitFor(() => expect(loadDraft(USER)?.title).toBe('검색'))
  })
})
