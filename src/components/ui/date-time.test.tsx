import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { usePreferences } from '@/stores/preferences'
import { DateTimeText, HqCalendarNote } from './date-time'

const AT = '2026-11-05T02:00:00.000Z' // 11:00 on November 5 in Seoul, 18:00 on November 4 in Los Angeles

afterEach(() => {
  usePreferences.setState({ timeZone: 'auto', showHqTime: true })
})

const at = (timeZone: string, showHqTime = true) => usePreferences.setState({ timeZone, showHqTime })

describe('DateTimeText', () => {
  it('adds head-office time on detail screens for a viewer in North America', () => {
    at('America/Los_Angeles')
    const { container } = render(<DateTimeText iso={AT} variant="full" />)
    expect(container).toHaveTextContent('11월 4일 오후 6:00 (PST) · 한국 11월 5일 오전 11:00')
    const times = container.querySelectorAll('time')
    expect([...times].map((t) => t.getAttribute('dateTime'))).toEqual([AT, AT])
  })

  it('stays as it was for a viewer in Korea', () => {
    at('Asia/Seoul')
    const { container } = render(<DateTimeText iso={AT} variant="full" />)
    expect(container.textContent).toBe('11월 5일 오전 11:00')
  })

  it('keeps lists short and puts the full form in the tooltip', () => {
    at('America/Los_Angeles')
    render(<DateTimeText iso={AT} />)
    const time = screen.getByText('11월 4일 오후 6:00')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('title', '11월 4일 오후 6:00 (PST) · 한국 11월 5일 오전 11:00')
  })

  it('drops head-office time when turned off, and follows the setting live', () => {
    at('America/Los_Angeles')
    const { container } = render(<DateTimeText iso={AT} variant="full" />)
    expect(container).toHaveTextContent('한국')
    act(() => usePreferences.getState().setShowHqTime(false))
    expect(container.textContent).toBe('11월 4일 오후 6:00 (PST)')
  })

  it('keeps the word order of the sentence around it', () => {
    at('America/Los_Angeles')
    const { container } = render(<DateTimeText iso={AT} variant="full" sentence={(time) => `${time} 작성`} />)
    expect(container.textContent).toBe('11월 4일 오후 6:00 (PST) · 한국 11월 5일 오전 11:00 작성')
  })

  it('shows the viewer’s date for the date variant', () => {
    at('America/Los_Angeles')
    const { container } = render(<DateTimeText iso={AT} variant="date" weekday />)
    expect(container.textContent).toBe('11월 4일 (수)')
  })

  it('reads a business day from the head-office calendar, with both clocks in the tooltip', () => {
    at('America/Los_Angeles', false)
    render(<DateTimeText iso={AT} variant="date" calendar="hq" weekday />)
    const time = screen.getByText('11월 5일 (목)')
    expect(time).toHaveAttribute('dateTime', AT)
    // Even with head-office time turned off: the date is the head office's, so say when that was there.
    expect(time).toHaveAttribute('title', '11월 4일 오후 6:00 (PST) · 한국 11월 5일 오전 11:00')
  })

  it('reads the same business day for a viewer in Korea', () => {
    at('Asia/Seoul')
    render(<DateTimeText iso="2026-11-30T15:30:00.000Z" variant="date" calendar="hq" />)
    expect(screen.getByText('12월 1일')).toHaveAttribute('title', '12월 1일 오전 12:30')
  })
})

describe('HqCalendarNote', () => {
  it('appears only for a viewer on another clock', () => {
    at('Asia/Tokyo')
    const { container, rerender } = render(<HqCalendarNote />)
    expect(container).toBeEmptyDOMElement()
    act(() => at('America/New_York'))
    rerender(<HqCalendarNote />)
    expect(container).toHaveTextContent('날짜와 월별 집계는 본사(한국) 시간 기준이에요.')
  })
})
