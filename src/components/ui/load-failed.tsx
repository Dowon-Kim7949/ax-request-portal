import { CircleAlert } from 'lucide-react'
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
 * another try. Use it wherever "nothing here" would otherwise be shown.
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
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line',
        className,
      )}
    >
      <CircleAlert className="size-5 shrink-0 text-danger-fg" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold text-ink-900">{t('loadError.title')}</span>{' '}
        <span className="text-ink-500">{body}</span>
      </p>
      {retry}
    </div>
  )
}
