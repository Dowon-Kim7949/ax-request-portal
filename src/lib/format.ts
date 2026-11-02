/** Formatting helpers for Korean UI. All take ISO strings from the API. */

const LOCALE = 'ko-KR'

/** YYYY-MM-DD → "11월 6일 (금)" */
export function formatDate(date: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date)
  return new Intl.DateTimeFormat(LOCALE, {
    ...(opts.year ? { year: 'numeric' } : {}),
    month: 'long',
    day: 'numeric',
    ...(opts.weekday !== false ? { weekday: 'short' } : {}),
  })
    .format(d)
    .replace(/\((.)\)/, '($1)')
}

/** ISO timestamp → "11월 2일 오후 3:04" */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/** ISO timestamp → "방금 전", "3시간 전", "어제" */
export function formatRelative(iso: string, now = Date.now()): string {
  const diff = (Date.parse(iso) - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return '방금 전'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86_400 * 7) return rtf.format(Math.round(diff / 86_400), 'day')
  return formatDate(iso.slice(0, 10), { weekday: false })
}

/** 184000 → "18.4만 원", 9800 → "9,800원" */
export function formatKrw(value: number): string {
  if (value >= 10_000) {
    const man = Math.round(value / 1_000) / 10
    return `${man.toLocaleString(LOCALE)}만 원`
  }
  return `${Math.round(value).toLocaleString(LOCALE)}원`
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

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}
