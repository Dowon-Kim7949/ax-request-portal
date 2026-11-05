import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { env } from '@/config/env'
import { MOCK_STORAGE_FULL_EVENT, takeMockStorageFull } from '@/mocks/signals'

export const DEMO_STORAGE_TOAST_ID = 'demo-storage-full'

/**
 * Mock mode: says once that the browser stopped saving the demo data, so a
 * reload would lose the latest changes, and how to make room. Non-blocking;
 * the demo keeps working in memory. A failure from before this was rendered
 * (the mock seeds and saves while it starts) is told on mount.
 */
export function DemoStorageNotice() {
  const { t } = useTranslation()
  useEffect(() => {
    if (!env.apiMock) return
    const onFull = () => {
      if (!takeMockStorageFull()) return
      toast.warning(t('demoStorage.full'), {
        id: DEMO_STORAGE_TOAST_ID,
        description: t('demoStorage.fullHint', { action: t('nav.resetDemo') }),
        duration: 12_000,
      })
    }
    window.addEventListener(MOCK_STORAGE_FULL_EVENT, onFull)
    onFull()
    return () => window.removeEventListener(MOCK_STORAGE_FULL_EVENT, onFull)
  }, [t])
  return null
}
