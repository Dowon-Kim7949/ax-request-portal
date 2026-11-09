import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { usePreferences } from '@/stores/preferences'
import {
  daysInMonth,
  describeDateTime,
  formatDate,
  formatDateTime,
  formatMonth,
  formatRelative,
  shiftMonth,
} from './format'

const LA = 'America/Los_Angeles'
const SEOUL = 'Asia/Seoul'
/** 11:00 on November 5 in Seoul = 18:00 on November 4 in Los Angeles (PST) */
const AT = '2026-11-05T02:00:00.000Z'

const view = (timeZone: string, showHq = true) => ({ timeZone, showHq })

beforeEach(async () => {
  await i18n.changeLanguage('ko')
})
afterEach(() => {
  usePreferences.setState({ timeZone: 'auto', showHqTime: true })
})
afterAll(() => i18n.changeLanguage('ko'))

describe('timestamps', () => {
  it('show in the chosen time zone', () => {
    expect(formatDateTime(AT, { timeZone: LA })).toBe('11월 4일 오후 6:00')
    expect(formatDateTime(AT, { timeZone: SEOUL })).toBe('11월 5일 오전 11:00')
    usePreferences.setState({ timeZone: 'America/New_York' })
    expect(formatDateTime(AT)).toBe('11월 4일 오후 9:00')
  })

  it('say 오전 / 오후 in Korean even where the locale data says AM / PM', async () => {
    // CLDR 47 (Node 22 and 24, some browsers) writes Korean day periods as AM / PM.
    const realParts = Intl.DateTimeFormat.prototype.formatToParts
    const oldData = function (this: Intl.DateTimeFormat, date?: Date | number) {
      return realParts
        .call(this, date)
        .map((p) =>
          p.type === 'dayPeriod' && this.resolvedOptions().locale.startsWith('ko')
            ? { ...p, value: p.value === '오전' ? 'AM' : p.value === '오후' ? 'PM' : p.value }
            : p,
        )
    }
    const parts = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(oldData)
    // `format` is a getter that returns a bound function (the DOM types call it a method).
    // (vitest spies on getters only of non-function properties, hence `unknown`.)
    const proto = Intl.DateTimeFormat.prototype as unknown as { format: unknown }
    const whole = vi.spyOn(proto, 'format', 'get').mockImplementation(function (this: Intl.DateTimeFormat) {
      return (date?: Date | number) =>
        oldData
          .call(this, date)
          .map((p) => p.value)
          .join('')
    })
    try {
      expect(formatDateTime(AT, { timeZone: LA })).toBe('11월 4일 오후 6:00')
      expect(formatDateTime(AT, { timeZone: SEOUL })).toBe('11월 5일 오전 11:00')
      // English keeps the locale's own words.
      await i18n.changeLanguage('en')
      expect(formatDateTime(AT, { timeZone: LA })).toMatch(/^Nov 4, 6:00\sPM$/)
    } finally {
      parts.mockRestore()
      whole.mockRestore()
      await i18n.changeLanguage('ko')
    }
  })

  it('add the zone and head-office time when the clock differs', () => {
    expect(describeDateTime(AT, view(LA))).toEqual({
      local: '11월 4일 오후 6:00',
      zone: 'PST',
      hq: { place: '한국', time: '11월 5일 오전 11:00' },
      text: '11월 4일 오후 6:00 (PST) · 한국 11월 5일 오전 11:00',
    })
  })

  it('add nothing for a viewer on the head-office clock, whatever the zone is called', () => {
    expect(describeDateTime(AT, view(SEOUL))).toEqual({
      local: '11월 5일 오전 11:00',
      text: '11월 5일 오전 11:00',
    })
    expect(describeDateTime(AT, view('Asia/Tokyo')).text).toBe('11월 5일 오전 11:00')
  })

  it('keep only the zone name when head-office time is turned off', () => {
    const d = describeDateTime(AT, view(LA, false))
    expect(d.hq).toBeUndefined()
    expect(d.text).toBe('11월 4일 오후 6:00 (PST)')
  })

  it('follow daylight saving time at the instant shown', () => {
    expect(describeDateTime('2026-07-01T02:00:00.000Z', view(LA)).text).toBe(
      '6월 30일 오후 7:00 (PDT) · 한국 7월 1일 오전 11:00',
    )
  })

  it('read naturally in English', async () => {
    await i18n.changeLanguage('en')
    expect(describeDateTime(AT, view(LA)).text).toBe('Nov 4, 6:00 PM (PST) · Korea Nov 5, 11:00 AM')
  })
})

describe('date-only values', () => {
  const zones = ['Pacific/Kiritimati', SEOUL, 'UTC', LA, 'Pacific/Pago_Pago']

  it('show the same calendar date in every viewing time zone', () => {
    for (const timeZone of zones) {
      usePreferences.setState({ timeZone })
      expect(formatDate('2026-11-06'), timeZone).toBe('11월 6일 (금)')
      expect(formatDate('2026-03-08', { weekday: false }), timeZone).toBe('3월 8일')
      expect(formatMonth('2026-11'), timeZone).toBe('2026년 11월')
    }
  })

  it('do not depend on the time zone of the machine either', () => {
    // Node applies a TZ change at run time on Linux and macOS (CI); Windows keeps its own zone.
    const original = process.env.TZ
    try {
      for (const tz of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
        process.env.TZ = tz
        expect(formatDate('2026-11-06'), tz).toBe('11월 6일 (금)')
        expect(formatMonth('2026-01'), tz).toBe('2026년 1월')
        expect(shiftMonth('2026-01', -1), tz).toBe('2025-12')
        expect(daysInMonth('2028-02'), tz).toBe(29)
      }
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
  })

  it('a timestamp given as a date falls on the viewer’s day', () => {
    const justAfterMidnightInSeoul = '2026-10-31T15:30:00.000Z'
    expect(formatDate(justAfterMidnightInSeoul, { weekday: false, timeZone: SEOUL })).toBe('11월 1일')
    expect(formatDate(justAfterMidnightInSeoul, { weekday: false, timeZone: LA })).toBe('10월 31일')
  })
})

describe('relative times', () => {
  it('fall back to the viewer’s date after a week', () => {
    const now = Date.parse('2026-11-20T00:00:00.000Z')
    const iso = '2026-10-31T15:30:00.000Z'
    usePreferences.setState({ timeZone: SEOUL })
    expect(formatRelative(iso, now)).toBe('11월 1일')
    usePreferences.setState({ timeZone: LA })
    expect(formatRelative(iso, now)).toBe('10월 31일')
  })
})
