import { afterEach, describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  dateInTimeZone,
  formatOffset,
  hqTimeZone,
  hqToday,
  isValidTimeZone,
  currentZoneName,
  listTimeZones,
  offsetMinutes,
  resolveViewTimeZone,
  sameOffset,
  zoneAbbreviation,
} from './time-zone'

const LA = 'America/Los_Angeles'
const NY = 'America/New_York'
const SEOUL = 'Asia/Seoul'

describe('offsets', () => {
  it('reads the clock of each zone at an instant', () => {
    const winter = '2026-11-05T02:00:00Z'
    const summer = '2026-07-01T12:00:00Z'
    expect(offsetMinutes(SEOUL, winter)).toBe(540)
    expect(offsetMinutes(SEOUL, summer)).toBe(540)
    expect(offsetMinutes(LA, winter)).toBe(-480)
    expect(offsetMinutes(LA, summer)).toBe(-420)
    expect(offsetMinutes(NY, winter)).toBe(-300)
    expect(offsetMinutes(NY, summer)).toBe(-240)
    expect(offsetMinutes('Asia/Kolkata', winter)).toBe(330)
  })

  it('changes exactly at the daylight-saving boundaries', () => {
    // 2026: clocks go forward on March 8 and back on November 1 in the US.
    expect(offsetMinutes(LA, '2026-03-08T09:59:59Z')).toBe(-480)
    expect(offsetMinutes(LA, '2026-03-08T10:00:00Z')).toBe(-420)
    expect(offsetMinutes(LA, '2026-11-01T08:59:59Z')).toBe(-420)
    expect(offsetMinutes(LA, '2026-11-01T09:00:00Z')).toBe(-480)
    expect(offsetMinutes(NY, '2026-03-08T06:59:59Z')).toBe(-300)
    expect(offsetMinutes(NY, '2026-03-08T07:00:00Z')).toBe(-240)
    expect(offsetMinutes(NY, '2026-11-01T05:59:59Z')).toBe(-240)
    expect(offsetMinutes(NY, '2026-11-01T06:00:00Z')).toBe(-300)
  })

  it('treats zones with another name but the same clock as the same', () => {
    expect(sameOffset(SEOUL, SEOUL)).toBe(true)
    expect(sameOffset(SEOUL, 'Asia/Tokyo', '2026-11-05T02:00:00Z')).toBe(true)
    expect(sameOffset(SEOUL, LA, '2026-11-05T02:00:00Z')).toBe(false)
    // London matches UTC in winter only.
    expect(sameOffset('Europe/London', 'UTC', '2026-01-15T12:00:00Z')).toBe(true)
    expect(sameOffset('Europe/London', 'UTC', '2026-07-15T12:00:00Z')).toBe(false)
  })

  it('names zones the way readers know them', () => {
    expect(zoneAbbreviation(LA, '2026-11-05T02:00:00Z')).toBe('PST')
    expect(zoneAbbreviation(LA, '2026-07-01T12:00:00Z')).toBe('PDT')
    expect(zoneAbbreviation(NY, '2026-11-05T02:00:00Z')).toBe('EST')
    expect(zoneAbbreviation(SEOUL, '2026-11-05T02:00:00Z')).toBe('GMT+9')
    expect(formatOffset(540)).toBe('UTC+09:00')
    expect(formatOffset(-480)).toBe('UTC-08:00')
    expect(formatOffset(330)).toBe('UTC+05:30')
    expect(formatOffset(0)).toBe('UTC+00:00')
  })
})

describe('calendar dates', () => {
  it('takes the date an instant falls on in a zone', () => {
    // 00:00 in Seoul on November 1 is still October 31 in UTC and in Los Angeles.
    expect(dateInTimeZone('2026-10-31T15:00:00Z', SEOUL)).toBe('2026-11-01')
    expect(dateInTimeZone('2026-10-31T14:59:59Z', SEOUL)).toBe('2026-10-31')
    expect(dateInTimeZone('2026-10-31T15:00:00Z', LA)).toBe('2026-10-31')
    expect(dateInTimeZone('2026-11-01T06:59:59Z', LA)).toBe('2026-10-31')
    expect(dateInTimeZone('2026-11-01T07:00:00Z', LA)).toBe('2026-11-01')
    expect(dateInTimeZone(new Date('2026-11-05T02:00:00Z'), NY)).toBe('2026-11-04')
  })

  it('counts "today" on the head-office calendar, whatever the device says', () => {
    expect(hqTimeZone()).toBe(SEOUL)
    expect(hqToday(new Date('2026-11-04T14:59:59Z'))).toBe('2026-11-04')
    expect(hqToday(new Date('2026-11-04T15:00:00Z'))).toBe('2026-11-05')
    expect(hqToday(Date.parse('2026-11-05T02:00:00Z'))).toBe('2026-11-05')
  })

  it('adds days as calendar arithmetic, across months, leap days and DST changes', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addCalendarDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(addCalendarDays('2026-11-05', 0)).toBe('2026-11-05')
  })
})

describe('choosing a time zone', () => {
  it('knows the current name of a renamed zone', () => {
    expect(currentZoneName('Asia/Calcutta')).toBe('Asia/Kolkata')
    expect(currentZoneName('Europe/Kiev')).toBe('Europe/Kyiv')
    expect(currentZoneName('Asia/Seoul')).toBe('Asia/Seoul')
  })

  it('uses a valid saved choice, otherwise the device', () => {
    expect(resolveViewTimeZone('auto', SEOUL)).toBe(SEOUL)
    expect(resolveViewTimeZone(LA, SEOUL)).toBe(LA)
    expect(resolveViewTimeZone('Not/AZone', SEOUL)).toBe(SEOUL)
    expect(resolveViewTimeZone(null, NY)).toBe(NY)
    expect(isValidTimeZone(LA)).toBe(true)
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
  })

  describe('list', () => {
    const original = Intl.supportedValuesOf
    afterEach(() => {
      Object.defineProperty(Intl, 'supportedValuesOf', {
        value: original,
        configurable: true,
        writable: true,
      })
    })

    it('lists every zone once, with UTC, the head office and the extras', () => {
      const zones = listTimeZones([LA, 'Not/AZone'])
      expect(zones).toContain(SEOUL)
      expect(zones).toContain('UTC')
      expect(zones).toContain(LA)
      expect(zones).not.toContain('Not/AZone')
      expect(new Set(zones).size).toBe(zones.length)
      expect(zones.length).toBeGreaterThan(100)
    })

    it('falls back to common zones when the browser cannot list them', () => {
      Object.defineProperty(Intl, 'supportedValuesOf', {
        value: undefined,
        configurable: true,
        writable: true,
      })
      const zones = listTimeZones(['Europe/Madrid'])
      expect(zones).toEqual(expect.arrayContaining([LA, NY, SEOUL, 'UTC', 'Europe/Madrid']))
      expect(zones.length).toBeLessThan(40)
    })
  })
})
