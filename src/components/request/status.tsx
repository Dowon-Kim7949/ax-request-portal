import { Bot, Check, Circle, X } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useSeesTechnicalStatus } from '@/app/hooks'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { requesterStatusOf, stageOf, STAGES, turnOf, type RequesterStatus } from '@/domain/lifecycle'
import type { RequestStatus } from '@/domain/model'
import { cn } from '@/lib/cn'

const TONE: Record<RequestStatus, BadgeTone> = {
  submitted: 'neutral',
  reporting: 'ai',
  scope_check: 'warning',
  review: 'brand',
  info_needed: 'warning',
  rejected: 'danger',
  in_progress: 'ai',
  code_review: 'brand',
  verification: 'warning',
  changes_requested: 'warning',
  release_scheduled: 'success',
  done: 'strong',
  cancelled: 'neutral',
}

const REQUESTER_TONE: Record<RequesterStatus, BadgeTone> = {
  reviewing: 'neutral',
  confirm_scope: 'warning',
  info_needed: 'warning',
  working: 'ai',
  please_check: 'warning',
  fixing: 'ai',
  release_scheduled: 'success',
  done: 'strong',
  rejected: 'danger',
  cancelled: 'neutral',
}

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { t } = useTranslation()
  const technical = useSeesTechnicalStatus()
  const ai = turnOf(status) === 'ai'
  if (technical) {
    return (
      <Badge tone={TONE[status]} className={className}>
        {ai ? <Bot aria-hidden /> : null}
        {t(`status.${status}`)}
      </Badge>
    )
  }
  const plain = requesterStatusOf(status)
  return (
    <Badge tone={REQUESTER_TONE[plain]} className={className}>
      {t(`status.requester.${plain}`)}
    </Badge>
  )
}

/** Seven-stage progress. Horizontal with labels from `sm`, a compact bar on phones. */
export function Stepper({ status }: { status: RequestStatus }) {
  const { t } = useTranslation()
  const stage = stageOf(status)
  const current = stage ? STAGES.indexOf(stage) : -1
  const stopped = status === 'rejected' || status === 'cancelled'
  const finished = status === 'done'
  const aiNow = turnOf(status) === 'ai'

  return (
    <div>
      {/* Phone: one bar + current stage */}
      <div className="sm:hidden">
        <div className="flex gap-1" aria-hidden>
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                i < current || finished
                  ? 'bg-brand-600'
                  : i === current
                    ? stopped
                      ? 'bg-danger-600'
                      : aiNow
                        ? 'bg-ai-500'
                        : 'bg-brand-600'
                    : 'bg-line',
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-500">
          {current >= 0
            ? `${current + 1}/${STAGES.length} · ${t(`stage.${STAGES[current]!}`)}`
            : t('status.cancelled')}
        </p>
      </div>

      {/* Tablet and up: labelled steps */}
      <ol className="hidden items-center sm:flex" aria-label={t('detail.progress')}>
        {STAGES.map((s, i) => {
          const done = i < current || finished
          const active = i === current && !finished
          return (
            <Fragment key={s}>
              {i > 0 ? (
                <li
                  aria-hidden
                  className={cn('mx-1 h-px flex-1', i <= current ? 'bg-brand-500' : 'bg-line')}
                />
              ) : null}
              <li className="flex flex-col items-center gap-1.5" aria-current={active ? 'step' : undefined}>
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-full text-xs font-bold',
                    done && 'bg-brand-600 text-white',
                    active &&
                      !stopped &&
                      (aiNow ? 'bg-ai-500 text-white' : 'bg-brand-600 text-white ring-4 ring-brand-100'),
                    active && stopped && 'bg-danger-600 text-white',
                    !done && !active && 'bg-muted text-ink-400 ring-1 ring-line',
                  )}
                >
                  {done ? (
                    <Check className="size-4" aria-hidden />
                  ) : active && stopped ? (
                    <X className="size-4" aria-hidden />
                  ) : active && aiNow ? (
                    <Bot className="size-4" aria-hidden />
                  ) : active ? (
                    <Circle className="size-2.5 fill-current" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    active ? 'font-bold text-ink-900' : done ? 'text-ink-600' : 'text-ink-400',
                  )}
                >
                  {t(`stage.${s}`)}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}
