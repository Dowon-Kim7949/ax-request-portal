/**
 * The weeks of a month calendar. Dates are head-office calendar days as
 * `YYYY-MM-DD` strings, worked out in UTC so no time zone can move a day.
 */
import { addDays } from '@/lib/format'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** A `YYYY-MM` month, e.g. from the URL. */
export function isMonth(value: string | null | undefined): value is string {
  return !!value && MONTH.test(value)
}

/** 0 = Sunday … 6 = Saturday */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * Every week (Sunday first) that holds a day of `month`, as seven dates each:
 * four to six weeks, padded with the neighbouring months' days.
 */
export function monthWeeks(month: string): string[][] {
  const start = addDays(`${month}-01`, -weekdayOf(`${month}-01`))
  const last = lastDayOf(month)
  const end = addDays(last, 6 - weekdayOf(last))
  const weeks: string[][] = []
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)))
  }
  return weeks
}
