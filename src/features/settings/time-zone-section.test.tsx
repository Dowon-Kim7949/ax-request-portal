import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { usePreferences } from '@/stores/preferences'
import { TimeZoneSection } from './time-zone-section'

const HQ_TIME = /한국 \d{1,2}월 \d{1,2}일 (오전|오후) \d{1,2}:\d{2}/

afterEach(() => {
  usePreferences.setState({ timeZone: 'auto', showHqTime: true })
})

describe('time zone settings', () => {
  it('shows a picked zone, previews both clocks and turns head-office time off', () => {
    usePreferences.setState({ timeZone: 'America/Los_Angeles', showHqTime: true })
    render(<TimeZoneSection />)
    const section = screen.getByRole('region', { name: '시간대' })
    expect(within(section).getByRole('radio', { name: /직접 선택/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(section).getByLabelText('시간대', { selector: 'select' })).toHaveValue(
      'America/Los_Angeles',
    )
    expect(section).toHaveTextContent(HQ_TIME)
    expect(section).toHaveTextContent(/\((PST|PDT)\)/)

    fireEvent.click(within(section).getByRole('switch', { name: /본사 시각 함께 보기/ }))
    expect(usePreferences.getState().showHqTime).toBe(false)
    expect(section).not.toHaveTextContent(HQ_TIME)
  })

  it('finds zones by name and keeps the current one selectable', () => {
    usePreferences.setState({ timeZone: 'America/Los_Angeles' })
    render(<TimeZoneSection />)
    fireEvent.change(screen.getByLabelText('시간대 찾기'), { target: { value: 'seoul' } })
    const select = screen.getByLabelText('시간대', { selector: 'select' })
    const values = [...select.querySelectorAll('option')].map((o) => o.value)
    expect(values).toContain('Asia/Seoul')
    expect(values).toContain('America/Los_Angeles')
    expect(values).not.toContain('Europe/Paris')
    expect(screen.getByText(/찾은 시간대 \d+개/)).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'Asia/Seoul' } })
    expect(usePreferences.getState().timeZone).toBe('Asia/Seoul')
    expect(screen.getByText(/본사와 시각이 같아서/)).toBeInTheDocument()
  })

  it('finds a zone by its current city name even where the browser lists a former one', () => {
    usePreferences.setState({ timeZone: 'America/Los_Angeles' })
    render(<TimeZoneSection />)
    const search = screen.getByLabelText('시간대 찾기')
    const select = screen.getByLabelText('시간대', { selector: 'select' })
    const values = () => [...select.querySelectorAll('option')].map((o) => o.value)
    // V8 lists Asia/Calcutta, Europe/Kiev and Asia/Saigon; other engines may list the current names.
    for (const [query, ids] of [
      ['kolkata', ['Asia/Calcutta', 'Asia/Kolkata']],
      ['kyiv', ['Europe/Kiev', 'Europe/Kyiv']],
      ['ho chi minh', ['Asia/Saigon', 'Asia/Ho_Chi_Minh']],
    ] as const) {
      fireEvent.change(search, { target: { value: query } })
      expect(
        values().some((v) => (ids as readonly string[]).includes(v)),
        query,
      ).toBe(true)
      expect(screen.queryByText('맞는 시간대가 없어요. 다른 이름으로 찾아보세요.')).toBeNull()
    }
  })

  it('does not read the preview out on every change, but describes the zone select with it', () => {
    usePreferences.setState({ timeZone: 'America/Los_Angeles' })
    render(<TimeZoneSection />)
    const preview = screen.getByText('미리보기').parentElement!
    expect(preview).not.toHaveAttribute('aria-live')
    expect(screen.getByLabelText('시간대', { selector: 'select' })).toHaveAccessibleDescription(
      expect.stringContaining('미리보기'),
    )
  })

  it('goes back to the device time zone', () => {
    usePreferences.setState({ timeZone: 'America/New_York' })
    render(<TimeZoneSection />)
    fireEvent.click(screen.getByRole('radio', { name: /자동/ }))
    expect(usePreferences.getState().timeZone).toBe('auto')
    expect(screen.queryByLabelText('시간대 찾기')).not.toBeInTheDocument()
  })
})
