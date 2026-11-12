import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { ReleaseScheduleItem } from '@/domain/model'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { monthWeeks } from './month-grid'
import { MonthCalendar } from './month-view'
import SchedulePage from './schedule-page'

// 10:00 on Monday 2 November 2026 at the head office. The seed schedules #1019
// for the next day and #1020 for three days later.
const NOW = new Date('2026-11-02T01:00:00.000Z')
const t = createTestApi(NOW)

/** A tablet or wider screen (`wide`), or a phone. */
function viewport(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  await signInAs('u-kim') // a requester
})
afterEach(() => {
  t.server.resetHandlers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
afterAll(() => t.server.close())

function Where() {
  const { pathname, search } = useLocation()
  return <output data-testid="where">{pathname + search}</output>
}

function renderAt(path: string, ui = <SchedulePage />) {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        {ui}
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const where = () => screen.getByTestId('where').textContent

describe('the month view of the release schedule', () => {
  it('puts each release on its head-office day and marks today', async () => {
    viewport(true)
    renderAt('/schedule?view=month')

    const calendar = await screen.findByRole('table', { name: '2026년 11월' })
    expect(within(calendar).getByRole('columnheader', { name: '일요일' })).toBeInTheDocument()
    expect(within(calendar).getAllByRole('row')).toHaveLength(6) // the weekday row and five weeks

    const tuesday = within(calendar).getByRole('cell', { name: /^11월 3일 \(화\)/ })
    expect(within(tuesday).getByRole('link', { name: /#1019/ })).toHaveAttribute('href', '/requests/1019')
    const thursday = within(calendar).getByRole('cell', { name: /^11월 5일 \(목\)/ })
    // Someone else's request: listed (the schedule is company-wide), but its page would not open.
    expect(within(thursday).getByText(/#1020/)).toBeInTheDocument()
    expect(within(thursday).queryByRole('link')).not.toBeInTheDocument()

    const today = within(calendar).getByRole('cell', { name: /^11월 2일 \(월\), 오늘/ })
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(
      within(calendar)
        .getAllByRole('cell')
        .filter((c) => c.hasAttribute('aria-current')),
    ).toHaveLength(1)
  })

  it('switches between the list and the month, keeping the choice in the URL', async () => {
    viewport(true)
    const user = userEvent.setup()
    renderAt('/schedule')

    const view = await screen.findByRole('radiogroup', { name: '보기' })
    expect(within(view).getByRole('radio', { name: '목록' })).toHaveAttribute('aria-checked', 'true')
    expect(await screen.findByRole('heading', { name: '이번 주' })).toBeInTheDocument()

    await user.click(within(view).getByRole('radio', { name: '달력' }))
    expect(await screen.findByRole('table', { name: '2026년 11월' })).toBeInTheDocument()
    expect(where()).toBe('/schedule?view=month')

    await user.click(within(view).getByRole('radio', { name: '목록' }))
    expect(await screen.findByRole('heading', { name: '이번 주' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(where()).toBe('/schedule')
  })

  it('steps to other months, past ones included, and back to this month', async () => {
    viewport(true)
    const user = userEvent.setup()
    renderAt('/schedule?view=month')
    await screen.findByRole('table', { name: '2026년 11월' })
    expect(screen.getByRole('button', { name: '이번 달' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '다음 달' }))
    expect(await screen.findByRole('table', { name: '2026년 12월' })).toBeInTheDocument()
    expect(where()).toBe('/schedule?view=month&month=2026-12')
    expect(screen.queryByRole('link', { name: /#1019/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    expect(await screen.findByRole('table', { name: '2026년 10월' })).toBeInTheDocument()
    expect(where()).toBe('/schedule?view=month&month=2026-10')

    await user.click(screen.getByRole('button', { name: '이번 달' }))
    expect(await screen.findByRole('table', { name: '2026년 11월' })).toBeInTheDocument()
    expect(where()).toBe('/schedule?view=month')
  })

  it('opens the month a link names', async () => {
    viewport(true)
    renderAt('/schedule?view=month&month=2027-02')
    expect(await screen.findByRole('table', { name: '2027년 2월' })).toBeInTheDocument()
    expect(screen.getByText('이 달에는 배포 일정이 없어요.')).toBeInTheDocument()
  })

  it('falls back to this month for a malformed month', async () => {
    viewport(true)
    renderAt('/schedule?view=month&month=2026-13')
    expect(await screen.findByRole('table', { name: '2026년 11월' })).toBeInTheDocument()
  })

  it('keeps the list on a phone, even when the link asks for the month', async () => {
    viewport(false)
    renderAt('/schedule?view=month')
    expect(await screen.findByRole('heading', { name: '이번 주' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: '보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('a busy day in the month view', () => {
  const day = '2026-11-10'
  const items: ReleaseScheduleItem[] = [
    {
      date: day,
      projectId: 'p-portal',
      requests: [1, 2, 3].map(
        (n) =>
          ({ id: 2000 + n, title: `포털 변경 ${n}`, status: 'release_scheduled', canOpen: true }) as const,
      ),
    },
    {
      date: day,
      projectId: 'p-field',
      requests: [4, 5].map(
        (n) =>
          ({ id: 2000 + n, title: `현장 변경 ${n}`, status: 'release_scheduled', canOpen: true }) as const,
      ),
    },
  ]

  it('shows two releases and folds the rest behind a button', async () => {
    const user = userEvent.setup()
    renderAt(
      '/schedule?view=month',
      <MonthCalendar
        month="2026-11"
        weeks={monthWeeks('2026-11')}
        today="2026-11-02"
        items={items}
        busy={false}
      />,
    )
    const cell = screen.getByRole('cell', { name: /^11월 10일 \(화\)/ })
    expect(within(cell).getAllByRole('link')).toHaveLength(2)

    const more = within(cell).getByRole('button', { name: '3건 더 보기' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await user.click(more)
    expect(within(cell).getAllByRole('link')).toHaveLength(5)

    const less = within(cell).getByRole('button', { name: '접기' })
    expect(less).toHaveAttribute('aria-expanded', 'true')
    expect(less).toHaveFocus()
    await user.click(less)
    expect(within(cell).getAllByRole('link')).toHaveLength(2)
  })

  it('names each release with its number, title, service and status', () => {
    renderAt(
      '/schedule?view=month',
      <MonthCalendar
        month="2026-11"
        weeks={monthWeeks('2026-11')}
        today="2026-11-02"
        items={items}
        busy={false}
      />,
    )
    expect(screen.getByRole('link', { name: /^#2001 포털 변경 1, .+, 배포 예정$/ })).toHaveAttribute(
      'href',
      '/requests/2001',
    )
  })

  it("lists someone else's release without a link to a page that would not open", () => {
    renderAt(
      '/schedule?view=month',
      <MonthCalendar
        month="2026-11"
        weeks={monthWeeks('2026-11')}
        today="2026-11-02"
        items={[
          {
            date: day,
            projectId: 'p-portal',
            requests: [{ id: 2009, title: '다른 팀 변경', status: 'release_scheduled', canOpen: false }],
          },
        ]}
        busy={false}
      />,
    )
    const cell = screen.getByRole('cell', { name: /^11월 10일 \(화\)/ })
    expect(within(cell).getByText('다른 팀 변경')).toBeInTheDocument()
    expect(within(cell).queryByRole('link')).not.toBeInTheDocument()
  })
})
