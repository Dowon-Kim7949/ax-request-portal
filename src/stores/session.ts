import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Session, type Session as SessionValue } from '../api/contract'
import type { User } from '../domain/model'

/** localStorage key of the persisted session; other tabs watch it to follow sign-ins and sign-outs. */
export const SESSION_STORAGE_KEY = 'ax-request-portal:session'

/**
 * Why the session in this tab ended. `signedOut`: the person chose to leave
 * (here or in another tab), so the login screen starts fresh. `expired`: the
 * server stopped accepting the token, so the login screen offers to return to
 * the page that was open.
 */
export type SessionEndReason = 'signedOut' | 'expired'

export interface SessionEnd {
  reason: SessionEndReason
  /** Who was signed in. The page that was open is theirs: someone else signing in next starts at home. */
  userId: string | null
}

interface SessionState {
  token: string | null
  user: User | null
  /** Set when the session ends in this tab, reset by the next sign-in. Not persisted: a fresh tab has no history. */
  ended: SessionEnd | null
  setSession: (session: SessionValue) => void
  setUser: (user: User) => void
  clear: (reason: SessionEndReason) => void
}

/** Signed-in user. Persisted so a reload keeps the session; the API remains the source of truth. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      ended: null,
      setSession: ({ token, user }) => set({ token, user, ended: null }),
      setUser: (user) => set({ user }),
      clear: (reason) =>
        set((s) => ({ token: null, user: null, ended: { reason, userId: s.user?.id ?? null } })),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user }) => ({ token, user }),
    },
  ),
)

/**
 * What another tab's write of the session key means for this tab:
 * - `signedOut`: the other tab signed out (or the key was removed).
 * - `signedIn`: this tab was signed out and the other tab signed in.
 * - `switchedUser`: the other tab signed in as someone else.
 * - `refreshed`: same person, new token or profile; nothing on screen should move.
 * Returns null when nothing changed or the stored value is unreadable.
 */
export type SessionChange =
  { kind: 'signedOut' } | { kind: 'signedIn' | 'switchedUser' | 'refreshed'; session: SessionValue }

export function sessionChangeFrom(
  current: { token: string | null; user: Pick<User, 'id'> | null },
  stored: string | null,
): SessionChange | null {
  const next = readStoredSession(stored)
  if (next === undefined) return null
  if (next === null) return current.token ? { kind: 'signedOut' } : null
  if (!current.token || !current.user) return { kind: 'signedIn', session: next }
  if (current.user.id !== next.user.id) return { kind: 'switchedUser', session: next }
  if (current.token === next.token && JSON.stringify(current.user) === JSON.stringify(next.user)) return null
  return { kind: 'refreshed', session: next }
}

/** The session in a persisted value: null when signed out, undefined when the value is not a session. */
function readStoredSession(stored: string | null): SessionValue | null | undefined {
  if (stored === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return undefined
  }
  const state = (parsed as { state?: { token?: unknown; user?: unknown } } | null)?.state
  if (!state || typeof state !== 'object') return undefined
  if (state.token === null || state.token === undefined) return null
  const session = Session.safeParse({ token: state.token, user: state.user })
  return session.success ? session.data : undefined
}
