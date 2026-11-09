import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { keys } from '@/api/queries'
import { env } from '@/config/env'
import { debounce } from '@/lib/debounce'
import { MOCK_DATA_CHANGED_EVENT } from '@/mocks/signals'

/** A burst of saves in another tab (one per request it sends) becomes one refresh here. */
export const DEMO_DATA_REFRESH_DELAY_MS = 150

/**
 * Mock mode: when another tab changes the demo data, what this tab has cached
 * is out of date. Marks every answer stale, so the screen on show is fetched
 * again at once and the others when they are next opened, as they would be
 * from a real backend after their next poll.
 */
export function DemoDataSync() {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!env.apiMock) return
    const refresh = debounce(
      () => void queryClient.invalidateQueries({ queryKey: keys.all }),
      DEMO_DATA_REFRESH_DELAY_MS,
    )
    window.addEventListener(MOCK_DATA_CHANGED_EVENT, refresh.schedule)
    return () => {
      window.removeEventListener(MOCK_DATA_CHANGED_EVENT, refresh.schedule)
      refresh.cancel()
    }
  }, [queryClient])
  return null
}
