import { Check } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useDirectory } from '@/app/hooks'
import { ProjectIcon } from '@/components/request/project-icon'
import { StatusBadge } from '@/components/request/status'
import type { ReleaseScheduleItem } from '@/domain/model'
import { cn } from '@/lib/cn'
import { formatDate, formatMonth, formatWeekday } from '@/lib/format'

/** Releases a day holds before the rest fold behind a button (which takes the last row). */
const ROWS = 3

type DayRelease = ReleaseScheduleItem['requests'][number] & { projectId: string }

/** "1", or "11월 1일" / "Nov 1" on the first of a month, as calendars mark where a month starts. */
function dayLabel(date: string): string {
  return date.endsWith('-01') ? formatDate(date, { weekday: false }) : String(Number(date.slice(8)))
}

function ReleaseChip({ release }: { release: DayRelease }) {
  const dir = useDirectory()
  const project = dir.project(release.projectId)
  const done = release.status === 'done'
  return (
    <li>
      <Link
        to={`/requests/${release.id}`}
        title={release.title}
        className={cn(
          'flex min-h-6 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold',
          done
            ? 'bg-muted text-ink-600 ring-1 ring-line ring-inset hover:bg-line/60'
            : 'bg-brand-50 text-accent-strong hover:bg-brand-100',
        )}
      >
        {/* The space sits outside the span, where no name computation trims it; the flex row does not draw it. */}
        <span className="sr-only">#{release.id}</span>{' '}
        <ProjectIcon
          icon={project?.icon}
          className="size-3.5 rounded-none bg-transparent text-current [&_svg]:size-3.5"
        />
        <span className="min-w-0 flex-1 truncate">{release.title}</span>
        {done ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
        <span className="sr-only">
          , {project?.name ?? release.projectId}, <StatusBadge status={release.status} />
        </span>
      </Link>
    </li>
  )
}

function DayCell({
  date,
  month,
  today,
  releases,
}: {
  date: string
  month: string
  today: string
  releases: DayRelease[]
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const isToday = date === today
  const past = date < today
  const folds = releases.length > ROWS
  const shown = folds && !open ? releases.slice(0, ROWS - 1) : releases
  return (
    <td
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'h-24 border-t border-l border-line p-1 align-top first:border-l-0 lg:h-28',
        // Past days sit on the muted tint, as in the list: fading them out would cost their text its contrast.
        past ? 'bg-muted' : 'bg-surface',
      )}
    >
      <div className="mb-1 flex">
        <span
          aria-hidden
          className={cn(
            'grid h-6 min-w-6 place-items-center rounded-full px-1 text-[13px] font-semibold',
            isToday
              ? 'bg-brand-600 text-white'
              : past || !date.startsWith(month)
                ? 'text-ink-400'
                : 'text-ink-900',
          )}
        >
          {dayLabel(date)}
        </span>
        <span className="sr-only">
          {formatDate(date)}
          {isToday ? `, ${t('schedule.today')}` : ''}
        </span>
      </div>
      {releases.length ? (
        <ul id={listId} className="flex flex-col gap-1">
          {shown.map((r) => (
            <ReleaseChip key={r.id} release={r} />
          ))}
        </ul>
      ) : null}
      {folds ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className="mt-1 flex min-h-6 w-full items-center rounded-md px-1.5 text-left text-xs font-semibold text-ink-600 hover:bg-line/60"
        >
          {open ? t('schedule.less') : t('schedule.more', { count: releases.length - (ROWS - 1) })}
        </button>
      ) : null}
    </td>
  )
}

/**
 * A month of releases, one cell per head-office day, Sunday first. A table, so
 * a screen reader announces each day's weekday and moves by week and by day.
 */
export function MonthCalendar({
  month,
  weeks,
  today,
  items,
  busy,
}: {
  /** YYYY-MM */
  month: string
  /** From `monthWeeks(month)` */
  weeks: string[][]
  /** The head office's today */
  today: string
  items: ReleaseScheduleItem[]
  /** Still showing another range's data while this one loads */
  busy: boolean
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, DayRelease[]>()
    for (const item of items) {
      const day = map.get(item.date) ?? []
      for (const r of item.requests) day.push({ ...r, projectId: item.projectId })
      map.set(item.date, day)
    }
    return map
  }, [items])
  return (
    <div className="overflow-hidden rounded-(--radius-card) bg-surface ring-1 ring-line">
      <table className="w-full table-fixed border-collapse" aria-busy={busy || undefined}>
        <caption className="sr-only">{formatMonth(month)}</caption>
        <thead>
          <tr>
            {weeks[0]!.map((date) => (
              <th key={date} scope="col" className="py-2 text-xs font-semibold text-ink-500">
                <span aria-hidden>{formatWeekday(date)}</span>
                <span className="sr-only">{formatWeekday(date, 'long')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((date) => (
                <DayCell
                  key={date}
                  date={date}
                  month={month}
                  today={today}
                  releases={byDate.get(date) ?? []}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
