import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Session } from '../api/contract'
import type { User } from '../domain/model'

interface SessionState {
  token: string | null
  user: User | null
  setSession: (session: Session) => void
  setUser: (user: User) => void
  clear: () => void
}

/** Signed-in user. Persisted so a reload keeps the session; the API remains the source of truth. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    {
      name: 'ax-request-portal:session',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user }) => ({ token, user }),
    },
  ),
)
