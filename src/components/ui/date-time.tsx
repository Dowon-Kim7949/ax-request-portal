import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useHqCalendarNote, useTimeView } from '@/app/time-zone'
import { cn } from '@/lib/cn'
import { describeDateTime, formatDate } from '@/lib/format'

// Placeholders put into a translated sentence, then swapped for elements.
const SLOT = String.fromCharCode(0xe000)
const SLOT_LOCAL = String.fromCharCode(0xe001)
const SLOT_HQ = String.fromCharCode(0xe002)
const SLOTS = new RegExp(`(${SLOT}|${SLOT_LOCAL}|${SLOT_HQ})`)

/** "{{time}} 작성" + <time/> → ["", <time/>, " 작성"]: the sentence keeps its word order per language. */
function interpolate(template: string, nodes: Record<string, ReactNode>): ReactNode {
  return template
    .split(SLOTS)
    .map((part, i) => <Fragment key={i}>{part in nodes ? nodes[part] : part}</Fragment>)
}

interface DateTimeTextProps {
  /** ISO timestamp */
  iso: string
  /**
   * - `compact` (lists, cards): local time only; the full form is in the tooltip.
   * - `full` (detail screens, timelines): adds the zone name and head-office time
   *   when the viewer's clock differs from the head office's.
   * - `date`: the date it falls on in the viewer's time zone; the full form is in the tooltip.
   */
  variant?: 'compact' | 'full' | 'date'
  /** `date` only: add the weekday ("11월 5일 (목)") */
  weekday?: boolean
  /** Sentence around the time, e.g. `(time) => t('report.generatedAt', { time })` */
  sentence?: (time: string) => string
  className?: string
}

/** A timestamp in the viewer's time zone, marked up with <time dateTime>. */
export function DateTimeText({
  iso,
  variant = 'compact',
  weekday = false,
  sentence,
  className,
}: DateTimeTextProps) {
  const { t } = useTranslation()
  const view = useTimeView()
  const d = describeDateTime(iso, view)

  let body: ReactNode
  if (variant === 'full') {
    const local = (
      <time dateTime={iso} className="whitespace-nowrap">
        {d.zone ? t('time.withZone', { time: d.local, zone: d.zone }) : d.local}
      </time>
    )
    body = d.hq
      ? interpolate(t('time.pair', { local: SLOT_LOCAL, hq: SLOT_HQ }), {
          [SLOT_LOCAL]: local,
          [SLOT_HQ]: (
            <span className="whitespace-nowrap">
              {interpolate(t('time.atHq', { place: d.hq.place, time: SLOT }), {
                [SLOT]: <time dateTime={iso}>{d.hq.time}</time>,
              })}
            </span>
          ),
        })
      : local
  } else {
    const text = variant === 'date' ? formatDate(iso, { weekday, timeZone: view.timeZone }) : d.local
    body = (
      <time dateTime={iso} title={d.text !== text ? d.text : undefined}>
        {text}
      </time>
    )
  }

  return <span className={className}>{sentence ? interpolate(sentence(SLOT), { [SLOT]: body }) : body}</span>
}

/** "Dates and monthly totals follow head-office time (Korea)." — only for viewers on another clock. */
export function HqCalendarNote({ className }: { className?: string }) {
  const note = useHqCalendarNote()
  return note ? <p className={cn('text-[13px] text-ink-500', className)}>{note}</p> : null
}
