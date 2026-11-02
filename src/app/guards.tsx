import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router'
import { useMe } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/feedback'
import type { Permission } from '@/domain/roles'
import { useSession } from '@/stores/session'
import { useCan } from './hooks'

/** Sends signed-out visitors to /login and keeps the stored user fresh. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useSession((s) => s.token)
  const user = useSession((s) => s.user)
  const setUser = useSession((s) => s.setUser)
  const location = useLocation()
  const me = useMe()

  useEffect(() => {
    if (me.data) setUser(me.data)
  }, [me.data, setUser])

  if (!token || !user) {
    const next = location.pathname + location.search
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <>{children}</>
}

/** Renders a friendly "not allowed" page instead of the route when a permission is missing. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const can = useCan()
  const { t } = useTranslation()
  if (!can(permission)) {
    return (
      <ErrorState
        title={t('errors.forbidden')}
        action={
          <Button asChild variant="secondary">
            <Link to="/">{t('common.goHome')}</Link>
          </Button>
        }
      />
    )
  }
  return <>{children}</>
}
