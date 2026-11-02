import { Bot, Cog, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDirectory } from '@/app/hooks'
import type { TimelineEntry } from '@/domain/model'
import { formatDateTime } from '@/lib/format'

const KNOWN_EVENTS = new Set([
  'created',
  'startReport',
  'reportReady',
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
              <time dateTime={e.at} className="text-xs text-ink-400">
                {formatDateTime(e.at)}
              </time>
              {e.note ? (
                <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-[13px] whitespace-pre-line text-ink-600">
                  {e.note}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
