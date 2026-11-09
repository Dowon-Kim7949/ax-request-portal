import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { call } from '@/api/client'
import { api } from '@/api/contract'
import { SessionSync } from '@/app/guards'
import { appConfig } from '@/config/app.config'
import { draftSync, resetDraftSync } from '@/features/drafts/sync'
import { DEMO_PASSWORD } from '@/mocks/seed'
import {
  clearDrafts,
  draftsKey,
  getLocalDraft,
  listLocalDrafts,
  putLocalDraft,
  type LocalDraft,
} from '@/stores/draft'
import { SESSION_STORAGE_KEY, useSession } from '@/stores/session'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { EMPTY_VALUES, toDraftContent, type WizardValues } from './schema'
import WizardPage from './wizard-page'

const t = createTestApi()
const USER = 'u-kim'
const LOCAL = 'local-test'
const REVIEW = `/requests/new?draft=${LOCAL}&step=6`
/** The draft sync waits a second after typing stops. */
const SYNCED = { timeout: 4_000 }
/** The save state line (a screen reader hears it from its own live region, not this text) */
const STATUS = { selector: 'span' }

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
  t.server.resetHandlers()
  vi.restoreAllMocks()
  resetDraftSync()
  clearDrafts(USER)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  await signInAs(USER)
  for (const draft of await call(api.listDrafts)) await call(api.deleteDraft, { params: { id: draft.id } })
})
afterAll(() => t.server.close())

/** A draft written on this device that the account does not have yet. */
function keepLocal(values: WizardValues, over: Partial<LocalDraft> = {}) {
  putLocalDraft(USER, {
    localId: LOCAL,
    step: 3,
    content: values,
    updatedAt: new Date().toISOString(),
    dirty: true,
    ...over,
  })
}

/** A draft in the account, as another device saved it. */
const saveToAccount = (values: WizardValues, step = 3) =>
  call(api.createDraft, { body: { step, content: toDraftContent(values) } })
const accountDrafts = () => call(api.listDrafts)

function renderWizard(at: string) {
  return renderWizardOnce(at).router
}

function renderWizardOnce(at: string) {
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
          { path: '/requests', element: <h1>내 요청</h1> },
          { path: '/requests/new', element: <WizardPage /> },
          { path: '/requests/:id', element: <h1>요청 상세</h1> },
        ],
      },
    ],
    { initialEntries: [at] },
  )
  const { unmount } = render(
    <QueryClientProvider client={testQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, unmount }
}

const draftParam = (router: ReturnType<typeof renderWizard>) =>
  new URLSearchParams(router.state.location.search).get('draft')

/** A promise the test resolves when it wants a held-back answer to go out. */
function gate() {
  let open!: () => void
  const closed = new Promise<void>((resolve) => (open = resolve))
  return { closed, open }
}

describe('submitting', () => {
  it('deletes the draft once the request is created, even if the wizard was left meanwhile', async () => {
    keepLocal(READY)
    const hold = gate()
    // Hold the answer back, then let the mock create the request as usual.
    t.server.use(
      http.post('*/api/requests', async () => {
        await hold.closed
      }),
    )
    const router = renderWizard(REVIEW)
    expect(await screen.findByText(/확인해 보면 좋은 점 \d+개/)).toBeInTheDocument()
    expect(await screen.findByText('계정에 저장됨', STATUS, SYNCED)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))
    expect(await screen.findByRole('button', { name: '제출 중…' })).toBeInTheDocument()

    // Leaving while it is sent asks nothing: the submission carries on without the screen.
    await act(() => router.navigate('/'))
    expect(screen.getByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(await accountDrafts()).toHaveLength(1)

    hold.open()
    // The request named the draft, so the server deleted it with the submission.
    await waitFor(async () => expect(await accountDrafts()).toEqual([]))
    expect(listLocalDrafts(USER)).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('waits for a submission still on its way instead of starting a new request', async () => {
    keepLocal(READY)
    const hold = gate()
    let posts = 0
    t.server.use(
      http.post('*/api/requests', async () => {
        posts += 1
        await hold.closed
      }),
    )
    const router = renderWizard(REVIEW)
    await screen.findByText(/확인해 보면 좋은 점 \d+개/)
    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))
    await screen.findByRole('button', { name: '제출 중…' })

    await act(() => router.navigate('/'))
    await act(() => router.navigate('/requests/new?step=6'))
    expect(await screen.findByText('앞서 제출한 요청을 보내고 있어요…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '요청 제출' })).toBeNull()

    hold.open()
    // Once it has arrived, a new request starts empty: that draft became the request.
    expect(await screen.findByRole('heading', { name: '어느 서비스에 대한 요청인가요?' })).toBeInTheDocument()
    await waitFor(() => expect(listLocalDrafts(USER)).toEqual([]))
    expect(posts).toBe(1)
  })

  it('a save on its way when the request is sent still ends with no draft left', async () => {
    keepLocal(READY)
    const posted = gate()
    // The draft's first save is slow; the person submits meanwhile.
    t.server.use(
      http.post('*/api/drafts', async () => {
        await posted.closed
      }),
    )
    const router = renderWizard(REVIEW)
    await screen.findByText(/확인해 보면 좋은 점 \d+개/)
    expect(screen.getByText('저장 중…', STATUS)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))
    // The wizard waits a moment for the save, then sends the request without it.
    expect(await screen.findByRole('heading', { name: '요청 상세' }, { timeout: 5_000 })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/requests\/\d+$/)

    // The save arrives late and creates the draft: it is deleted at once.
    posted.open()
    await waitFor(async () => expect(await accountDrafts()).toEqual([]))
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('a save answered after the wizard stopped waiting, but before the request was created, leaves no draft', async () => {
    keepLocal(READY)
    const posted = gate()
    const created = gate()
    let submitted = false
    t.server.use(
      http.post('*/api/drafts', async () => {
        await posted.closed
      }),
      http.post('*/api/requests', async () => {
        submitted = true
        await created.closed
      }),
    )
    renderWizard(REVIEW)
    await screen.findByText(/확인해 보면 좋은 점 \d+개/)
    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))
    // The wizard waits a moment for the save, then sends the request without naming the draft…
    await waitFor(() => expect(submitted).toBe(true), { timeout: 5_000 })
    // …and the save arrives before the request is created: the account has the draft now.
    posted.open()
    await waitFor(async () => expect(await accountDrafts()).toHaveLength(1))

    created.open()
    expect(await screen.findByRole('heading', { name: '요청 상세' })).toBeInTheDocument()
    await waitFor(async () => expect(await accountDrafts()).toEqual([]))
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('names the attachments the server could not find and leads back to them', async () => {
    const photo = {
      id: 'att-expired',
      name: 'screen.png',
      size: 4,
      mimeType: 'image/png',
      url: 'data:image/png;base64,iVBORw==',
    }
    keepLocal({ ...READY, attachments: [photo] })
    renderWizard(REVIEW)
    await screen.findByText(/확인해 보면 좋은 점 \d+개/)
    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))

    const alert = await screen.findByRole('alert', {}, { timeout: 5_000 })
    expect(alert).toHaveTextContent('찾을 수 없는 첨부가 있어요')
    expect(alert).toHaveTextContent('screen.png')
    await userEvent.click(screen.getByRole('button', { name: '첨부 고치기' }))

    expect(await screen.findByText('다시 올려 주세요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'screen.png 지우기' }))
    expect(screen.queryByText('찾을 수 없는 첨부가 있어요')).toBeNull()
  })

  it('opens the new request and leaves no draft behind, here or in the account', async () => {
    const draft = await saveToAccount(READY, 6)
    renderWizard(`/requests/new?draft=${draft.id}&step=6`)
    await screen.findByText(/확인해 보면 좋은 점 \d+개/)
    await userEvent.click(screen.getByRole('button', { name: '요청 제출' }))

    expect(await screen.findByRole('heading', { name: '요청 상세' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(listLocalDrafts(USER)).toEqual([])
    expect(await accountDrafts()).toEqual([])
  })
})

describe('the submission check', () => {
  it('says when it could not run, drops the earlier advice and can run again', async () => {
    keepLocal(READY)
    const router = renderWizard(REVIEW)
    expect(await screen.findByText(/확인해 보면 좋은 점 \d+개/)).toBeInTheDocument()

    t.server.use(
      http.post('*/api/requests/precheck', () =>
        HttpResponse.json({ code: 'internal', message: 'down' }, { status: 500 }),
      ),
    )
    const draft = draftParam(router)
    await act(() => router.navigate(`/requests/new?draft=${draft}&step=5`))
    await act(() => router.navigate(`/requests/new?draft=${draft}&step=6`))

    expect(await screen.findByText(/점검을 하지 못했어요/)).toBeInTheDocument()
    expect(screen.queryByText(/확인해 보면 좋은 점/)).toBeNull()
    expect(screen.getByRole('button', { name: '요청 제출' })).toBeEnabled()

    t.server.resetHandlers()
    await userEvent.click(screen.getByRole('button', { name: '다시 점검하기' }))
    expect(await screen.findByText(/확인해 보면 좋은 점 \d+개/)).toBeInTheDocument()
    expect(screen.queryByText(/점검을 하지 못했어요/)).toBeNull()
  })
})

describe('the draft in the account', () => {
  it('starts a draft once something is written, and moves to its server id once saved', async () => {
    const router = renderWizard('/requests/new?project=p-portal')
    await userEvent.click(await screen.findByRole('radio', { name: /기존 기능 변경/ }))
    await screen.findByRole('heading', { name: '어느 화면이나 기능인가요?' })
    // One-tap choices alone make no draft.
    expect(draftParam(router)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await userEvent.type(await screen.findByLabelText('요청 제목'), '공지 검색')

    await waitFor(() => expect(draftParam(router)).toMatch(/^local-/))
    expect(await screen.findByText('계정에 저장됨', STATUS, SYNCED)).toBeInTheDocument()
    const [saved] = await accountDrafts()
    expect(saved).toMatchObject({ title: '공지 검색', step: 3, projectId: 'p-portal' })
    expect(draftParam(router)).toBe(saved!.id)
    expect(new URLSearchParams(router.state.location.search).get('step')).toBe('3')
    // The account has it all: nothing stays on this device.
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('opens a draft from the account with its words', async () => {
    const draft = await saveToAccount(READY)
    renderWizard(`/requests/new?draft=${draft.id}&step=3`)
    expect(screen.getByText('초안을 불러오고 있어요…')).toBeInTheDocument()
    expect(await screen.findByLabelText('요청 제목')).toHaveValue('공지사항 검색 추가')
    expect(screen.getByText('계정에 저장됨', STATUS)).toBeInTheDocument()
    expect(listLocalDrafts(USER)).toEqual([])
    // Continuing a draft: no pointer to the others.
    expect(screen.queryByRole('link', { name: /임시 저장된 초안/ })).toBeNull()
  })

  it('points a new request to the drafts there are to continue, until this one is being saved', async () => {
    await saveToAccount(READY)
    keepLocal({ ...READY, title: '기기에만 있는 초안' })
    renderWizard('/requests/new?project=p-portal')
    const notice = await screen.findByRole('link', { name: /임시 저장된 초안 2개/ })
    expect(notice).toHaveAttribute('href', '/requests#drafts')
    expect(notice).toHaveAccessibleName(/이어 쓰기$/)

    await userEvent.click(screen.getByRole('radio', { name: /기존 기능 변경/ }))
    await screen.findByRole('heading', { name: '어느 화면이나 기능인가요?' })
    expect(screen.getByRole('link', { name: /임시 저장된 초안 2개/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await userEvent.type(await screen.findByLabelText('요청 제목'), '새 요청')
    // The save state takes the line once this one is written.
    expect(await screen.findByText('계정에 저장됨', STATUS, SYNCED)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /임시 저장된 초안/ })).toBeNull()
  })

  it('continues this device’s newer copy written over the account’s version, and saves it', async () => {
    const draft = await saveToAccount(READY)
    keepLocal(
      { ...READY, title: '이 기기에서 고친 제목' },
      { localId: draft.id, draftId: draft.id, baseVersion: draft.version },
    )
    renderWizard(`/requests/new?draft=${draft.id}&step=3`)
    expect(await screen.findByLabelText('요청 제목')).toHaveValue('이 기기에서 고친 제목')
    await waitFor(
      async () =>
        expect(await call(api.getDraft, { params: { id: draft.id } })).toMatchObject({
          title: '이 기기에서 고친 제목',
          version: 2,
        }),
      SYNCED,
    )
  })

  describe('saved elsewhere meanwhile', () => {
    async function openConflict(
      saved: { values: WizardValues; step: number } = {
        values: { ...READY, title: '다른 기기에서 고친 제목' },
        step: 3,
      },
      step = 3,
    ) {
      const draft = await saveToAccount(READY)
      await call(api.updateDraft, {
        params: { id: draft.id },
        body: { baseVersion: 1, step: saved.step, content: toDraftContent(saved.values) },
      })
      keepLocal(
        { ...READY, title: '이 기기에서 고친 제목' },
        { localId: draft.id, draftId: draft.id, baseVersion: 1, step },
      )
      const router = renderWizard(`/requests/new?draft=${draft.id}&step=${step}`)
      expect(await screen.findByText('다른 곳에서 이 초안이 먼저 저장됐어요')).toBeInTheDocument()
      // Nothing on screen is lost while the person decides.
      if (step === 3) expect(screen.getByLabelText('요청 제목')).toHaveValue('이 기기에서 고친 제목')
      expect(screen.getByText('저장 충돌', STATUS)).toBeInTheDocument()
      return { draft, router }
    }

    it('loading the saved version goes back to the first step it leaves incomplete', async () => {
      const { router } = await openConflict({ values: { ...READY, title: '' }, step: 6 }, 6)
      expect(screen.getByRole('heading', { name: '이대로 제출할까요?' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '저장된 내용 불러오기' }))
      // Not left on the review step with an empty title and the earlier check's advice.
      expect(
        await screen.findByRole('heading', { name: '지금은 어떻고, 어떻게 바뀌면 좋을까요?' }),
      ).toBeInTheDocument()
      expect(new URLSearchParams(router.state.location.search).get('step')).toBe('3')
      expect(screen.getByLabelText('요청 제목')).toHaveValue('')
    })

    it('and checks it again when it is complete and the person is on the review step', async () => {
      let checks = 0
      t.server.use(
        http.post('*/api/requests/precheck', () => {
          checks += 1
        }),
      )
      await openConflict({ values: { ...READY, title: '다른 기기에서 고친 제목' }, step: 6 }, 6)
      await waitFor(() => expect(checks).toBe(1))
      await userEvent.click(screen.getByRole('button', { name: '저장된 내용 불러오기' }))
      await waitFor(() => expect(checks).toBe(2))
      expect(screen.getByRole('heading', { name: '이대로 제출할까요?' })).toBeInTheDocument()
    })

    it('tells a screen reader about it from the heading that takes focus as the draft opens', async () => {
      await openConflict()
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveFocus()
      expect(heading).toHaveAccessibleDescription(
        '다른 곳에서 이 초안이 먼저 저장됐어요 이 화면의 내용은 그대로 있어요. 어느 쪽을 남길지 골라 주세요.',
      )
      // The live region is written after it is on the page, so it is read too.
      await waitFor(() =>
        expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('저장 충돌'),
      )
    })

    it('keeps what is on screen, saved over the newer version', async () => {
      const { draft } = await openConflict()
      const success = vi.spyOn(toast, 'success')
      await userEvent.click(screen.getByRole('button', { name: '이 화면 내용으로 저장' }))
      // The button goes with the notice: focus moves to the step's heading, and the choice is told.
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
      expect(success).toHaveBeenCalledWith('이 화면 내용으로 저장할게요.')
      await waitFor(async () =>
        expect(await call(api.getDraft, { params: { id: draft.id } })).toMatchObject({
          title: '이 기기에서 고친 제목',
          version: 3,
        }),
      )
      await waitFor(() => expect(screen.queryByText('다른 곳에서 이 초안이 먼저 저장됐어요')).toBeNull())
      expect(listLocalDrafts(USER)).toEqual([])
    })

    it('or loads the saved version in place of what is on screen', async () => {
      const { draft } = await openConflict()
      const success = vi.spyOn(toast, 'success')
      await userEvent.click(screen.getByRole('button', { name: '저장된 내용 불러오기' }))
      await waitFor(() => expect(screen.getByLabelText('요청 제목')).toHaveValue('다른 기기에서 고친 제목'))
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
      expect(success).toHaveBeenCalledWith('저장된 내용을 불러왔어요.')
      expect(screen.queryByText('다른 곳에서 이 초안이 먼저 저장됐어요')).toBeNull()
      expect(getLocalDraft(USER, draft.id)).toBeUndefined()
      expect(await call(api.getDraft, { params: { id: draft.id } })).toMatchObject({ version: 2 })
    })
  })

  it('goes on as a new draft when the account’s draft was deleted elsewhere and this device has more', async () => {
    const draft = await saveToAccount(READY)
    await call(api.deleteDraft, { params: { id: draft.id } })
    keepLocal(
      { ...READY, title: '이 기기에서 더 쓴 것' },
      { localId: draft.id, draftId: draft.id, baseVersion: 1 },
    )
    const router = renderWizard(`/requests/new?draft=${draft.id}&step=3`)
    expect(await screen.findByLabelText('요청 제목')).toHaveValue('이 기기에서 더 쓴 것')
    await waitFor(async () => expect((await accountDrafts())[0]?.title).toBe('이 기기에서 더 쓴 것'), SYNCED)
    const [again] = await accountDrafts()
    await waitFor(() => expect(draftParam(router)).toBe(again!.id))
  })

  it('says so when the draft is not in the account and not on this device', async () => {
    renderWizard('/requests/new?draft=draft-999')
    expect(await screen.findByText('초안을 찾을 수 없어요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '임시 저장함 보기' })).toHaveAttribute('href', '/requests#drafts')
    await userEvent.click(screen.getByRole('link', { name: '새 요청 쓰기' }))
    expect(await screen.findByRole('heading', { name: '어느 서비스에 대한 요청인가요?' })).toBeInTheDocument()
  })

  it('takes a link naming something that cannot be a draft for a draft not found', async () => {
    for (const id of ['__proto__', 'constructor', 'toString', '../drafts', 'x'.repeat(101)]) {
      const { unmount } = renderWizardOnce(`/requests/new?draft=${encodeURIComponent(id)}`)
      expect(await screen.findByText('초안을 찾을 수 없어요')).toBeInTheDocument()
      unmount()
    }
  })

  it('keeps the draft on this device when the account is full, and says how to make room', async () => {
    await Promise.all(
      Array.from({ length: appConfig.drafts.maxPerAccount }, (_, i) =>
        saveToAccount({ ...EMPTY_VALUES, title: `초안 ${i}` }),
      ),
    )
    keepLocal(READY)
    renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    expect(await screen.findByText(/임시 저장함이 가득 찼어요\(최대 20개\)/, {}, SYNCED)).toBeInTheDocument()
    expect(screen.getByText('이 기기에만 저장됨', STATUS)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '임시 저장함' })).toHaveAttribute('href', '/requests#drafts')
    expect(getLocalDraft(USER, LOCAL)).toMatchObject({ limited: true })
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleDescription(/임시 저장함이 가득 찼어요/)
  })

  it('stays as it is while typing goes on in a draft the account has no room for', async () => {
    await Promise.all(
      Array.from({ length: appConfig.drafts.maxPerAccount }, (_, i) =>
        saveToAccount({ ...EMPTY_VALUES, title: `초안 ${i}` }),
      ),
    )
    keepLocal(READY)
    renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    const notice = await screen.findByText(/임시 저장함이 가득 찼어요/, {}, SYNCED)
    let sawSaving = false
    const observer = new MutationObserver(() => {
      if (screen.queryByText('저장 중…', STATUS)) sawSaving = true
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    try {
      await userEvent.type(screen.getByLabelText('요청 제목'), ' 더')
      // Past the write and the sync's wait.
      await act(() => new Promise((resolve) => setTimeout(resolve, 1_600)))
    } finally {
      observer.disconnect()
    }
    // Nothing is sent on a pause in typing, so the line does not say so, and the notice does not move.
    expect(sawSaving).toBe(false)
    expect(notice).toBeInTheDocument()
    expect(screen.getByText('이 기기에만 저장됨', STATUS)).toBeInTheDocument()
    expect(getLocalDraft(USER, LOCAL)).toMatchObject({
      limited: true,
      content: { title: `${READY.title} 더` },
    })
  })

  it('says when the draft is kept nowhere but on this screen', async () => {
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === draftsKey(USER)) throw new DOMException('full', 'QuotaExceededError')
      original.call(this, key, value)
    })
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error()))
    renderWizard('/requests/new?project=p-portal')
    await userEvent.click(await screen.findByRole('radio', { name: /기존 기능 변경/ }))
    await screen.findByRole('heading', { name: '어느 화면이나 기능인가요?' })
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await userEvent.type(await screen.findByLabelText('요청 제목'), '사진이 안 올라감')

    expect(await screen.findByText('저장되지 않음 · 화면을 닫지 마세요', STATUS, SYNCED)).toBeInTheDocument()
    expect(screen.queryByText(/이 기기에만 저장됨/, STATUS)).toBeNull()
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('저장되지 않음')
  })

  it('says when the account cannot be reached, and keeps the draft on this device', async () => {
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error()))
    keepLocal(READY)
    renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    expect(
      await screen.findByText('이 기기에만 저장됨 · 연결되면 올려요', STATUS, SYNCED),
    ).toBeInTheDocument()
    // Told once, as it changes; not on every save.
    const region = document.querySelector('[aria-live="polite"]')!
    expect(region).toHaveTextContent('이 기기에만 저장됨')
    expect(getLocalDraft(USER, LOCAL)).toBeDefined()

    // Every pause in typing tries again, and fails again: the region is not written again.
    const changes: MutationRecord[] = []
    const observer = new MutationObserver((records) => changes.push(...records))
    observer.observe(region, { subtree: true, childList: true, characterData: true })
    try {
      await userEvent.type(screen.getByLabelText('요청 제목'), ' 더')
      expect(await screen.findByText('저장 중…', STATUS)).toBeInTheDocument()
      expect(
        await screen.findByText('이 기기에만 저장됨 · 연결되면 올려요', STATUS, SYNCED),
      ).toBeInTheDocument()
    } finally {
      observer.disconnect()
    }
    expect(changes).toEqual([])
    expect(region).toHaveTextContent('이 기기에만 저장됨')
  })

  it('deletes the draft here and in the account, after asking', async () => {
    const draft = await saveToAccount(READY)
    const router = renderWizard(`/requests/new?draft=${draft.id}&step=3`)
    await screen.findByLabelText('요청 제목')
    await userEvent.click(screen.getByRole('button', { name: '초안 삭제' }))
    const dialog = await screen.findByRole('dialog', { name: '이 초안을 삭제할까요?' })
    expect(dialog).toHaveTextContent('되돌릴 수 없어요')
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    expect(await screen.findByRole('heading', { name: '어느 서비스에 대한 요청인가요?' })).toBeInTheDocument()
    expect(draftParam(router)).toBeNull()
    expect(await accountDrafts()).toEqual([])
    expect(listLocalDrafts(USER)).toEqual([])
  })
})

describe('the same draft open in another tab', () => {
  /** Another tab on this device writes the draft (here, straight to this device's store). */
  const writeFromOtherTab = (title: string) =>
    act(() => {
      const entry = getLocalDraft(USER, LOCAL)!
      putLocalDraft(USER, {
        ...entry,
        content: { ...(entry.content as WizardValues), title },
        updatedAt: new Date(Date.now() + 1_000).toISOString(),
      })
    })

  async function openInThisTab() {
    // Kept off the account, so both tabs' words stay on this device.
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error()))
    keepLocal({ ...READY, title: '처음 제목' })
    renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    expect(await screen.findByLabelText('요청 제목')).toHaveValue('처음 제목')
  }

  it('follows the words the other tab wrote while nothing new was typed here', async () => {
    await openInThisTab()
    writeFromOtherTab('다른 탭에서 고친 제목')
    expect(await screen.findByLabelText('요청 제목')).toHaveValue('다른 탭에서 고친 제목')
    expect(screen.queryByText('다른 곳에서 이 초안이 먼저 저장됐어요')).toBeNull()

    // Moving on from here keeps them: this screen does not write its older words back.
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByRole('heading', { name: '무엇이 되면 완료인가요?' })
    expect(getLocalDraft(USER, LOCAL)?.content).toMatchObject({ title: '다른 탭에서 고친 제목' })
  })

  it('asks which to keep when both tabs wrote, and writes neither over the other meanwhile', async () => {
    await openInThisTab()
    const field = screen.getByLabelText('요청 제목')
    await userEvent.type(field, ' 이 탭')
    writeFromOtherTab('다른 탭에서 고친 제목')

    expect(await screen.findByText('다른 곳에서 이 초안이 먼저 저장됐어요')).toBeInTheDocument()
    expect(screen.getByText('저장 충돌', STATUS)).toBeInTheDocument()
    expect(field).toHaveValue('처음 제목 이 탭')
    // Past the moment this screen would have written.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)))
    expect(getLocalDraft(USER, LOCAL)?.content).toMatchObject({ title: '다른 탭에서 고친 제목' })

    await userEvent.click(screen.getByRole('button', { name: '이 화면 내용으로 저장' }))
    await waitFor(() => expect(screen.queryByText('다른 곳에서 이 초안이 먼저 저장됐어요')).toBeNull())
    expect(getLocalDraft(USER, LOCAL)?.content).toMatchObject({ title: '처음 제목 이 탭' })
  })

  it('or takes the other tab’s words in place of this screen’s', async () => {
    await openInThisTab()
    await userEvent.type(screen.getByLabelText('요청 제목'), ' 이 탭')
    writeFromOtherTab('다른 탭에서 고친 제목')
    await screen.findByText('다른 곳에서 이 초안이 먼저 저장됐어요')

    await userEvent.click(screen.getByRole('button', { name: '저장된 내용 불러오기' }))
    await waitFor(() => expect(screen.getByLabelText('요청 제목')).toHaveValue('다른 탭에서 고친 제목'))
    expect(screen.queryByText('다른 곳에서 이 초안이 먼저 저장됐어요')).toBeNull()
    expect(getLocalDraft(USER, LOCAL)?.content).toMatchObject({ title: '다른 탭에서 고친 제목' })
  })
})

describe('leaving', () => {
  it('leaves without asking once the draft is kept, and sends it on its way', async () => {
    keepLocal({ ...READY, title: '' })
    const router = renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    await userEvent.type(await screen.findByLabelText('요청 제목'), '사진이 안 올라감')

    await act(() => router.navigate('/'))
    expect(await screen.findByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(async () => expect((await accountDrafts())[0]?.title).toBe('사진이 안 올라감'), SYNCED)
  })

  it('asks before leaving only when the draft could not be kept anywhere', async () => {
    keepLocal({ ...READY, title: '' })
    // Storage full, and no connection to the account.
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === draftsKey(USER)) throw new DOMException('full', 'QuotaExceededError')
      original.call(this, key, value)
    })
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error()))
    const router = renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    await userEvent.type(await screen.findByLabelText('요청 제목'), '사진이 안 올라감')

    await act(() => router.navigate('/'))
    const dialog = await screen.findByRole('dialog', { name: '작성을 멈추고 나갈까요?' })
    expect(dialog).toHaveTextContent('이 기기에도 계정에도 초안을 저장하지 못해서')

    await userEvent.click(screen.getByRole('button', { name: '계속 쓰기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByLabelText('요청 제목')).toHaveValue('사진이 안 올라감')

    await act(() => router.navigate('/'))
    await userEvent.click(await screen.findByRole('button', { name: '나가기' }))
    expect(await screen.findByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
  })

  it('moves on without asking when another tab signs in as someone else', async () => {
    keepLocal({ ...READY, title: '' })
    renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
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
    const [kept] = listLocalDrafts(USER)
    expect(kept?.content).toMatchObject({ title: '사진이 안 올라감' })
    expect(listLocalDrafts(other.user.id)).toEqual([])
  })

  it('a sign-out in another tab deletes the draft, and the wizard does not write it back', async () => {
    keepLocal({ ...READY, title: '' })
    const router = renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    await userEvent.type(await screen.findByLabelText('요청 제목'), '사진이 안 올라감')

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_STORAGE_KEY,
          newValue: JSON.stringify({
            state: { token: null, user: null, endReason: 'signedOut' },
            version: 0,
          }),
          storageArea: localStorage,
        }),
      )
    })
    expect(useSession.getState().ended?.reason).toBe('signedOut')
    await act(() => router.navigate('/'))
    // Past the moment the pending save and the sync would have run.
    await act(() => new Promise((resolve) => setTimeout(resolve, 1_500)))
    expect(localStorage.getItem(draftsKey(USER))).toBeNull()
  })

  it('leaves without asking when only the attachments’ files did not fit on this device', async () => {
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === draftsKey(USER) && value.includes('data:')) {
        throw new DOMException('full', 'QuotaExceededError')
      }
      original.call(this, key, value)
    })
    const photo = {
      id: 'att-1',
      name: 'screen.png',
      size: 4,
      mimeType: 'image/png',
      url: 'data:image/png;base64,QQ==',
    }
    // Kept off the account, so this device's copy stays to look at.
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error()))
    keepLocal({ ...READY, title: '', attachments: [photo] })
    const router = renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    await userEvent.type(await screen.findByLabelText('요청 제목'), '사진이 안 올라감')
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(draftsKey(USER)) ?? '{}')).toMatchObject({
        entries: {
          [LOCAL]: { content: { title: '사진이 안 올라감', attachments: [{ id: 'att-1', url: '' }] } },
        },
      }),
    )

    await act(() => router.navigate('/'))
    expect(await screen.findByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not ask when nothing has been written', async () => {
    const router = renderWizard('/requests/new?project=p-portal')
    expect(await screen.findByRole('heading', { name: '어떤 종류의 요청인가요?' })).toBeInTheDocument()
    await act(() => router.navigate('/'))
    expect(screen.getByRole('heading', { name: '홈 화면' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('sends the last words when the page is hidden, without waiting for typing to pause', async () => {
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error()))
    keepLocal({ ...READY, title: '' })
    const engine = draftSync(USER)
    const sent: Array<{ trigger: string; title: unknown }> = []
    const sync = engine.sync.bind(engine)
    vi.spyOn(engine, 'sync').mockImplementation((trigger, key) => {
      const content = key
        ? (getLocalDraft(USER, key)?.content as Partial<WizardValues> | undefined)
        : undefined
      sent.push({ trigger, title: content?.title })
      return sync(trigger, key)
    })
    renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    const field = await screen.findByLabelText('요청 제목')

    await userEvent.type(field, '검색')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    try {
      document.dispatchEvent(new Event('visibilitychange'))
    } finally {
      Reflect.deleteProperty(document, 'visibilityState')
    }
    expect(sent.at(-1)).toEqual({ trigger: 'hidden', title: '검색' })

    await userEvent.type(field, ' 추가')
    window.dispatchEvent(new Event('pagehide'))
    expect(sent.at(-1)).toEqual({ trigger: 'hidden', title: '검색 추가' })
  })

  it('keeps writing the draft on this device, a moment after typing stops', async () => {
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error()))
    keepLocal({ ...READY, title: '' })
    renderWizard(`/requests/new?draft=${LOCAL}&step=3`)
    await userEvent.type(await screen.findByLabelText('요청 제목'), '검색')
    await waitFor(() => expect(getLocalDraft(USER, LOCAL)?.content).toMatchObject({ title: '검색' }))
  })
})
