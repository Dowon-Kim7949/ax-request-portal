import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import HomePage from './home-page'

const t = createTestApi()
const serverError = (message: string) => HttpResponse.json({ code: 'internal', message }, { status: 500 })

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  await signInAs('u-kim') // a requester
})
afterEach(() => {
  t.server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => t.server.close())

function renderHome(qc = testQueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('home screen when loading fails', () => {
  it('says the requests could not be loaded instead of showing none, and loads them on retry', async () => {
    t.server.use(http.get('*/api/requests', () => serverError('잠시 점검 중이에요.')))
    renderHome()

    const myTurn = screen.getByRole('region', { name: '확인이 필요해요' })
    // A polite status, not an alert: a screen may hold several of these lines.
    expect(await within(myTurn).findByRole('status')).toHaveTextContent('불러오지 못했어요')
    expect(within(myTurn).getByRole('status')).toHaveTextContent('잠시 점검 중이에요.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('지금 처리할 일이 없어요.')).toBeNull()
    expect(screen.queryByText(/진행 중인 요청 0건/)).toBeNull()
    expect(screen.getByRole('link', { name: /내 요청/ })).toHaveAttribute('href', '/requests')

    t.server.resetHandlers()
    await userEvent.click(within(myTurn).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText(/진행 중인 요청 \d+건/)).toBeInTheDocument()
    expect(within(myTurn).queryByRole('status')).toBeNull()
    expect(within(myTurn).getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('offers a retry for the service list instead of an empty one', async () => {
    t.server.use(http.get('*/api/projects', () => serverError('프로젝트를 읽지 못했어요.')))
    renderHome()

    const services = screen.getByRole('region', { name: '어느 서비스에 대한 요청인가요?' })
    expect(await within(services).findByRole('status')).toHaveTextContent('프로젝트를 읽지 못했어요.')
    // Starting a request without a preselected service still works.
    expect(within(services).getByRole('link', { name: '새 요청 쓰기' })).toBeInTheDocument()

    t.server.resetHandlers()
    await userEvent.click(within(services).getByRole('button', { name: '다시 시도' }))
    expect(await within(services).findByRole('link', { name: /고객 포털 웹/ })).toBeInTheDocument()
  })
})

describe('home screen when a refresh fails', () => {
  it('keeps what was loaded, says it may be out of date, and refreshes on retry', async () => {
    const qc = testQueryClient()
    renderHome(qc)
    expect(await screen.findByText(/진행 중인 요청 \d+건/)).toBeInTheDocument()
    const notice = '최신 정보를 불러오지 못했어요. 마지막으로 불러온 내용이에요.'
    expect(screen.queryByText(notice)).toBeNull()

    t.server.use(http.get('*/api/requests', () => serverError('잠시 점검 중이에요.')))
    await qc.refetchQueries()
    expect(await screen.findByText(notice)).toBeInTheDocument()
    // The data stays: no empty state, no full-screen error.
    expect(screen.getByText(/진행 중인 요청 \d+건/)).toBeInTheDocument()
    expect(screen.queryByText('불러오지 못했어요')).toBeNull()

    t.server.resetHandlers()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.queryByText(notice)).toBeNull())
  })
})
