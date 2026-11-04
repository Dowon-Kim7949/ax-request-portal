import { describe, expect, it } from 'vitest'
import { Project, User, WorkRequest } from '../domain/model'
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { localDate, MockEngine } from './engine'
import { buildSeedState } from './seed'

const NOW = new Date('2026-11-02T03:00:00.000Z')
const OPTS = { reportSeconds: 6, workSeconds: 20, rolePermissions: DEFAULT_ROLE_PERMISSIONS }

describe('seed data', () => {
  const state = buildSeedState(NOW, OPTS)
  const byId = (id: number) => state.requests.find((r) => r.id === id)!

  it('conforms to the API contract', () => {
    for (const u of state.users) expect(User.safeParse(u).error).toBeUndefined()
    for (const p of state.projects) expect(Project.safeParse(p).error).toBeUndefined()
    for (const r of state.requests) expect(WorkRequest.safeParse(r).error, `#${r.id}`).toBeUndefined()
  })

  it('is fictional: example domains only', () => {
    for (const u of state.users) expect(u.email).toMatch(/@example\.com$/)
    for (const p of state.projects)
      expect(p.repository.url).toMatch(/^https:\/\/(gitlab\.example\.com|github\.com\/acme)\//)
  })

  it('keeps every timeline in chronological order', () => {
    for (const r of state.requests) {
      const times = r.timeline.map((t) => t.at)
      expect(times, `#${r.id}`).toEqual([...times].sort())
    }
  })

  it('puts each showcase request in the intended state', () => {
    const expected: Record<number, string> = {
      1012: 'done',
      1013: 'done',
      1014: 'done',
      1015: 'done',
      1016: 'rejected',
      1017: 'verification',
      1018: 'cancelled',
      1019: 'release_scheduled',
      1020: 'release_scheduled',
      1021: 'verification',
      1022: 'info_needed',
      1023: 'changes_requested',
      1024: 'code_review',
      1025: 'in_progress',
      1026: 'review',
      1027: 'reporting',
      1028: 'scope_check',
    }
    for (const [id, status] of Object.entries(expected))
      expect(byId(Number(id)).status, `#${id}`).toBe(status)
    expect(state.nextRequestId).toBe(1029)
  })

  it('asks the requester of #1028 to pick the screen and how far the change goes', () => {
    const questions = byId(1028).scope?.proposal.questions ?? []
    expect(questions.map((q) => q.id)).toEqual(['q-screen', 'q-extent'])
    expect(questions[1]?.recommended).toBe('only')
    // Every request a developer works on has a confirmed scope.
    for (const id of [1017, 1021, 1024, 1026]) expect(byId(id).scope?.decision, `#${id}`).toBeDefined()
  })

  it('reproduces the work-detail showcase for #1024', () => {
    const r = byId(1024)
    expect(r.work?.mergeRequest).toMatchObject({ number: 57, filesChanged: 4, additions: 86, deletions: 12 })
    expect(r.work?.tests).toEqual({
      existingPassed: 128,
      existingTotal: 128,
      criteriaPassed: 2,
      criteriaTotal: 2,
    })
    expect(r.report?.wikiTrust).toBe('high')
    expect(r.regression.map((g) => g.label)).toEqual(['자동 로그인', '비밀번호 재설정', '관리자 잠금 해제'])
    expect(r.infoRequest?.answer).toBeTruthy()
    // The requester can look at the change before it goes in.
    expect(r.work?.preview?.url).toMatch(/^https:\/\/preview\.example\.com\//)
    expect(r.work?.preview?.screenshots[0]?.url).toMatch(/^data:image\/svg\+xml/)
  })

  it('flags #1017 as delayed and schedules two releases this week', () => {
    const engine = new MockEngine(structuredClone(state), OPTS)
    const today = localDate(NOW)
    expect(engine.isDelayed(byId(1017), today)).toBe(true)
    const summary = engine.dashboard(
      state.users.find((u) => u.role === 'executive')!,
      today.slice(0, 7),
      NOW,
    )
    expect(summary.attention.delayedRequestIds).toContain(1017)
    expect(summary.attention.infoNeeded).toBe(1)
    expect(summary.upcomingReleases.flatMap((r) => r.requestIds).sort()).toEqual([1019, 1020])
  })

  it('finishes the live AI jobs shortly after seeding', () => {
    const engine = new MockEngine(structuredClone(state), OPTS)
    engine.tick(new Date(NOW.getTime() + 30_000), 'ko')
    expect(engine.state.requests.find((r) => r.id === 1025)?.status).toBe('code_review')
    expect(engine.state.requests.find((r) => r.id === 1027)?.status).toBe('scope_check')
  })

  it('compares an unfinished month with the same span of the previous one', () => {
    const engine = new MockEngine(structuredClone(state), OPTS)
    const exec = state.users.find((u) => u.role === 'executive')!
    const today = localDate(NOW) // 2026-11-02 in any timezone east of UTC-3
    const current = engine.dashboard(exec, today.slice(0, 7), NOW)
    const previous = engine.dashboard(exec, '2026-10', NOW)
    const sameSpan = state.requests.filter((r) => {
      const d = localDate(new Date(r.createdAt))
      return d.startsWith('2026-10') && d.slice(8, 10) <= today.slice(8, 10)
    }).length
    expect(current.receivedPrevMonth).toBe(sameSpan)
    expect(current.receivedPrevMonth).toBeLessThan(previous.received)
  })
})
