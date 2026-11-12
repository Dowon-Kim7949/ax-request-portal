import { Search, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useRequests } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { Page, PageHeader, PageScroll, PageTop } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { RequestCard } from '@/components/request/request-card'
import { Button } from '@/components/ui/button'
import { EmptyState, ListSkeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { Input } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { isTerminal, turnOf } from '@/domain/lifecycle'
import type { WorkRequestSummary } from '@/domain/model'
import { DraftsSection } from '@/features/drafts/drafts-section'

type Filter = 'open' | 'myTurn' | 'closed' | 'all'

const FILTERS: Record<Filter, (r: WorkRequestSummary) => boolean> = {
  open: (r) => !isTerminal(r.status),
  myTurn: (r) => turnOf(r.status) === 'requester',
  closed: (r) => isTerminal(r.status),
  all: () => true,
}

/** How long typing pauses before the search goes to the server. */
const SEARCH_DELAY_MS = 250

/** `value`, once it has stopped changing for `ms`. */
function useSettled(value: string, ms: number): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return settled
}

export default function MyRequestsPage() {
  const { t } = useTranslation()
  usePageTitle(t('requests.title'))
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') as Filter | null) ?? 'open'
  const [q, setQ] = useState('')
  // The server searches (`q` matches the title or #id), so a long history need not be loaded whole.
  // The filter's counts stay those of every request; without a search both are one query.
  const needle = useSettled(q.trim(), SEARCH_DELAY_MS)
  const all = useRequests({ scope: 'mine' })
  const list = useRequests(needle ? { scope: 'mine', q: needle } : { scope: 'mine' })

  const counts = useMemo(() => {
    const data = all.data ?? []
    return Object.fromEntries(
      (Object.keys(FILTERS) as Filter[]).map((f) => [f, data.filter(FILTERS[f]).length]),
    ) as Record<Filter, number>
  }, [all.data])

  const shown = useMemo(() => (list.data ?? []).filter(FILTERS[filter] ?? FILTERS.open), [list.data, filter])

  return (
    <Page>
      <PageTop>
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
      </PageTop>
      <PageScroll label={t('common.listOf', { title: t('requests.title') })} className="@container">
        {/* Above the requests, apart from their filter and search. */}
        <DraftsSection variant="page" className="mb-6" />
        {/* On a big screen the filter stays at the top of the list once the drafts have scrolled away. */}
        <div className="flex flex-col gap-3 bg-canvas pb-4 sm:flex-row sm:items-center sm:justify-between fit:sticky fit:top-0 fit:z-10">
          <Segmented
            label={t('requests.title')}
            value={filter}
            onChange={(f) => setParams({ filter: f }, { replace: true })}
            options={(['open', 'myTurn', 'closed', 'all'] as const).map((f) => ({
              value: f,
              label: t(`requests.filter.${f}`),
              count: all.data ? counts[f] : undefined,
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
          <div
            // The previous results stand in while a new search loads.
            aria-busy={list.isPlaceholderData || undefined}
            className="grid grid-cols-1 gap-3 lg:grid-cols-2 @min-[84rem]:grid-cols-3"
          >
            {shown.map((r) => (
              <RequestCard key={r.id} request={r} myTurn={turnOf(r.status) === 'requester'} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={all.data?.length ? t('requests.emptyFiltered') : t('requests.empty')}
            action={
              all.data?.length ? null : (
                <Button asChild>
                  <Link to="/requests/new">{t('home.newRequestCta')}</Link>
                </Button>
              )
            }
          />
        )}
      </PageScroll>
    </Page>
  )
}
