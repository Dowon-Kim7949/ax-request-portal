import { BellOff, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useMarkNotificationRead, useNotifications } from '@/api/queries'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback'
import type { Notification } from '@/domain/model'
import { cn } from '@/lib/cn'
import { describeDateTime, formatRelative } from '@/lib/format'

export default function NotificationsPage() {
  const { t } = useTranslation()
  usePageTitle(t('notifications.title'))
  const navigate = useNavigate()
  const list = useNotifications()
  const mark = useMarkNotificationRead()
  const unread = list.data?.filter((n) => !n.readAt).length ?? 0

  const open = (n: Notification) => {
    if (!n.readAt) mark.mutate(n.id)
    if (n.requestId) navigate(`/requests/${n.requestId}`)
  }

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        actions={
          unread ? (
            <Button
              variant="secondary"
              onClick={() => mark.mutate('all')}
              loading={mark.isPending && mark.variables === 'all'}
            >
              <CheckCheck aria-hidden />
              {t('notifications.markAll')}
            </Button>
          ) : null
        }
      />
      {list.isPending ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState
          title={t('common.errorTitle')}
          action={
            <Button variant="secondary" onClick={() => void list.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : list.data.length ? (
        <ul className="flex flex-col overflow-hidden rounded-(--radius-card) bg-surface ring-1 ring-line">
          {list.data.map((n) => (
            <li key={n.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  'flex w-full gap-3 px-4 py-3.5 text-left hover:bg-muted sm:px-5',
                  !n.readAt && 'bg-brand-50/50',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    n.readAt ? 'bg-transparent' : 'bg-brand-600',
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn('text-[15px]', n.readAt ? 'text-ink-700' : 'font-bold text-ink-900')}>
                    {n.title}
                    {n.readAt ? null : <span className="sr-only"> ({t('notifications.unread')})</span>}
                  </span>
                  <span className="line-clamp-2 text-sm text-ink-500">{n.body}</span>
                  <time
                    dateTime={n.createdAt}
                    title={describeDateTime(n.createdAt).text}
                    className="text-xs text-ink-400"
                  >
                    {formatRelative(n.createdAt)}
                  </time>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<BellOff className="size-6" aria-hidden />} title={t('notifications.empty')} />
      )}
    </>
  )
}
