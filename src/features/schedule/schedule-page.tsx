import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useReleases } from '@/api/queries'
import { useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { ProjectIcon } from '@/components/request/project-icon'
import { StatusBadge } from '@/components/request/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HqCalendarNote } from '@/components/ui/date-time'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback'
import { Segmented } from '@/components/ui/segmented'
import type { ReleaseScheduleItem } from '@/domain/model'
import { cn } from '@/lib/cn'
import { addDays, formatDate } from '@/lib/format'
import { hqToday } from '@/lib/time-zone'

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
            <section
              key={item.projectId}
              className={cn('rounded-(--radius-card) bg-surface p-4 ring-1 ring-line', past && 'opacity-75')}
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
                      className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
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
  const [projectId, setProjectId] = useState('all')
  const releases = useReleases(addDays(today, -45), addDays(today, 90))

  const { thisWeek, upcoming, past } = useMemo(() => {
    const items = (releases.data ?? []).filter((r) => projectId === 'all' || r.projectId === projectId)
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
  }, [releases.data, projectId, today])

  const sections = [
    { key: 'thisWeek', label: t('schedule.thisWeek'), groups: thisWeek },
    { key: 'upcoming', label: t('schedule.upcoming'), groups: upcoming },
    { key: 'past', label: t('schedule.past'), groups: past },
  ].filter((s) => s.groups.length)

  return (
    <>
      <PageHeader title={t('schedule.title')} description={t('schedule.subtitle')} />
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
      {releases.isPending ? (
        <ListSkeleton />
      ) : releases.isError ? (
        <ErrorState
          title={t('common.errorTitle')}
          action={
            <Button variant="secondary" onClick={() => void releases.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
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
