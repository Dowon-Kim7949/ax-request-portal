/**
 * Charts of the AI usage dashboard. Plain elements, no chart library, same
 * conventions as the executive dashboard: thin marks, 2px surface gaps, a
 * rounded data end and a square baseline, values on hover and focus, and a
 * table view so no value is reachable only by pointing at it.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProviderSwatch, TokenLine } from '@/components/ai/ai'
import { PROVIDER_FILL, useModelLabel } from '@/components/ai/provider'
import { AI_PROVIDERS, cacheHitRate, type AiProvider } from '@/domain/ai'
import type { AiUsageReport } from '@/domain/model'
import { niceScale } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { daysInMonth, formatDate, formatKrw, formatNumber, formatPercent, toLocalDate } from '@/lib/format'

type Totals = Record<AiProvider, number>
const zero = (): Totals => ({ anthropic: 0, openai: 0 })

/* ------------------------------------------------------------------ */
/* Provider split                                                      */
/* ------------------------------------------------------------------ */

/**
 * Claude next to GPT: a thin segmented bar for the split, then each provider's
 * figures beside its swatch (the swatches replace a legend).
 */
export function ProviderSplit({ rows, totalKrw }: { rows: AiUsageReport['byProvider']; totalKrw: number }) {
  const { t } = useTranslation()
  const ordered = AI_PROVIDERS.map((p) => rows.find((r) => r.provider === p)).filter(
    (r): r is AiUsageReport['byProvider'][number] => Boolean(r),
  )
  const share = (v: number) => (totalKrw ? v / totalKrw : 0)

  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={ordered
          .map((r) => `${t(`ai.provider.${r.provider}`)} ${formatPercent(share(r.costKrw))}`)
          .join(', ')}
        className="flex h-2 gap-0.5"
      >
        {ordered
          .filter((r) => r.costKrw > 0)
          .map((r) => (
            <span
              key={r.provider}
              className={cn('h-full rounded-full', PROVIDER_FILL[r.provider])}
              style={{ flexGrow: r.costKrw, flexBasis: 0 }}
            />
          ))}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ordered.map((r) => (
          <li key={r.provider} className="flex flex-col gap-2 rounded-2xl bg-muted p-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 font-bold text-ink-900">
                <ProviderSwatch provider={r.provider} />
                {t(`ai.provider.${r.provider}`)}
              </span>
              <span className="text-right">
                <span className="text-lg font-bold">{formatKrw(r.costKrw)}</span>{' '}
                <span className="text-sm text-ink-500">{formatPercent(share(r.costKrw))}</span>
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-ink-500">{t('usage.calls')}</dt>
              <dd className="text-right font-semibold tabular-nums">
                {t('usage.callsValue', { n: formatNumber(r.calls) })}
              </dd>
              <dt className="text-ink-500">{t('usage.cacheHit')}</dt>
              <dd className="text-right font-semibold tabular-nums">
                {formatPercent(cacheHitRate(r.tokens))}
              </dd>
            </dl>
            <TokenLine tokens={r.tokens} className="text-xs text-ink-600" />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Daily cost                                                          */
/* ------------------------------------------------------------------ */

/** Names the two series; always shown when a chart has both providers. */
export function ProviderLegend() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 text-xs text-ink-600">
      {AI_PROVIDERS.map((p) => (
        <span key={p} className="flex items-center gap-1.5">
          <ProviderSwatch provider={p} />
          {t(`ai.provider.${p}`)}
        </span>
      ))}
    </div>
  )
}

/** Day rows of a month (up to today while it is in progress), cost per provider. */
function dailyRows(month: string, daily: AiUsageReport['daily']): { date: string; values: Totals }[] {
  const today = toLocalDate()
  const last = today.startsWith(month) ? Number(today.slice(8, 10)) : daysInMonth(month)
  const byDay = new Map<string, Totals>()
  for (const d of daily) {
    const row = byDay.get(d.date) ?? zero()
    row[d.provider] += d.costKrw
    byDay.set(d.date, row)
  }
  return Array.from({ length: last }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`
    return { date, values: byDay.get(date) ?? zero() }
  })
}

const sum = (v: Totals) => v.anthropic + v.openai

/**
 * Stacked columns, one per day, Claude at the base and GPT on top. The whole
 * column is the hover/focus target, larger than the painted mark.
 */
export function DailyChart({ month, daily }: { month: string; daily: AiUsageReport['daily'] }) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  const rows = dailyRows(month, daily)
  const { top, ticks } = niceScale(Math.max(0, ...rows.map((r) => sum(r.values))))
  const n = rows.length
  const pct = (v: number) => `${(v / top) * 100}%`
  const xLabels = [1, 8, 15, 22, 29].filter((d) => d <= n)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div
          className="relative h-44 w-14 shrink-0 text-right text-[11px] text-ink-500 tabular-nums"
          aria-hidden
        >
          {ticks.map((v) => (
            <span key={v} className="absolute right-0 translate-y-1/2" style={{ bottom: pct(v) }}>
              {formatKrw(v)}
            </span>
          ))}
        </div>
        <div className="relative h-44 min-w-0 flex-1">
          {ticks.map((v) => (
            <span
              key={v}
              aria-hidden
              className="absolute inset-x-0 h-px bg-line"
              style={{ bottom: pct(v) }}
            />
          ))}
          <div role="group" aria-label={t('usage.daily')} className="absolute inset-0 flex items-end gap-0.5">
            {rows.map((r, i) => {
              const parts = AI_PROVIDERS.map((p) => ({ p, v: r.values[p] })).filter((s) => s.v > 0)
              const label = `${formatDate(r.date, { weekday: false })}: ${AI_PROVIDERS.map(
                (p) => `${t(`ai.provider.${p}`)} ${formatKrw(r.values[p])}`,
              ).join(', ')}`
              const align = i < n / 3 ? 'left-0' : i > (2 * n) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
              return (
                <span
                  key={r.date}
                  role="img"
                  tabIndex={0}
                  aria-label={label}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  className="relative flex h-full min-w-0 flex-1 justify-center outline-offset-2 focus-visible:outline-2"
                >
                  <span
                    className={cn(
                      'flex h-full w-full max-w-6 flex-col-reverse gap-0.5 transition-[filter]',
                      active === i && 'brightness-110',
                    )}
                  >
                    {parts.map((s, j) => (
                      <span
                        key={s.p}
                        className={cn(
                          'w-full shrink-0',
                          PROVIDER_FILL[s.p],
                          j === parts.length - 1 && 'rounded-t-[4px]',
                        )}
                        style={{ height: pct(s.v) }}
                      />
                    ))}
                  </span>
                  {active === i ? (
                    <span
                      className={cn(
                        'pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 rounded-lg bg-inverse px-2.5 py-1.5 text-xs whitespace-nowrap text-on-inverse shadow-lg',
                        align,
                      )}
                    >
                      <span className="text-on-inverse/70">{formatDate(r.date, { weekday: false })}</span>
                      {AI_PROVIDERS.map((p) => (
                        <span key={p} className="flex items-center gap-1.5">
                          <span aria-hidden className={cn('h-0.5 w-3 rounded-full', PROVIDER_FILL[p])} />
                          <strong className="text-sm">{formatKrw(r.values[p])}</strong>
                          <span className="text-on-inverse/70">{t(`ai.provider.${p}`)}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              )
            })}
          </div>
        </div>
      </div>
      <div className="relative ml-16 h-4 text-[11px] text-ink-500" aria-hidden>
        {xLabels.map((d) => (
          <span
            key={d}
            className={cn(
              'absolute -translate-x-1/2 whitespace-nowrap',
              (d === 8 || d === 22) && 'hidden sm:inline',
            )}
            style={{ left: `${((d - 0.5) / n) * 100}%` }}
          >
            {formatDate(rows[d - 1]!.date, { weekday: false })}
          </span>
        ))}
      </div>

      <details className="mt-2 text-sm">
        <summary className="w-fit font-semibold text-accent">{t('usage.showTable')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[13px] tabular-nums">
            <thead className="text-ink-500">
              <tr>
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  {t('usage.date')}
                </th>
                {AI_PROVIDERS.map((p) => (
                  <th key={p} scope="col" className="py-1.5 pr-3 text-right font-semibold">
                    {t(`ai.provider.${p}`)}
                  </th>
                ))}
                <th scope="col" className="py-1.5 text-right font-semibold">
                  {t('usage.sum')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows
                .filter((r) => sum(r.values) > 0)
                .map((r) => (
                  <tr key={r.date}>
                    <th scope="row" className="py-1.5 pr-3 font-normal">
                      {formatDate(r.date, { weekday: false })}
                    </th>
                    {AI_PROVIDERS.map((p) => (
                      <td key={p} className="py-1.5 pr-3 text-right">
                        {formatKrw(r.values[p])}
                      </td>
                    ))}
                    <td className="py-1.5 text-right font-semibold">{formatKrw(sum(r.values))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ranked bars                                                         */
/* ------------------------------------------------------------------ */

/** One bar per model, largest first, each in its provider's color. */
export function ModelBars({ rows }: { rows: AiUsageReport['byModel'] }) {
  const { t } = useTranslation()
  const label = useModelLabel()
  const sorted = [...rows].sort((a, b) => b.costKrw - a.costKrw)
  const max = Math.max(1, ...sorted.map((r) => r.costKrw))
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((r) => (
        <li key={`${r.provider}/${r.model}`} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-900">
              <ProviderSwatch provider={r.provider} />
              <span className="truncate">{label(r)}</span>
            </span>
            <span className="shrink-0 text-ink-600 tabular-nums">
              {formatKrw(r.costKrw)} · {t('usage.callsValue', { n: formatNumber(r.calls) })}
            </span>
          </div>
          <span
            aria-hidden
            className={cn('h-3 rounded-r-[4px]', PROVIDER_FILL[r.provider])}
            style={{ width: `${Math.max(0.5, (r.costKrw / max) * 100)}%` }}
          />
        </li>
      ))}
    </ul>
  )
}
