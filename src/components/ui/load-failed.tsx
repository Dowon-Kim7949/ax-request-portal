import { CircleAlert, CloudOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { errorText } from '@/api/error-text'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { ErrorState } from './feedback'

interface LoadFailedProps {
  /** The query's error: an API message (no connection, too slow, no permission…) is shown as is */
  error?: unknown
  onRetry: () => void
  /** The retry is running (`isFetching`) */
  retrying?: boolean
  /** One line inside a section, instead of a full-width block */
  compact?: boolean
  className?: string
}

/**
 * Data that could not be loaded: says so instead of looking empty, and offers
 * another try. Use it wherever "nothing here" would otherwise be shown — only
 * when there is nothing to show; a failed refresh of data already on screen
 * is `RefreshFailed`.
 *
 * The full block is an alert (the screen has nothing else). The compact line
 * is a polite status: a screen can hold several, and the same failure read
 * out as one interruption after another helps nobody.
 */
export function LoadFailed({ error, onRetry, retrying, compact, className }: LoadFailedProps) {
  const { t } = useTranslation()
  const body = errorText(error, t('loadError.body'))
  const retry = (
    <Button variant="secondary" loading={retrying} onClick={onRetry}>
      {t('common.retry')}
    </Button>
  )
  if (!compact) return <ErrorState title={t('loadError.title')} body={body} action={retry} />
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line',
        className,
      )}
    >
      <CircleAlert className="size-5 shrink-0 text-danger-fg" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold text-ink-900">{t('loadError.title')}</span>
        {/* Read as two sentences, not one run-on line. */}
        <span className="sr-only">. </span> <span className="text-ink-500">{body}</span>
      </p>
      {retry}
    </div>
  )
}

interface RefreshFailedProps {
  /** A refresh failed; what is on screen is from an earlier load */
  failed: boolean
  onRetry: () => void
  retrying?: boolean
  className?: string
}

/**
 * A refresh (a poll, a return to the tab, a retry) failed while the screen
 * still shows what was loaded before. The data stays, so the person can go
 * on reading; one line says it may be out of date and offers another try.
 *
 * Always rendered, as a polite status that is visually hidden until a refresh
 * fails, so screen readers hear the line appear; hidden, it takes no room in
 * a flex or grid layout either.
 */
export function RefreshFailed({ failed, onRetry, retrying, className }: RefreshFailedProps) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className={
        failed
          ? cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-warning-50 py-1.5 pr-1.5 pl-3.5 text-sm text-warning-fg',
              className,
            )
          : 'sr-only'
      }
    >
      {failed ? (
        <>
          <CloudOff className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">{t('loadError.stale')}</p>
          <Button variant="ghost" size="sm" loading={retrying} onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
