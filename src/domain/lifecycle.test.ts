import { describe, expect, it } from 'vitest'
import { people, project, report, request } from './fixtures'
import {
  applyTransition,
  availableEvents,
  canTransition,
  isAuthorized,
  isTerminal,
  LifecycleError,
  releaseDateMissing,
  requesterStatusOf,
  scopeRevisionsLeft,
  stageOf,
  TERMINAL_STATUSES,
  TRANSITIONS,
  turnOf,
  USER_EVENTS,
  type LifecycleEvent,
} from './lifecycle'
import { RequestStatus, type User, type WorkRequest } from './model'

const ALL_STATUSES = RequestStatus.options
const ALL_EVENTS = Object.keys(TRANSITIONS) as LifecycleEvent[]

let seq = 0
const opts = (actor: User | 'ai' | 'system' = 'system') => ({
  actor:
    actor === 'ai'
      ? ({ type: 'ai' } as const)
      : actor === 'system'
        ? ({ type: 'system' } as const)
        : ({ type: 'user', userId: actor.id } as const),
  now: new Date(Date.UTC(2026, 9, 27, 2, seq)),
  newId: () => `t${++seq}`,
})

const ctx = (u: User, r: WorkRequest) => ({ user: u, request: r, project })

describe('transition table', () => {
  it('reaches every status from submitted', () => {
    const seen = new Set<string>(['submitted'])
    const queue: string[] = ['submitted']
    while (queue.length) {
      const s = queue.shift()!
      for (const rule of Object.values(TRANSITIONS)) {
        if ((rule.from as readonly string[]).includes(s) && !seen.has(rule.to)) {
          seen.add(rule.to)
          queue.push(rule.to)
        }
      }
    }
    expect([...seen].sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('has no dead ends: every open status can move, terminal statuses cannot', () => {
    for (const status of ALL_STATUSES) {
      const outgoing = ALL_EVENTS.filter((e) => canTransition(status, e))
      if (isTerminal(status)) expect(outgoing, status).toEqual([])
      else expect(outgoing.length, status).toBeGreaterThan(0)
    }
    expect(TERMINAL_STATUSES).toEqual(['done', 'rejected', 'cancelled'])
  })

  it('maps every status to a turn, a requester label and a stage', () => {
    for (const status of ALL_STATUSES) {
      expect(turnOf(status), status).toBeDefined()
      expect(requesterStatusOf(status), status).toBeDefined()
      expect(stageOf(status) !== undefined, status).toBe(true)
    }
    expect(stageOf('cancelled')).toBeNull()
    expect(turnOf('info_needed')).toBe('requester')
    expect(turnOf('verification')).toBe('requester')
    expect(turnOf('code_review')).toBe('developer')
  })

  it('collapses technical states into plain-language requester labels', () => {
    expect(['submitted', 'reporting', 'review'].map((s) => requesterStatusOf(s as never))).toEqual([
      'reviewing',
      'reviewing',
      'reviewing',
    ])
    expect(requesterStatusOf('scope_check')).toBe('confirm_scope')
    expect(turnOf('scope_check')).toBe('requester')
    expect(stageOf('scope_check')).toBe('review')
    expect(requesterStatusOf('code_review')).toBe('working')
    expect(requesterStatusOf('verification')).toBe('please_check')
  })

  it('exposes only human events to clients', () => {
    expect([...USER_EVENTS].sort()).toEqual(
      ALL_EVENTS.filter(
        (e) => !['startReport', 'reportReady', 'scopeReady', 'workFinished'].includes(e),
      ).sort(),
    )
  })
})

describe('authorization', () => {
  it('lets only the requester answer, verify and withdraw (admin may withdraw)', () => {
    for (const event of [
      'provideInfo',
      'approveScope',
      'reviseScope',
      'reportIssue',
      'confirmResult',
      'cancel',
    ] as const) {
      const r = request(TRANSITIONS[event].from[0])
      expect(isAuthorized(event, ctx(people.requester, r)), event).toBe(true)
      expect(isAuthorized(event, ctx(people.otherRequester, r)), event).toBe(false)
      expect(isAuthorized(event, ctx(people.owner, r)), event).toBe(false)
      expect(isAuthorized(event, ctx(people.admin, r)), event).toBe(event === 'cancel')
    }
  })

  it('lets only responsible developers (owner, assignee, admin) act as developer', () => {
    const r = request('review')
    expect(isAuthorized('runWork', ctx(people.owner, r))).toBe(true)
    expect(isAuthorized('runWork', ctx(people.admin, r))).toBe(true)
    expect(isAuthorized('runWork', ctx(people.otherDeveloper, r))).toBe(false)
    expect(
      isAuthorized('runWork', ctx(people.otherDeveloper, request('review', { assigneeId: 'dev2' }))),
    ).toBe(true)
    expect(isAuthorized('runWork', ctx(people.executive, r))).toBe(false)
    expect(isAuthorized('runWork', ctx(people.requester, r))).toBe(false)
  })

  it('never lets a person trigger AI or system events', () => {
    for (const event of ['startReport', 'reportReady', 'scopeReady', 'workFinished'] as const) {
      expect(isAuthorized(event, ctx(people.admin, request(TRANSITIONS[event].from[0])))).toBe(false)
    }
  })

  it('lists the buttons each person sees', () => {
    expect(availableEvents(ctx(people.owner, request('review')))).toEqual([
      'requestInfo',
      'reject',
      'runWork',
    ])
    expect(availableEvents(ctx(people.requester, request('review')))).toEqual(['cancel'])
    expect(availableEvents(ctx(people.requester, request('scope_check')))).toEqual([
      'approveScope',
      'reviseScope',
      'cancel',
    ])
    expect(availableEvents(ctx(people.owner, request('scope_check')))).toEqual([])
    expect(availableEvents(ctx(people.requester, request('verification')))).toEqual([
      'reportIssue',
      'confirmResult',
    ])
    expect(availableEvents(ctx(people.executive, request('verification')))).toEqual([])
    expect(availableEvents(ctx(people.owner, request('done')))).toEqual([])
  })
})

describe('applyTransition', () => {
  it('walks the happy path and records every step in the timeline', () => {
    let r = request('submitted')
    r = applyTransition(r, { event: 'startReport' }, opts('system'))
    r = applyTransition(r, { event: 'reportReady' }, opts('ai'))
    r = applyTransition(
      r,
      { event: 'runWork', instructions: '기존 잠금 정책은 건드리지 말 것' },
      opts(people.owner),
    )
    expect(r.work).toMatchObject({
      attempt: 1,
      phase: 'queued',
      instructions: '기존 잠금 정책은 건드리지 말 것',
    })

    r = applyTransition(r, { event: 'workFinished' }, opts('ai'))
    r = applyTransition(r, { event: 'approveMerge' }, opts(people.owner))
    expect(r.status).toBe('verification')
    expect(r.verification.map((c) => c.result)).toEqual(['pending', 'pending'])

    r = applyTransition(
      r,
      {
        event: 'confirmResult',
        checks: [
          { criterionId: 'c1', result: 'passed' },
          { criterionId: 'c2', result: 'passed' },
        ],
      },
      opts(people.requester),
    )
    expect(r.status).toBe('release_scheduled')
    // The developer sets the date (PUT /requests/{id}/release) before marking it released.
    r = { ...r, release: { ...r.release, scheduledDate: '2026-10-30' } }
    r = applyTransition(r, { event: 'markReleased' }, opts(people.owner))

    expect(r.status).toBe('done')
    expect(r.release).toMatchObject({ scheduledDate: '2026-10-30' })
    expect(r.release?.releasedAt).toBeDefined()
    expect(r.timeline.map((t) => `${t.from}>${t.to}`)).toEqual([
      'submitted>reporting',
      'reporting>review',
      'review>in_progress',
      'in_progress>code_review',
      'code_review>verification',
      'verification>release_scheduled',
      'release_scheduled>done',
    ])
    expect(r.timeline[2]?.actor).toEqual({ type: 'user', userId: 'dev' })
  })

  it('rewrites the report after the requester answers questions', () => {
    let r = applyTransition(
      request('review'),
      { event: 'requestInfo', questions: ['관리자가 풀 수 있어야 하나요?'] },
      opts(people.owner),
    )
    expect(r.status).toBe('info_needed')
    r = applyTransition(
      r,
      { event: 'provideInfo', answer: '네, 관리자 화면에서 풉니다' },
      opts(people.requester),
    )
    expect(r.status).toBe('reporting')
    expect(r.infoRequest).toMatchObject({
      questions: ['관리자가 풀 수 있어야 하나요?'],
      answer: '네, 관리자 화면에서 풉니다',
    })
  })

  it('sends failed verification back through changes_requested with a new attempt', () => {
    let r = request('verification', {
      work: {
        attempt: 1,
        startedAt: '2026-10-27T01:00:00.000Z',
        phase: 'finished',
        branch: 'ax/request-1024',
      },
    })
    r = applyTransition(
      r,
      { event: 'reportIssue', checks: [{ criterionId: 'c1', result: 'failed', note: '안내가 안 보임' }] },
      opts(people.requester),
    )
    expect(r.status).toBe('changes_requested')
    expect(r.verification).toEqual([
      { criterionId: 'c1', result: 'failed', note: '안내가 안 보임' },
      { criterionId: 'c2', result: 'pending' },
    ])
    r = applyTransition(r, { event: 'runWork' }, opts(people.owner))
    expect(r.work?.attempt).toBe(2)
  })

  it('refuses transitions that are not allowed from the current status', () => {
    expect(() =>
      applyTransition(request('submitted'), { event: 'approveMerge' }, opts(people.owner)),
    ).toThrow(LifecycleError)
    try {
      applyTransition(request('done'), { event: 'cancel' }, opts(people.requester))
    } catch (e) {
      expect((e as LifecycleError).code).toBe('invalid_transition')
    }
  })

  it('enforces checklist guards', () => {
    const r = request('verification')
    const confirmWithFailure = () =>
      applyTransition(
        r,
        {
          event: 'confirmResult',
          checks: [
            { criterionId: 'c1', result: 'passed' },
            { criterionId: 'c2', result: 'failed' },
          ],
        },
        opts(people.requester),
      )
    expect(confirmWithFailure).toThrow(expect.objectContaining({ code: 'guard_failed' }))

    const confirmIncomplete = () =>
      applyTransition(
        r,
        { event: 'confirmResult', checks: [{ criterionId: 'c1', result: 'passed' }] },
        opts(people.requester),
      )
    expect(confirmIncomplete).toThrow(expect.objectContaining({ code: 'guard_failed' }))

    const issueWithoutFailure = () =>
      applyTransition(
        r,
        { event: 'reportIssue', checks: [{ criterionId: 'c1', result: 'passed' }] },
        opts(people.requester),
      )
    expect(issueWithoutFailure).toThrow(expect.objectContaining({ code: 'guard_failed' }))
  })

  it('starts the first AI run only after every assumption in the report is confirmed', () => {
    const r = request('review', {
      report: report({
        assumptions: [
          { id: 'a1', text: '잠금 정책은 서버에만 있다' },
          { id: 'a2', text: '안내 문구는 번역 파일에 있다' },
        ],
      }),
    })
    const run = (checkedAssumptions?: string[]) =>
      applyTransition(
        r,
        { event: 'runWork', ...(checkedAssumptions ? { checkedAssumptions } : {}) },
        opts(people.owner),
      )

    expect(() => run()).toThrow(
      expect.objectContaining({ code: 'guard_failed', guard: 'assumptionsUnchecked' }),
    )
    expect(() => run(['a1'])).toThrow(expect.objectContaining({ guard: 'assumptionsUnchecked' }))
    expect(run(['a2', 'a1']).work?.checkedAssumptions).toEqual(['a1', 'a2'])

    // A re-run after a failed check keeps what was confirmed and asks nothing new.
    const rerun = applyTransition(
      { ...run(['a1', 'a2']), status: 'changes_requested' },
      { event: 'runWork' },
      opts(people.owner),
    )
    expect(rerun.work).toMatchObject({ attempt: 2, checkedAssumptions: ['a1', 'a2'] })
  })

  it('records the scope the requester confirmed, and lets them send it back twice', () => {
    const scope = {
      proposal: {
        revision: 1,
        summary: '로그인 화면에서 안내가 보이도록 바꿉니다.',
        changes: ['5번 틀리면 안내가 보인다'],
        unchanged: [],
        questions: [
          {
            id: 'q1',
            text: '관리자 화면도 바꿀까요?',
            options: [
              { id: 'no', label: '아니요' },
              { id: 'yes', label: '네' },
            ],
            recommended: 'no',
          },
        ],
      },
    }
    let r = applyTransition(request('reporting', { scope }), { event: 'scopeReady' }, opts('ai'))
    expect(r.status).toBe('scope_check')

    const approve = (choices: Array<{ questionId: string; optionId: string }>) =>
      applyTransition(r, { event: 'approveScope', choices }, opts(people.requester))
    expect(() => approve([])).toThrow(expect.objectContaining({ guard: 'scopeUnanswered' }))
    expect(() => approve([{ questionId: 'q1', optionId: 'maybe' }])).toThrow(
      expect.objectContaining({ guard: 'scopeUnanswered' }),
    )
    const approved = approve([{ questionId: 'q1', optionId: 'no' }])
    expect(approved.status).toBe('review')
    expect(approved.scope?.decision).toMatchObject({
      by: 'req',
      choices: [{ questionId: 'q1', optionId: 'no' }],
    })

    for (const note of ['범위를 줄여 주세요', '관리자 화면은 빼 주세요']) {
      r = applyTransition(r, { event: 'reviseScope', note }, opts(people.requester))
      expect(r.status).toBe('reporting')
      r = applyTransition(r, { event: 'scopeReady' }, opts('ai'))
    }
    expect(scopeRevisionsLeft(r)).toBe(0)
    expect(() =>
      applyTransition(r, { event: 'reviseScope', note: '한 번 더' }, opts(people.requester)),
    ).toThrow(expect.objectContaining({ guard: 'scopeRevisionsUsed' }))
  })

  it('marks a request released only once a release date is planned', () => {
    const unscheduled = request('release_scheduled')
    expect(releaseDateMissing(unscheduled)).toBe(true)
    expect(() => applyTransition(unscheduled, { event: 'markReleased' }, opts(people.owner))).toThrow(
      expect.objectContaining({ code: 'guard_failed', guard: 'releaseUnscheduled' }),
    )
    // A note alone is not a date.
    const noted = request('release_scheduled', { release: { note: '야간 배포' } })
    expect(() => applyTransition(noted, { event: 'markReleased' }, opts(people.owner))).toThrow(
      expect.objectContaining({ guard: 'releaseUnscheduled' }),
    )

    const scheduled = request('release_scheduled', {
      release: { scheduledDate: '2026-10-30', note: '야간 배포' },
    })
    expect(releaseDateMissing(scheduled)).toBe(false)
    const done = applyTransition(scheduled, { event: 'markReleased' }, opts(people.owner))
    expect(done.status).toBe('done')
    expect(done.release).toMatchObject({ scheduledDate: '2026-10-30', note: '야간 배포' })
  })

  it('does not mutate the input request', () => {
    const r = request('review')
    const snapshot = structuredClone(r)
    applyTransition(r, { event: 'reject', reason: '범위 밖' }, opts(people.owner))
    expect(r).toEqual(snapshot)
  })
})
