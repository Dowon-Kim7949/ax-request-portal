import { afterEach, describe, expect, it } from 'vitest'
import type { User } from '../domain/model'
import { draftCountKey, draftsKey, legacyDraftKey } from './draft'
import { SESSION_STORAGE_KEY, sessionChangeFrom, useSession } from './session'

const kim: User = {
  id: 'u-kim',
  name: '김기획',
  email: 'planner@example.com',
  role: 'requester',
  active: true,
}
const han: User = { id: 'u-han', name: '한운영', email: 'admin@example.com', role: 'admin', active: true }

const stored = (token: string | null, user: User | null, endReason?: string | null) =>
  JSON.stringify({ state: { token, user, ...(endReason !== undefined ? { endReason } : {}) }, version: 0 })
const signedIn = { token: 'token-1', user: kim }
const signedOut = { token: null, user: null }

describe('sessionChangeFrom', () => {
  it('reads a sign-out in another tab, or the key being removed', () => {
    expect(sessionChangeFrom(signedIn, stored(null, null))).toEqual({ kind: 'signedOut' })
    expect(sessionChangeFrom(signedIn, null)).toEqual({ kind: 'signedOut' })
    expect(sessionChangeFrom(signedOut, stored(null, null))).toBeNull()
  })

  it('reads an expiry in another tab, so this tab keeps next too', () => {
    expect(sessionChangeFrom(signedIn, stored(null, null, 'expired'))).toEqual({ kind: 'expired' })
    expect(sessionChangeFrom(signedIn, stored(null, null, 'signedOut'))).toEqual({ kind: 'signedOut' })
    // An older or unknown reason reads as a sign-out, the safe choice.
    expect(sessionChangeFrom(signedIn, stored(null, null, null))).toEqual({ kind: 'signedOut' })
    expect(sessionChangeFrom(signedIn, stored(null, null, 'later'))).toEqual({ kind: 'signedOut' })
    expect(sessionChangeFrom(signedOut, stored(null, null, 'expired'))).toBeNull()
  })

  it('reads a sign-in as someone else', () => {
    expect(sessionChangeFrom(signedIn, stored('token-2', han))).toEqual({
      kind: 'switchedUser',
      session: { token: 'token-2', user: han },
    })
  })

  it('reads a sign-in while this tab was signed out', () => {
    expect(sessionChangeFrom(signedOut, stored('token-2', han))).toEqual({
      kind: 'signedIn',
      session: { token: 'token-2', user: han },
    })
  })

  it('treats the same person with a new token or profile as a quiet refresh', () => {
    expect(sessionChangeFrom(signedIn, stored('token-2', kim))).toEqual({
      kind: 'refreshed',
      session: { token: 'token-2', user: kim },
    })
    expect(sessionChangeFrom(signedIn, stored('token-1', { ...kim, teamId: 't-planning' }))?.kind).toBe(
      'refreshed',
    )
    expect(sessionChangeFrom(signedIn, stored('token-1', kim))).toBeNull()
  })

  it('ignores a value that is not a session', () => {
    expect(sessionChangeFrom(signedIn, '{not json')).toBeNull()
    expect(sessionChangeFrom(signedIn, JSON.stringify({ version: 0 }))).toBeNull()
    expect(
      sessionChangeFrom(signedIn, stored('token-2', { ...kim, role: 'boss' } as unknown as User)),
    ).toBeNull()
  })
})

describe('the persisted session', () => {
  afterEach(() => {
    useSession.setState({ token: null, user: null, ended: null })
    localStorage.clear()
  })
  const saved = () => JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null') as { state: unknown }

  it('says why it ended, for the other tabs', () => {
    useSession.getState().setSession({ token: 'token-1', user: kim })
    expect(saved().state).toEqual({ token: 'token-1', user: kim })
    useSession.getState().clear('expired')
    expect(saved().state).toEqual({ token: null, user: null, endReason: 'expired' })
    useSession.getState().setSession({ token: 'token-2', user: kim })
    useSession.getState().clear('signedOut')
    expect(saved().state).toEqual({ token: null, user: null, endReason: 'signedOut' })
  })

  it('starts a new tab without the previous ending', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, stored(null, null, 'expired'))
    await useSession.persist.rehydrate()
    expect(useSession.getState()).toMatchObject({ token: null, user: null, ended: null })
    expect(useSession.getState()).not.toHaveProperty('endReason')
  })

  it('deletes the drafts kept on this device when the person signs out, and keeps them when the session expires', () => {
    const fill = () => {
      localStorage.setItem(draftsKey(kim.id), '{"v":1,"entries":{}}')
      localStorage.setItem(legacyDraftKey(kim.id), '{"title":"검색"}')
      localStorage.setItem(draftCountKey(kim.id), '2')
    }
    fill()
    useSession.getState().setSession({ token: 'token-1', user: kim })
    useSession.getState().clear('expired')
    expect(localStorage.getItem(draftsKey(kim.id))).not.toBeNull()
    expect(localStorage.getItem(legacyDraftKey(kim.id))).not.toBeNull()
    expect(localStorage.getItem(draftCountKey(kim.id))).toBe('2')

    useSession.getState().setSession({ token: 'token-2', user: kim })
    useSession.getState().clear('signedOut')
    expect(localStorage.getItem(draftsKey(kim.id))).toBeNull()
    expect(localStorage.getItem(legacyDraftKey(kim.id))).toBeNull()
    expect(localStorage.getItem(draftCountKey(kim.id))).toBeNull()
  })

  it('still deletes them when the sign-out comes right after an expiry', () => {
    // A request refused while signing out ends the session as expired first; the sign-out is still theirs.
    localStorage.setItem(draftsKey(kim.id), '{"v":1,"entries":{}}')
    useSession.getState().setSession({ token: 'token-1', user: kim })
    useSession.getState().clear('expired')
    useSession.getState().clear('signedOut')
    expect(localStorage.getItem(draftsKey(kim.id))).toBeNull()
  })

  it('leaves someone else’s drafts alone', () => {
    localStorage.setItem(draftsKey(han.id), '{"v":1,"entries":{}}')
    useSession.getState().setSession({ token: 'token-1', user: kim })
    useSession.getState().clear('signedOut')
    expect(localStorage.getItem(draftsKey(han.id))).not.toBeNull()
  })
})
