import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useDirectory } from '@/app/hooks'
import { Badge } from '@/components/ui/badge'
import { isTerminal } from '@/domain/lifecycle'
import type { WorkRequestSummary } from '@/domain/model'
import { formatDate, formatRelative } from '@/lib/format'
import { hqToday } from '@/lib/time-zone'
import { StatusBadge } from './status'

interface RequestCardProps {
  request: WorkRequestSummary
  myTurn?: boolean
  showRequester?: boolean
  /** Add the wanted-by and release dates, flagged once past while the request is open */
  showDates?: boolean
}

/** One request in a list. The whole card is the link — large touch target on phones. */
export function RequestCard({ request, myTurn, showRequester, showDates }: RequestCardProps) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const project = dir.project(request.projectId)
  const requester = dir.user(request.requesterId)

  return (
    <Link
      to={`/requests/${request.id}`}
      className="group flex items-center gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line transition-shadow hover:shadow-md hover:ring-field focus-visible:outline-offset-2 sm:p-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={request.status} />
          {myTurn ? <Badge tone="action">{t('requests.myTurnBadge')}</Badge> : null}
          <span className="text-xs text-ink-400">#{request.id}</span>
        </div>
        <p className="line-clamp-2 text-[15px] leading-snug font-bold text-ink-900">{request.title}</p>
        <p className="flex flex-wrap gap-x-2 text-[13px] text-ink-500">
          <span>{project?.name ?? request.projectId}</span>
          <span aria-hidden>·</span>
          <span>{t(`requestType.${request.type}.label`)}</span>
          {showRequester && requester ? (
            <>
              <span aria-hidden>·</span>
              <span>{requester.name}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>{t('requests.updated', { time: formatRelative(request.updatedAt) })}</span>
        </p>
        {showDates ? <RequestDates request={request} /> : null}
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  )
}

/**
 * The requester's wanted-by date and the release date, as written (calendar
 * dates). One before the head office's today is past due while the request is
 * still open; "past due" is spelled out, not shown by colour alone.
 */
function RequestDates({ request }: { request: WorkRequestSummary }) {
  const { t } = useTranslation()
  const open = !isTerminal(request.status)
  const today = hqToday()
  const dates = [
    request.desiredDate
      ? { key: 'wanted', date: request.desiredDate, label: 'requests.wantedBy' as const }
      : null,
    request.scheduledDate
      ? { key: 'release', date: request.scheduledDate, label: 'requests.releaseOn' as const }
      : null,
  ].filter((d) => d !== null)
  if (!dates.length) return null

  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-600">
      {dates.map(({ key, date, label }, i) => {
        const text = t(label, { date: formatDate(date) })
        const late = open && date < today
        return (
          // The spaces sit between elements, so assistive tech reads the dates apart.
          <Fragment key={key}>
            {i ? ' ' : null}
            {late ? (
              <span data-past-due="" className="font-semibold text-danger-fg">
                {text} <span>· {t('requests.pastDue')}</span>
              </span>
            ) : (
              <span>{text}</span>
            )}
          </Fragment>
        )
      })}
    </p>
  )
}
