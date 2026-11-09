import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useReleases } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { ProjectIcon } from '@/components/request/project-icon'
import { StatusBadge } from '@/components/request/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HqCalendarNote } from '@/components/ui/date-time'
import { EmptyState, ListSkeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { Segmented } from '@/components/ui/segmented'
import type { ReleaseScheduleItem } from '@/domain/model'
import { cn } from '@/lib/cn'
import { addDays, formatDate, formatMonth, shiftMonth } from '@/lib/format'
import { hqToday } from '@/lib/time-zone'
import { TABLET_UP, useMediaQuery } from '@/lib/use-media-query'
import { isMonth, monthWeeks } from './month-grid'
import { MonthCalendar } from './month-view'

type View = 'list' | 'month'

function DateGroup({ date, items, today }: { date: string; items: ReleaseScheduleItem[]; today: string }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const past = date < today
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:gap-5">
      <div className="flex items-center gap-2 sm:w-36 sm:flex-col sm:items-start sm:pt-4">
        <span className={cn('text-[15px] font-bold', past ? 'text-ink-400' : 'text-ink-900')}>
          {formatDate(date)}
        </span>
        {date === today ? <Badge tone="action">{t('schedule.today')}</Badge> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const project = dir.project(item.projectId)
          return (
            // Past days sit on the muted tint instead of fading out: faded text loses its contrast.
            <section
              key={item.projectId}
              className={cn('rounded-(--radius-card) p-4 ring-1 ring-line', past ? 'bg-muted' : 'bg-surface')}
            >
              <div className="mb-2 flex items-center gap-2.5">
                <ProjectIcon icon={project?.icon} className="size-8 rounded-lg" />
                <h3 className="font-bold">{project?.name ?? item.projectId}</h3>
                <span className="text-sm text-ink-400">
                  {t('common.count', { count: item.requests.length })}
                </span>
              </div>
              <ul className="flex flex-col">
                {item.requests.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/requests/${r.id}`}
                      className={cn(
                        '-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5',
                        past ? 'hover:bg-surface' : 'hover:bg-muted',
                      )}
                    >
                      <span className="text-xs text-ink-400">#{r.id}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px]">{r.title}</span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </li>
  )
}

export default function SchedulePage() {
  const { t } = useTranslation()
  usePageTitle(t('schedule.title'))
  const dir = useDirectory()
  // Release dates are head-office calendar days, so "today" is the head office's.
  const today = hqToday()
  const thisMonth = today.slice(0, 7)
  const [projectId, setProjectId] = useState('all')
  const [params, setParams] = useSearchParams()
  // Seven columns need a tablet's width: phones keep the list, even from a link to the month.
  const roomy = useMediaQuery(TABLET_UP)
  const view: View = roomy && params.get('view') === 'month' ? 'month' : 'list'
  const asked = params.get('month')
  const month = isMonth(asked) ? asked : thisMonth
  const weeks = monthWeeks(month)
  const releases = useReleases(
    view === 'month' ? weeks[0]![0] : addDays(today, -45),
    view === 'month' ? weeks.at(-1)!.at(-1) : addDays(today, 90),
  )
  const items = useMemo(
    () => (releases.data ?? []).filter((r) => projectId === 'all' || r.projectId === projectId),
    [releases.data, projectId],
  )
  // Replaced, not pushed: Back leaves the schedule instead of stepping through every month looked at.
  const showView = (next: View) => setParams(next === 'month' ? { view: 'month' } : {}, { replace: true })
  const showMonth = (next: string) =>
    setParams(next === thisMonth ? { view: 'month' } : { view: 'month', month: next }, { replace: true })

  const { thisWeek, upcoming, past } = useMemo(() => {
    const byDate = new Map<string, ReleaseScheduleItem[]>()
    for (const item of items) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item])
    const dates = [...byDate.keys()].sort()
    const weekEnd = addDays(today, 6)
    return {
      thisWeek: dates.filter((d) => d >= today && d <= weekEnd).map((d) => [d, byDate.get(d)!] as const),
      upcoming: dates.filter((d) => d > weekEnd).map((d) => [d, byDate.get(d)!] as const),
      past: dates
        .filter((d) => d < today)
        .reverse()
        .map((d) => [d, byDate.get(d)!] as const),
    }
  }, [items, today])

  const sections = [
    { key: 'thisWeek', label: t('schedule.thisWeek'), groups: thisWeek },
    { key: 'upcoming', label: t('schedule.upcoming'), groups: upcoming },
    { key: 'past', label: t('schedule.past'), groups: past },
  ].filter((s) => s.groups.length)

  return (
    <>
      <PageHeader
        title={t('schedule.title')}
        description={t('schedule.subtitle')}
        actions={
          roomy ? (
            <Segmented
              label={t('schedule.view')}
              value={view}
              onChange={showView}
              options={[
                { value: 'list', label: t('schedule.viewList') },
                { value: 'month', label: t('schedule.viewMonth') },
              ]}
            />
          ) : null
        }
      />
      <HqCalendarNote className="-mt-2 mb-4" />
      <Segmented
        className="mb-5"
        label={t('schedule.allProjects')}
        value={projectId}
        onChange={setProjectId}
        options={[
          { value: 'all', label: t('schedule.allProjects') },
          ...dir.projects.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
      {view === 'month' ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('schedule.prevMonth')}
            onClick={() => showMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          {/* Announced, so a screen reader hears where the arrows went. */}
          <span aria-live="polite" className="min-w-32 text-center text-lg font-bold">
            {formatMonth(month)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('schedule.nextMonth')}
            onClick={() => showMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="ml-2"
            disabled={month === thisMonth}
            onClick={() => showMonth(thisMonth)}
          >
            {t('schedule.thisMonth')}
          </Button>
        </div>
      ) : null}
      <RefreshFailed {...refreshOf(releases)} className="mb-3" />
      {releases.isPending ? (
        <ListSkeleton />
      ) : releases.isLoadingError ? (
        <LoadFailed
          error={releases.error}
          onRetry={() => void releases.refetch()}
          retrying={releases.isFetching}
        />
      ) : view === 'month' ? (
        <>
          {/* Not while another range's data stands in: that would claim an empty month too early. */}
          {!releases.isPlaceholderData && !items.some((i) => i.date.startsWith(month)) ? (
            <p className="mb-3 text-[15px] text-ink-500">{t('schedule.emptyMonth')}</p>
          ) : null}
          <MonthCalendar
            key={month}
            month={month}
            weeks={weeks}
            today={today}
            items={items}
            busy={releases.isPlaceholderData}
          />
        </>
      ) : sections.length ? (
        <div className="flex flex-col gap-8">
          {sections.map((s) => (
            <section key={s.key} aria-labelledby={`sched-${s.key}`}>
              <h2 id={`sched-${s.key}`} className="mb-3 text-sm font-bold text-ink-500">
                {s.label}
              </h2>
              <ol className="flex flex-col gap-4">
                {s.groups.map(([date, items]) => (
                  <DateGroup key={date} date={date} items={items} today={today} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<CalendarDays className="size-6" aria-hidden />} title={t('schedule.empty')} />
      )}
    </>
  )
}
