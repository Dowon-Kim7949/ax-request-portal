import { CalendarCheck, CalendarClock, Rocket } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDirectory } from '@/app/hooks'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { DateTimeText, HqCalendarNote } from '@/components/ui/date-time'
import type { WorkRequest } from '@/domain/model'
import { formatDate } from '@/lib/format'
import { AttachmentLink } from './attachment-link'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-[13px] font-semibold text-ink-500 sm:w-32 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 flex-1 text-[15px] whitespace-pre-line text-ink-900">{children}</dd>
    </div>
  )
}

/** The request as the requester wrote it. */
export function RequestContent({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const project = dir.project(request.projectId)
  const targets = project?.targets.filter((x) => request.targetIds.includes(x.id)).map((x) => x.name) ?? []
  if (request.targetOther) targets.push(request.targetOther)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.whatIAsked')}</CardTitle>
      </CardHeader>
      <dl className="divide-y divide-line">
        {targets.length ? <Row label={t('detail.targets')}>{targets.join(', ')}</Row> : null}
        {request.currentBehavior ? <Row label={t('detail.current')}>{request.currentBehavior}</Row> : null}
        <Row label={t('detail.desired')}>{request.desiredBehavior}</Row>
        {request.checklist?.length ? (
          <Row label={t('detail.checklist')}>
            {request.checklistSource ? (
              <p className="mb-2 text-sm text-ink-600">
                {t('detail.checklistSource')}: {request.checklistSource}
              </p>
            ) : null}
            <ol className="flex flex-col gap-2">
              {request.checklist.map((k) => (
                <li key={k.id} className="rounded-xl bg-muted px-3 py-2.5 text-sm">
                  <p className="font-semibold text-ink-900">
                    {k.ref}
                    {k.clause ? <span className="font-normal text-ink-500"> · {k.clause}</span> : null}
                  </p>
                  <p className="mt-0.5 text-ink-700">{k.finding}</p>
                  {k.expected ? (
                    <p className="mt-0.5 text-ink-600">
                      {t('detail.expected')}: {k.expected}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Row>
        ) : null}
        <Row label={t('detail.criteria')}>
          <ol className="flex flex-col gap-1.5">
            {request.acceptanceCriteria.map((c, i) => (
              <li key={c.id} className="flex gap-2">
                <span className="grid size-5 shrink-0 translate-y-0.5 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-accent-strong">
                  {i + 1}
                </span>
                {c.text}
              </li>
            ))}
          </ol>
        </Row>
        {request.outOfScope ? <Row label={t('detail.outOfScope')}>{request.outOfScope}</Row> : null}
        {request.attachments.length ? (
          <Row label={t('detail.attachments')}>
            <ul className="flex flex-wrap gap-2">
              {request.attachments.map((a) => (
                <li key={a.id} className="min-w-0">
                  <AttachmentLink attachment={a} />
                </li>
              ))}
            </ul>
          </Row>
        ) : null}
        {request.desiredDate ? (
          <Row label={t('detail.desiredDate')}>
            {formatDate(request.desiredDate)}
            {request.desiredDateReason ? (
              <span className="text-ink-500"> · {request.desiredDateReason}</span>
            ) : null}
          </Row>
        ) : null}
      </dl>
    </Card>
  )
}

export function ReleaseCard({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const released = request.release?.releasedAt
  const scheduled = request.release?.scheduledDate
  const Icon = released ? Rocket : scheduled ? CalendarCheck : CalendarClock
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.release')}</CardTitle>
      </CardHeader>
      <p className="flex items-start gap-2.5 text-[15px]">
        <Icon
          className={released || scheduled ? 'size-5 text-success-fg' : 'size-5 text-ink-400'}
          aria-hidden
        />
        <span className={released || scheduled ? 'font-semibold' : 'text-ink-500'}>
          {released ? (
            // A release day is a business day: the head office's, as on the schedule and the dashboard.
            <DateTimeText
              iso={released}
              variant="date"
              calendar="hq"
              weekday
              sentence={(date) => t('detail.releasedOn', { date })}
            />
          ) : scheduled ? (
            t('detail.scheduledFor', { date: formatDate(scheduled) })
          ) : (
            t('detail.notScheduled')
          )}
        </span>
      </p>
      {request.release?.note ? <p className="mt-2 text-sm text-ink-500">{request.release.note}</p> : null}
      {released || scheduled ? <HqCalendarNote className="mt-2" /> : null}
    </Card>
  )
}
