import { describe, expect, it } from 'vitest'
import { isMonth, monthWeeks } from './month-grid'

describe('monthWeeks', () => {
  it('starts on the Sunday on or before the 1st and ends on the Saturday on or after the last day', () => {
    const weeks = monthWeeks('2026-11') // 1 November 2026 is a Sunday
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ])
    expect(weeks.at(-1)).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
    ])
  })

  it('needs four weeks for a February that starts on a Sunday and six for a long month that starts on a Saturday', () => {
    const february = monthWeeks('2026-02')
    expect(february).toHaveLength(4)
    expect([february[0]![0], february.at(-1)!.at(-1)]).toEqual(['2026-02-01', '2026-02-28'])

    const august = monthWeeks('2026-08') // starts on a Saturday, 31 days
    expect(august).toHaveLength(6)
    expect([august[0]![0], august.at(-1)!.at(-1)]).toEqual(['2026-07-26', '2026-09-05'])
  })

  it('crosses a year and a leap day', () => {
    const december = monthWeeks('2026-12')
    expect(december.at(-1)!.at(-1)).toBe('2027-01-02')
    const leap = monthWeeks('2028-02')
    expect(leap.flat()).toContain('2028-02-29')
    expect(leap.flat().filter((d) => d.startsWith('2028-02'))).toHaveLength(29)
  })

  it('lists every day once, in order, seven to a week', () => {
    const days = monthWeeks('2027-03').flat()
    expect(days.length % 7).toBe(0)
    expect([...days].sort()).toEqual(days)
    expect(new Set(days).size).toBe(days.length)
  })
})

describe('isMonth', () => {
  it('accepts YYYY-MM only', () => {
    expect(isMonth('2026-11')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-00')).toBe(false)
    expect(isMonth('2026-1')).toBe(false)
    expect(isMonth('2026-11-01')).toBe(false)
    expect(isMonth(null)).toBe(false)
    expect(isMonth('')).toBe(false)
  })
})
