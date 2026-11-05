import { Globe, Smartphone } from 'lucide-react'
import { useDeferredValue, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTimeView } from '@/app/time-zone'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SwitchRow } from '@/components/ui/controls'
import { DateTimeText } from '@/components/ui/date-time'
import { Field, Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { hqPlaceName } from '@/lib/format'
import {
  currentZoneName,
  deviceTimeZone,
  formatOffset,
  hqTimeZone,
  isValidTimeZone,
  listTimeZones,
  offsetMinutes,
  sameOffset,
  zoneAbbreviation,
} from '@/lib/time-zone'
import { usePreferences } from '@/stores/preferences'

interface ZoneOption {
  id: string
  offset: number
  label: string
  /** Lower-cased text the search matches against: the label, and the zone's current name */
  haystack: string
}

/** The zone's everyday name in the UI language ("미국 태평양 시간"), when the browser has one. */
function genericName(id: string, locale: string, at: number): string | undefined {
  try {
    const name = new Intl.DateTimeFormat(locale, { timeZone: id, timeZoneName: 'longGeneric' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    return name && !/^(GMT|UTC)/.test(name) ? name : undefined
  } catch {
    return undefined
  }
}

/** "UTC-08:00 · America/Los Angeles (미국 태평양 시간)" */
function zoneOption(id: string, locale: string, at: number): ZoneOption {
  const offset = offsetMinutes(id, at)
  const generic = genericName(id, locale, at)
  const label = `${formatOffset(offset)} · ${id.replaceAll('_', ' ')}${generic ? ` (${generic})` : ''}`
  const current = currentZoneName(id)
  const renamed = current === id ? '' : ` ${current} ${current.replaceAll('_', ' ')}`
  return { id, offset, label, haystack: `${label} ${id}${renamed}`.toLowerCase() }
}

/** Every zone the browser knows, west to east. Built once per language: a few hundred formatters. */
function zoneOptions(locale: string, at: number): ZoneOption[] {
  return listTimeZones([deviceTimeZone()])
    .map((id) => zoneOption(id, locale, at))
    .sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id))
}

/** Searchable native select: the platform picker is the best one on phones. */
function TimeZonePicker({
  value,
  onChange,
  previewId,
}: {
  value: string
  onChange: (timeZone: string) => void
  /** The preview below, read with the select: picking a zone changes it */
  previewId: string
}) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  // Offsets as of opening the picker: they only move at daylight-saving changes.
  const [at] = useState(() => Date.now())
  const options = useMemo(() => zoneOptions(i18n.language, at), [i18n.language, at])
  const visible = useMemo(() => {
    const words = deferred.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matches = words.length
      ? options.filter((o) => words.every((w) => o.haystack.includes(w.replaceAll('_', ' '))))
      : options
    // The current choice stays in the list (even a saved alias the browser does not list),
    // so the select never shows another zone than the one in use.
    const current = options.find((o) => o.id === value) ?? zoneOption(value, i18n.language, at)
    return {
      count: matches.length,
      list: matches.includes(current) ? matches : [current, ...matches],
    }
  }, [deferred, options, value, i18n.language, at])

  return (
    <div className="flex flex-col gap-3">
      <Field label={t('time.settings.search')}>
        {(p) => (
          <Input
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t('time.settings.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            {...p}
          />
        )}
      </Field>
      <p className="text-[13px] text-ink-500" aria-live="polite">
        {deferred.trim()
          ? visible.count
            ? t('time.settings.matches', { count: visible.count })
            : t('time.settings.noMatch')
          : null}
      </p>
      <Field label={t('time.settings.zone')}>
        {(p) => (
          <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...p}
            aria-describedby={[p['aria-describedby'], previewId].filter(Boolean).join(' ')}
          >
            {visible.list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  )
}

export function TimeZoneSection() {
  const { t } = useTranslation()
  const preference = usePreferences((s) => s.timeZone)
  const setTimeZone = usePreferences((s) => s.setTimeZone)
  const showHq = usePreferences((s) => s.showHqTime)
  const setShowHq = usePreferences((s) => s.setShowHqTime)
  const view = useTimeView()
  const device = deviceTimeZone()
  const manual = preference !== 'auto' && isValidTimeZone(preference)
  const place = hqPlaceName()
  const previewId = useId()
  // One instant for the preview, so it changes only when the settings do.
  const [sample] = useState(() => new Date().toISOString())
  const sameClock = sameOffset(view.timeZone, hqTimeZone(), sample)

  const modes = [
    {
      key: 'auto',
      icon: Smartphone,
      label: t('time.settings.auto'),
      hint: t('time.settings.autoHint', { zone: `${device} (${zoneAbbreviation(device)})` }),
      active: !manual,
      select: () => setTimeZone('auto'),
    },
    {
      key: 'manual',
      icon: Globe,
      label: t('time.settings.manual'),
      hint: manual ? `${view.timeZone} (${zoneAbbreviation(view.timeZone)})` : t('time.settings.manualHint'),
      active: manual,
      // Start from the zone in use, so nothing changes until another one is picked.
      select: () => setTimeZone(view.timeZone),
    },
  ] as const

  return (
    <Card aria-labelledby="time-zone-title">
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle id="time-zone-title">{t('time.settings.title')}</CardTitle>
        <p className="text-sm text-ink-500">{t('time.settings.hint', { place })}</p>
      </CardHeader>
      <div className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label={t('time.settings.mode')}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={m.active}
              onClick={m.select}
              className={cn(
                'flex min-h-16 min-w-0 items-start gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ring-inset',
                m.active ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-surface ring-field hover:bg-muted',
              )}
            >
              <m.icon
                className={cn('mt-0.5 size-5 shrink-0', m.active ? 'text-accent-strong' : 'text-ink-500')}
                aria-hidden
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={cn('text-sm font-semibold', m.active ? 'text-accent-strong' : 'text-ink-700')}
                >
                  {m.label}
                </span>
                <span className="text-[13px] [overflow-wrap:anywhere] text-ink-500">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {manual ? (
          <TimeZonePicker value={view.timeZone} onChange={setTimeZone} previewId={previewId} />
        ) : null}

        <div className="border-t border-line">
          <SwitchRow
            checked={showHq}
            onCheckedChange={setShowHq}
            label={t('time.settings.showHq')}
            hint={t('time.settings.showHqHint', { place })}
          />
        </div>

        {/* Not a live region: each arrow key on the zone select changes it, and every change
            would be read out. The select names it as its description instead. */}
        <div id={previewId} className="rounded-2xl bg-muted px-4 py-3">
          <p className="text-xs font-semibold text-ink-500">{t('time.settings.preview')}</p>
          <dl className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-1 text-sm min-[420px]:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-ink-500">{t('time.settings.previewList')}</dt>
            <dd className="min-w-0 text-ink-900">
              <DateTimeText iso={sample} />
            </dd>
            <dt className="text-ink-500">{t('time.settings.previewDetail')}</dt>
            <dd className="min-w-0 text-ink-900">
              <DateTimeText iso={sample} variant="full" />
            </dd>
          </dl>
          {sameClock ? <p className="mt-2 text-[13px] text-ink-500">{t('time.settings.sameAsHq')}</p> : null}
        </div>
      </div>
    </Card>
  )
}
