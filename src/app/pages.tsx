import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/feedback'

export function ComingSoonPage() {
  const { t } = useTranslation()
  return <EmptyState icon={<Construction className="size-6" aria-hidden />} title={t('common.comingSoon')} />
}

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <ErrorState
      title={t('common.notFoundTitle')}
      body={t('common.notFoundBody')}
      action={
        <Button asChild variant="secondary">
          <Link to="/">{t('common.goHome')}</Link>
        </Button>
      }
    />
  )
}

export function RouteErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined
  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorState
        title={t('common.errorTitle')}
        body={detail}
        action={
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t('common.retry')}
          </Button>
        }
      />
    </div>
  )
}
