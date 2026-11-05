/**
 * Time zones. Two clocks matter here:
 *
 * - The viewer's. Timestamps (when something happened) show in the time zone of
 *   the device, or the one picked in Settings. Where someone is comes from the
 *   device's time zone (Intl), never from an IP lookup.
 * - The head office's (`appConfig.organization.timeZone`). It is the business
 *   calendar: "today" for date-only values (desired dates, release dates,
 *   delays) and daily/monthly totals follow it, in the UI and the API alike.
 *
 * Date-only values (YYYY-MM-DD) are calendar dates: they never shift with a
 * time zone. This module has no UI state, so the mock API can use it too.
 */
import { appConfig } from '../config/app.config'

const FALLBACK_TIME_ZONE = 'UTC'

/** Whether the runtime knows this IANA time zone name. */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** Time zone the device is set to; UTC when the browser does not say. */
export function deviceTimeZone(): string {
  try {
    const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(tz) ? tz : FALLBACK_TIME_ZONE
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

/** Time zone timestamps are shown in: a valid saved choice, otherwise the device's. */
export function resolveViewTimeZone(
  preference: string | null | undefined,
  device = deviceTimeZone(),
): string {
  return preference && preference !== 'auto' && isValidTimeZone(preference) ? preference : device
}

/* ------------------------------------------------------------------ */
/* Wall clock and offsets                                              */
/* ------------------------------------------------------------------ */

const wallFormatters = new Map<string, Intl.DateTimeFormat>()

function wallClock(at: Date | number, timeZone: string) {
  let f = wallFormatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    wallFormatters.set(timeZone, f)
  }
  const parts = f.formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const toMs = (at: Date | number | string) =>
  typeof at === 'number' ? at : typeof at === 'string' ? Date.parse(at) : at.getTime()

/** Minutes `timeZone` is ahead of UTC at that instant (Seoul +540, Los Angeles -480 or -420). */
export function offsetMinutes(timeZone: string, at: Date | number | string = Date.now()): number {
  const ms = Math.floor(toMs(at) / 1000) * 1000
  const w = wallClock(ms, timeZone)
  return Math.round((Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - ms) / 60_000)
}

/** Whether two time zones read the same clock at that instant (different names may). */
export function sameOffset(a: string, b: string, at: Date | number | string = Date.now()): boolean {
  return a === b || offsetMinutes(a, at) === offsetMinutes(b, at)
}

/** "UTC+09:00", "UTC-08:00", "UTC+05:30" */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

const nameFormatters = new Map<string, Intl.DateTimeFormat>()

/**
 * Short zone name for a reader: "PST", "EDT" in North America, "GMT+9"
 * elsewhere. English names on purpose: they are the ones people use.
 */
export function zoneAbbreviation(timeZone: string, at: Date | number | string = Date.now()): string {
  try {
    let f = nameFormatters.get(timeZone)
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      nameFormatters.set(timeZone, f)
    }
    const name = f.formatToParts(toMs(at)).find((p) => p.type === 'timeZoneName')?.value
    if (name) return name
  } catch {
    // fall through to the numeric offset
  }
  return formatOffset(offsetMinutes(timeZone, at))
}

/* ------------------------------------------------------------------ */
/* Calendar dates                                                      */
/* ------------------------------------------------------------------ */

/** Calendar date (YYYY-MM-DD) of an instant in `timeZone`. */
export function dateInTimeZone(at: Date | number | string, timeZone: string): string {
  const w = wallClock(toMs(at), timeZone)
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`
}

/** YYYY-MM-DD plus or minus whole days: calendar arithmetic, no time zone involved. */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Head office                                                         */
/* ------------------------------------------------------------------ */

export function hqTimeZone(): string {
  return appConfig.organization.timeZone
}

/** "Today" on the business calendar: the head office's date right now. */
export function hqToday(now: Date | number = Date.now()): string {
  return dateInTimeZone(now, hqTimeZone())
}

/* ------------------------------------------------------------------ */
/* Choosing a time zone                                                */
/* ------------------------------------------------------------------ */

/** Used when the browser cannot list its time zones. */
const COMMON_TIME_ZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Denver',
  'America/Phoenix',
  'America/Chicago',
  'America/Mexico_City',
  'America/New_York',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
]

/**
 * Current names of zones that browsers may still list under a former one: V8
 * (Chrome, Edge, Node) lists Asia/Calcutta, not Asia/Kolkata. People search
 * for the city as it is called now. Search only: the zone stays the browser's.
 */
const CURRENT_ZONE_NAMES: Readonly<Record<string, string>> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Coral_Harbour': 'America/Atikokan',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Godthab': 'America/Nuuk',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Dacca': 'Asia/Dhaka',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Macao': 'Asia/Macau',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Thimbu': 'Asia/Thimphu',
  'Asia/Ujung_Pandang': 'Asia/Makassar',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
}

/** The zone's current IANA name ("Asia/Calcutta" → "Asia/Kolkata"); the id itself when it is current. */
export function currentZoneName(id: string): string {
  return CURRENT_ZONE_NAMES[id] ?? id
}

/**
 * Every time zone the browser knows (or a short list of common ones), plus
 * UTC, the head office's and `extra` (the device's, the saved choice), once each.
 */
export function listTimeZones(extra: readonly string[] = []): string[] {
  let zones: readonly string[] = []
  try {
    if (typeof Intl.supportedValuesOf === 'function') zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  if (!zones.length) zones = COMMON_TIME_ZONES
  return [...new Set([...zones, FALLBACK_TIME_ZONE, hqTimeZone(), ...extra.filter(isValidTimeZone)])]
}
