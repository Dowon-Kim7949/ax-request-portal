import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keys } from '@/api/queries'
import { MOCK_DATA_CHANGED_EVENT } from '@/mocks/signals'
import { DEMO_DATA_REFRESH_DELAY_MS, DemoDataSync } from './demo-data-sync'

afterEach(() => {
  vi.useRealTimers()
})

describe('DemoDataSync', () => {
  it("refreshes what this tab has cached once another tab's changes are taken up", () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue()
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <DemoDataSync />
      </QueryClientProvider>,
    )

    // A burst of saves in the other tab: one refresh.
    act(() => {
      window.dispatchEvent(new Event(MOCK_DATA_CHANGED_EVENT))
      window.dispatchEvent(new Event(MOCK_DATA_CHANGED_EVENT))
    })
    expect(invalidate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(DEMO_DATA_REFRESH_DELAY_MS))
    expect(invalidate).toHaveBeenCalledOnce()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.all })

    unmount()
    window.dispatchEvent(new Event(MOCK_DATA_CHANGED_EVENT))
    vi.advanceTimersByTime(DEMO_DATA_REFRESH_DELAY_MS)
    expect(invalidate).toHaveBeenCalledOnce()
  })
})
