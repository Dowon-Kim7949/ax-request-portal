import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CriterionCheck, Notification, WorkRequest } from '@/domain/model'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { call } from './client'
import { api } from './contract'
import { keys, useMarkNotificationRead, useSaveVerification, useUpdateUser } from './queries'

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

    result.current.mutate({ id: 'u-kim', body: { team: '전략기획팀' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(qc.getQueryState(keys.me())?.isInvalidated).toBe(false)

    result.current.mutate({ id: admin.id, body: { team: '플랫폼운영팀' } })
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
