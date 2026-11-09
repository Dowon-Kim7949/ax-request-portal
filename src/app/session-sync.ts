import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { SESSION_STORAGE_KEY, sessionChangeFrom, useSession } from '@/stores/session'

/**
 * A 401 from the API: the server no longer accepts the token. Drops the
 * session and every cached response; the login screen then keeps `next` so
 * the same person returns to the page they had open.
 *
 * `token` is the one the refused request carried. Only a refusal of the
 * current token ends the session: a request still in flight while signing out
 * (the session already ended, and its reason stands) or one sent before
 * signing in again (a newer session) changes nothing.
 */
export function expireSession(queryClient: QueryClient, token: string | null): void {
  const session = useSession.getState()
  if (!session.token || session.token !== token) return
  queryClient.clear()
  session.clear('expired')
}

/**
 * Follows sign-ins and sign-outs made in other tabs of this browser
 * (`storage` events on the persisted session). It also re-reads the session
 * once it starts listening, for a change made while this tab was still
 * starting up, and when the page comes back from the back/forward cache: both
 * miss those events, and writing the stale session back would undo the change.
 *
 * - Signed out elsewhere: drop the session and the cache; `RequireAuth` shows
 *   the login screen without `next`, as after a sign-out here.
 * - Expired elsewhere: the same, as an expiry: `next` and the notice stay, as
 *   after this tab's own 401.
 * - Signed in elsewhere while this tab was signed out: take the session; the
 *   login screen moves on by itself.
 * - Signed in as someone else: take the new session, drop the previous
 *   person's cached data and go home.
 * - Same person, new token: update it quietly.
 */
export function useSessionSync(): void {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const apply = (stored: string | null) => {
      const session = useSession.getState()
      const change = sessionChangeFrom(session, stored)
      if (!change) return
      switch (change.kind) {
        case 'refreshed':
          session.setSession(change.session)
          return
        case 'signedOut':
        case 'expired':
          queryClient.clear()
          session.clear(change.kind)
          return
        case 'signedIn':
          queryClient.clear()
          session.setSession(change.session)
          return
        case 'switchedUser':
          queryClient.clear()
          session.setSession(change.session)
          void navigate('/', { replace: true })
          toast.info(t('auth.switchedAccount', { name: change.session.user.name }))
          return
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return
      // key null: the other tab cleared all of localStorage.
      if (e.key === null) apply(null)
      else if (e.key === SESSION_STORAGE_KEY) apply(e.newValue)
    }
    const reread = () => {
      try {
        apply(localStorage.getItem(SESSION_STORAGE_KEY))
      } catch {
        // Storage blocked: nothing to follow.
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reread()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('pageshow', onPageShow)
    // The store was read from storage when the app's code loaded; until now (the mock API may take
    // seconds to start) nothing was listening. Rendered before the routes, so this runs before
    // `RequireAuth` can save the session again.
    reread()
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [queryClient, navigate, t])
}
