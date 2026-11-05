import { describe, expect, it } from 'vitest'
import type { User } from '../domain/model'
import { sessionChangeFrom } from './session'

const kim: User = {
  id: 'u-kim',
  name: '김기획',
  email: 'planner@example.com',
  role: 'requester',
  active: true,
}
const han: User = { id: 'u-han', name: '한운영', email: 'admin@example.com', role: 'admin', active: true }

const stored = (token: string | null, user: User | null) =>
  JSON.stringify({ state: { token, user }, version: 0 })
const signedIn = { token: 'token-1', user: kim }
const signedOut = { token: null, user: null }

describe('sessionChangeFrom', () => {
  it('reads a sign-out in another tab, or the key being removed', () => {
    expect(sessionChangeFrom(signedIn, stored(null, null))).toEqual({ kind: 'signedOut' })
    expect(sessionChangeFrom(signedIn, null)).toEqual({ kind: 'signedOut' })
    expect(sessionChangeFrom(signedOut, stored(null, null))).toBeNull()
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
    expect(sessionChangeFrom(signedIn, stored('token-1', { ...kim, team: '기획팀' }))?.kind).toBe('refreshed')
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
