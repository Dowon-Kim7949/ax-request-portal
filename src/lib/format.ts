/** Locale-aware formatting. Every function follows the current UI language. */
import i18n, { currentLocale } from '@/i18n'
import { INTL_LOCALE } from '@/i18n/locales'

const tag = () => INTL_LOCALE[currentLocale()]

/** YYYY-MM-DD → "11월 6일 (금)" / "Fri, Nov 6" */
export function formatDate(date: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date)
  return new Intl.DateTimeFormat(tag(), {
    ...(opts.year ? { year: 'numeric' } : {}),
    month: currentLocale() === 'ko' ? 'long' : 'short',
    day: 'numeric',
    ...(opts.weekday !== false ? { weekday: 'short' } : {}),
  }).format(d)
}

/** ISO timestamp → "11월 2일 오후 3:04" / "Nov 2, 3:04 PM" */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(tag(), {
    month: currentLocale() === 'ko' ? 'long' : 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** YYYY-MM → "2026년 10월" / "October 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Intl.DateTimeFormat(tag(), { year: 'numeric', month: 'long' }).format(new Date(y, m - 1, 1))
}

/** ISO timestamp → "방금 전", "3시간 전" / "just now", "3 hours ago" */
export function formatRelative(iso: string, now = Date.now()): string {
  const diff = (Date.parse(iso) - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return i18n.t('common.justNow')
  const rtf = new Intl.RelativeTimeFormat(tag(), { numeric: 'auto' })
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86_400 * 7) return rtf.format(Math.round(diff / 86_400), 'day')
  return formatDate(iso.slice(0, 10), { weekday: false })
}

/** Korean won: "18.4만 원" / "9,800원" in Korean, "₩184K" / "₩9,800" in English */
export function formatKrw(value: number): string {
  if (currentLocale() === 'ko') {
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

/** Local calendar date of a Date, YYYY-MM-DD */
export function toLocalDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM plus or minus whole months */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Number of days in a YYYY-MM month */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(y, m, 0).getDate()
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}
