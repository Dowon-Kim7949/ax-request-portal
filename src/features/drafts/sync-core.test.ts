import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import type { DraftContent, SavedDraft } from '@/api/contract'
import type { LocalDraft } from '@/stores/draft'
import { outcomeOf, requestFor, sameInput, settle, shouldSend } from './sync-core'

const base: LocalDraft = {
  localId: 'local-a',
  step: 3,
  content: { title: '검색' },
  updatedAt: '2026-11-09T01:00:00.000Z',
  dirty: true,
}
const linked: LocalDraft = { ...base, localId: 'draft-1', draftId: 'draft-1', baseVersion: 2 }
const savedAs = (id: string, version: number) => ({
  kind: 'saved' as const,
  draft: { id, version } as SavedDraft,
})
const toContent = (content: unknown) => content as DraftContent

describe('what is sent', () => {
  it('sends drafts with changes, but not one in conflict, and one the account had no room for not on every pause', () => {
    expect(shouldSend(base, 'input')).toBe(true)
    expect(shouldSend({ ...base, dirty: false }, 'boot')).toBe(false)
    expect(shouldSend({ ...linked, conflict: true }, 'manual')).toBe(false)
    expect(shouldSend({ ...base, limited: true }, 'input')).toBe(false)
    expect(shouldSend({ ...base, limited: true }, 'online')).toBe(true)
  })

  it('creates a new draft, or updates over the version it was written on', () => {
    expect(requestFor(base, toContent)).toEqual({
      kind: 'create',
      body: { step: 3, content: { title: '검색' } },
    })
    expect(requestFor(linked, toContent)).toEqual({
      kind: 'update',
      id: 'draft-1',
      body: { step: 3, content: { title: '검색' }, baseVersion: 2 },
    })
    expect(requestFor({ ...base, step: 9 }, toContent)).toMatchObject({ body: { step: 6 } })
  })

  it('leaves out attachments the server cannot find, and sends nothing for content that is not a draft', () => {
    const withFiles = { ...base, content: { attachmentIds: ['a', 'gone', 'b'] } }
    expect(requestFor(withFiles, toContent, new Set(['gone']))).toMatchObject({
      body: { content: { attachmentIds: ['a', 'b'] } },
    })
    expect(requestFor(base, () => null)).toBeNull()
  })

  it('treats a link to a server draft without a known version as a conflict', () => {
    expect(requestFor({ ...linked, baseVersion: undefined }, toContent)).toBe('conflict')
  })
})

describe('reading a failure', () => {
  it('tries again later after no answer, a server error or a refused token', () => {
    expect(outcomeOf(new ApiError(0, 'network', 'down'))).toEqual({ kind: 'offline' })
    expect(outcomeOf(new ApiError(0, 'timeout', 'slow'))).toEqual({ kind: 'offline' })
    expect(outcomeOf(new ApiError(503, 'internal', 'busy'))).toEqual({ kind: 'offline' })
    expect(outcomeOf(new ApiError(401, 'unauthorized', 'expired'))).toEqual({ kind: 'offline' })
  })

  it('tells a conflict from a full account, and a draft that is gone', () => {
    expect(outcomeOf(new ApiError(409, 'conflict', 'saved elsewhere'))).toEqual({ kind: 'conflict' })
    expect(outcomeOf(new ApiError(409, 'limit_reached', 'full'))).toEqual({ kind: 'limit' })
    expect(outcomeOf(new ApiError(404, 'not_found', 'gone'))).toEqual({ kind: 'gone' })
  })

  it('names the attachments the server cannot find', () => {
    const refused = new ApiError(400, 'bad_request', 'bad', [
      { path: 'content.attachmentIds.1', message: 'missing' },
      { path: 'content.title', message: 'too long' },
    ])
    expect(outcomeOf(refused, ['a', 'gone'])).toEqual({ kind: 'refused', missingAttachments: ['gone'] })
    expect(outcomeOf(new Error('bug'))).toEqual({ kind: 'refused', missingAttachments: [] })
  })
})

describe('what a draft on this device becomes', () => {
  it('goes once the server has all of it, and the local id keeps leading to the server draft', () => {
    expect(settle(base, base, savedAs('draft-1', 1))).toEqual({
      next: null,
      alias: { id: 'draft-1', version: 1 },
      again: false,
    })
    expect(settle(linked, linked, savedAs('draft-1', 3))).toMatchObject({ next: null, again: false })
  })

  it('stays, linked to the answered version, when something was typed while it was sent', () => {
    const typed = { ...base, content: { title: '검색 추가' } }
    expect(settle(typed, base, savedAs('draft-1', 1))).toEqual({
      next: { ...typed, localId: 'draft-1', draftId: 'draft-1', baseVersion: 1 },
      alias: { id: 'draft-1', version: 1 },
      again: true,
    })
    expect(settle({ ...base, step: 4 }, base, savedAs('draft-1', 1)).next).toMatchObject({ step: 4 })
  })

  it('deletes a new server draft nothing here wants: submitted, deleted or signed out of meanwhile', () => {
    expect(settle(undefined, base, savedAs('draft-9', 1))).toEqual({ orphan: 'draft-9', again: false })
    // An update for an entry that is gone changes nothing.
    expect(settle(undefined, linked, savedAs('draft-1', 3))).toEqual({ again: false })
  })

  it('deletes a duplicate when another tab saved the same draft first', () => {
    const savedByOtherTab = { ...base, draftId: 'draft-1', baseVersion: 1 }
    expect(settle(savedByOtherTab, base, savedAs('draft-2', 1))).toEqual({ orphan: 'draft-2', again: false })
  })

  it('keeps a newer version another tab already holds', () => {
    expect(settle({ ...linked, baseVersion: 5 }, linked, savedAs('draft-1', 3))).toEqual({ again: false })
  })

  it('marks a conflict for the person to settle, unless another tab moved the base meanwhile', () => {
    expect(settle(linked, linked, { kind: 'conflict' })).toEqual({
      next: { ...linked, conflict: true },
      again: false,
    })
    expect(settle({ ...linked, baseVersion: 3 }, linked, { kind: 'conflict' })).toEqual({ again: true })
  })

  it('keeps a draft the account has no room for on this device only', () => {
    expect(settle(base, base, { kind: 'limit' })).toEqual({ next: { ...base, limited: true }, again: false })
  })

  it('goes on as a new draft when the server draft is gone', () => {
    const typed = { ...linked, conflict: true }
    expect(settle(typed, linked, { kind: 'gone' })).toEqual({
      next: {
        localId: 'draft-1',
        step: 3,
        content: { title: '검색' },
        updatedAt: base.updatedAt,
        dirty: true,
      },
      again: true,
      gone: true,
    })
  })

  it('keeps everything as it is when there was no answer or a refusal', () => {
    expect(settle(base, base, { kind: 'offline' })).toEqual({ again: false })
    expect(settle(base, base, { kind: 'refused', missingAttachments: [] })).toEqual({ again: false })
  })

  it('compares what was typed, not when', () => {
    expect(sameInput(base, { ...base, updatedAt: '2026-11-09T02:00:00.000Z' })).toBe(true)
    expect(sameInput(base, { ...base, step: 4 })).toBe(false)
  })
})
