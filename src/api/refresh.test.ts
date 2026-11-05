import { describe, expect, it, vi } from 'vitest'
import { refreshOf } from './refresh'

const query = (isRefetchError: boolean, isFetching = false) => ({
  isRefetchError,
  isFetching,
  refetch: vi.fn(),
})

describe('refreshOf', () => {
  it('says nothing while every refresh works', () => {
    expect(refreshOf(query(false), query(false))).toMatchObject({ failed: false, retrying: false })
  })

  it('retries only the queries whose refresh failed', () => {
    const ok = query(false, true)
    const stale = query(true)
    const props = refreshOf(ok, stale)
    expect(props).toMatchObject({ failed: true, retrying: false })
    props.onRetry()
    expect(stale.refetch).toHaveBeenCalledOnce()
    expect(ok.refetch).not.toHaveBeenCalled()
    expect(refreshOf(ok, query(true, true)).retrying).toBe(true)
  })
})
