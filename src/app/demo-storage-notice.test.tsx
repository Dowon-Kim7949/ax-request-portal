import { render } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { reportMockStorageFull, takeMockStorageFull } from '@/mocks/signals'
import { DEMO_STORAGE_TOAST_ID, DemoStorageNotice } from './demo-storage-notice'

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

beforeEach(() => {
  vi.mocked(toast.warning).mockClear()
  takeMockStorageFull() // nothing left over from an earlier test
})

describe('DemoStorageNotice', () => {
  it('tells the person when the demo data can no longer be saved, and how to make room', () => {
    const { unmount } = render(<DemoStorageNotice />)
    reportMockStorageFull()
    expect(toast.warning).toHaveBeenCalledWith('데모 데이터 저장 공간이 부족해요', {
      id: DEMO_STORAGE_TOAST_ID,
      description: expect.stringContaining('‘데모 데이터 초기화’'),
      duration: 12_000,
    })

    unmount()
    reportMockStorageFull()
    expect(toast.warning).toHaveBeenCalledOnce()
  })

  it('tells a failure from before it was rendered, once', () => {
    // The mock seeds and saves while it starts, before the app renders.
    reportMockStorageFull()
    const first = render(<DemoStorageNotice />)
    expect(toast.warning).toHaveBeenCalledOnce()

    first.unmount()
    render(<DemoStorageNotice />)
    expect(toast.warning).toHaveBeenCalledOnce()
  })
})
