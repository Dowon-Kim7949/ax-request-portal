/**
 * AI prices (operator): the price table and exchange rate that turn token
 * counts into an estimated cost. Edits apply to usage booked from then on.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'
import { ApiError } from '@/api/client'
import { useAiPricing, useAiSettings, useUpdateAiPricing } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { ProviderSwatch } from '@/components/ai/ai'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { Field, Input } from '@/components/ui/field'
import {
  AI_PROVIDERS,
  AiProvider,
  selectionsInUse,
  type AiPricing,
  type AiProvider as Provider,
} from '@/domain/ai'

/** Where each provider publishes its prices; the operator checks them before changing a number. */
const PRICE_SOURCES: Record<Provider, string> = {
  anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  openai: 'https://developers.openai.com/api/docs/pricing',
}

const PRICE_FIELDS = ['inputUsd', 'cacheReadUsd', 'cacheWriteUsd', 'outputUsd'] as const
const PRICE_LABEL = {
  inputUsd: 'ai.tokens.input',
  cacheReadUsd: 'ai.tokens.cacheRead',
  cacheWriteUsd: 'ai.tokens.cacheWrite',
  outputUsd: 'ai.tokens.output',
} as const

const Usd = z.coerce.number().min(0)
const PricingForm = z
  .object({
    asOf: z.iso.date(),
    usdKrw: z.coerce.number().positive(),
    models: z
      .array(
        z.object({
          provider: AiProvider,
          model: z.string().trim().min(1),
          label: z.string().trim().min(1),
          inputUsd: Usd,
          cacheReadUsd: Usd,
          cacheWriteUsd: Usd,
          outputUsd: Usd,
        }),
      )
      .min(1),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    v.models.forEach((m, i) => {
      const key = `${m.provider}/${m.model}`
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['models', i, 'model'], message: 'duplicate' })
      seen.add(key)
    })
  })
type PricingIn = z.input<typeof PricingForm>
type PricingOut = z.output<typeof PricingForm>

function PricingEditor({ pricing, inUse }: { pricing: AiPricing; inUse: ReadonlySet<string> }) {
  const { t } = useTranslation()
  const update = useUpdateAiPricing()
  const form = useForm<PricingIn, unknown, PricingOut>({
    resolver: zodResolver(PricingForm),
    defaultValues: pricing,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'models' })
  const models = useWatch({ control: form.control, name: 'models' })
  const err = form.formState.errors
  const modelErr = (i: number): FieldErrors<PricingIn['models'][number]> | undefined => err.models?.[i]

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        update.mutate(values, {
          onSuccess: (saved) => {
            form.reset(saved)
            toast.success(t('pricing.saved'))
          },
          onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
        }),
      )}
    >
      <Card aria-labelledby="basis-title">
        <CardHeader>
          <CardTitle id="basis-title">{t('pricing.basis')}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('pricing.usdKrw')}
            hint={t('pricing.usdKrwHint')}
            error={err.usdKrw ? t('pricing.invalid') : undefined}
          >
            {(p) => (
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                {...p}
                {...form.register('usdKrw')}
              />
            )}
          </Field>
          <Field
            label={t('pricing.asOf')}
            hint={t('pricing.asOfHint')}
            error={err.asOf ? t('common.requiredField') : undefined}
          >
            {(p) => <Input type="date" {...p} {...form.register('asOf')} />}
          </Field>
        </div>
      </Card>

      {AI_PROVIDERS.map((provider) => (
        <Card key={provider} aria-labelledby={`prices-${provider}`}>
          <CardHeader>
            <CardTitle id={`prices-${provider}`} className="flex items-center gap-2">
              <ProviderSwatch provider={provider} className="size-3" />
              {t(`ai.vendor.${provider}`)}
            </CardTitle>
            <a
              href={PRICE_SOURCES[provider]}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
            >
              {t('pricing.source')}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </CardHeader>
          <p className="mb-3 text-[13px] text-ink-500">
            {t('pricing.perMTok')} · {t('pricing.inUseHint')}
          </p>
          <ul className="flex flex-col gap-3">
            {fields.map((f, i) => {
              if (f.provider !== provider) return null
              const used = inUse.has(`${f.provider}/${f.model}`)
              const label = models[i]?.label || t('pricing.newModel')
              const e = modelErr(i)
              return (
                <li key={f.id} className="rounded-2xl p-3 ring-1 ring-line sm:p-4">
                  <fieldset className="flex flex-col gap-3">
                    <legend className="sr-only">{label}</legend>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                      <Field
                        label={t('pricing.label')}
                        error={e?.label ? t('common.requiredField') : undefined}
                      >
                        {(p) => <Input {...p} {...form.register(`models.${i}.label`)} />}
                      </Field>
                      <div className="flex items-center gap-1 self-start sm:order-last sm:self-end">
                        {used ? <Badge tone="brand">{t('pricing.inUse')}</Badge> : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={used}
                          title={used ? t('pricing.inUseHint') : undefined}
                          aria-label={t('pricing.removeModel', { label })}
                          onClick={() => remove(i)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      <Field
                        className="col-span-2 sm:col-span-1"
                        label={t('pricing.modelId')}
                        error={
                          e?.model
                            ? e.model.message === 'duplicate'
                              ? t('pricing.duplicate')
                              : t('common.requiredField')
                            : undefined
                        }
                      >
                        {(p) => (
                          <Input
                            {...p}
                            className="font-mono text-sm"
                            spellCheck={false}
                            autoCapitalize="none"
                            readOnly={used}
                            {...form.register(`models.${i}.model`)}
                          />
                        )}
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {PRICE_FIELDS.map((k) => (
                        <Field
                          key={k}
                          label={t(PRICE_LABEL[k])}
                          error={e?.[k] ? t('pricing.invalid') : undefined}
                        >
                          {(p) => (
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              className="tabular-nums"
                              {...p}
                              {...form.register(`models.${i}.${k}`)}
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  </fieldset>
                </li>
              )
            })}
          </ul>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() =>
              append({
                provider,
                model: '',
                label: '',
                inputUsd: 0,
                cacheReadUsd: 0,
                cacheWriteUsd: 0,
                outputUsd: 0,
              })
            }
          >
            <Plus aria-hidden />
            {t('pricing.addModel')}
          </Button>
        </Card>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" className="sm:w-fit" loading={update.isPending}>
          {t('common.save')}
        </Button>
        {form.formState.isDirty ? (
          <p className="text-sm text-ink-500" aria-live="polite">
            {t('pricing.unsaved')}
          </p>
        ) : null}
      </div>
    </form>
  )
}

export default function PricingPage() {
  const { t } = useTranslation()
  usePageTitle(t('pricing.title'))
  const pricing = useAiPricing()
  const settings = useAiSettings()

  const body = () => {
    if (pricing.isPending || settings.isPending) return <Skeleton className="h-96" />
    if (pricing.isLoadingError || settings.isLoadingError || !pricing.data || !settings.data) {
      const failed = [pricing, settings].filter((q) => q.isError)
      return (
        <LoadFailed
          error={failed[0]?.error}
          onRetry={() => failed.forEach((q) => void q.refetch())}
          retrying={failed.some((q) => q.isFetching)}
        />
      )
    }
    const inUse = new Set(selectionsInUse(settings.data).map((s) => `${s.provider}/${s.model}`))
    return <PricingEditor pricing={pricing.data} inUse={inUse} />
  }

  return (
    <>
      <PageHeader title={t('pricing.title')} description={t('pricing.subtitle')} />
      <RefreshFailed {...refreshOf(pricing, settings)} className="mb-3" />
      {body()}
    </>
  )
}
