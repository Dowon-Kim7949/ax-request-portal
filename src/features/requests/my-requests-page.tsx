import { Search, SquarePen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useRequests } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { RequestCard } from '@/components/request/request-card'
import { Button } from '@/components/ui/button'
import { EmptyState, ListSkeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { Input } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { isTerminal, turnOf } from '@/domain/lifecycle'
import type { WorkRequestSummary } from '@/domain/model'

type Filter = 'open' | 'myTurn' | 'closed' | 'all'

const FILTERS: Record<Filter, (r: WorkRequestSummary) => boolean> = {
  open: (r) => !isTerminal(r.status),
  myTurn: (r) => turnOf(r.status) === 'requester',
  closed: (r) => isTerminal(r.status),
  all: () => true,
}

export default function MyRequestsPage() {
  const { t } = useTranslation()
  usePageTitle(t('requests.title'))
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') as Filter | null) ?? 'open'
  const [q, setQ] = useState('')
  const list = useRequests({ scope: 'mine' })

  const counts = useMemo(() => {
    const data = list.data ?? []
    return Object.fromEntries(
      (Object.keys(FILTERS) as Filter[]).map((f) => [f, data.filter(FILTERS[f]).length]),
    ) as Record<Filter, number>
  }, [list.data])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return (list.data ?? [])
      .filter(FILTERS[filter] ?? FILTERS.open)
      .filter((r) => !needle || r.title.toLowerCase().includes(needle) || String(r.id) === needle)
  }, [list.data, filter, q])

  return (
    <>
      <PageHeader
        title={t('requests.title')}
        actions={
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/requests/new">
              <SquarePen aria-hidden />
              {t('nav.newRequest')}
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label={t('requests.title')}
          value={filter}
          onChange={(f) => setParams({ filter: f }, { replace: true })}
          options={(['open', 'myTurn', 'closed', 'all'] as const).map((f) => ({
            value: f,
            label: t(`requests.filter.${f}`),
            count: list.data ? counts[f] : undefined,
          }))}
        />
        <label className="relative sm:w-64">
          <span className="sr-only">{t('requests.search')}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('requests.search')}
            className="h-11 pl-10"
          />
        </label>
      </div>

      <RefreshFailed {...refreshOf(list)} className="mb-3" />
      {list.isPending ? (
        <ListSkeleton />
      ) : list.isLoadingError ? (
        <LoadFailed error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : shown.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((r) => (
            <RequestCard key={r.id} request={r} myTurn={turnOf(r.status) === 'requester'} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={list.data?.length ? t('requests.emptyFiltered') : t('requests.empty')}
          action={
            list.data?.length ? null : (
              <Button asChild>
                <Link to="/requests/new">{t('home.newRequestCta')}</Link>
              </Button>
            )
          }
        />
      )}
    </>
  )
}
