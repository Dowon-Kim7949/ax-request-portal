/**
 * End-to-end through the real client: call() → MSW handler → engine.
 * Every response is validated against the contract by the client itself.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError, call, configureClient } from '../api/client'
import { api, type DraftContent } from '../api/contract'
import { appConfig } from '../config/app.config'
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

/** The requester confirms the AI's reading, taking its suggestion (or the first option) everywhere. */
async function confirmScope(id: number) {
  const req = await call(api.getRequest, { params: { id } })
  const choices = (req.scope?.proposal.questions ?? []).map((q) => ({
    questionId: q.id,
    optionId: q.recommended ?? q.options[0]!.id,
  }))
  return call(api.transitionRequest, { params: { id }, body: { event: 'approveScope', choices } })
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
    // The requester confirms the AI's reading before a developer spends time on it.
    const proposed = await call(api.getRequest, { params: { id } })
    expect(proposed.status).toBe('scope_check')
    expect(proposed.scope?.proposal.changes).toEqual([draft.acceptanceCriteria[0]!.text])
    expect(proposed.scope?.proposal.questions.map((q) => q.id)).toEqual(['q-extent'])

    // "Not quite": the AI writes it up again with the note.
    const revised = await call(api.transitionRequest, {
      params: { id },
      body: { event: 'reviseScope', note: '공지 본문은 검색하지 않아요' },
    })
    expect(revised.status).toBe('reporting')
    t.advance(6)
    const again = await call(api.getRequest, { params: { id } })
    expect(again.status).toBe('scope_check')
    expect(again.report?.revision).toBe(2)
    expect(again.scope?.proposal.summary).toContain('공지 본문은 검색하지 않아요')

    // Every choice must be made before going ahead.
    await expectApiError(
      call(api.transitionRequest, { params: { id }, body: { event: 'approveScope', choices: [] } }),
      409,
      'guard_failed',
    )
    const approved = await call(api.transitionRequest, {
      params: { id },
      body: {
        event: 'approveScope',
        choices: [{ questionId: 'q-extent', optionId: 'only' }],
        note: '급하지 않아요',
      },
    })
    expect(approved.status).toBe('review')
    expect(approved.scope?.decision).toMatchObject({
      by: 'u-kim',
      choices: [{ questionId: 'q-extent', optionId: 'only' }],
      note: '급하지 않아요',
    })

    await loginAs('dev1@example.com')
    expect((await call(api.listNotifications)).map((n) => n.title)).toContain(
      `[#${id}] 요청자가 진행 범위를 확인했습니다`,
    )
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
    // A new report means a new reading to confirm.
    expect((await call(api.getRequest, { params: { id } })).status).toBe('scope_check')
    const rewritten = await confirmScope(id)
    expect(rewritten.status).toBe('review')
    expect(rewritten.report?.revision).toBe(3)
    // Every project rule is checked against the plan; a reviewed wiki leaves nothing to assume.
    expect(rewritten.report?.constraintChecks.map((k) => k.constraintId)).toEqual([
      'pc-storage',
      'pc-masking',
    ])
    expect(rewritten.report?.assumptions).toEqual([])

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
        `[#${id}] 진행 범위를 확인해 주세요`,
        `[#${id}] 추가 정보가 필요합니다`,
        `[#${id}] 결과를 확인해 주세요`,
        `[#${id}] 반영되었습니다`,
      ]),
    )
    await call(api.markAllNotificationsRead)
    expect((await call(api.listNotifications)).every((n) => n.readAt)).toBe(true)
  })

  it('makes the developer confirm what the report could not before AI work starts', async () => {
    await loginAs('planner@example.com')
    const { id } = await call(api.createRequest, {
      body: { ...draft, projectId: 'p-field', targetIds: ['t-task-list', 't-push'] },
    })
    t.advance(6)
    const reviewed = await confirmScope(id)
    // "Push notifications" has no wiki doc, so the AI could only guess where its code is.
    expect(reviewed.report?.assumptions.map((a) => a.id)).toEqual(['a1'])

    await loginAs('dev2@example.com')
    await expectApiError(
      call(api.transitionRequest, { params: { id }, body: { event: 'runWork' } }),
      409,
      'guard_failed',
    )
    const started = await call(api.transitionRequest, {
      params: { id },
      body: { event: 'runWork', checkedAssumptions: ['a1'] },
    })
    expect(started.status).toBe('in_progress')
    expect(started.work?.checkedAssumptions).toEqual(['a1'])
  })

  it('lets the requester send the scope back twice, then only go ahead or cancel', async () => {
    await loginAs('planner@example.com')
    const { id } = await call(api.createRequest, { body: draft })
    for (const note of ['첫 번째', '두 번째']) {
      t.advance(6)
      await call(api.transitionRequest, { params: { id }, body: { event: 'reviseScope', note } })
    }
    t.advance(6)
    await expectApiError(
      call(api.transitionRequest, { params: { id }, body: { event: 'reviseScope', note: '세 번째' } }),
      409,
      'guard_failed',
    )
    expect((await confirmScope(id)).status).toBe('review')
  })

  it('sends a report with nothing to confirm straight to the developer', async () => {
    await loginAs('planner@example.com')
    const { id } = await call(api.createRequest, { body: { ...draft, type: 'non_code', targetIds: [] } })
    t.advance(6)
    const req = await call(api.getRequest, { params: { id } })
    expect(req.status).toBe('review')
    expect(req.scope).toBeUndefined()
  })

  it('lets the requester react to a preview before the merge, without moving the request', async () => {
    await loginAs('planner@example.com')
    const { id } = await call(api.createRequest, { body: draft })
    t.advance(6)
    await confirmScope(id)
    await loginAs('dev1@example.com')
    await call(api.transitionRequest, { params: { id }, body: { event: 'runWork' } })
    t.advance(20)

    await loginAs('planner@example.com')
    const inReview = await call(api.getRequest, { params: { id } })
    expect(inReview.status).toBe('code_review')
    expect(inReview.work?.preview?.screenshots[0]?.alt).toContain(draft.title)
    expect((await call(api.listNotifications)).map((n) => n.title)).toContain(
      `[#${id}] 바뀐 화면을 미리 볼 수 있습니다`,
    )

    // A change request needs a note.
    await expectApiError(
      call(api.sendPreviewFeedback, { params: { id }, body: { verdict: 'needs_change', note: ' ' } }),
      400,
    )
    const sent = await call(api.sendPreviewFeedback, {
      params: { id },
      body: { verdict: 'needs_change', note: '검색창을 목록 위로 올려 주세요' },
    })
    expect(sent.status).toBe('code_review')
    expect(sent.work?.previewFeedback).toMatchObject({ by: 'u-kim', verdict: 'needs_change' })

    // Only the requester reacts.
    await loginAs('dev1@example.com')
    await expectApiError(
      call(api.sendPreviewFeedback, { params: { id }, body: { verdict: 'looks_good' } }),
      403,
    )
    expect((await call(api.listNotifications)).map((n) => n.title)).toContain(
      `[#${id}] 요청자가 미리보기에서 수정을 요청했습니다`,
    )
    // A new run starts without the old reaction.
    const revised = await call(api.transitionRequest, {
      params: { id },
      body: { event: 'requestRevision', note: '검색창 위치 변경' },
    })
    expect(revised.work?.previewFeedback).toBeUndefined()
    await loginAs('planner@example.com')
    await expectApiError(
      call(api.sendPreviewFeedback, { params: { id }, body: { verdict: 'looks_good' } }),
      409,
    )
  })

  it('takes audit findings as the acceptance criteria of a checklist request', async () => {
    await loginAs('planner@example.com')
    const audit = {
      ...draft,
      type: 'checklist' as const,
      acceptanceCriteria: [],
      checklistSource: '보안 점검',
      checklist: [
        { ref: '지적 1', finding: '처리방침 링크가 없다', expected: '링크가 항상 보인다' },
        { ref: '지적 2', clause: '2.5', finding: '오류 문구가 계정 유무를 알려 준다' },
      ],
    }
    const created = await call(api.createRequest, { body: audit })
    expect(created.acceptanceCriteria).toEqual([
      { id: 'c1', text: '[지적 1] 링크가 항상 보인다' },
      { id: 'c2', text: '[지적 2] 오류 문구가 계정 유무를 알려 준다' },
    ])
    expect(created.checklist?.[1]).toMatchObject({ id: 'k2', criterionId: 'c2', clause: '2.5' })
    expect(created.checklistSource).toBe('보안 점검')

    // A checklist request needs findings; other requests need criteria and no findings.
    await expectApiError(call(api.createRequest, { body: { ...audit, checklist: [] } }), 400)
    await expectApiError(call(api.createRequest, { body: { ...draft, acceptanceCriteria: [] } }), 400)
    await expectApiError(call(api.createRequest, { body: { ...draft, checklist: audit.checklist } }), 400)
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

  it('keeps project rules with the project for the AI to respect', async () => {
    await loginAs('admin@example.com')
    const [portal] = await call(api.listProjects)
    const { id, wikiStats: _stats, ...input } = portal!
    const saved = await call(api.updateProject, {
      params: { id },
      body: { ...input, constraints: [...input.constraints, { text: '결제 금액은 서버에서만 계산한다' }] },
    })
    expect(saved.constraints).toHaveLength(3)
    expect(saved.constraints[2]).toMatchObject({ text: '결제 금액은 서버에서만 계산한다' })
    expect(saved.constraints[2]!.id).toBeTruthy()
    await expectApiError(
      call(api.updateProject, { params: { id }, body: { ...input, constraints: [{ text: ' ' }] } }),
      400,
    )
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

  it('keeps the budget screen to the operator', async () => {
    await loginAs('operator@example.com')
    const budget = await call(api.getBudget)
    expect(budget.monthlyLimitKrw).toBe(500_000)
    const updated = await call(api.updateBudget, {
      body: { monthlyLimitKrw: 300_000, perRequestLimitKrw: 10_000, alertThresholdPct: 70 },
    })
    expect(updated.monthlyLimitKrw).toBe(300_000)

    await loginAs('dev1@example.com')
    await expectApiError(call(api.getBudget), 403)
    // An organization admin manages people and projects, not the AI budget.
    await loginAs('admin@example.com')
    await expectApiError(call(api.getBudget), 403)
  })
})

describe('AI budget', () => {
  const DEFAULT_BUDGET = { monthlyLimitKrw: 500_000, perRequestLimitKrw: 20_000, alertThresholdPct: 80 }
  afterAll(async () => {
    await loginAs('operator@example.com')
    await call(api.updateBudget, { body: DEFAULT_BUDGET })
  })

  it('refuses AI work once a request has spent its per-request limit', async () => {
    await loginAs('operator@example.com')
    // The feasibility report alone costs more than 1 KRW.
    await call(api.updateBudget, { body: { ...DEFAULT_BUDGET, perRequestLimitKrw: 1 } })

    await loginAs('planner@example.com')
    const { id } = await call(api.createRequest, { body: draft })
    t.advance(6)
    // Asking for another reading is an AI job the requester chooses to repeat.
    await expectApiError(
      call(api.transitionRequest, { params: { id }, body: { event: 'reviseScope', note: '다시' } }),
      409,
      'guard_failed',
    )
    await confirmScope(id)

    await loginAs('dev1@example.com')
    await expectApiError(
      call(api.transitionRequest, { params: { id }, body: { event: 'runWork' } }),
      409,
      'guard_failed',
    )
    // Asking and rejecting stay possible: they cost nothing.
    expect((await call(api.getRequest, { params: { id } })).status).toBe('review')

    // 0 means no per-request limit.
    await loginAs('operator@example.com')
    await call(api.updateBudget, { body: { ...DEFAULT_BUDGET, perRequestLimitKrw: 0 } })
    await loginAs('dev1@example.com')
    const started = await call(api.transitionRequest, { params: { id }, body: { event: 'runWork' } })
    expect(started.status).toBe('in_progress')
  })

  it('gives the dashboard the budget alert threshold', async () => {
    await loginAs('operator@example.com')
    await call(api.updateBudget, { body: { ...DEFAULT_BUDGET, alertThresholdPct: 65 } })
    await loginAs('ceo@example.com')
    const summary = await call(api.dashboard, { query: {} })
    expect(summary.aiAlertThresholdPct).toBe(65)
  })
})

describe('AI operations', () => {
  it('books each AI job with the provider, model and agent the project uses', async () => {
    await loginAs('planner@example.com')
    const onClaude = await call(api.createRequest, { body: draft })
    const onOpenAi = await call(api.createRequest, {
      body: { ...draft, projectId: 'p-data', targetIds: ['t-report-api'] },
    })
    t.advance(6)
    await confirmScope(onClaude.id)
    await confirmScope(onOpenAi.id)

    await loginAs('dev1@example.com')
    const claude = await call(api.getRequest, { params: { id: onClaude.id } })
    expect(claude.report?.generatedBy).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' })
    const report = claude.aiUsage?.entries.find((e) => e.task === 'report')
    expect(report).toMatchObject({ provider: 'anthropic', runtime: 'api', requestId: onClaude.id })
    expect(report!.costKrw).toBeGreaterThan(0)
    expect(claude.aiUsage?.spentKrw).toBeCloseTo(report!.costKrw, 2)

    await loginAs('dev2@example.com')
    await call(api.transitionRequest, { params: { id: onOpenAi.id }, body: { event: 'runWork' } })
    t.advance(20)
    const openai = await call(api.getRequest, { params: { id: onOpenAi.id } })
    expect(openai.work?.agent).toEqual({ provider: 'openai', model: 'gpt-6.1-sol', runtime: 'codex' })
    const work = openai.aiUsage?.entries.find((e) => e.task === 'work')
    expect(work).toMatchObject({ provider: 'openai', runtime: 'codex' })
    expect(work!.tokens.cacheRead).toBeGreaterThan(work!.tokens.input)
    expect(openai.work?.costKrw).toBe(work!.costKrw)
  })

  it('shows request cost to engineering viewers only', async () => {
    await loginAs('planner@example.com')
    const mine = await call(api.listRequests, { query: { scope: 'mine' } })
    const req = await call(api.getRequest, { params: { id: mine[0]!.id } })
    expect(req.aiUsage).toBeUndefined()
  })

  it('lets the operator choose models and connect providers, keeping keys write-only', async () => {
    await loginAs('operator@example.com')
    const settings = await call(api.getAiSettings)
    expect(settings.providers.every((p) => p.connected)).toBe(true)

    const key = 'sk-test-0123456789abcd'
    const saved = await call(api.setProviderKey, { params: { provider: 'openai' }, body: { apiKey: key } })
    expect(saved).toMatchObject({ provider: 'openai', connected: true, keyHint: 'abcd' })
    expect(JSON.stringify(saved)).not.toContain(key)
    expect(JSON.stringify(await call(api.getAiSettings))).not.toContain(key)

    // A provider still in use cannot be disconnected.
    await expectApiError(call(api.removeProviderKey, { params: { provider: 'openai' } }), 409, 'guard_failed')

    // Move everything to Claude, then OpenAI can go; selecting it again is refused.
    const updated = await call(api.updateAiSettings, {
      body: { defaults: settings.defaults, projectOverrides: [] },
    })
    expect(updated.projectOverrides).toEqual([])
    await call(api.removeProviderKey, { params: { provider: 'openai' } })
    await expectApiError(
      call(api.updateAiSettings, {
        body: {
          defaults: { ...settings.defaults, report: { provider: 'openai', model: 'gpt-6.1-sol' } },
          projectOverrides: [],
        },
      }),
      400,
      'bad_request',
    )

    // Restore the seed configuration for later tests.
    await call(api.setProviderKey, { params: { provider: 'openai' }, body: { apiKey: key } })
    await call(api.updateAiSettings, {
      body: { defaults: settings.defaults, projectOverrides: settings.projectOverrides },
    })
  })

  it('keeps models in use in the price table and prices new usage only', async () => {
    await loginAs('operator@example.com')
    const pricing = await call(api.getAiPricing)
    const withoutOpus = { ...pricing, models: pricing.models.filter((m) => m.model !== 'claude-opus-5-5') }
    await expectApiError(call(api.updateAiPricing, { body: withoutOpus }), 409, 'guard_failed')

    const before = await call(api.aiUsage, { query: {} })
    const doubled = await call(api.updateAiPricing, { body: { ...pricing, usdKrw: pricing.usdKrw * 2 } })
    expect(doubled.usdKrw).toBe(pricing.usdKrw * 2)
    // Booked entries keep the rate they were booked at.
    expect((await call(api.aiUsage, { query: {} })).totalKrw).toBe(before.totalKrw)
    await call(api.updateAiPricing, { body: pricing })
  })

  it('reports usage by provider, model, task and request for the month', async () => {
    await loginAs('operator@example.com')
    const report = await call(api.aiUsage, { query: {} })
    expect(report.calls).toBeGreaterThan(0)
    expect(report.byProvider.map((p) => p.provider).sort()).toEqual(['anthropic', 'openai'])
    const sum = (rows: Array<{ costKrw: number }>) => rows.reduce((n, r) => n + r.costKrw, 0)
    // Groups are rounded separately, so allow one won per group.
    expect(Math.abs(sum(report.byProvider) - report.totalKrw)).toBeLessThanOrEqual(report.byProvider.length)
    expect(Math.abs(sum(report.byTask) - report.totalKrw)).toBeLessThanOrEqual(report.byTask.length)
    expect(report.topRequests.length).toBeLessThanOrEqual(10)
  })

  it('keeps AI operations to the operator, and the operator out of requests', async () => {
    await loginAs('admin@example.com')
    await expectApiError(call(api.getAiSettings), 403)
    await expectApiError(call(api.aiUsage, { query: {} }), 403)
    await expectApiError(
      call(api.createUser, { body: { name: 'Op', email: 'op2@example.com', role: 'operator' } }),
      403,
    )
    await expectApiError(call(api.updateUser, { params: { id: 'u-yoon' }, body: { active: false } }), 403)

    await loginAs('operator@example.com')
    await expectApiError(call(api.listRequests, { query: { scope: 'all' } }), 403)
  })
})

describe('release, regression and settings rules', () => {
  /** A new request taken to "release scheduled" without a release date. */
  async function confirmedWithoutDate() {
    await loginAs('planner@example.com')
    const { id } = await call(api.createRequest, { body: draft })
    t.advance(6)
    await confirmScope(id)
    await loginAs('dev1@example.com')
    await call(api.transitionRequest, { params: { id }, body: { event: 'runWork' } })
    t.advance(20)
    await call(api.transitionRequest, { params: { id }, body: { event: 'approveMerge' } })
    await loginAs('planner@example.com')
    await call(api.transitionRequest, {
      params: { id },
      body: { event: 'confirmResult', checks: [{ criterionId: 'c1', result: 'passed' }] },
    })
    return id
  }

  it('marks a request released only once a release date is set', async () => {
    const id = await confirmedWithoutDate()
    await loginAs('dev1@example.com')
    const refused = await call(api.transitionRequest, {
      params: { id },
      body: { event: 'markReleased' },
    }).catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(ApiError)
    expect(refused).toMatchObject({ status: 409, code: 'guard_failed' })
    expect((refused as ApiError).message).toBe('배포 예정일을 먼저 정해야 배포 완료로 바꿀 수 있습니다.')

    await call(api.updateRelease, { params: { id }, body: { scheduledDate: '2026-11-03' } })
    const done = await call(api.transitionRequest, { params: { id }, body: { event: 'markReleased' } })
    expect(done.status).toBe('done')
    expect(done.release?.scheduledDate).toBe('2026-11-03')
  })

  it('keeps the regression checks of a closed request as they were', async () => {
    await loginAs('dev1@example.com')
    const shipped = await call(api.getRequest, { params: { id: 1012 } })
    expect(shipped.status).toBe('done')
    const before = shipped.regression
    await expectApiError(
      call(api.updateRegression, {
        params: { id: 1012 },
        body: { checks: before.map((c) => ({ id: c.id, result: 'failed' as const })) },
      }),
      409,
      'invalid_transition',
    )
    expect((await call(api.getRequest, { params: { id: 1012 } })).regression).toEqual(before)
  })

  it('gives a person without saved notification settings the defaults', async () => {
    await loginAs('admin@example.com')
    const invited = await call(api.createUser, {
      body: { name: '설정없음', email: 'no-settings@example.com', role: 'requester' },
    })
    await loginAs(invited.email)
    expect(await call(api.getNotificationSettings)).toEqual({
      inApp: true,
      email: true,
      messenger: false,
      onlyActionRequired: false,
    })
  })

  it('validates budget limits and months like the screens do', async () => {
    await loginAs('operator@example.com')
    await expectApiError(
      call(api.updateBudget, {
        body: { monthlyLimitKrw: 100_000, perRequestLimitKrw: 200_000, alertThresholdPct: 80 },
      }),
      400,
      'bad_request',
    )
    await expectApiError(
      call(api.updateBudget, {
        body: { monthlyLimitKrw: 1e13, perRequestLimitKrw: 0, alertThresholdPct: 80 },
      }),
      400,
      'bad_request',
    )
    await expectApiError(call(api.aiUsage, { query: { month: '2026-13' } }), 400, 'bad_request')
    expect((await call(api.aiUsage, { query: { month: '2026-10' } })).month).toBe('2026-10')
  })
})

describe('saved drafts', () => {
  const content: DraftContent = {
    projectId: 'p-portal',
    type: 'change',
    title: '  공지사항 검색  ',
    desiredBehavior: '',
    acceptanceCriteria: [{ text: '' }],
  }

  /** An upload of `userId`'s, put straight into the store (uploads have their own tests). */
  function uploadAs(userId: string) {
    const user = t.store.engine.user(userId)!
    return t.store.engine.addAttachment(user, {
      name: 'screen.png',
      size: 4,
      type: 'image/png',
      url: 'https://files.example.com/screen.png',
    })
  }

  it('saves a half-written request and keeps it to its owner', async () => {
    await loginAs('planner@example.com')
    const created = await call(api.createDraft, { body: { step: 3, content } })
    expect(created).toMatchObject({
      title: '공지사항 검색',
      projectId: 'p-portal',
      type: 'change',
      step: 3,
      version: 1,
      attachmentCount: 0,
      attachments: [],
      content,
    })
    expect(created.createdAt).toBe(created.updatedAt)
    expect(await call(api.getDraft, { params: { id: created.id } })).toEqual(created)
    const { content: _content, attachments: _attachments, ...summary } = created
    expect((await call(api.listDrafts)).find((d) => d.id === created.id)).toEqual(summary)

    // Nothing picked or written yet is a draft too.
    const blank = await call(api.createDraft, { body: { step: 0, content: {} } })
    expect(blank).toMatchObject({ title: '', step: 0, content: {} })
    expect(blank).not.toHaveProperty('projectId')
    expect(blank).not.toHaveProperty('type')

    // Someone else's draft is "not found", whatever they try.
    await loginAs('sales@example.com')
    expect((await call(api.listDrafts)).map((d) => d.id)).not.toContain(created.id)
    const id = created.id
    await expectApiError(call(api.getDraft, { params: { id } }), 404, 'not_found')
    await expectApiError(
      call(api.updateDraft, { params: { id }, body: { baseVersion: 1, step: 0, content: {} } }),
      404,
      'not_found',
    )
    await expectApiError(call(api.deleteDraft, { params: { id } }), 404, 'not_found')

    await loginAs('planner@example.com')
    expect((await call(api.getDraft, { params: { id } })).version).toBe(1)
    await call(api.deleteDraft, { params: { id } })
    await call(api.deleteDraft, { params: { id: blank.id } })
    // Gone: a second delete is "not found", which the client takes as done.
    await expectApiError(call(api.deleteDraft, { params: { id } }), 404, 'not_found')
    await expectApiError(call(api.getDraft, { params: { id } }), 404, 'not_found')
  })

  it('refuses an update based on a version that has been saved over', async () => {
    await loginAs('planner@example.com')
    const { id } = await call(api.createDraft, { body: { step: 1, content } })
    t.advance(1)
    // This device saves first…
    const phone = await call(api.updateDraft, {
      params: { id },
      body: { baseVersion: 1, step: 4, content: { ...content, title: '휴대폰에서 고친 제목' } },
    })
    expect(phone).toMatchObject({ version: 2, step: 4, title: '휴대폰에서 고친 제목' })
    expect(Date.parse(phone.updatedAt)).toBeGreaterThan(Date.parse(phone.createdAt))

    // …so another device still on version 1 is refused, and nothing changes.
    const refused = await call(api.updateDraft, {
      params: { id },
      body: { baseVersion: 1, step: 2, content: { ...content, title: 'PC에서 고친 제목' } },
    }).catch((e: unknown) => e)
    expect(refused).toMatchObject({ status: 409, code: 'conflict' })
    expect((refused as ApiError).message).toBe(
      '이 초안이 다른 곳에서 먼저 저장되었습니다. 저장된 내용을 불러오거나 이 화면 내용으로 다시 저장해 주세요.',
    )
    expect(await call(api.getDraft, { params: { id } })).toEqual(phone)

    // Based on the latest version, the same change goes through.
    const pc = await call(api.updateDraft, {
      params: { id },
      body: { baseVersion: 2, step: 2, content: { ...content, title: 'PC에서 고친 제목' } },
    })
    expect(pc).toMatchObject({ version: 3, step: 2, title: 'PC에서 고친 제목' })
    await call(api.deleteDraft, { params: { id } })
  })

  it('lists the most recently changed first', async () => {
    await loginAs('planner@example.com')
    const first = await call(api.createDraft, { body: { step: 0, content: { title: '첫 번째' } } })
    const second = await call(api.createDraft, { body: { step: 0, content: { title: '두 번째' } } })
    expect((await call(api.listDrafts)).slice(0, 2).map((d) => d.id)).toEqual([second.id, first.id])

    // Changed in the same moment as the other was created: the later change still comes first.
    await call(api.updateDraft, {
      params: { id: first.id },
      body: { baseVersion: 1, step: 1, content: { title: '첫 번째, 고침' } },
    })
    expect((await call(api.listDrafts)).slice(0, 2).map((d) => d.id)).toEqual([first.id, second.id])
    t.advance(1)
    await call(api.updateDraft, {
      params: { id: second.id },
      body: { baseVersion: 1, step: 1, content: { title: '두 번째, 고침' } },
    })
    expect((await call(api.listDrafts)).slice(0, 2).map((d) => d.id)).toEqual([second.id, first.id])

    await call(api.deleteDraft, { params: { id: first.id } })
    await call(api.deleteDraft, { params: { id: second.id } })
  })

  it("holds the person's own uploads and names any other attachment it cannot take", async () => {
    await loginAs('planner@example.com')
    const mine = uploadAs('u-kim')
    const theirs = uploadAs('u-lee')

    const refused = await call(api.createDraft, {
      body: { step: 5, content: { attachmentIds: [mine.id, theirs.id, 'att-gone'] } },
    }).catch((e: unknown) => e)
    expect(refused).toMatchObject({ status: 400, code: 'bad_request' })
    expect((refused as ApiError).issues?.map((i) => i.path)).toEqual([
      'content.attachmentIds.1',
      'content.attachmentIds.2',
    ])

    const saved = await call(api.createDraft, {
      body: { step: 5, content: { attachmentIds: [mine.id, mine.id] } },
    })
    expect(saved.attachments).toEqual([mine])
    expect(saved.attachmentCount).toBe(1)
    expect(saved.attachments[0]).not.toHaveProperty('ownerId')
    expect((await call(api.listDrafts)).find((d) => d.id === saved.id)?.attachmentCount).toBe(1)

    // An update is checked the same way.
    const id = saved.id
    const err = await call(api.updateDraft, {
      params: { id },
      body: { baseVersion: 1, step: 5, content: { attachmentIds: [theirs.id] } },
    }).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 400 })
    expect((err as ApiError).issues?.map((i) => i.path)).toEqual(['content.attachmentIds.0'])
    await call(api.deleteDraft, { params: { id } })
  })

  it('takes a loose draft but refuses steps and sizes beyond the contract', async () => {
    await loginAs('planner@example.com')
    for (const step of [-1, 7, 1.5]) {
      await expectApiError(call(api.createDraft, { body: { step, content: {} } }), 400, 'bad_request')
    }
    await expectApiError(
      call(api.createDraft, { body: { step: 0, content: { title: 'x'.repeat(10_001) } } }),
      400,
      'bad_request',
    )
    await expectApiError(
      call(api.createDraft, {
        body: { step: 0, content: { targetIds: Array.from({ length: 51 }, (_, i) => `t-${i}`) } },
      }),
      400,
      'bad_request',
    )
  })

  it('stops at the per-account limit, for that account only', async () => {
    const limit = appConfig.drafts.maxPerAccount
    await loginAs('planner@example.com')
    const before = (await call(api.listDrafts)).length
    const made: string[] = []
    for (let i = before; i < limit; i++) {
      made.push((await call(api.createDraft, { body: { step: 0, content: { title: `초안 ${i}` } } })).id)
    }
    expect(await call(api.listDrafts)).toHaveLength(limit)

    const refused = await call(api.createDraft, { body: { step: 0, content: {} } }).catch((e: unknown) => e)
    expect(refused).toMatchObject({ status: 409, code: 'limit_reached' })
    expect((refused as ApiError).message).toBe(
      `임시 저장함이 가득 찼습니다(최대 ${limit}개). 다른 초안을 지우면 저장할 수 있습니다.`,
    )
    // Updating one that exists is still fine.
    await call(api.updateDraft, {
      params: { id: made[0]! },
      body: { baseVersion: 1, step: 1, content: { title: '고침' } },
    })

    // Someone else's account has room of its own.
    await loginAs('sales@example.com')
    const theirs = await call(api.createDraft, { body: { step: 0, content: {} } })
    await call(api.deleteDraft, { params: { id: theirs.id } })

    // Deleting one makes room again.
    await loginAs('planner@example.com')
    await call(api.deleteDraft, { params: { id: made.pop()! } })
    made.push((await call(api.createDraft, { body: { step: 0, content: {} } })).id)
    for (const id of made) await call(api.deleteDraft, { params: { id } })
  })

  it('deletes the draft a request was written in, together with the submission', async () => {
    await loginAs('sales@example.com')
    const theirs = await call(api.createDraft, { body: { step: 6, content: {} } })

    await loginAs('planner@example.com')
    const mine = await call(api.createDraft, { body: { step: 6, content: {} } })
    const kept = await call(api.createDraft, { body: { step: 6, content: {} } })
    await call(api.createRequest, { body: { ...draft, draftId: mine.id } })
    const left = (await call(api.listDrafts)).map((d) => d.id)
    expect(left).not.toContain(mine.id)
    expect(left).toContain(kept.id)

    // A refused submission leaves the draft as it was.
    await expectApiError(
      call(api.createRequest, { body: { ...draft, attachmentIds: ['att-gone'], draftId: kept.id } }),
      400,
    )
    expect((await call(api.getDraft, { params: { id: kept.id } })).version).toBe(1)

    // A draft that is gone, or someone else's, does not stop the submission, and theirs stays.
    await call(api.createRequest, { body: { ...draft, draftId: mine.id } })
    await call(api.createRequest, { body: { ...draft, draftId: theirs.id } })
    await loginAs('sales@example.com')
    expect((await call(api.listDrafts)).map((d) => d.id)).toContain(theirs.id)

    await call(api.deleteDraft, { params: { id: theirs.id } })
    await loginAs('planner@example.com')
    await call(api.deleteDraft, { params: { id: kept.id } })
  })

  it('keeps drafts to people who may file requests', async () => {
    await loginAs('operator@example.com')
    await expectApiError(call(api.listDrafts), 403, 'forbidden')
    await expectApiError(call(api.createDraft, { body: { step: 0, content: {} } }), 403, 'forbidden')
    // Developers file requests too.
    await loginAs('dev1@example.com')
    expect(await call(api.listDrafts)).toEqual([])
  })
})

describe('demo data language', () => {
  it('keeps read marks when the language changes', async () => {
    await loginAs('planner@example.com')
    t.store.engine.state.dirty = false
    await call(api.markAllNotificationsRead)
    // Marked as a person's change, so a language switch no longer rebuilds the demo data.
    expect(t.store.engine.state.dirty).toBe(true)
  })

  it('keeps saved drafts when the language changes', async () => {
    await loginAs('planner@example.com')
    t.store.engine.state.dirty = false
    const { id } = await call(api.createDraft, { body: { step: 0, content: { title: '언어를 바꿔도' } } })
    expect(t.store.engine.state.dirty).toBe(true)
    await call(api.deleteDraft, { params: { id } })
  })
})
