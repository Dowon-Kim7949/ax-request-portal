import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { WorkRequestSummary } from '@/domain/model'
import AssignedPage from '@/features/work/assigned-page'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { RequestCard } from './request-card'

// 10:00 on Monday 2 November 2026 at the head office: "today" is 2026-11-02.
const NOW = new Date('2026-11-02T01:00:00.000Z')
const t = createTestApi(NOW)

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  await signInAs('u-han') // an admin: every request is in the queue
})
afterEach(() => {
  t.server.resetHandlers()
  vi.useRealTimers()
})
afterAll(() => t.server.close())

function renderUi(ui: React.ReactNode, path = '/') {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const summary = (over: Partial<WorkRequestSummary>): WorkRequestSummary => ({
  id: 3001,
  title: '로그인 실패 안내 문구 개선',
  projectId: 'p-portal',
  type: 'change',
  status: 'in_progress',
  requesterId: 'u-kim',
  createdAt: '2026-10-20T01:00:00.000Z',
  updatedAt: '2026-11-01T01:00:00.000Z',
  ...over,
})

describe('the dates on a request card', () => {
  it('stay hidden unless the list asks for them', () => {
    renderUi(<RequestCard request={summary({ desiredDate: '2026-10-30', scheduledDate: '2026-11-12' })} />)
    expect(screen.queryByText(/희망 일정/)).not.toBeInTheDocument()
    expect(screen.queryByText(/배포 예정 11월/)).not.toBeInTheDocument()
  })

  it('show the wanted-by and release dates as written', () => {
    renderUi(
      <RequestCard request={summary({ desiredDate: '2026-11-12', scheduledDate: '2026-11-10' })} showDates />,
    )
    const link = screen.getByRole('link')
    expect(within(link).getByText('희망 일정 11월 12일 (목)')).toBeInTheDocument()
    expect(within(link).getByText('배포 예정 11월 10일 (화)')).toBeInTheDocument()
    expect(screen.queryByText(/지남/)).not.toBeInTheDocument()
  })

  it('flag a date before the head office’s today while the request is open', () => {
    renderUi(
      <RequestCard request={summary({ desiredDate: '2026-10-30', scheduledDate: '2026-11-02' })} showDates />,
    )
    expect(screen.getByText('희망 일정 10월 30일 (금)').closest('[data-past-due]')).toHaveTextContent(
      '희망 일정 10월 30일 (금) · 지남',
    )
    // Today itself is not past due.
    expect(screen.getByText('배포 예정 11월 2일 (월)').closest('[data-past-due]')).toBeNull()
    expect(screen.getByRole('link')).toHaveAccessibleName(/희망 일정 10월 30일 \(금\) · 지남/)
  })

  it('do not flag a request that has ended', () => {
    renderUi(
      <RequestCard
        request={summary({ status: 'done', desiredDate: '2026-10-30', scheduledDate: '2026-10-29' })}
        showDates
      />,
    )
    expect(screen.getByText('배포 예정 10월 29일 (목)')).toBeInTheDocument()
    expect(screen.queryByText(/지남/)).not.toBeInTheDocument()
  })

  it('show nothing extra when the request has no dates', () => {
    renderUi(<RequestCard request={summary({})} showDates />)
    expect(screen.queryByText(/희망 일정|배포 예정 \d/)).not.toBeInTheDocument()
  })
})

describe('the assigned queue', () => {
  it('shows each request’s dates', async () => {
    renderUi(<AssignedPage />, '/work?filter=open')
    // The seed schedules #1019's release for tomorrow.
    const card = (await screen.findByText('#1019')).closest('a')!
    expect(within(card).getByText('배포 예정 11월 3일 (화)')).toBeInTheDocument()
  })
})
