/**
 * AI agents (operator): connect providers with a write-only key, choose the
 * model for each task, and let individual projects use another one.
 */
import { Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AiSettingsInput } from '@/api/contract'
import { errorText } from '@/api/error-text'
import {
  useAiPricing,
  useAiSettings,
  useRemoveProviderKey,
  useSetProviderKey,
  useUpdateAiSettings,
} from '@/api/queries'
import { useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { ModelName, ProviderSwatch } from '@/components/ai/ai'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/controls'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import {
  AI_PROVIDERS,
  AI_TASKS,
  priceOf,
  runtimeFor,
  type AiPricing,
  type AiProvider,
  type AiSelection,
  type AiSettings,
  type AiTask,
} from '@/domain/ai'
import { formatDateTime, formatUsd } from '@/lib/format'

const keyOf = (sel: AiSelection) => `${sel.provider}/${sel.model}`

function parseKey(value: string): AiSelection {
  const i = value.indexOf('/')
  return { provider: value.slice(0, i) as AiProvider, model: value.slice(i + 1) }
}

/* ------------------------------------------------------------------ */
/* Provider connections                                                */
/* ------------------------------------------------------------------ */

function Providers({ settings }: { settings: AiSettings }) {
  const { t } = useTranslation()
  const setKey = useSetProviderKey()
  const remove = useRemoveProviderKey()
  const [sheet, setSheet] = useState<{ provider: AiProvider; mode: 'key' | 'remove' } | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const vendor = sheet ? t(`ai.vendor.${sheet.provider}`) : ''

  const close = () => {
    setSheet(null)
    // Never keep a secret in memory longer than the form that took it.
    setApiKey('')
    setTooShort(false)
  }

  const saveKey = () => {
    if (!sheet) return
    if (apiKey.trim().length < 8) {
      setTooShort(true)
      return
    }
    setKey.mutate(
      { provider: sheet.provider, apiKey: apiKey.trim() },
      {
        onSuccess: () => {
          close()
          toast.success(t('agents.keySaved'))
        },
        onError: (e) => toast.error(errorText(e, t('errors.generic'))),
      },
    )
  }

  return (
    <Card aria-labelledby="providers-title">
      <CardHeader>
        <CardTitle id="providers-title">{t('agents.providers')}</CardTitle>
      </CardHeader>
      <ul className="flex flex-col divide-y divide-line">
        {AI_PROVIDERS.map((provider) => {
          const c = settings.providers.find((p) => p.provider === provider)
          const name = t(`ai.vendor.${provider}`)
          return (
            <li key={provider} className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <ProviderSwatch provider={provider} className="mt-1.5 size-3" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {name}
                    {c?.connected ? (
                      <Badge tone="success">{t('agents.connected')}</Badge>
                    ) : (
                      <Badge>{t('agents.notConnected')}</Badge>
                    )}
                  </p>
                  <p className="text-[13px] text-ink-500">{t(`agents.providerHint.${provider}`)}</p>
                  {c?.connected && c.keyHint ? (
                    <p className="text-[13px] text-ink-500 tabular-nums">
                      {t('agents.keyHint', { hint: c.keyHint })}
                      {c.updatedAt
                        ? ` · ${t('agents.keyUpdated', { time: formatDateTime(c.updatedAt) })}`
                        : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  variant="secondary"
                  aria-label={`${name} ${c?.connected ? t('agents.replaceKey') : t('agents.setKey')}`}
                  onClick={() => setSheet({ provider, mode: 'key' })}
                >
                  {c?.connected ? t('agents.replaceKey') : t('agents.setKey')}
                </Button>
                {c?.connected ? (
                  <Button
                    variant="ghost"
                    className="text-danger-fg"
                    aria-label={`${name} ${t('agents.disconnect')}`}
                    onClick={() => setSheet({ provider, mode: 'remove' })}
                  >
                    {t('agents.disconnect')}
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-500">
        {t('agents.keyNote')}
      </p>

      <Sheet
        open={sheet?.mode === 'key'}
        onOpenChange={(o) => (o ? undefined : close())}
        title={t('agents.keyTitle', { vendor })}
        description={t('agents.keyBody', { vendor })}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button size="lg" className="flex-1" loading={setKey.isPending} onClick={saveKey}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            saveKey()
          }}
        >
          <Field
            label={t('agents.keyLabel')}
            hint={t('agents.keyNote')}
            error={tooShort ? t('agents.keyTooShort') : undefined}
          >
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setTooShort(false)
                }}
              />
            )}
          </Field>
        </form>
      </Sheet>

      <Sheet
        open={sheet?.mode === 'remove'}
        onOpenChange={(o) => (o ? undefined : close())}
        title={t('agents.disconnectTitle', { vendor })}
        description={t('agents.disconnectBody')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              loading={remove.isPending}
              onClick={() =>
                sheet &&
                remove.mutate(sheet.provider, {
                  onSuccess: () => {
                    close()
                    toast.success(t('agents.disconnected'))
                  },
                  onError: (e) => toast.error(errorText(e, t('errors.generic'))),
                })
              }
            >
              {t('agents.disconnect')}
            </Button>
          </>
        }
      >
        {null}
      </Sheet>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Model selection                                                     */
/* ------------------------------------------------------------------ */

/** Priced models grouped by provider; models of a disconnected provider cannot be picked. */
function ModelSelect({
  value,
  onChange,
  pricing,
  connected,
  ...rest
}: {
  value: AiSelection
  onChange: (sel: AiSelection) => void
  pricing: AiPricing
  connected: ReadonlySet<AiProvider>
  id?: string
  'aria-describedby'?: string
  'aria-label'?: string
}) {
  const { t } = useTranslation()
  return (
    <Select {...rest} value={keyOf(value)} onChange={(e) => onChange(parseKey(e.target.value))}>
      {AI_PROVIDERS.map((provider) => (
        <optgroup key={provider} label={t(`ai.vendor.${provider}`)}>
          {pricing.models
            .filter((m) => m.provider === provider)
            .map((m) => (
              <option key={keyOf(m)} value={keyOf(m)} disabled={!connected.has(provider)}>
                {connected.has(provider) ? m.label : t('agents.notConnectedOption', { label: m.label })}
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  )
}

function Selections({ settings, pricing }: { settings: AiSettings; pricing: AiPricing }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const update = useUpdateAiSettings()
  const saved: AiSettingsInput = { defaults: settings.defaults, projectOverrides: settings.projectOverrides }
  const [draft, setDraft] = useState<AiSettingsInput>(saved)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const connected = new Set(settings.providers.filter((p) => p.connected).map((p) => p.provider))
  const statusId = useId()

  const projects = dir.projects
  const [adding, setAdding] = useState<{ projectId: string; task: AiTask; selection: AiSelection }>(() => ({
    projectId: projects[0]?.id ?? '',
    task: 'work',
    selection: settings.defaults.work,
  }))
  const addProjectId = adding.projectId || projects[0]?.id || ''

  const setDefault = (task: AiTask, selection: AiSelection) =>
    setDraft((d) => ({ ...d, defaults: { ...d.defaults, [task]: selection } }))

  const addOverride = () => {
    if (!addProjectId) return
    setDraft((d) => ({
      ...d,
      projectOverrides: [
        ...d.projectOverrides.filter((o) => !(o.projectId === addProjectId && o.task === adding.task)),
        { projectId: addProjectId, task: adding.task, selection: adding.selection },
      ],
    }))
  }

  const removeOverride = (projectId: string, task: AiTask) =>
    setDraft((d) => ({
      ...d,
      projectOverrides: d.projectOverrides.filter((o) => !(o.projectId === projectId && o.task === task)),
    }))

  const save = () =>
    update.mutate(draft, {
      onSuccess: (next) => {
        setDraft({ defaults: next.defaults, projectOverrides: next.projectOverrides })
        toast.success(t('agents.saved'))
      },
      onError: (e) => toast.error(errorText(e, t('errors.generic'))),
    })

  const priceHint = (sel: AiSelection) => {
    const price = priceOf(pricing, sel)
    return price
      ? t('agents.price', { input: formatUsd(price.inputUsd), output: formatUsd(price.outputUsd) })
      : ''
  }

  return (
    <>
      <Card aria-labelledby="defaults-title">
        <CardHeader className="items-start">
          <div>
            <CardTitle id="defaults-title">{t('agents.defaults')}</CardTitle>
            <p className="mt-0.5 text-sm text-ink-500">{t('agents.defaultsHint')}</p>
          </div>
        </CardHeader>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {AI_TASKS.map((task) => {
            const sel = draft.defaults[task]
            return (
              <Field
                key={task}
                label={t(`ai.task.${task}`)}
                hint={
                  <span className="flex flex-col gap-0.5">
                    <span>{t(`agents.taskHint.${task}`)}</span>
                    <span className="font-semibold text-ink-600">
                      {t('agents.runsOn', { runtime: t(`ai.runtime.${runtimeFor(task, sel.provider)}`) })}
                    </span>
                    <span className="tabular-nums">{priceHint(sel)}</span>
                  </span>
                }
              >
                {(p) => (
                  <ModelSelect
                    {...p}
                    value={sel}
                    onChange={(s) => setDefault(task, s)}
                    pricing={pricing}
                    connected={connected}
                  />
                )}
              </Field>
            )
          })}
        </div>
      </Card>

      <Card aria-labelledby="overrides-title">
        <CardHeader className="items-start">
          <div>
            <CardTitle id="overrides-title">{t('agents.overrides')}</CardTitle>
            <p className="mt-0.5 text-sm text-ink-500">{t('agents.overridesHint')}</p>
          </div>
        </CardHeader>

        {draft.projectOverrides.length ? (
          <ul className="mb-4 flex flex-col gap-2">
            {draft.projectOverrides.map((o) => {
              const project = dir.project(o.projectId)?.name ?? o.projectId
              const task = t(`ai.task.${o.task}`)
              return (
                <li
                  key={`${o.projectId}/${o.task}`}
                  className="flex items-center gap-3 rounded-xl bg-muted py-2 pr-2 pl-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">
                      {project} · {task}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-600">
                      <ModelName selection={o.selection} />
                      {o.task === 'work' ? (
                        <span>· {t(`ai.runtime.${runtimeFor('work', o.selection.provider)}`)}</span>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('agents.removeOverride', { project, task })}
                    onClick={() => removeOverride(o.projectId, o.task)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-ink-500">{t('agents.noOverrides')}</p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] lg:items-end">
          <Field label={t('agents.project')}>
            {(p) => (
              <Select
                {...p}
                value={addProjectId}
                onChange={(e) => setAdding((a) => ({ ...a, projectId: e.target.value }))}
              >
                {projects.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('agents.task')}>
            {(p) => (
              <Select
                {...p}
                value={adding.task}
                onChange={(e) => setAdding((a) => ({ ...a, task: e.target.value as AiTask }))}
              >
                {AI_TASKS.map((task) => (
                  <option key={task} value={task}>
                    {t(`ai.task.${task}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('agents.model')}>
            {(p) => (
              <ModelSelect
                {...p}
                value={adding.selection}
                onChange={(selection) => setAdding((a) => ({ ...a, selection }))}
                pricing={pricing}
                connected={connected}
              />
            )}
          </Field>
          <Button variant="secondary" size="lg" disabled={!addProjectId} onClick={addOverride}>
            <Plus aria-hidden />
            {t('agents.addOverride')}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          size="lg"
          className="sm:w-fit"
          disabled={!dirty}
          aria-describedby={statusId}
          loading={update.isPending}
          onClick={save}
        >
          {t('common.save')}
        </Button>
        {dirty ? (
          <Button variant="ghost" size="lg" className="sm:w-fit" onClick={() => setDraft(saved)}>
            {t('agents.reset')}
          </Button>
        ) : null}
        <p id={statusId} className="text-sm text-ink-500" aria-live="polite">
          {dirty ? t('agents.unsaved') : t('agents.upToDate')}
        </p>
      </div>
    </>
  )
}

export default function AgentsPage() {
  const { t } = useTranslation()
  usePageTitle(t('agents.title'))
  const settings = useAiSettings()
  const pricing = useAiPricing()

  const body = () => {
    if (settings.isPending || pricing.isPending) return <Skeleton className="h-96" />
    if (settings.isError || pricing.isError || !settings.data || !pricing.data) {
      return (
        <ErrorState
          title={t('common.errorTitle')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void settings.refetch()
                void pricing.refetch()
              }}
            >
              {t('common.retry')}
            </Button>
          }
        />
      )
    }
    return (
      <div className="flex flex-col gap-4">
        <Providers settings={settings.data} />
        <Selections settings={settings.data} pricing={pricing.data} />
      </div>
    )
  }

  return (
    <>
      <PageHeader title={t('agents.title')} description={t('agents.subtitle')} />
      {body()}
    </>
  )
}
