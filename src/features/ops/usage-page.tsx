/**
 * AI usage (operator): one month of AI spending by provider, model, task,
 * day and request. Every figure is an estimate booked from token counts.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAiUsage } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { useDirectory } from '@/app/hooks'
import { Page, PageHeader, PageScroll, PageTop } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Meter } from '@/components/ui/controls'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { MonthStepper } from '@/components/ui/month-stepper'
import { StatTile } from '@/components/ui/stat-tile'
import { addUsage, AI_TASKS, cacheHitRate, ZERO_USAGE } from '@/domain/ai'
import { cn } from '@/lib/cn'
import {
  formatDate,
  formatKrw,
  formatMonth,
  formatNumber,
  formatPercent,
  formatSmallKrw,
  formatUsd,
} from '@/lib/format'
import { hqToday } from '@/lib/time-zone'
import { DailyChart, ModelBars, ProviderLegend, ProviderSplit } from './usage-charts'

export default function UsagePage() {
  const { t } = useTranslation()
  usePageTitle(t('usage.title'))
  const dir = useDirectory()
  const [month, setMonth] = useState(() => hqToday().slice(0, 7))
  const query = useAiUsage(month)
  const u = query.data
  const stale = query.isFetching && query.isPlaceholderData

  const pct = u && u.monthlyLimitKrw ? (u.totalKrw / u.monthlyLimitKrw) * 100 : 0
  const tokens = u ? u.byProvider.reduce((acc, r) => addUsage(acc, r.tokens), ZERO_USAGE) : ZERO_USAGE

  return (
    <Page>
      <PageTop>
        <PageHeader
          title={t('usage.title')}
          description={t('usage.subtitle', { month: formatMonth(month) })}
          badge={<Badge>{t('ai.estimate')}</Badge>}
        />

        {/* Filters: one row, above everything they scope */}
        <MonthStepper month={month} onChange={setMonth} />

        <RefreshFailed {...refreshOf(query)} className="mb-3" />
        {query.isPending ? (
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : query.isLoadingError || !u ? (
          <LoadFailed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          // The month's totals stay in view above its charts.
          <div
            className={cn(
              'mb-4 grid grid-cols-1 gap-3 transition-opacity min-[420px]:grid-cols-2 lg:grid-cols-4',
              stale && 'opacity-60',
            )}
            aria-busy={stale}
          >
            <StatTile
              label={t('usage.total')}
              value={formatKrw(u.totalKrw)}
              note={
                u.monthlyLimitKrw
                  ? t('usage.ofLimit', { pct: Math.round(pct) })
                  : t('usage.totalUsd', { usd: formatUsd(u.totalUsd) })
              }
              noteTone={u.monthlyLimitKrw && pct >= u.alertThresholdPct ? 'warning' : 'muted'}
            >
              {u.monthlyLimitKrw ? (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <Meter value={pct} warnAt={u.alertThresholdPct} label={t('usage.total')} />
                  <p className="text-xs text-ink-500">
                    {t('budget.of', { limit: formatKrw(u.monthlyLimitKrw) })} ·{' '}
                    {t('usage.totalUsd', { usd: formatUsd(u.totalUsd) })}
                  </p>
                </div>
              ) : null}
            </StatTile>
            <StatTile label={t('usage.calls')} value={t('usage.callsValue', { n: formatNumber(u.calls) })}>
              <p className="text-xs text-ink-500">{t('usage.callsNote')}</p>
            </StatTile>
            <StatTile label={t('usage.cacheHit')} value={formatPercent(cacheHitRate(tokens))}>
              <p className="text-xs text-ink-500">{t('usage.cacheHitNote')}</p>
            </StatTile>
            <StatTile label={t('usage.rate')} value={t('usage.rateValue', { rate: formatNumber(u.usdKrw) })}>
              <p className="text-xs text-ink-500">
                {t('usage.rateNote', { date: formatDate(u.pricingAsOf, { weekday: false }) })}
              </p>
            </StatTile>
          </div>
        )}
      </PageTop>
      {!query.isPending && !query.isLoadingError && u ? (
        <PageScroll label={t('common.contentOf', { title: t('usage.title') })}>
          <div
            className={cn('flex flex-col gap-4 transition-opacity', stale && 'opacity-60')}
            aria-busy={stale}
          >
            {u.calls === 0 ? (
              <EmptyState title={t('usage.empty')} />
            ) : (
              <>
                <Card aria-labelledby="by-provider">
                  <CardHeader>
                    <CardTitle id="by-provider">{t('usage.byProvider')}</CardTitle>
                  </CardHeader>
                  <ProviderSplit rows={u.byProvider} totalKrw={u.totalKrw} />
                </Card>

                <Card aria-labelledby="daily">
                  <CardHeader>
                    <CardTitle id="daily">{t('usage.daily')}</CardTitle>
                    <ProviderLegend />
                  </CardHeader>
                  <DailyChart month={u.month} daily={u.daily} />
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <Card aria-labelledby="by-model">
                    <CardHeader>
                      <CardTitle id="by-model">{t('usage.byModel')}</CardTitle>
                      <ProviderLegend />
                    </CardHeader>
                    <ModelBars rows={u.byModel} />
                  </Card>

                  <div className="flex flex-col gap-4">
                    <Card aria-labelledby="by-task">
                      <CardHeader>
                        <CardTitle id="by-task">{t('usage.byTask')}</CardTitle>
                      </CardHeader>
                      <dl className="flex flex-col divide-y divide-line text-sm">
                        {AI_TASKS.map((task) => {
                          const row = u.byTask.find((r) => r.task === task)
                          const cost = row?.costKrw ?? 0
                          return (
                            <div
                              key={task}
                              className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                            >
                              <dt className="text-ink-700">
                                {t(`ai.task.${task}`)}
                                <span className="ml-1.5 text-xs text-ink-500">
                                  {t('usage.callsValue', { n: formatNumber(row?.calls ?? 0) })}
                                </span>
                              </dt>
                              <dd className="shrink-0 text-right tabular-nums">
                                <span className="font-semibold">{formatSmallKrw(cost)}</span>{' '}
                                <span className="text-xs text-ink-500">
                                  {formatPercent(u.totalKrw ? cost / u.totalKrw : 0)}
                                </span>
                              </dd>
                            </div>
                          )
                        })}
                      </dl>
                    </Card>

                    <Card aria-labelledby="top-requests">
                      <CardHeader>
                        <CardTitle id="top-requests">{t('usage.topRequests')}</CardTitle>
                      </CardHeader>
                      <ol className="flex flex-col divide-y divide-line text-sm">
                        {u.topRequests.map((r) => (
                          <li
                            key={r.requestId}
                            className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-semibold text-ink-900">#{r.requestId}</span>{' '}
                              <span className="text-ink-600">
                                {dir.project(r.projectId)?.name ?? r.projectId}
                              </span>
                            </span>
                            <span className="shrink-0 text-right tabular-nums">
                              <span className="font-semibold">{formatKrw(r.costKrw)}</span>{' '}
                              <span className="text-xs text-ink-500">
                                {t('usage.callsValue', { n: formatNumber(r.calls) })}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </Card>
                  </div>
                </div>
              </>
            )}

            <p className="text-xs leading-relaxed text-ink-500">{t('ai.estimateNote')}</p>
          </div>
        </PageScroll>
      ) : null}
    </Page>
  )
}
