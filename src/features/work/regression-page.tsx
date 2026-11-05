import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useRegressionQueue } from '@/api/queries'
import { useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { StatusBadge } from '@/components/request/status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback'
import { RegressionChecks } from '@/features/detail/developer-panels'

export default function RegressionPage() {
  const { t } = useTranslation()
  usePageTitle(t('regression.title'))
  const dir = useDirectory()
  const queue = useRegressionQueue()
  // Unfinished first: rows with pending checks are the ones that need a person.
  const items = [...(queue.data ?? [])].sort(
    (a, b) =>
      Number(b.checks.some((c) => c.result === 'pending')) -
      Number(a.checks.some((c) => c.result === 'pending')),
  )

  return (
    <>
      <PageHeader title={t('regression.title')} description={t('regression.subtitle')} />
      {queue.isPending ? (
        <ListSkeleton />
      ) : queue.isError ? (
        <ErrorState
          title={t('common.errorTitle')}
          action={
            <Button variant="secondary" onClick={() => void queue.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <Card key={item.requestId} aria-labelledby={`rg-${item.requestId}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="text-xs text-ink-400">#{item.requestId}</span>
                <span className="text-xs text-ink-400">· {dir.projectName(item.projectId)}</span>
              </div>
              <h2 id={`rg-${item.requestId}`} className="mb-3 text-[15px] font-bold">
                <Link to={`/requests/${item.requestId}`} className="hover:underline">
                  {item.title}
                </Link>
              </h2>
              <RegressionChecks requestId={item.requestId} checks={item.checks} editable />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ShieldCheck className="size-6" aria-hidden />} title={t('regression.empty')} />
      )}
    </>
  )
}
