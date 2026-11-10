import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router'
import { useMe } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/feedback'
import type { Permission } from '@/domain/roles'
import { useSession } from '@/stores/session'
import { useCan } from './hooks'
import { PagePlain } from './page'
import { useSessionSync } from './session-sync'

export const LOGIN_PATH = '/login'

/**
 * Sends signed-out visitors to /login and keeps the stored user fresh.
 * The login screen gets `next` (this page) unless the person signed out on
 * purpose: then the next sign-in, possibly by someone else, starts at home.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useSession((s) => s.token)
  const user = useSession((s) => s.user)
  const signedOut = useSession((s) => s.ended?.reason === 'signedOut')
  const setUser = useSession((s) => s.setUser)
  const location = useLocation()
  const me = useMe()

  useEffect(() => {
    if (me.data) setUser(me.data)
  }, [me.data, setUser])

  if (!token || !user) {
    const next = location.pathname + location.search + location.hash
    const keepNext = !signedOut && next !== '/'
    return <Navigate to={keepNext ? `${LOGIN_PATH}?next=${encodeURIComponent(next)}` : LOGIN_PATH} replace />
  }
  return <>{children}</>
}

/** Follows sign-ins and sign-outs made in other tabs (see useSessionSync). Rendered once, at the root route. */
export function SessionSync() {
  useSessionSync()
  return null
}

/**
 * Renders a friendly "not allowed" page instead of the route when a permission is missing.
 * It brings the page width and padding, which the shell leaves to `fit` pages (`RouteHandle.fit`).
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const can = useCan()
  const { t } = useTranslation()
  if (!can(permission)) {
    const denied = (
      <ErrorState
        title={t('errors.forbidden')}
        action={
          <Button asChild variant="secondary">
            <Link to="/">{t('common.goHome')}</Link>
          </Button>
        }
      />
    )
    return <PagePlain>{denied}</PagePlain>
  }
  return <>{children}</>
}
