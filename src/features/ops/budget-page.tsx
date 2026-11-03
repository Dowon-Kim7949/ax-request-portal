import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'
import { ApiError } from '@/api/client'
import { useBudget, useUpdateBudget } from '@/api/queries'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { ModelName } from '@/components/ai/ai'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Meter } from '@/components/ui/controls'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import type { Budget } from '@/domain/model'
import { formatKrw, formatMonth } from '@/lib/format'

const LimitsForm = z.object({
  monthlyLimitKrw: z.coerce.number().int().min(0),
  perRequestLimitKrw: z.coerce.number().int().min(0),
  alertThresholdPct: z.coerce.number().int().min(1).max(100),
})
type LimitsIn = z.input<typeof LimitsForm>
type LimitsOut = z.output<typeof LimitsForm>

function Limits({ budget }: { budget: Budget }) {
  const { t } = useTranslation()
  const update = useUpdateBudget()
  const form = useForm<LimitsIn, unknown, LimitsOut>({
    resolver: zodResolver(LimitsForm),
    defaultValues: {
      monthlyLimitKrw: budget.monthlyLimitKrw,
      perRequestLimitKrw: budget.perRequestLimitKrw,
      alertThresholdPct: budget.alertThresholdPct,
    },
  })
  const err = form.formState.errors
  return (
    <Card>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          update.mutate(values, {
            onSuccess: () => toast.success(t('budget.saved')),
            onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
          }),
        )}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label={t('budget.monthly')}
            error={err.monthlyLimitKrw ? t('common.requiredField') : undefined}
          >
            {(p) => (
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={10000}
                {...p}
                {...form.register('monthlyLimitKrw')}
              />
            )}
          </Field>
          <Field
            label={t('budget.perRequest')}
            error={err.perRequestLimitKrw ? t('common.requiredField') : undefined}
          >
            {(p) => (
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                {...p}
                {...form.register('perRequestLimitKrw')}
              />
            )}
          </Field>
          <Field
            label={t('budget.alert')}
            hint={t('budget.alertHint')}
            error={err.alertThresholdPct ? '1–100' : undefined}
          >
            {(p) => (
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                {...p}
                {...form.register('alertThresholdPct')}
              />
            )}
          </Field>
        </div>
        <Button type="submit" size="lg" className="sm:w-fit" loading={update.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Card>
  )
}

export default function BudgetPage() {
  const { t } = useTranslation()
  usePageTitle(t('budget.title'))
  const query = useBudget()
  const b = query.data

  if (query.isPending) return <Skeleton className="h-64" />
  if (query.isError || !b) {
    return (
      <ErrorState
        title={t('common.errorTitle')}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  }

  const pct = b.monthlyLimitKrw ? (b.spentKrw / b.monthlyLimitKrw) * 100 : 0
  const over = pct >= b.alertThresholdPct

  return (
    <>
      <PageHeader title={t('budget.title')} description={t('budget.subtitle')} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="items-start">
            <div>
              <CardTitle>{t('budget.thisMonth', { month: formatMonth(b.month) })}</CardTitle>
              <p className="mt-1 text-[32px] leading-tight font-bold tracking-tight">
                {formatKrw(b.spentKrw)}
              </p>
              <p className="text-sm text-ink-500">
                {t('budget.of', { limit: formatKrw(b.monthlyLimitKrw) })} · {Math.round(pct)}%
              </p>
            </div>
            {over ? (
              <span className="flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-xs font-bold text-warning-fg">
                <AlertTriangle className="size-3.5" aria-hidden />
                {t('budget.over')}
              </span>
            ) : null}
          </CardHeader>
          <Meter
            value={pct}
            warnAt={b.alertThresholdPct}
            label={t('budget.thisMonth', { month: formatMonth(b.month) })}
          />
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {b.byModel.map((m) => (
              <div
                key={`${m.provider}/${m.model}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3.5 py-2.5"
              >
                <dt className="min-w-0 text-ink-600">
                  <ModelName selection={m} />
                </dt>
                <dd className="font-semibold tabular-nums">{formatKrw(m.spentKrw)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Limits budget={b} />
      </div>
    </>
  )
}
