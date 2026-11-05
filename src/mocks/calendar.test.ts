/**
 * The mock API keeps one business calendar: the head office's (Asia/Seoul by
 * default), whatever the time zone of the server, the browser or the tests.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiError, call, configureClient } from '../api/client'
import { api } from '../api/contract'
import type { WorkRequest } from '../domain/model'
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { createTestApi } from '../test/mock-api'
import { errorText } from './copy'
import { businessDate, HttpError, MockEngine, type MockState } from './engine'
import { buildSeedState, DEMO_PASSWORD } from './seed'

const NOW = new Date('2026-11-02T03:00:00.000Z') // 12:00 on November 2 in Seoul
const OPTS = { reportSeconds: 6, workSeconds: 20, rolePermissions: DEFAULT_ROLE_PERMISSIONS }
const seeded = buildSeedState(NOW, OPTS)

/** 23:59 on October 31 in Seoul, and one minute later: 00:00 on November 1 (still Oct 31 in UTC) */
const LAST_MINUTE_OF_OCTOBER = '2026-10-31T14:59:00.000Z'
const FIRST_MINUTE_OF_NOVEMBER = '2026-10-31T15:00:00.000Z'
const EARLY_MORNING_NOVEMBER_1 = '2026-10-31T23:30:00.000Z' // 08:30 in Seoul

const user = (state: MockState, id: string) => state.users.find((u) => u.id === id)!
const exec = (state: MockState) => state.users.find((u) => u.role === 'executive')!

/** A copy of the seed where one shipped request was filed and released at `at`. */
function withShippedAt(at: string, opts: object = {}) {
  const state = structuredClone(seeded)
  const r = state.requests.find((x) => x.status === 'done')!
  r.createdAt = at
  r.release = { ...r.release, releasedAt: at }
  return { engine: new MockEngine(state, { ...OPTS, ...opts }), state, request: r }
}

describe('business calendar', () => {
  it('counts "today" in Seoul', () => {
    const engine = new MockEngine(structuredClone(seeded), OPTS)
    expect(engine.today(new Date('2026-11-02T14:59:59Z'))).toBe('2026-11-02')
    expect(engine.today(new Date('2026-11-02T15:00:00Z'))).toBe('2026-11-03')
    expect(businessDate(FIRST_MINUTE_OF_NOVEMBER)).toBe('2026-11-01')
  })

  it('puts requests filed and released between 00:00 and 09:00 in Seoul in the new month', () => {
    const before = withShippedAt(LAST_MINUTE_OF_OCTOBER)
    const after = withShippedAt(FIRST_MINUTE_OF_NOVEMBER)
    const morning = withShippedAt(EARLY_MORNING_NOVEMBER_1)
    const month = (w: ReturnType<typeof withShippedAt>, m: string) =>
      w.engine.dashboard(exec(w.state), m, NOW)

    expect(month(after, '2026-11').received).toBe(month(before, '2026-11').received + 1)
    expect(month(after, '2026-11').done).toBe(month(before, '2026-11').done + 1)
    expect(month(after, '2026-10').received).toBe(month(before, '2026-10').received - 1)
    expect(month(after, '2026-10').done).toBe(month(before, '2026-10').done - 1)
    expect(month(morning, '2026-11').received).toBe(month(after, '2026-11').received)
    expect(month(morning, '2026-11').done).toBe(month(after, '2026-11').done)
  })

  it('shows a release on the schedule on its Seoul date', () => {
    const { engine, state, request } = withShippedAt(EARLY_MORNING_NOVEMBER_1)
    const day = (d: string) =>
      engine.releases(user(state, 'u-kim'), d, d).flatMap((g) => g.requests.map((r) => r.id))
    expect(day('2026-11-01')).toContain(request.id)
    expect(day('2026-10-31')).not.toContain(request.id)
  })

  it('books AI spending of the early morning in Seoul to the new month', () => {
    const state = structuredClone(seeded)
    const template = state.aiUsage[0]!
    state.aiUsage.push({ ...template, id: 'au-boundary', at: FIRST_MINUTE_OF_NOVEMBER, costKrw: 1_000 })
    const withEntry = new MockEngine(state, OPTS)
    const without = new MockEngine(structuredClone(seeded), OPTS)
    expect(withEntry.budget('2026-11').spentKrw).toBe(without.budget('2026-11').spentKrw + 1_000)
    expect(withEntry.budget('2026-10').spentKrw).toBe(without.budget('2026-10').spentKrw)
    const daily = withEntry.aiUsageReport(user(state, 'u-yoon'), '2026-11').daily
    expect(daily.some((d) => d.date === '2026-11-01')).toBe(true)
  })

  it('follows another head office when configured', () => {
    const tz = { timeZone: 'America/Los_Angeles' }
    const after = withShippedAt(FIRST_MINUTE_OF_NOVEMBER, tz) // 08:00 on October 31 in Los Angeles
    const before = withShippedAt(LAST_MINUTE_OF_OCTOBER, tz)
    expect(after.engine.today(NOW)).toBe('2026-11-01')
    expect(after.engine.dashboard(exec(after.state), '2026-10', NOW).received).toBe(
      before.engine.dashboard(exec(before.state), '2026-10', NOW).received,
    )
  })

  it('flags a delay once the date has passed in Seoul', () => {
    const engine = new MockEngine(structuredClone(seeded), OPTS)
    const scheduled = engine.state.requests.find((r) => r.status === 'release_scheduled')!
    const due = {
      ...scheduled,
      release: { ...scheduled.release, scheduledDate: '2026-11-02' },
    } as WorkRequest
    // 23:59 on November 2 in Seoul: due today, not late. One minute later it is.
    expect(engine.isDelayed(due, engine.today(new Date('2026-11-02T14:59:00Z')))).toBe(false)
    expect(engine.isDelayed(due, engine.today(new Date('2026-11-02T15:00:00Z')))).toBe(true)
  })
})

describe('release dates', () => {
  // 01:00 on November 2 in Seoul, still November 1 in UTC and in North America.
  const EARLY = new Date('2026-11-01T16:00:00.000Z')

  /** #1019 waits for its release; u-choi is its developer. */
  function scheduled() {
    const engine = new MockEngine(structuredClone(seeded), OPTS)
    const r = engine.state.requests.find((x) => x.id === 1019)!
    expect(r.status).toBe('release_scheduled')
    return { engine, r, dev: user(engine.state, 'u-choi') }
  }

  it('refuses a date before today in Seoul', () => {
    const { engine, r, dev } = scheduled()
    let error: unknown
    try {
      engine.updateRelease(dev, r.id, { scheduledDate: '2026-11-01' }, EARLY)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(400)
    expect((error as HttpError).key).toBe('releaseDateInPast')
    expect((error as HttpError).params).toEqual({ today: '2026-11-02' })
  })

  it('accepts today and later', () => {
    const { engine, r, dev } = scheduled()
    expect(
      engine.updateRelease(dev, r.id, { scheduledDate: '2026-11-02' }, EARLY).release?.scheduledDate,
    ).toBe('2026-11-02')
  })

  it('lets a passed date be sent again unchanged, e.g. with a new note', () => {
    const { engine, r, dev } = scheduled()
    engine.updateRelease(dev, r.id, { scheduledDate: '2026-11-03' }, EARLY)
    const later = new Date('2026-11-05T03:00:00.000Z')
    expect(() =>
      engine.updateRelease(dev, r.id, { scheduledDate: '2026-11-03', note: 'QA' }, later),
    ).not.toThrow()
    expect(() => engine.updateRelease(dev, r.id, { scheduledDate: '2026-11-04' }, later)).toThrow(HttpError)
  })

  it('explains the refusal in both languages', () => {
    expect(errorText('ko', 'releaseDateInPast', { today: '2026-11-02' })).toContain('2026-11-02')
    expect(errorText('en', 'releaseDateInPast', { today: '2026-11-02' })).toBe(
      'The release date cannot be in the past. Today is 2026-11-02 at the head office.',
    )
  })
})

describe('release dates through the API', () => {
  const t = createTestApi(new Date('2026-11-01T16:00:00.000Z'))
  let token: string | null = null
  configureClient({ getToken: () => token, onUnauthorized: () => {} })
  beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
  afterAll(() => t.server.close())

  it('answers 400 with the head-office date', async () => {
    token = (await call(api.login, { body: { email: 'dev1@example.com', password: DEMO_PASSWORD } })).token
    const err = await call(api.updateRelease, {
      params: { id: 1019 },
      body: { scheduledDate: '2026-11-01' },
    }).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(400)
    expect((err as ApiError).code).toBe('bad_request')
    expect((err as ApiError).message).toContain('2026-11-02')
  })
})
