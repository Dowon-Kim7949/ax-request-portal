import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useDashboard } from '@/api/queries'
import { useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Meter } from '@/components/ui/controls'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import type { DashboardSummary } from '@/domain/model'
import { cn } from '@/lib/cn'
import { formatDate, formatKrw, formatMonth, toLocalDate } from '@/lib/format'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Stat tile: label · value · one supporting line. */
function StatTile({
  label,
  value,
  note,
  noteTone = 'muted',
  children,
}: {
  label: string
  value: string
  note?: ReactNode
  noteTone?: 'muted' | 'warning'
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink-500">{label}</p>
        {note ? (
          <p
            className={cn(
              'flex items-center gap-1 text-xs font-semibold',
              noteTone === 'warning' ? 'text-warning-fg' : 'text-ink-500',
            )}
          >
            {noteTone === 'warning' ? <AlertTriangle className="size-3.5" aria-hidden /> : null}
            {note}
          </p>
        ) : null}
      </div>
      <p className="text-[28px] leading-tight font-bold tracking-tight text-ink-900">{value}</p>
      {children}
    </div>
  )
}

/**
 * Stacked horizontal bars: done (brand) + in progress (ai), 12px thick,
 * 2px surface gap between segments, rounded data-end, square baseline.
 * Each segment is focusable and shows its value on hover/focus.
 */
function ProjectBars({ rows }: { rows: DashboardSummary['byProject'] }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.done + r.inProgress))

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const name = dir.project(row.projectId)?.name ?? row.projectId
        const segments = [
          { key: 'done', value: row.done, color: 'bg-brand-600', label: t('dashboard.legendDone') },
          { key: 'open', value: row.inProgress, color: 'bg-ai-500', label: t('dashboard.legendOpen') },
        ].filter((s) => s.value > 0)
        return (
          <li key={row.projectId} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-ink-900">{name}</span>
              <span className="shrink-0 text-ink-500 tabular-nums">
                {t('dashboard.rowValue', { done: row.done, open: row.inProgress })}
              </span>
            </div>
            <div
              className="relative flex h-3 gap-0.5"
              style={{ width: `${((row.done + row.inProgress) / max) * 100}%` }}
            >
              {segments.map((s, i) => {
                const id = `${row.projectId}-${s.key}`
                const last = i === segments.length - 1
                return (
                  <span
                    key={s.key}
                    tabIndex={0}
                    role="img"
                    aria-label={`${name} ${s.label} ${s.value}`}
                    onPointerEnter={() => setActive(id)}
                    onPointerLeave={() => setActive((a) => (a === id ? null : a))}
                    onFocus={() => setActive(id)}
                    onBlur={() => setActive((a) => (a === id ? null : a))}
                    className={cn(
                      'relative h-full outline-offset-2 transition-[filter] hover:brightness-110 focus-visible:outline-2',
                      s.color,
                      last && 'rounded-r-[4px]',
                    )}
                    style={{ flexGrow: s.value, flexBasis: 0 }}
                  >
                    {active === id ? (
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-inverse px-2.5 py-1.5 text-xs whitespace-nowrap text-on-inverse shadow-lg">
                        <strong className="text-sm">{s.value}</strong>{' '}
                        <span className="text-on-inverse/70">{s.label}</span>
                      </span>
                    ) : null}
                  </span>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Legend() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 text-xs text-ink-600">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-brand-600" aria-hidden />
        {t('dashboard.legendDone')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-ai-500" aria-hidden />
        {t('dashboard.legendOpen')}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  usePageTitle(t('dashboard.title'))
  const dir = useDirectory()
  const current = toLocalDate().slice(0, 7)
  const [month, setMonth] = useState(current)
  const query = useDashboard(month)
  const data = query.data
  const stale = query.isFetching && query.isPlaceholderData

  const delta = data ? data.received - data.receivedPrevMonth : 0
  const budgetPct = data && data.aiBudgetKrw > 0 ? (data.aiCostKrw / data.aiBudgetKrw) * 100 : 0

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.subtitle', { month: formatMonth(month) })}
      />

      {/* Filters: one row, above everything they scope */}
      <div className="mb-4 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('dashboard.prevMonth')}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="min-w-28 text-center font-bold">{formatMonth(month)}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('dashboard.nextMonth')}
          disabled={month >= current}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : query.isError || !data ? (
        <ErrorState
          title={t('common.errorTitle')}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <div
          className={cn('flex flex-col gap-4 transition-opacity', stale && 'opacity-60')}
          aria-busy={stale}
        >
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={t('dashboard.received')}
              value={t('common.count', { count: data.received })}
              note={t('dashboard.receivedDelta', { delta: `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}` })}
            />
            <StatTile
              label={t('dashboard.inProgress')}
              value={t('common.count', { count: data.inProgress })}
              note={data.delayed ? t('dashboard.delayed', { count: data.delayed }) : undefined}
              noteTone="warning"
            />
            <StatTile
              label={t('dashboard.done')}
              value={t('common.count', { count: data.done })}
              note={
                data.avgLeadTimeDays !== undefined
                  ? t('dashboard.leadTime', { days: data.avgLeadTimeDays })
                  : undefined
              }
            />
            <StatTile
              label={t('dashboard.aiCost')}
              value={formatKrw(data.aiCostKrw)}
              note={t('dashboard.aiBudget', { pct: Math.round(budgetPct) })}
              noteTone={budgetPct >= 80 ? 'warning' : 'muted'}
            >
              <div className="mt-1.5">
                <Meter value={budgetPct} warnAt={80} label={t('dashboard.aiCost')} />
              </div>
            </StatTile>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.byProject')}</CardTitle>
                <Legend />
              </CardHeader>
              <ProjectBars rows={data.byProject} />
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('dashboard.upcoming')}</CardTitle>
                </CardHeader>
                {data.upcomingReleases.length ? (
                  <ul className="flex flex-col gap-2 text-sm">
                    {data.upcomingReleases.map((r) => (
                      <li key={`${r.date}-${r.projectId}`} className="flex items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-ink-400" aria-hidden />
                        <span className="font-semibold">{formatDate(r.date)}</span>
                        <span className="min-w-0 truncate text-ink-600">
                          {dir.project(r.projectId)?.name} ·{' '}
                          {t('common.count', { count: r.requestIds.length })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-500">{t('dashboard.noUpcoming')}</p>
                )}
                <Link to="/schedule" className="mt-3 inline-block text-sm font-semibold text-accent">
                  {t('common.seeAll')} ›
                </Link>
              </Card>

              <section
                aria-labelledby="attention"
                className="rounded-(--radius-card) bg-warning-50 p-4 sm:p-5"
              >
                <h2
                  id="attention"
                  className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-warning-fg"
                >
                  <AlertTriangle className="size-4" aria-hidden />
                  {t('dashboard.attention')}
                </h2>
                {data.attention.infoNeeded || data.attention.delayedRequestIds.length ? (
                  <ul className="flex flex-col gap-1 text-sm text-ink-700">
                    {data.attention.infoNeeded ? (
                      <li>{t('dashboard.infoWaiting', { count: data.attention.infoNeeded })}</li>
                    ) : null}
                    {data.attention.delayedRequestIds.length ? (
                      <li>
                        {t('dashboard.delayedList', { count: data.attention.delayedRequestIds.length })}{' '}
                        {data.attention.delayedRequestIds.map((id) => (
                          <Link key={id} to={`/requests/${id}`} className="mr-1 font-semibold underline">
                            #{id}
                          </Link>
                        ))}
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-600">{t('dashboard.nothing')}</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
