import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useRequests } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { useDirectory } from '@/app/hooks'
import { Page, PageHeader, PageScroll, PageTop } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { RequestCard } from '@/components/request/request-card'
import { Select } from '@/components/ui/controls'
import { EmptyState, ListSkeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { Segmented } from '@/components/ui/segmented'
import { isTerminal, turnOf } from '@/domain/lifecycle'
import type { WorkRequestSummary } from '@/domain/model'

type Filter = 'myTurn' | 'ai' | 'waiting' | 'open' | 'closed'

const FILTERS: Record<Filter, (r: WorkRequestSummary) => boolean> = {
  myTurn: (r) => turnOf(r.status) === 'developer',
  ai: (r) => turnOf(r.status) === 'ai',
  waiting: (r) => turnOf(r.status) === 'requester',
  open: (r) => !isTerminal(r.status),
  closed: (r) => isTerminal(r.status),
}

export default function AssignedPage() {
  const { t } = useTranslation()
  usePageTitle(t('work.title'))
  const dir = useDirectory()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') as Filter | null) ?? 'myTurn'
  const projectId = params.get('project') ?? ''
  const list = useRequests({ scope: 'assigned', ...(projectId ? { projectId } : {}) })

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const counts = useMemo(() => {
    const data = list.data ?? []
    return Object.fromEntries(
      (Object.keys(FILTERS) as Filter[]).map((f) => [f, data.filter(FILTERS[f]).length]),
    ) as Record<Filter, number>
  }, [list.data])

  const shown = (list.data ?? []).filter(FILTERS[filter] ?? FILTERS.myTurn)

  return (
    <Page>
      <PageTop>
        <PageHeader title={t('work.title')} description={t('work.subtitle')} />
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            label={t('work.title')}
            value={filter}
            onChange={(f) => set('filter', f)}
            options={(Object.keys(FILTERS) as Filter[]).map((f) => ({
              value: f,
              label: t(`work.filter.${f}`),
              count: list.data ? counts[f] : undefined,
            }))}
          />
          <Select
            className="lg:w-56"
            aria-label={t('work.allProjects')}
            value={projectId}
            onChange={(e) => set('project', e.target.value)}
          >
            <option value="">{t('work.allProjects')}</option>
            {dir.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <RefreshFailed {...refreshOf(list)} className="mb-3" />
      </PageTop>

      {/* Three columns once a card can keep its details on one line (a 1344 px list, as on FHD). */}
      <PageScroll label={t('work.listLabel')} className="@container">
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isLoadingError ? (
          <LoadFailed error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} />
        ) : shown.length ? (
          <div
            className={`grid grid-cols-1 gap-3 lg:grid-cols-2 @min-[84rem]:grid-cols-3 ${list.isFetching ? 'opacity-90' : ''}`}
          >
            {shown.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                myTurn={turnOf(r.status) === 'developer'}
                showRequester
                showDates
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t('work.empty')} />
        )}
      </PageScroll>
    </Page>
  )
}
