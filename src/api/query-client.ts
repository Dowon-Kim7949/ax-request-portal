import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

/** Tries after the first failure */
export const MAX_RETRIES = 2

/**
 * Worth another try: no answer (network, timeout) or a server error (5xx).
 * A 4xx will not fix itself, a contract violation is a deployment mismatch,
 * and anything that is not an ApiError is a bug in the app.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.code === 'contract_violation') return false
  return error.code === 'network' || error.code === 'timeout' || error.status >= 500
}

/** Errors the client did not raise itself point at a bug: say so in the console with where it happened. */
function logUnexpected(error: unknown, where: unknown) {
  if (!(error instanceof ApiError)) console.error('[query] unexpected error in', where, error)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => logUnexpected(error, query.queryKey) }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        logUnexpected(error, mutation.options.mutationKey ?? 'a mutation'),
    }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: (count, error) => count < MAX_RETRIES && isRetryable(error),
      },
      // A change is not repeated by itself: the server may have applied it before the answer was lost.
      mutations: { retry: false },
    },
  })
}
