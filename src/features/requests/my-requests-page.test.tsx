import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import MyRequestsPage from './my-requests-page'

const t = createTestApi()
const searches: string[] = []

beforeAll(() => {
  t.server.listen({ onUnhandledFrame: 'error' })
  t.server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/requests') && url.searchParams.has('q'))
      searches.push(url.searchParams.get('q')!)
  })
})
beforeEach(async () => {
  searches.length = 0
  await signInAs('u-kim') // a requester
})
afterEach(() => t.server.resetHandlers())
afterAll(() => t.server.close())

function mine() {
  return t.store.engine.state.requests
    .filter((r) => r.requesterId === 'u-kim' && !['done', 'cancelled', 'rejected'].includes(r.status))
    .sort((a, b) => a.id - b.id)
}

describe('searching my requests', () => {
  it('asks the server once typing pauses, and keeps the filter counts of every request', async () => {
    const [target, other] = mine()
    expect(other).toBeDefined()
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={testQueryClient()}>
        <MemoryRouter initialEntries={['/requests']}>
          <MyRequestsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('link', { name: new RegExp(`#${other!.id}`) })).toBeInTheDocument()
    const open = screen.getByRole('radio', { name: /진행 중/ })
    const countBefore = open.textContent
    expect(countBefore).toMatch(/\d+$/)

    await user.type(screen.getByRole('searchbox', { name: '제목이나 번호로 찾기' }), `#${target!.id}`)
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: new RegExp(`#${other!.id}`) })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: new RegExp(`#${target!.id}`) })).toBeInTheDocument()
    // One request for the whole word, not one per keystroke.
    expect(searches).toEqual([`#${target!.id}`])
    expect(open.textContent).toBe(countBefore)
  })
})
