/**
 * The draft sync against the mock API: what reaches the account, what stays
 * on this device, and the races (a submission or a sign-out while a save is
 * on its way, two tabs saving the same draft).
 */
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { call } from '@/api/client'
import { api } from '@/api/contract'
import { appConfig } from '@/config/app.config'
import { draftContentOf, EMPTY_VALUES } from '@/features/wizard/schema'
import {
  clearDrafts,
  getLocalDraft,
  legacyDraftKey,
  listLocalDrafts,
  putLocalDraft,
  resolveDraftId,
  type LocalDraft,
} from '@/stores/draft'
import { useSession } from '@/stores/session'
import { createTestApi } from '@/test/mock-api'
import { signInAs } from '@/test/session'
import { draftApi, migrateLegacyDraft, resetDraftSync } from './sync'
import { DraftSyncEngine, type DraftApi, type DraftSyncEvent } from './sync-engine'

const t = createTestApi()
const USER = 'u-kim'

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  t.server.resetHandlers()
  resetDraftSync()
  clearDrafts(USER)
  await signInAs(USER)
  for (const draft of await call(api.listDrafts)) await call(api.deleteDraft, { params: { id: draft.id } })
})
afterAll(() => t.server.close())

const isActive = () => {
  const { token, user } = useSession.getState()
  return Boolean(token) && user?.id === USER
}

function engine(draftsApi: DraftApi = draftApi) {
  const sync = new DraftSyncEngine({
    userId: USER,
    api: draftsApi,
    toContent: draftContentOf,
    isActive,
    delayMs: 5,
  })
  const events: DraftSyncEvent[] = []
  sync.subscribe((e) => {
    if (e.type !== 'state') events.push(e)
  })
  return { sync, events }
}

/** What the wizard writes as the person types. */
function write(localId: string, title: string, over: Partial<LocalDraft> = {}) {
  putLocalDraft(USER, {
    localId,
    step: 3,
    content: { ...EMPTY_VALUES, title },
    updatedAt: new Date().toISOString(),
    dirty: true,
    ...over,
  })
}

const serverDrafts = () => call(api.listDrafts)
const serverDraft = (id: string) => call(api.getDraft, { params: { id } })
const createOnServer = (title: string) => call(api.createDraft, { body: { step: 3, content: { title } } })

/** A promise the test opens when a held-back request may go on. */
function gate() {
  let open!: () => void
  const closed = new Promise<void>((resolve) => (open = resolve))
  return { closed, open }
}

/** The real draft API, with the n-th create / update held until its gate opens; counts the calls. */
function heldApi(holds: { create?: Array<Promise<void>>; update?: Array<Promise<void>> } = {}) {
  const calls = { create: 0, update: 0, remove: 0 }
  const held: DraftApi = {
    create: async (body) => {
      const hold = holds.create?.[calls.create]
      calls.create++
      if (hold) await hold
      return draftApi.create(body)
    },
    update: async (id, body) => {
      const hold = holds.update?.[calls.update]
      calls.update++
      if (hold) await hold
      return draftApi.update(id, body)
    },
    remove: async (id) => {
      calls.remove++
      return draftApi.remove(id)
    },
  }
  return { api: held, calls }
}

describe('saving drafts to the account', () => {
  it('sends a new draft, then its changes over the version the server answered', async () => {
    const { sync, events } = engine()
    write('local-a', '검색')
    await sync.sync('boot')

    const [saved] = await serverDrafts()
    expect(saved).toMatchObject({ title: '검색', version: 1, step: 3 })
    // The account has all of it: nothing stays on this device, and the local id leads to the draft.
    expect(listLocalDrafts(USER)).toEqual([])
    expect(resolveDraftId(USER, 'local-a')).toEqual({ id: saved!.id, version: 1 })
    expect(events).toMatchObject([
      { type: 'saved', localId: 'local-a', next: null, draft: { id: saved!.id } },
    ])

    write(saved!.id, '검색 추가', { draftId: saved!.id, baseVersion: 1 })
    await sync.sync('input', saved!.id)
    expect(await serverDraft(saved!.id)).toMatchObject({ title: '검색 추가', version: 2 })
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('waits for typing to pause before sending', async () => {
    const { api: held, calls } = heldApi()
    const { sync } = engine(held)
    write('local-a', '검')
    sync.schedule('local-a')
    write('local-a', '검색')
    sync.schedule('local-a')
    expect(sync.state('local-a')).toBe('scheduled')
    await vi.waitFor(() => expect(listLocalDrafts(USER)).toEqual([]))
    expect(calls.create).toBe(1)
    expect((await serverDrafts())[0]?.title).toBe('검색')
  })

  it('keeps what was typed while a new draft was on its way, and sends it next', async () => {
    const first = gate()
    const { sync, events } = engine(heldApi({ create: [first.closed] }).api)
    write('local-a', '검색')
    const running = sync.sync('boot')
    await vi.waitFor(() => expect(sync.state('local-a')).toBe('sending'))
    write('local-a', '검색 추가')
    first.open()
    await running

    const [saved] = await serverDrafts()
    expect(saved).toMatchObject({ title: '검색 추가', version: 2 })
    expect(listLocalDrafts(USER)).toEqual([])
    // First answer: the draft moved to its server id with the newer words still to send.
    expect(events[0]).toMatchObject({ type: 'saved', localId: 'local-a', next: { localId: saved!.id } })
    expect(events[1]).toMatchObject({ type: 'saved', localId: saved!.id, next: null })
  })

  it('marks a conflict and sends nothing more until the person chooses', async () => {
    const draft = await createOnServer('처음')
    await call(api.updateDraft, {
      params: { id: draft.id },
      body: { baseVersion: 1, step: 3, content: { title: '다른 기기에서' } },
    })
    const { api: held, calls } = heldApi()
    const { sync } = engine(held)
    write(draft.id, '이 기기에서', { draftId: draft.id, baseVersion: 1 })

    await sync.sync('boot')
    expect(getLocalDraft(USER, draft.id)).toMatchObject({ conflict: true, dirty: true })
    expect(await serverDraft(draft.id)).toMatchObject({ title: '다른 기기에서', version: 2 })
    await sync.sync('online')
    expect(calls.update).toBe(1)
  })

  it('keeps a draft on this device when the account is full, and tries again once a slot frees up', async () => {
    const full = await Promise.all(
      Array.from({ length: appConfig.drafts.maxPerAccount }, (_, i) => createOnServer(`초안 ${i}`)),
    )
    const { api: held, calls } = heldApi()
    const { sync } = engine(held)
    write('local-a', '하나 더')
    await sync.sync('boot')
    expect(getLocalDraft(USER, 'local-a')).toMatchObject({ limited: true })

    // Not sent again on every pause in typing.
    write('local-a', '하나 더 쓰는 중', { limited: true })
    await sync.sync('input', 'local-a')
    expect(calls.create).toBe(1)

    await call(api.deleteDraft, { params: { id: full[0]!.id } })
    await sync.freed()
    expect(listLocalDrafts(USER)).toEqual([])
    expect((await serverDrafts()).map((d) => d.title)).toContain('하나 더 쓰는 중')
  })

  it('keeps a draft through a lost connection and sends it at the next chance', async () => {
    const { sync } = engine()
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error(), { once: true }))
    write('local-a', '검색')
    await sync.sync('boot')
    expect(getLocalDraft(USER, 'local-a')).toMatchObject({ dirty: true })
    expect(sync.state('local-a')).toBe('offline')

    await sync.sync('online')
    expect(listLocalDrafts(USER)).toEqual([])
    expect((await serverDrafts())[0]?.title).toBe('검색')
  })

  it('goes on as a new draft when the account’s draft was deleted or submitted elsewhere', async () => {
    const draft = await createOnServer('처음')
    await call(api.deleteDraft, { params: { id: draft.id } })
    const { sync, events } = engine()
    write(draft.id, '이 기기에서 더 쓴 것', { draftId: draft.id, baseVersion: 1 })
    await sync.sync('boot')

    const [again] = await serverDrafts()
    expect(again).toMatchObject({ title: '이 기기에서 더 쓴 것', version: 1 })
    expect(again!.id).not.toBe(draft.id)
    expect(events[0]).toEqual({ type: 'gone', localId: draft.id, draftId: draft.id })
    expect(resolveDraftId(USER, draft.id).id).toBe(again!.id)
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('leaves out an attachment the server cannot find, and still saves the draft', async () => {
    const { sync } = engine()
    const lost = {
      id: 'att-lost',
      name: 'lost.png',
      size: 4,
      mimeType: 'image/png',
      url: 'data:image/png;base64,QQ==',
    }
    write('local-a', '첨부', { content: { ...EMPTY_VALUES, title: '첨부', attachments: [lost] } })
    await sync.sync('boot')
    const [saved] = await serverDrafts()
    expect(saved).toMatchObject({ title: '첨부', attachmentCount: 0 })
    expect((await serverDraft(saved!.id)).content.attachmentIds).toEqual([])
  })

  it('says how many drafts are still on this device only after sending what it can', async () => {
    const { sync } = engine()
    write('local-ok', '보낼 것')
    write('draft-x', '충돌', { draftId: 'draft-x', baseVersion: 1, conflict: true })
    expect(await sync.flush(1_000)).toBe(1)
    expect(getLocalDraft(USER, 'local-ok')).toBeUndefined()
  })
})

describe('races', () => {
  it('submitting waits for a new draft on its way, so the request can name it', async () => {
    const posted = gate()
    const { sync } = engine(heldApi({ create: [posted.closed] }).api)
    write('local-a', '검색')
    void sync.sync('boot')
    await vi.waitFor(() => expect(sync.state('local-a')).toBe('sending'))

    const waiting = sync.pause('local-a', 1_000)
    posted.open()
    const key = await waiting
    const [saved] = await serverDrafts()
    expect(key).toBe(saved!.id)
    expect(resolveDraftId(USER, 'local-a').id).toBe(saved!.id)
  })

  it('a new draft arriving after the request was submitted is deleted at once', async () => {
    const posted = gate()
    const { api: held, calls } = heldApi({ create: [posted.closed] })
    const { sync, events } = engine(held)
    write('local-a', '검색')
    const running = sync.sync('boot')
    await vi.waitFor(() => expect(sync.state('local-a')).toBe('sending'))

    // Too slow: the request goes without it, and is created.
    expect(await sync.pause('local-a', 10)).toBe('local-a')
    sync.forget('local-a')
    posted.open()
    await running

    await vi.waitFor(() => expect(calls.remove).toBe(1))
    expect(await serverDrafts()).toEqual([])
    expect(listLocalDrafts(USER)).toEqual([])
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ type: 'removed' }))
  })

  it('a new draft saved after the submission stopped waiting, but before the request was created, is deleted', async () => {
    const posted = gate()
    const { sync, events } = engine(heldApi({ create: [posted.closed] }).api)
    write('local-a', '검색')
    const running = sync.sync('boot')
    await vi.waitFor(() => expect(sync.state('local-a')).toBe('sending'))
    // Too slow: the request goes without naming it…
    expect(await sync.pause('local-a', 10)).toBe('local-a')
    // …and the save is answered first: the draft now lives under its server id.
    posted.open()
    await running
    const [saved] = await serverDrafts()
    expect(saved?.title).toBe('검색')

    sync.submitted('local-a', undefined)
    await vi.waitFor(async () => expect(await serverDrafts()).toEqual([]))
    expect(listLocalDrafts(USER)).toEqual([])
    expect(events.at(-1)).toEqual({ type: 'removed', draftId: saved!.id })
  })

  it('so is what was typed while it was on its way, and nothing more is sent for it', async () => {
    const posted = gate()
    const { api: held, calls } = heldApi({ create: [posted.closed] })
    const { sync } = engine(held)
    write('local-a', '검색')
    const running = sync.sync('boot')
    await vi.waitFor(() => expect(sync.state('local-a')).toBe('sending'))
    expect(await sync.pause('local-a', 10)).toBe('local-a')
    write('local-a', '검색 추가')
    posted.open()
    await running
    const [saved] = await serverDrafts()
    // Kept under the server id, still to send; held for the submission.
    expect(getLocalDraft(USER, saved!.id)).toMatchObject({ dirty: true, content: { title: '검색 추가' } })

    sync.submitted('local-a', undefined)
    await vi.waitFor(() => expect(calls.remove).toBe(1))
    expect(listLocalDrafts(USER)).toEqual([])
    await sync.sync('online')
    expect(calls.update).toBe(0)
    expect(await serverDrafts()).toEqual([])
  })

  it('a request that named the draft leaves the deleting to the server', async () => {
    const draft = await createOnServer('처음')
    const { api: held, calls } = heldApi()
    const { sync } = engine(held)
    write(draft.id, '고친 것', { draftId: draft.id, baseVersion: 1 })
    expect(await sync.pause(draft.id, 10)).toBe(draft.id)
    sync.submitted(draft.id, draft.id)
    expect(listLocalDrafts(USER)).toEqual([])
    expect(calls.remove).toBe(0)
  })

  it('a failed submission sends the draft again under the server id it was saved as meanwhile', async () => {
    const posted = gate()
    const { api: held, calls } = heldApi({ create: [posted.closed] })
    const { sync } = engine(held)
    write('local-a', '검색')
    const running = sync.sync('boot')
    await vi.waitFor(() => expect(sync.state('local-a')).toBe('sending'))
    expect(await sync.pause('local-a', 10)).toBe('local-a')
    posted.open()
    await running
    const [saved] = await serverDrafts()

    // The submission failed: the hold ends, wherever the draft lives now.
    sync.release('local-a')
    write(saved!.id, '검색 고침', { draftId: saved!.id, baseVersion: 1 })
    sync.schedule(saved!.id)
    await vi.waitFor(() => expect(calls.update).toBe(1))
    await vi.waitFor(() => expect(sync.state(saved!.id)).toBe('idle'))
    expect(await serverDraft(saved!.id)).toMatchObject({ title: '검색 고침', version: 2 })
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('nothing is sent for a draft held for a submission, until it is released', async () => {
    const { api: held, calls } = heldApi()
    const { sync } = engine(held)
    write('local-a', '검색')
    await sync.pause('local-a', 10)
    await sync.sync('hidden')
    expect(calls.create).toBe(0)
    sync.release('local-a')
    await vi.waitFor(() => expect(calls.create).toBe(1))
  })

  it('a sign-out while an update is on its way writes nothing back to this device', async () => {
    const draft = await createOnServer('처음')
    const put = gate()
    const { api: held, calls } = heldApi({ update: [put.closed] })
    const { sync, events } = engine(held)
    write(draft.id, '고친 것', { draftId: draft.id, baseVersion: 1 })
    const running = sync.sync('boot')
    await vi.waitFor(() => expect(sync.state(draft.id)).toBe('sending'))

    useSession.getState().clear('signedOut')
    expect(listLocalDrafts(USER)).toEqual([])
    put.open()
    await running

    expect(localStorage.getItem(`ax-request-portal:drafts:${USER}`)).toBeNull()
    expect(events).toEqual([])
    write('local-later', '로그아웃 뒤')
    await sync.sync('online')
    expect(calls.create).toBe(0)
  })

  it('two tabs saving the same new draft leave one draft in the account', async () => {
    const holdA = gate()
    const holdB = gate()
    const tabA = engine(heldApi({ create: [holdA.closed] }).api)
    const tabB = engine(heldApi({ create: [holdB.closed] }).api)
    write('local-a', '검색')
    const a = tabA.sync.sync('online')
    const b = tabB.sync.sync('online')
    await vi.waitFor(() => expect(tabB.sync.state('local-a')).toBe('sending'))

    holdA.open()
    await a
    holdB.open()
    await b

    const drafts = await vi.waitFor(async () => {
      const list = await serverDrafts()
      expect(list).toHaveLength(1)
      return list
    })
    expect(resolveDraftId(USER, 'local-a').id).toBe(drafts[0]!.id)
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('two tabs updating the same draft do not take each other for a conflict', async () => {
    const draft = await createOnServer('처음')
    const holdA1 = gate()
    const holdA2 = gate()
    const holdB = gate()
    const tabA = engine(heldApi({ update: [holdA1.closed, holdA2.closed] }).api)
    const tabB = engine(heldApi({ update: [holdB.closed] }).api)
    write(draft.id, '하나', { draftId: draft.id, baseVersion: 1 })
    const a = tabA.sync.sync('online')
    const b = tabB.sync.sync('online')
    await vi.waitFor(() => expect(tabB.sync.state(draft.id)).toBe('sending'))
    // Typed on: the wizard keeps the version the entry was written over.
    write(draft.id, '둘', { draftId: draft.id, baseVersion: 1 })

    // A saves "하나" (version 2) and goes on with "둘", held on its way.
    holdA1.open()
    await vi.waitFor(() => expect(getLocalDraft(USER, draft.id)?.baseVersion).toBe(2))
    // B's update over version 1 is refused, but the base moved: B sends again, not a conflict.
    holdB.open()
    await b
    holdA2.open()
    await a

    expect(await serverDraft(draft.id)).toMatchObject({ title: '둘' })
    expect(getLocalDraft(USER, draft.id)).toBeUndefined()
  })
})

describe('the draft from before drafts were saved to the account', () => {
  it('moves into the new store and is deleted once the new copy is written', async () => {
    localStorage.setItem(
      legacyDraftKey(USER),
      JSON.stringify({ ...EMPTY_VALUES, projectId: 'p-portal', type: 'change', title: '이전 초안' }),
    )
    migrateLegacyDraft(USER)
    expect(localStorage.getItem(legacyDraftKey(USER))).toBeNull()
    const [moved] = listLocalDrafts(USER)
    expect(moved).toMatchObject({ dirty: true, step: 3, content: { title: '이전 초안' } })
    expect(moved!.localId).toMatch(/^local-/)

    // The sync sends it like any other.
    await engine().sync.sync('boot')
    expect((await serverDrafts())[0]?.title).toBe('이전 초안')
  })

  it('stays where it is when the new copy cannot be written', () => {
    localStorage.setItem(legacyDraftKey(USER), JSON.stringify({ ...EMPTY_VALUES, title: '이전 초안' }))
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    try {
      migrateLegacyDraft(USER)
    } finally {
      spy.mockRestore()
    }
    expect(localStorage.getItem(legacyDraftKey(USER))).not.toBeNull()
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('is just deleted when nothing was written in it, or it is not a draft', () => {
    localStorage.setItem(legacyDraftKey(USER), JSON.stringify({ ...EMPTY_VALUES, projectId: 'p-portal' }))
    migrateLegacyDraft(USER)
    expect(localStorage.getItem(legacyDraftKey(USER))).toBeNull()
    localStorage.setItem(legacyDraftKey(USER), '{not json')
    migrateLegacyDraft(USER)
    expect(localStorage.getItem(legacyDraftKey(USER))).toBeNull()
    expect(listLocalDrafts(USER)).toEqual([])
  })
})
