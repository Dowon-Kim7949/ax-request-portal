import { render } from '@testing-library/react'
import { toast } from 'sonner'
import { describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { MOCK_STORAGE_FULL_EVENT } from '@/mocks/signals'
import { DEMO_STORAGE_TOAST_ID, DemoStorageNotice } from './demo-storage-notice'

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

describe('DemoStorageNotice', () => {
  it('tells the person when the demo data can no longer be saved, and how to make room', () => {
    const { unmount } = render(<DemoStorageNotice />)
    window.dispatchEvent(new Event(MOCK_STORAGE_FULL_EVENT))
    expect(toast.warning).toHaveBeenCalledWith('데모 데이터 저장 공간이 부족해요', {
      id: DEMO_STORAGE_TOAST_ID,
      description: expect.stringContaining('‘데모 데이터 초기화’'),
      duration: 12_000,
    })

    unmount()
    window.dispatchEvent(new Event(MOCK_STORAGE_FULL_EVENT))
    expect(toast.warning).toHaveBeenCalledOnce()
  })
})
