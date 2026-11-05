import { Bot, Cog, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDirectory } from '@/app/hooks'
import { DateTimeText } from '@/components/ui/date-time'
import type { TimelineEntry } from '@/domain/model'
import { formatDate } from '@/lib/format'

/** A release date is stored as YYYY-MM-DD: a calendar date, written as is. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

const KNOWN_EVENTS = new Set([
  'created',
  'startReport',
  'reportReady',
  'scopeReady',
  'approveScope',
  'reviseScope',
  'preview_looks_good',
  'preview_needs_change',
  'requestInfo',
  'provideInfo',
  'reject',
  'runWork',
  'workFinished',
  'requestRevision',
  'approveMerge',
  'reportIssue',
  'confirmResult',
  'markReleased',
  'cancel',
  'release_updated',
])

/** Progress log, newest first. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const items = [...entries].reverse()

  return (
    <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
      {items.map((e) => {
        const Icon = e.actor.type === 'ai' ? Bot : e.actor.type === 'system' ? Cog : User
        const who =
          e.actor.type === 'user'
            ? (dir.user(e.actor.userId)?.name ?? t('common.unknownUser'))
            : e.actor.type === 'ai'
              ? t('common.ai')
              : t('common.system')
        const label = KNOWN_EVENTS.has(e.event) ? t(`event.${e.event as 'created'}`) : e.event
        return (
          <li key={e.id} className="relative flex gap-3">
            <span
              className={
                e.actor.type === 'ai'
                  ? 'z-10 grid size-8 shrink-0 place-items-center rounded-full bg-ai-50 text-ai-600 ring-4 ring-surface'
                  : 'z-10 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-ink-500 ring-4 ring-surface'
              }
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 pt-1">
              <p className="text-sm font-semibold text-ink-900">
                {label} <span className="font-normal text-ink-500">· {who}</span>
              </p>
              <DateTimeText iso={e.at} variant="full" className="text-xs text-ink-400" />
              {e.note ? (
                <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-[13px] whitespace-pre-line text-ink-600">
                  {e.event === 'release_updated' && CALENDAR_DATE.test(e.note) ? formatDate(e.note) : e.note}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
