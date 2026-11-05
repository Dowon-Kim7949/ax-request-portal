import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { createQueryClient, isRetryable, MAX_RETRIES } from './query-client'

describe('retry policy', () => {
  it('tries again when there was no answer or the server failed', () => {
    expect(isRetryable(new ApiError(0, 'network', 'offline'))).toBe(true)
    expect(isRetryable(new ApiError(0, 'timeout', 'slow'))).toBe(true)
    expect(isRetryable(new ApiError(500, 'internal', 'boom'))).toBe(true)
    expect(isRetryable(new ApiError(503, 'internal', 'busy'))).toBe(true)
  })

  it('does not repeat what another try cannot fix', () => {
    expect(isRetryable(new ApiError(404, 'not_found', 'gone'))).toBe(false)
    expect(isRetryable(new ApiError(409, 'invalid_transition', 'late'))).toBe(false)
    expect(isRetryable(new ApiError(401, 'unauthorized', 'signed out'))).toBe(false)
    // The deployed backend and this build disagree; asking again gets the same answer.
    expect(isRetryable(new ApiError(200, 'contract_violation', 'shape'))).toBe(false)
    expect(isRetryable(new ApiError(502, 'contract_violation', 'shape'))).toBe(false)
    // Not raised by the client: a bug in the app.
    expect(isRetryable(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false)
    expect(isRetryable(new Error('boom'))).toBe(false)
  })

  it('is what queries use, at most twice more; changes are never repeated', () => {
    const defaults = createQueryClient().getDefaultOptions()
    const retry = defaults.queries?.retry as (count: number, error: unknown) => boolean
    const network = new ApiError(0, 'network', 'offline')
    expect(retry(0, network)).toBe(true)
    expect(retry(MAX_RETRIES - 1, network)).toBe(true)
    expect(retry(MAX_RETRIES, network)).toBe(false)
    expect(retry(0, new ApiError(200, 'contract_violation', 'shape'))).toBe(false)
    expect(defaults.mutations?.retry).toBe(false)
  })
})
