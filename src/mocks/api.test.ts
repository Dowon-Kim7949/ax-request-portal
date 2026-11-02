/**
 * End-to-end through the real client: call() → MSW handler → engine.
 * Every response is validated against the contract by the client itself.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError, call, configureClient } from '../api/client'
import { api } from '../api/contract'
import type { RequestDraft } from '../domain/model'
import { createTestApi } from '../test/mock-api'
import { DEMO_PASSWORD } from './seed'

const t = createTestApi()
let token: string | null = null
configureClient({ getToken: () => token, onUnauthorized: () => {} })

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => t.server.close())
beforeEach(() => {
  token = null
})

async function loginAs(email: string) {
  const session = await call(api.login, { body: { email, password: DEMO_PASSWORD } })
  token = session.token
  return session.user
}

const draft: RequestDraft = {
  projectId: 'p-portal',
  type: 'change',
  title: '공지사항 검색 추가',
  targetIds: ['t-notice'],
  currentBehavior: '공지가 많아 찾기 어렵다',
  desiredBehavior: '제목으로 공지를 검색한다',
  acceptanceCriteria: [{ text: '검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다' }],
  attachmentIds: [],
}

async function expectApiError(promise: Promise<unknown>, status: number, code?: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ApiError)
  expect((err as ApiError).status).toBe(status)
  if (code) expect((err as ApiError).code).toBe(code)
}

describe('auth', () => {
  it('rejects a wrong password and unauthenticated calls', async () => {
    await expectApiError(call(api.login, { body: { email: 'planner@example.com', password: 'nope' } }), 401)
    await expectApiError(call(api.me), 401, 'unauthorized')
  })

  it('returns the signed-in user', async () => {
    const user = await loginAs('planner@example.com')
    expect(await call(api.me)).toEqual(user)
  })
})

describe('request lifecycle through the API', () => {
  it('runs a request from submission to release', async () => {
    await loginAs('planner@example.com')
    const { issues } = await call(api.precheckRequest, {
      body: { ...draft, desiredBehavior: '좀 편하게 해 주세요' },
    })
    expect(issues.some((i) => i.field === 'desiredBehavior')).toBe(true)

    const created = await call(api.createRequest, { body: draft })
    const id = created.id
    expect(created.status).toBe('reporting')
    expect(created.assigneeId).toBe('u-choi')

    // The requester cannot start work.
    await expectApiError(call(api.transitionRequest, { params: { id }, body: { event: 'runWork' } }), 403)

    t.advance(6)
    expect((await call(api.getRequest, { params: { id } })).status).toBe('review')

    await loginAs('dev1@example.com')
    const assigned = await call(api.listRequests, { query: { scope: 'assigned', status: 'review' } })
    expect(assigned.map((r) => r.id)).toContain(id)
    const asked = await call(api.transitionRequest, {
      params: { id },
      body: { event: 'requestInfo', questions: ['첨부파일 이름도 검색해야 하나요?'] },
    })
    expect(asked.status).toBe('info_needed')

    await loginAs('planner@example.com')
    await call(api.transitionRequest, {
      params: { id },
      body: { event: 'provideInfo', answer: '제목만 검색합니다.' },
    })
    t.advance(6)
    const rewritten = await call(api.getRequest, { params: { id } })
    expect(rewritten.status).toBe('review')
    expect(rewritten.report?.revision).toBe(2)

    await loginAs('dev1@example.com')
    await call(api.transitionRequest, {
      params: { id },
      body: { event: 'runWork', instructions: '기존 목록 정렬 유지' },
    })
    t.advance(8)
    expect((await call(api.getRequest, { params: { id } })).work?.phase).toBe('editing')
    t.advance(12)
    const reviewed = await call(api.getRequest, { params: { id } })
    expect(reviewed.status).toBe('code_review')
    expect(reviewed.work?.mergeRequest?.url).toMatch(/merge_requests/)
    expect(reviewed.work?.wikiChanges?.pendingReview).toBe(true)

    await call(api.updateRelease, { params: { id }, body: { scheduledDate: '2026-11-06' } })
    await call(api.transitionRequest, { params: { id }, body: { event: 'approveMerge' } })

    await loginAs('planner@example.com')
    const saved = await call(api.saveVerification, {
      params: { id },
      body: { checks: [{ criterionId: 'c1', result: 'passed' }] },
    })
    expect(saved.status).toBe('verification')
    await expectApiError(
      call(api.transitionRequest, {
        params: { id },
        body: { event: 'confirmResult', checks: [{ criterionId: 'c1', result: 'failed' }] },
      }),
      409,
      'guard_failed',
    )
    const confirmed = await call(api.transitionRequest, {
      params: { id },
      body: { event: 'confirmResult', checks: [{ criterionId: 'c1', result: 'passed' }] },
    })
    expect(confirmed.status).toBe('release_scheduled')
    expect(confirmed.release?.scheduledDate).toBe('2026-11-06')

    await loginAs('dev1@example.com')
    const done = await call(api.transitionRequest, { params: { id }, body: { event: 'markReleased' } })
    expect(done.status).toBe('done')

    await loginAs('planner@example.com')
    const notes = await call(api.listNotifications)
    expect(notes.filter((n) => n.requestId === id).map((n) => n.title)).toEqual(
      expect.arrayContaining([
        `[#${id}] 추가 정보가 필요합니다`,
        `[#${id}] 결과를 확인해 주세요`,
        `[#${id}] 반영되었습니다`,
      ]),
    )
    await call(api.markAllNotificationsRead)
    expect((await call(api.listNotifications)).every((n) => n.readAt)).toBe(true)
  })

  it('refuses transitions that do not fit the current status', async () => {
    await loginAs('dev1@example.com')
    await expectApiError(
      call(api.transitionRequest, { params: { id: 1012 }, body: { event: 'approveMerge' } }),
      409,
      'invalid_transition',
    )
  })

  it('validates request bodies against the contract', async () => {
    await loginAs('planner@example.com')
    const err = await call(api.createRequest, { body: { ...draft, acceptanceCriteria: [] } }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(400)
    expect((err as ApiError).issues?.[0]?.path).toBe('acceptanceCriteria')
  })
})

describe('visibility and permissions', () => {
  it('hides other people’s requests from requesters', async () => {
    await loginAs('sales@example.com')
    await expectApiError(call(api.getRequest, { params: { id: 1024 } }), 404)
    await expectApiError(call(api.listRequests, { query: { scope: 'all' } }), 403)
    const mine = await call(api.listRequests, { query: { scope: 'mine' } })
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((r) => r.requesterId === 'u-lee')).toBe(true)
  })

  it('opens the dashboard to executives only', async () => {
    await loginAs('ceo@example.com')
    const summary = await call(api.dashboard, { query: {} })
    expect(summary.received).toBeGreaterThan(0)
    expect((await call(api.listRequests, { query: { scope: 'all' } })).length).toBeGreaterThan(20)

    await loginAs('planner@example.com')
    await expectApiError(call(api.dashboard, { query: {} }), 403, 'forbidden')
  })

  it('lets admins manage users but not demote themselves', async () => {
    await loginAs('admin@example.com')
    const created = await call(api.createUser, {
      body: { name: '신규요청자', email: 'new@example.com', role: 'requester' },
    })
    const promoted = await call(api.updateUser, { params: { id: created.id }, body: { role: 'developer' } })
    expect(promoted.role).toBe('developer')
    await expectApiError(call(api.updateUser, { params: { id: 'u-han' }, body: { role: 'requester' } }), 400)
  })

  it('keeps the budget screen to budget managers', async () => {
    await loginAs('admin@example.com')
    const budget = await call(api.getBudget)
    expect(budget.monthlyLimitKrw).toBe(500_000)
    const updated = await call(api.updateBudget, {
      body: { monthlyLimitKrw: 300_000, perRequestLimitKrw: 10_000, alertThresholdPct: 70 },
    })
    expect(updated.monthlyLimitKrw).toBe(300_000)

    await loginAs('dev1@example.com')
    await expectApiError(call(api.getBudget), 403)
  })
})
