import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Session, type Session as SessionValue } from '../api/contract'
import type { User } from '../domain/model'
import { clearDrafts } from './draft'

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
  /**
   * Ends the session. Signing out on purpose means someone else may use this
   * device next, so the person's drafts kept on this device are deleted too
   * (their account keeps what reached it); an expiry keeps them for when the
   * same person signs in again.
   */
  clear: (reason: SessionEndReason) => void
}

/**
 * What is written to localStorage. A signed-out value also says why the
 * session ended (`endReason`), so other tabs end theirs the same way: an
 * expiry keeps `next` there too. Only other tabs read it; this tab's own
 * `ended` stays in memory (see `merge`).
 */
interface StoredSession {
  token: string | null
  user: User | null
  endReason?: SessionEndReason | null
}

/** Signed-in user. Persisted so a reload keeps the session; the API remains the source of truth. */
export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      ended: null,
      setSession: ({ token, user }) => set({ token, user, ended: null }),
      setUser: (user) => set({ user }),
      clear: (reason) => {
        // A sign-out right after an expiry (a request refused while signing out) is still that person's.
        const userId = get().user?.id ?? get().ended?.userId ?? null
        if (reason === 'signedOut' && userId) clearDrafts(userId)
        set({ token: null, user: null, ended: { reason, userId } })
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user, ended }): StoredSession =>
        token ? { token, user } : { token, user, endReason: ended?.reason ?? null },
      // A tab opened later starts without history: the reason is for tabs that were open.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<StoredSession>
        return { ...current, token: stored.token ?? null, user: stored.user ?? null }
      },
    },
  ),
)

/**
 * What another tab's write of the session key means for this tab:
 * - `signedOut`: the other tab signed out (or the key was removed).
 * - `expired`: the server stopped accepting the token in the other tab.
 * - `signedIn`: this tab was signed out and the other tab signed in.
 * - `switchedUser`: the other tab signed in as someone else.
 * - `refreshed`: same person, new token or profile; nothing on screen should move.
 * Returns null when nothing changed or the stored value is unreadable.
 */
export type SessionChange =
  { kind: SessionEndReason } | { kind: 'signedIn' | 'switchedUser' | 'refreshed'; session: SessionValue }

export function sessionChangeFrom(
  current: { token: string | null; user: Pick<User, 'id'> | null },
  stored: string | null,
): SessionChange | null {
  const next = readStoredSession(stored)
  if (next === undefined) return null
  if ('ended' in next) return current.token ? { kind: next.ended } : null
  const { session } = next
  if (!current.token || !current.user) return { kind: 'signedIn', session }
  if (current.user.id !== session.user.id) return { kind: 'switchedUser', session }
  if (current.token === session.token && JSON.stringify(current.user) === JSON.stringify(session.user)) {
    return null
  }
  return { kind: 'refreshed', session }
}

/**
 * The session in a persisted value: a session, or why there is none (a value
 * without a reason, or no value at all, reads as a sign-out); undefined when
 * the value is not a session.
 */
function readStoredSession(
  stored: string | null,
): { session: SessionValue } | { ended: SessionEndReason } | undefined {
  if (stored === null) return { ended: 'signedOut' }
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return undefined
  }
  const state = (parsed as { state?: Record<string, unknown> } | null)?.state
  if (!state || typeof state !== 'object') return undefined
  if (state.token === null || state.token === undefined) {
    return { ended: state.endReason === 'expired' ? 'expired' : 'signedOut' }
  }
  const session = Session.safeParse({ token: state.token, user: state.user })
  return session.success ? { session: session.data } : undefined
}
