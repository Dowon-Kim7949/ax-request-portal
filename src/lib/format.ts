/**
 * Locale-aware formatting. Every function follows the current UI language.
 *
 * Timestamps (ISO instants) show in the viewer's time zone: the one picked in
 * Settings, otherwise the device's. Date-only values (YYYY-MM-DD) are calendar
 * dates and show as they are, whatever the time zone. See ./time-zone.ts.
 */
import { appConfig } from '@/config/app.config'
import i18n, { currentLocale } from '@/i18n'
import { INTL_LOCALE } from '@/i18n/locales'
import { usePreferences } from '@/stores/preferences'
import {
  addCalendarDays,
  dateInTimeZone,
  hqTimeZone,
  resolveViewTimeZone,
  sameOffset,
  zoneAbbreviation,
} from './time-zone'

const tag = () => INTL_LOCALE[currentLocale()]

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

/** How timestamps are shown on this device. */
export interface TimeView {
  /** Time zone timestamps are written in */
  timeZone: string
  /** Add head-office time when `timeZone` reads a different clock */
  showHq: boolean
}

/** The saved choice, read once (components use `useTimeView` to follow changes). */
export function currentTimeView(): TimeView {
  const { timeZone, showHqTime } = usePreferences.getState()
  return { timeZone: resolveViewTimeZone(timeZone), showHq: showHqTime }
}

/** "한국" / "Korea": how the head office's place is called in the UI language */
export function hqPlaceName(): string {
  return appConfig.organization.timeZoneLabel[currentLocale()]
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function dateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tag()}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(tag(), options)
    formatters.set(key, f)
  }
  return f
}

/** A calendar date as a UTC midnight, formatted in UTC: it can never slip to another day. */
function calendarInstant(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * YYYY-MM-DD → "11월 6일 (금)" / "Fri, Nov 6", the date exactly as written.
 * Given a timestamp instead, the date it falls on in the viewer's time zone.
 */
export function formatDate(
  date: string,
  opts: { weekday?: boolean; year?: boolean; timeZone?: string } = {},
): string {
  const calendar = CALENDAR_DATE.test(date)
    ? date
    : dateInTimeZone(date, opts.timeZone ?? currentTimeView().timeZone)
  return dateTimeFormat({
    timeZone: 'UTC',
    ...(opts.year ? { year: 'numeric' } : {}),
    month: currentLocale() === 'ko' ? 'long' : 'short',
    day: 'numeric',
    ...(opts.weekday !== false ? { weekday: 'short' } : {}),
  }).format(calendarInstant(calendar))
}

/**
 * Korean morning and afternoon. Some locale data (CLDR 47: Node 22 and 24, and
 * browsers built on it) writes Korean times with "AM" / "PM"; Korean readers
 * and newer data use 오전 / 오후, so every browser shows the same words.
 */
const KO_DAY_PERIOD: Readonly<Record<string, string>> = { AM: '오전', PM: '오후' }

/** ISO timestamp → "11월 2일 오후 3:04" / "Nov 2, 3:04 PM", in the viewer's time zone */
export function formatDateTime(iso: string, opts: { timeZone?: string } = {}): string {
  const format = dateTimeFormat({
    timeZone: opts.timeZone ?? currentTimeView().timeZone,
    month: currentLocale() === 'ko' ? 'long' : 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const date = new Date(iso)
  if (currentLocale() !== 'ko') return format.format(date)
  return format
    .formatToParts(date)
    .map((p) => (p.type === 'dayPeriod' ? (KO_DAY_PERIOD[p.value] ?? p.value) : p.value))
    .join('')
}

/** A timestamp spelled out for a detail screen. */
export interface DateTimeDescription {
  /** In the viewer's time zone: "11월 4일 오후 6:00" */
  local: string
  /** Zone name, only when the viewer's clock differs from the head office's: "PST" */
  zone?: string
  /** Head-office time, when it differs and the viewer wants it */
  hq?: { place: string; time: string }
  /** Everything in one line: "11월 4일 오후 6:00 (PST) · 한국 11월 5일 오전 11:00" */
  text: string
}

/**
 * Local time, plus the zone name and head-office time when the viewer's clock
 * differs from the head office's at that instant. A viewer whose time zone has
 * a different name but the same offset sees no difference, and nothing is added.
 */
export function describeDateTime(iso: string, view: TimeView = currentTimeView()): DateTimeDescription {
  const local = formatDateTime(iso, { timeZone: view.timeZone })
  const hqZone = hqTimeZone()
  if (sameOffset(view.timeZone, hqZone, iso)) return { local, text: local }
  const zone = zoneAbbreviation(view.timeZone, iso)
  const withZone = i18n.t('time.withZone', { time: local, zone })
  if (!view.showHq) return { local, zone, text: withZone }
  const hq = { place: hqPlaceName(), time: formatDateTime(iso, { timeZone: hqZone }) }
  return {
    local,
    zone,
    hq,
    text: i18n.t('time.pair', { local: withZone, hq: i18n.t('time.atHq', hq) }),
  }
}

/** YYYY-MM-DD → its weekday: "월" / "Mon" (short), "월요일" / "Monday" (long) */
export function formatWeekday(date: string, width: 'short' | 'long' = 'short'): string {
  return dateTimeFormat({ timeZone: 'UTC', weekday: width }).format(calendarInstant(date))
}

/** YYYY-MM → "2026년 10월" / "October 2026" */
export function formatMonth(month: string): string {
  return dateTimeFormat({ timeZone: 'UTC', year: 'numeric', month: 'long' }).format(
    calendarInstant(`${month}-01`),
  )
}

/** ISO timestamp → "방금 전", "3시간 전" / "just now", "3 hours ago"; older ones as a date */
export function formatRelative(iso: string, now = Date.now()): string {
  const diff = (Date.parse(iso) - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return i18n.t('common.justNow')
  const rtf = new Intl.RelativeTimeFormat(tag(), { numeric: 'auto' })
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86_400 * 7) return rtf.format(Math.round(diff / 86_400), 'day')
  return formatDate(iso, { weekday: false })
}

/** Korean won: "1.5억 원" / "18.4만 원" / "9,800원" in Korean, "₩184K" / "₩9,800" in English */
export function formatKrw(value: number): string {
  if (currentLocale() === 'ko') {
    // Korean groups by 10⁴ (만) and 10⁸ (억): "100억 원", not "1,000,000만 원".
    if (value >= 100_000_000) return `${(Math.round(value / 10_000_000) / 10).toLocaleString('ko-KR')}억 원`
    if (value >= 10_000) return `${(Math.round(value / 1_000) / 10).toLocaleString('ko-KR')}만 원`
    return `${Math.round(value).toLocaleString('ko-KR')}원`
  }
  return new Intl.NumberFormat(tag(), {
    style: 'currency',
    currency: 'KRW',
    ...(value >= 10_000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
  }).format(value)
}

/** Like formatKrw, but a cost above zero never shows as "0원". */
export function formatSmallKrw(value: number): string {
  if (value > 0 && value < 1) return currentLocale() === 'ko' ? '1원 미만' : '< ₩1'
  return formatKrw(value)
}

/** US dollars with cents: "$0.42"; a cost above zero never shows as "$0.00". */
export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return '< $0.01'
  return new Intl.NumberFormat(tag(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Token counts, compact: "1.2K" / "1.2천", "3.4M" / "340만" */
export function formatTokens(value: number): string {
  return new Intl.NumberFormat(tag(), {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

/** Plain number in the UI language: "1,234" */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(tag()).format(value)
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(tag(), { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** YYYY-MM plus or minus whole months */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Number of days in a YYYY-MM month */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** YYYY-MM-DD plus or minus whole days */
export function addDays(date: string, days: number): string {
  return addCalendarDays(date, days)
}
