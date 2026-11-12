import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CriterionCheck, Notification, RequestDraft, WorkRequest } from '@/domain/model'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { call } from './client'
import { api, type SavedDraft, type SavedDraftSummary } from './contract'
import {
  keys,
  storeSavedDraft,
  useCreateRequest,
  useDeleteDraft,
  useDrafts,
  useMarkNotificationRead,
  useSaveVerification,
  useUpdateUser,
} from './queries'

const t = createTestApi()
const IN_VERIFICATION = 1021 // the requester's request waiting for the acceptance check

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  await signInAs('u-kim')
})
afterEach(() => t.server.resetHandlers())
afterAll(() => t.server.close())

function setup() {
  const qc = testQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

async function primeRequest(qc: QueryClient, patch: Partial<WorkRequest> = {}) {
  const req = { ...(await call(api.getRequest, { params: { id: IN_VERIFICATION } })), ...patch }
  qc.setQueryData(keys.request(req.id), req)
  return req
}

const checks = (req: WorkRequest, result: CriterionCheck['result']): CriterionCheck[] =>
  req.acceptanceCriteria.map((c) => ({ criterionId: c.id, result }))

describe('saving the acceptance checklist', () => {
  it('sends the saves in order, keeps the last one, and refreshes the lists', async () => {
    const { qc, wrapper } = setup()
    const req = await primeRequest(qc)
    qc.setQueryData(keys.requestList({ scope: 'mine' }), [])

    // The first save is slow; sent side by side, the second would land first and be overwritten.
    const received: string[] = []
    t.server.use(
      http.put('*/api/requests/:id/verification', async ({ request }) => {
        const body = (await request.clone().json()) as { checks: CriterionCheck[] }
        received.push(body.checks[0]!.result)
        if (received.length === 1) await delay(50)
      }),
    )

    const { result } = renderHook(() => useSaveVerification(req.id), { wrapper })
    result.current.mutate({ checks: checks(req, 'passed') })
    result.current.mutate({ checks: checks(req, 'failed') })

    await waitFor(() => expect(qc.isMutating()).toBe(0))
    expect(received).toEqual(['passed', 'failed'])
    const allFailed = req.acceptanceCriteria.map(() => 'failed')
    // The server applied them in order…
    const stored = await call(api.getRequest, { params: { id: req.id } })
    expect(stored.verification.map((c) => c.result)).toEqual(allFailed)
    // …and the screen's copy is the last answer.
    const cached = qc.getQueryData<WorkRequest>(keys.request(req.id))
    expect(cached?.verification.map((c) => c.result)).toEqual(allFailed)
    expect(qc.getQueryState(keys.requestList({ scope: 'mine' }))?.isInvalidated).toBe(true)
  })

  it('does not let a late answer replace a newer copy of the request', async () => {
    const { qc, wrapper } = setup()
    const newer = await primeRequest(qc, {
      updatedAt: '2099-01-01T00:00:00.000Z',
      status: 'release_scheduled',
    })

    const { result } = renderHook(() => useSaveVerification(newer.id), { wrapper })
    result.current.mutate({ checks: checks(newer, 'passed') })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(qc.getQueryData<WorkRequest>(keys.request(newer.id))).toMatchObject({
      updatedAt: '2099-01-01T00:00:00.000Z',
      status: 'release_scheduled',
    })
  })
})

describe('changing a user', () => {
  it('refreshes the signed-in user’s own copy only when they changed themselves', async () => {
    const admin = await signInAs('u-han')
    const { qc, wrapper } = setup()
    qc.setQueryData(keys.me(), admin)
    const { result } = renderHook(() => useUpdateUser(), { wrapper })

    result.current.mutate({ id: 'u-kim', body: { teamId: 't-sales' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryState(keys.me())?.isInvalidated).toBe(false)

    result.current.mutate({ id: admin.id, body: { teamId: 't-platform' } })
    await waitFor(() => expect(result.current.variables?.id).toBe(admin.id))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryState(keys.me())?.isInvalidated).toBe(true)
  })
})

describe('marking a notification read', () => {
  it('shows it read at once and puts it back when the server refuses', async () => {
    const { qc, wrapper } = setup()
    const unread: Notification = {
      id: 'n-test',
      title: '확인이 필요해요',
      body: '요청 #1021',
      createdAt: '2026-11-02T00:00:00.000Z',
    }
    const read: Notification = { ...unread, id: 'n-old', readAt: '2026-11-01T00:00:00.000Z' }
    qc.setQueryData(keys.notifications(), [unread, read])

    let refuse!: () => void
    const refused = new Promise<void>((resolve) => (refuse = resolve))
    t.server.use(
      http.post('*/api/notifications/:id/read', async () => {
        await refused
        return HttpResponse.json({ code: 'internal', message: 'try later' }, { status: 500 })
      }),
    )
    const onError = vi.fn()
    const { result } = renderHook(() => useMarkNotificationRead({ onError }), { wrapper })

    result.current.mutate('n-test')
    await waitFor(() =>
      expect(qc.getQueryData<Notification[]>(keys.notifications())?.[0]?.readAt).toBeTruthy(),
    )

    refuse()
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
    const list = qc.getQueryData<Notification[]>(keys.notifications())
    expect(list?.[0]?.readAt).toBeUndefined()
    expect(list?.[1]?.readAt).toBe('2026-11-01T00:00:00.000Z')
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ status: 500, message: 'try later' })
  })
})

describe('saved drafts', () => {
  /** The list as the screen last read it, so a test can see it change in the cache. */
  async function primeList(qc: QueryClient): Promise<SavedDraftSummary[]> {
    const list = await call(api.listDrafts)
    qc.setQueryData(keys.drafts(), list)
    return list
  }

  it('reads the list under its own key', async () => {
    const saved = await call(api.createDraft, { body: { step: 2, content: { title: '목록' } } })
    const { wrapper } = setup()
    const list = renderHook(() => useDrafts(), { wrapper })
    await waitFor(() => expect(list.result.current.data?.[0]?.id).toBe(saved.id))
    await call(api.deleteDraft, { params: { id: saved.id } })
  })

  it('keeps a saved draft as the open copy, lists it at once and reads the list again', async () => {
    const { qc } = setup()
    await primeList(qc)
    const saved = await call(api.createDraft, { body: { step: 1, content: { title: '새 초안' } } })
    storeSavedDraft(qc, saved)

    expect(qc.getQueryData<SavedDraft>(keys.draft(saved.id))).toEqual(saved)
    // In the list before it is read again (the sync deletes this device's copy in the same moment).
    const { content: _content, attachments: _attachments, ...summary } = saved
    expect(qc.getQueryData<SavedDraftSummary[]>(keys.drafts())?.[0]).toEqual(summary)
    expect(qc.getQueryState(keys.drafts())?.isInvalidated).toBe(true)
    await call(api.deleteDraft, { params: { id: saved.id } })
  })

  it('takes a draft that is already gone as deleted, and drops it from the list at once', async () => {
    const saved = await call(api.createDraft, { body: { step: 0, content: { title: '지울 초안' } } })
    const { qc, wrapper } = setup()
    expect((await primeList(qc)).map((d) => d.id)).toContain(saved.id)
    qc.setQueryData(keys.draft(saved.id), saved)

    const { result } = renderHook(() => useDeleteDraft(), { wrapper })
    result.current.mutate(saved.id)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryData<SavedDraftSummary[]>(keys.drafts())?.map((d) => d.id)).not.toContain(saved.id)
    expect(qc.getQueryData(keys.draft(saved.id))).toBeUndefined()

    // Deleted on another device meanwhile: still a success.
    result.current.mutate(saved.id)
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isSuccess).toBe(true)
  })

  it('still reports a delete that failed for another reason', async () => {
    const { wrapper } = setup()
    t.server.use(
      http.delete('*/api/drafts/:id', () =>
        HttpResponse.json({ code: 'internal', message: 'try later' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useDeleteDraft(), { wrapper })
    result.current.mutate('draft-any')
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 500 })
  })

  it('submits with the draft it was written in, which then leaves the list', async () => {
    const saved = await call(api.createDraft, { body: { step: 6, content: { title: '제출할 초안' } } })
    const { qc, wrapper } = setup()
    await primeList(qc)
    qc.setQueryData(keys.draft(saved.id), saved)

    const body: RequestDraft = {
      projectId: 'p-portal',
      type: 'change',
      title: '공지사항 검색 추가',
      targetIds: ['t-notice'],
      currentBehavior: '',
      desiredBehavior: '제목으로 공지를 검색한다',
      acceptanceCriteria: [{ text: '검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다' }],
      attachmentIds: [],
    }
    const { result } = renderHook(() => useCreateRequest(), { wrapper })
    result.current.mutate({ ...body, draftId: saved.id })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(qc.getQueryData<SavedDraftSummary[]>(keys.drafts())?.map((d) => d.id)).not.toContain(saved.id)
    expect(qc.getQueryData(keys.draft(saved.id))).toBeUndefined()
    expect(qc.getQueryState(keys.drafts())?.isInvalidated).toBe(true)
    // The server deleted it with the submission.
    expect((await call(api.listDrafts)).map((d) => d.id)).not.toContain(saved.id)
  })
})
