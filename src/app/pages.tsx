import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/feedback'
import { isChunkLoadError } from './update-check'

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

/** Developer-facing text for an error; never shown to users of a production build. */
function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  return String(error)
}

const reload = () => window.location.reload()

/**
 * What a screen shows when it fails to load or render. The raw error (module
 * URLs, stack) goes to the console, and to the page only in development.
 */
export function RouteErrorView({
  error,
  showDetail = import.meta.env.DEV,
}: {
  error: unknown
  showDetail?: boolean
}) {
  const { t } = useTranslation()
  const chunk = isChunkLoadError(error)

  useEffect(() => {
    console.error('[route] the screen failed to load', error)
  }, [error])

  const detail = showDetail ? (
    <details className="w-full max-w-md text-left text-xs text-ink-500">
      <summary className="cursor-pointer rounded font-semibold">{t('routeError.detail')}</summary>
      <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-muted p-3 break-words whitespace-pre-wrap">
        {describe(error)}
      </pre>
    </details>
  ) : null

  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorState
        title={chunk ? t('routeError.chunkTitle') : t('common.errorTitle')}
        body={chunk ? t('routeError.chunkBody') : t('routeError.body')}
        action={
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {chunk ? null : (
                <Button asChild variant="secondary">
                  <Link to="/">{t('common.goHome')}</Link>
                </Button>
              )}
              <Button variant={chunk ? 'primary' : 'secondary'} onClick={reload}>
                {t('routeError.reload')}
              </Button>
            </div>
            {detail}
          </>
        }
      />
    </div>
  )
}

export function RouteErrorPage() {
  return <RouteErrorView error={useRouteError()} />
}
