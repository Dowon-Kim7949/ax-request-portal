/**
 * The demo data in localStorage: shape check on load, one copy per tab kept in
 * step through a revision counter, and a signal when saving fails.
 */
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { call, configureClient } from '../api/client'
import { api } from '../api/contract'
import type { RequestDraft, User } from '../domain/model'
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { TEST_TIMING } from '../test/mock-api'
import { NOTIFICATIONS_PER_USER_MAX, type MockState } from './engine'
import { createHandlers, tokenFor } from './handlers'
import { buildSeedState } from './seed'
import { createMockStore, REVISION_KEY, stateProblem, STORAGE_KEY } from './store'

const NOW = new Date('2026-11-02T01:00:00.000Z')
const OPTS = { ...TEST_TIMING, rolePermissions: DEFAULT_ROLE_PERMISSIONS }

/** localStorage stand-in shared by "tabs"; `full` makes every write fail as a full quota does. */
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    full: false,
    getItem: (key: string) => items.get(key) ?? null,
    setItem(key: string, value: string) {
      if (this.full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      items.set(key, value)
    },
    removeItem: (key: string) => void items.delete(key),
  }
}

const tab = (storage: ReturnType<typeof memoryStorage>, extra: { onSaveError?: () => void } = {}) =>
  createMockStore({ ...OPTS, storage, now: () => NOW, ...extra })

const draft: RequestDraft = {
  projectId: 'p-portal',
  type: 'change',
  title: '공지사항 검색 추가',
  targetIds: ['t-notice'],
  currentBehavior: '',
  desiredBehavior: '제목으로 공지를 검색한다',
  acceptanceCriteria: [{ text: '검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다' }],
  attachmentIds: [],
}

const kim = (state: MockState): User => state.users.find((u) => u.id === 'u-kim')!

describe('loading', () => {
  afterEach(() => vi.restoreAllMocks())

  it('accepts the seed and names what is wrong with anything else', () => {
    const seed = buildSeedState(NOW, OPTS)
    expect(stateProblem(seed)).toBeNull()
    expect(stateProblem(null)).toBe('not an object')
    expect(stateProblem({ ...seed, version: 4 })).toMatch(/^version 4/)
    expect(stateProblem({ ...seed, requests: undefined })).toMatch(/requests/)
    expect(stateProblem({ ...seed, users: [null] })).toMatch(/users/)
    expect(stateProblem({ ...seed, revision: -1 })).toMatch(/revision/)
    expect(stateProblem({ ...seed, ai: { ...seed.ai, pricing: null } })).toMatch(/AI settings/)
    expect(stateProblem({ ...seed, nextRequestId: 1000 })).toMatch(/issued twice/)
    // Data saved before drafts were kept on the server is rebuilt rather than read without them.
    expect(stateProblem({ ...seed, version: 5 })).toMatch(/^version 5/)
    expect(stateProblem({ ...seed, drafts: undefined })).toMatch(/drafts/)
    expect(stateProblem({ ...seed, drafts: [{ id: 'draft-1', ownerId: 'u-kim', version: 1 }] })).toBe(
      'a draft is incomplete',
    )
  })

  it('keeps what a previous visit saved', () => {
    const storage = memoryStorage()
    const first = tab(storage)
    const created = first.engine.createRequest(kim(first.engine.state), draft, NOW, 'ko')
    first.save()

    const again = tab(storage)
    expect(again.engine.state.requests.some((r) => r.id === created.id)).toBe(true)
    expect(again.engine.state.revision).toBe(first.engine.state.revision)
  })

  it.each([
    ['broken JSON', '{"version":'],
    ['an older shape', JSON.stringify({ version: 4, users: [] })],
    ['a missing collection', JSON.stringify({ ...buildSeedState(NOW, OPTS), notifications: 'x' })],
  ])('rebuilds %s with a warning instead of failing later', (_label, raw) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const storage = memoryStorage()
    storage.items.set(STORAGE_KEY, raw)
    const store = tab(storage)
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('Stored demo data was rebuilt')
    expect(stateProblem(store.engine.state)).toBeNull()
    expect(stateProblem(JSON.parse(storage.items.get(STORAGE_KEY)!))).toBeNull()
  })
})

describe('several tabs', () => {
  it('counts saves in a revision both copies share', () => {
    const storage = memoryStorage()
    const a = tab(storage)
    const b = tab(storage)
    expect(storage.items.get(REVISION_KEY)).toBe(String(a.engine.state.revision))

    a.engine.createRequest(kim(a.engine.state), draft, NOW, 'ko')
    a.save()
    expect(storage.items.get(REVISION_KEY)).toBe(String(a.engine.state.revision))
    expect(b.engine.state.revision).toBeLessThan(a.engine.state.revision)

    b.sync()
    expect(b.engine.state.revision).toBe(a.engine.state.revision)
    expect(b.engine.state.requests).toHaveLength(a.engine.state.requests.length)
    // Nothing new: the copy is kept as it is.
    const engine = b.engine
    b.sync()
    expect(b.engine).toBe(engine)
  })

  it('never issues an id twice when tabs take turns', () => {
    const storage = memoryStorage()
    const a = tab(storage)
    const b = tab(storage)
    const first = a.engine.createRequest(kim(a.engine.state), draft, NOW, 'ko')
    a.save()
    b.sync()
    const second = b.engine.createRequest(kim(b.engine.state), draft, NOW, 'ko')
    b.save()
    a.sync()
    expect(second.id).toBe(first.id + 1)
    expect(a.engine.state.requests.filter((r) => r.id === first.id || r.id === second.id)).toHaveLength(2)
  })

  it('hands a reset in one tab to the others', () => {
    const storage = memoryStorage()
    const a = tab(storage)
    const b = tab(storage)
    const created = b.engine.createRequest(kim(b.engine.state), draft, NOW, 'ko')
    b.save()
    a.sync()

    a.reset('en')
    expect(a.engine.state.revision).toBeGreaterThan(b.engine.state.revision)
    b.sync()
    expect(b.engine.state.language).toBe('en')
    expect(b.engine.state.requests.some((r) => r.id === created.id)).toBe(false)
  })
})

describe('a tab that another tab has written to, through the API', () => {
  const storage = memoryStorage()
  const other = tab(storage)
  const store = tab(storage)
  const server = setupServer(...createHandlers(store, { latency: [0, 0] }))
  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' })
    configureClient({ getToken: () => tokenFor('u-kim'), onUnauthorized: () => {} })
  })
  afterAll(() => {
    server.close()
    configureClient({ getToken: () => null, onUnauthorized: () => {} })
  })

  it('reads the other tab’s save before answering and before changing anything', async () => {
    const theirs = other.engine.createRequest(kim(other.engine.state), draft, NOW, 'ko')
    other.save()

    const mine = await call(api.listRequests, { query: { scope: 'mine' } })
    expect(mine.map((r) => r.id)).toContain(theirs.id)

    const created = await call(api.createRequest, { body: draft })
    expect(created.id).toBe(theirs.id + 1)
    other.sync()
    expect(other.engine.state.requests.map((r) => r.id)).toEqual(
      expect.arrayContaining([theirs.id, created.id]),
    )
  })
})

describe('saving', () => {
  it('reports a failing save once, and again after a save that worked', () => {
    const storage = memoryStorage()
    const onSaveError = vi.fn()
    const store = tab(storage, { onSaveError })
    expect(onSaveError).not.toHaveBeenCalled()

    storage.full = true
    store.save()
    store.save()
    expect(onSaveError).toHaveBeenCalledOnce()
    expect(onSaveError.mock.calls[0]?.[0]).toMatchObject({ name: 'QuotaExceededError' })
    // The demo carries on in memory.
    const created = store.engine.createRequest(kim(store.engine.state), draft, NOW, 'ko')
    expect(store.engine.state.requests.at(-1)?.id).toBe(created.id)

    storage.full = false
    store.save()
    storage.full = true
    store.save()
    expect(onSaveError).toHaveBeenCalledTimes(2)
  })

  it('keeps each person’s newest notifications only', () => {
    const store = createMockStore({ ...OPTS, storage: null, now: () => NOW })
    const engine = store.engine
    const requester = kim(engine.state)
    // #1024 is in code review with a preview; each reaction notifies the responsible developers.
    for (let i = 0; i < NOTIFICATIONS_PER_USER_MAX + 15; i++) {
      engine.previewFeedback(
        requester,
        1024,
        { verdict: 'needs_change', note: `${i}` },
        new Date(NOW.getTime() + i * 1000),
      )
    }
    const forDev = engine.state.notifications.filter((n) => n.userId === 'u-choi')
    expect(forDev).toHaveLength(NOTIFICATIONS_PER_USER_MAX)
    expect(forDev.some((n) => n.params.note === `${NOTIFICATIONS_PER_USER_MAX + 14}`)).toBe(true)
    expect(forDev.some((n) => n.params.note === '0')).toBe(false)
    // Other people's notifications are untouched.
    expect(engine.state.notifications.some((n) => n.userId === 'u-kim')).toBe(true)
  })
})
