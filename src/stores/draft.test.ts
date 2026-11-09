import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearDrafts,
  draftsKey,
  getLocalDraft,
  isLocalId,
  legacyDraftKey,
  listLocalDrafts,
  newLocalId,
  putLocalDraft,
  removeLocalDraft,
  resolveDraftId,
  settleLocalDraft,
  subscribeLocalDrafts,
  updateLocalDraft,
  type LocalDraft,
} from './draft'

const USER = 'u-store'
const photo = {
  id: 'att-1',
  name: 'screen.png',
  size: 4,
  mimeType: 'image/png',
  url: 'data:image/png;base64,QQ==',
}

const entry = (over: Partial<LocalDraft> = {}): LocalDraft => ({
  localId: 'local-a',
  step: 3,
  content: { title: '사진이 안 올라감', attachments: [] },
  updatedAt: '2026-11-09T01:00:00.000Z',
  dirty: true,
  ...over,
})

/** Storage that refuses any value holding a data: URL (inline attachments fill the quota first). */
function fullForInlineFiles() {
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (value.includes('data:')) throw new DOMException('full', 'QuotaExceededError')
    original.call(this, key, value)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  clearDrafts(USER)
  localStorage.clear()
})

describe('the drafts kept on this device', () => {
  it('keeps several drafts per person, newest first, under the person’s own key', () => {
    putLocalDraft(USER, entry())
    putLocalDraft(
      USER,
      entry({
        localId: 'draft-7',
        draftId: 'draft-7',
        baseVersion: 2,
        updatedAt: '2026-11-09T02:00:00.000Z',
      }),
    )
    expect(listLocalDrafts(USER).map((e) => e.localId)).toEqual(['draft-7', 'local-a'])
    expect(JSON.parse(localStorage.getItem(draftsKey(USER))!)).toMatchObject({
      v: 1,
      entries: { 'local-a': {} },
    })
    expect(listLocalDrafts('u-someone-else')).toEqual([])
  })

  it('makes local ids that cannot be taken for server ids', () => {
    const a = newLocalId()
    expect(isLocalId(a)).toBe(true)
    expect(a).not.toBe(newLocalId())
    expect(isLocalId('draft-1')).toBe(false)
  })

  it('drops only an entry that is not a draft, and reads anything unreadable as nothing', () => {
    localStorage.setItem(
      draftsKey(USER),
      JSON.stringify({
        v: 1,
        entries: { 'local-a': entry(), 'local-b': { localId: 'local-b', step: 'two' } },
      }),
    )
    expect(listLocalDrafts(USER).map((e) => e.localId)).toEqual(['local-a'])
    localStorage.setItem(draftsKey(USER), '{not json')
    expect(listLocalDrafts(USER)).toEqual([])
    localStorage.setItem(draftsKey(USER), JSON.stringify({ v: 2, entries: {} }))
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('changes and removes one draft', () => {
    putLocalDraft(USER, entry())
    updateLocalDraft(USER, 'local-a', (e) => ({ ...e, conflict: true }))
    expect(getLocalDraft(USER, 'local-a')?.conflict).toBe(true)
    expect(updateLocalDraft(USER, 'local-missing', (e) => e)).toBeUndefined()
    removeLocalDraft(USER, 'local-a')
    expect(getLocalDraft(USER, 'local-a')).toBeUndefined()
  })

  it('moves a draft the server saved to its server id, and the local id keeps leading there', () => {
    putLocalDraft(USER, entry())
    settleLocalDraft(USER, 'local-a', entry({ localId: 'draft-3', draftId: 'draft-3', baseVersion: 1 }), {
      id: 'draft-3',
      version: 1,
    })
    expect(getLocalDraft(USER, 'local-a')).toBeUndefined()
    expect(getLocalDraft(USER, 'draft-3')).toMatchObject({ draftId: 'draft-3', baseVersion: 1 })
    expect(resolveDraftId(USER, 'local-a')).toEqual({ id: 'draft-3', version: 1 })
    expect(resolveDraftId(USER, 'draft-3')).toEqual({ id: 'draft-3' })

    // Nothing left to keep: the entry goes, the way there stays.
    settleLocalDraft(USER, 'draft-3', null)
    expect(listLocalDrafts(USER)).toEqual([])
    expect(resolveDraftId(USER, 'local-a').id).toBe('draft-3')
  })

  it('forgets where a local id led after a day', () => {
    vi.useFakeTimers({ now: new Date('2026-11-09T01:00:00.000Z'), toFake: ['Date'] })
    try {
      settleLocalDraft(USER, 'local-a', null, { id: 'draft-3', version: 1 })
      vi.setSystemTime(new Date('2026-11-10T02:00:00.000Z'))
      putLocalDraft(USER, entry({ localId: 'local-b' }))
      expect(resolveDraftId(USER, 'local-a')).toEqual({ id: 'local-a' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the words and attachment ids without the files’ data when storage is full', () => {
    fullForInlineFiles()
    const withPhoto = entry({ content: { title: '사진', attachments: [photo] } })
    expect(putLocalDraft(USER, withPhoto)).toBe('withoutAttachments')
    const stored = JSON.parse(localStorage.getItem(draftsKey(USER))!) as {
      entries: Record<string, LocalDraft<{ attachments: Array<{ id: string; url: string }> }>>
    }
    expect(stored.entries['local-a']!.content.attachments).toEqual([{ ...photo, url: '' }])
    // This tab still has the whole draft to send.
    expect(getLocalDraft(USER, 'local-a')?.content).toEqual(withPhoto.content)
  })

  it('says whose attachments did not fit', () => {
    fullForInlineFiles()
    putLocalDraft(USER, entry({ localId: 'local-big', content: { title: '큰 첨부', attachments: [photo] } }))
    expect(putLocalDraft(USER, entry())).toBe('saved')
  })

  it('keeps a draft in this tab when storage takes nothing at all', () => {
    putLocalDraft(USER, entry({ localId: 'local-old', content: { title: '이전' } }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(putLocalDraft(USER, entry())).toBe('failed')
    expect(getLocalDraft(USER, 'local-a')).toBeDefined()
    expect(getLocalDraft(USER, 'local-old')).toBeDefined()
    // A removal in this tab holds too, though storage still has the old copy.
    removeLocalDraft(USER, 'local-old')
    expect(getLocalDraft(USER, 'local-old')).toBeUndefined()
  })

  it('deletes all of a person’s drafts, the pre-account one included', () => {
    putLocalDraft(USER, entry())
    localStorage.setItem(legacyDraftKey(USER), '{"title":"이전 초안"}')
    clearDrafts(USER)
    expect(localStorage.getItem(draftsKey(USER))).toBeNull()
    expect(localStorage.getItem(legacyDraftKey(USER))).toBeNull()
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('also forgets what only this tab could keep', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    putLocalDraft(USER, entry())
    clearDrafts(USER)
    expect(listLocalDrafts(USER)).toEqual([])
  })

  it('tells listeners about changes here and in other tabs', () => {
    const heard: Array<string | null> = []
    const off = subscribeLocalDrafts((userId) => heard.push(userId))
    putLocalDraft(USER, entry())
    window.dispatchEvent(
      new StorageEvent('storage', { key: draftsKey('u-other'), newValue: '{}', storageArea: localStorage }),
    )
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'unrelated', newValue: '1', storageArea: localStorage }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))
    off()
    putLocalDraft(USER, entry({ localId: 'local-b' }))
    expect(heard).toEqual([USER, 'u-other', null])
  })
})
