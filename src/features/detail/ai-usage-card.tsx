/** AI usage of one request: what each AI call cost, on which provider and model. */
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ModelName, TokenLine } from '@/components/ai/ai'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Meter } from '@/components/ui/controls'
import { overRequestLimit } from '@/domain/ai'
import type { RequestAiUsage } from '@/domain/model'
import { formatDateTime, formatKrw, formatSmallKrw } from '@/lib/format'

export function AiRunLimitReason({ id, reason }: { id: string; reason: string }) {
  return (
    <p id={id} className="flex gap-1.5 text-[13px] leading-snug text-danger-fg">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {reason}
    </p>
  )
}

export function AiUsageCard({ usage }: { usage: RequestAiUsage }) {
  const { t } = useTranslation()
  const entries = [...usage.entries].sort((a, b) => b.at.localeCompare(a.at))
  const pct = usage.limitKrw ? (usage.spentKrw / usage.limitKrw) * 100 : 0
  const reached = overRequestLimit(usage.spentKrw, usage.limitKrw)

  return (
    <Card aria-labelledby="ai-usage-title">
      <CardHeader className="items-start">
        <div>
          <CardTitle id="ai-usage-title">{t('aiUsage.title')}</CardTitle>
          <p className="mt-0.5 text-xs text-ink-400">
            {usage.limitKrw ? t('aiUsage.limit', { limit: formatKrw(usage.limitKrw) }) : t('aiUsage.noLimit')}
          </p>
        </div>
        <Badge tone="neutral">{t('ai.estimate')}</Badge>
      </CardHeader>

      <p className="text-2xl leading-tight font-bold tracking-tight">{formatSmallKrw(usage.spentKrw)}</p>
      {usage.limitKrw ? (
        <div className="mt-2">
          {/* The per-request limit has no early-warning step: it only turns red when reached. */}
          <Meter value={pct} warnAt={100} label={t('aiUsage.title')} />
        </div>
      ) : null}
      {reached ? (
        <p className="mt-2 flex gap-1.5 text-[13px] font-semibold text-danger-fg">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('aiUsage.reached')}
        </p>
      ) : null}

      {entries.length ? (
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-ink-900">{t(`ai.task.${e.task}`)}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatSmallKrw(e.costKrw)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-600">
                <ModelName selection={e} />
                {e.runtime !== 'api' ? <span>· {t(`ai.runtime.${e.runtime}`)}</span> : null}
                <span className="text-ink-500">· {formatDateTime(e.at)}</span>
              </div>
              <TokenLine tokens={e.tokens} className="text-xs text-ink-500" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-500">{t('aiUsage.empty')}</p>
      )}

      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-500">
        {t('ai.estimateNote')}
      </p>
    </Card>
  )
}
