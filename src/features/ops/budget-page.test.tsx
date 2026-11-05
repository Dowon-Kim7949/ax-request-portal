import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import BudgetPage from './budget-page'

const t = createTestApi()
beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  await signInAs('u-yoon') // the operator
})
afterAll(() => t.server.close())

function renderBudget() {
  render(
    <QueryClientProvider client={testQueryClient()}>
      <MemoryRouter>
        <BudgetPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const OVER_MONTHLY = '요청 1건 한도는 월 한도보다 클 수 없어요.'

async function setValue(label: string, value: string) {
  const input = screen.getByLabelText(label)
  await userEvent.clear(input)
  await userEvent.type(input, value)
}

describe('budget limits', () => {
  it('checks both limits again when either changes, so the error goes with its cause', async () => {
    renderBudget()
    await screen.findByLabelText('월 한도 (원)')
    await setValue('요청 1건 한도 (원)', '600000')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText(OVER_MONTHLY)).toBeInTheDocument()

    // Raising the monthly limit fixes it: the error on the other field goes at once.
    await setValue('월 한도 (원)', '1000000')
    expect(screen.queryByText(OVER_MONTHLY)).toBeNull()

    // Lowering it again brings the error back on the per-request field.
    await setValue('월 한도 (원)', '100000')
    expect(await screen.findByText(OVER_MONTHLY)).toBeInTheDocument()
  })

  it('names the largest amount the Korean way', async () => {
    renderBudget()
    await screen.findByLabelText('월 한도 (원)')
    await setValue('월 한도 (원)', '20000000000')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('100억 원 이하로 입력해 주세요.')).toBeInTheDocument()
  })
})
