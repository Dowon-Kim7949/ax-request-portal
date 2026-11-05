/** The part of a TanStack query result `refreshOf` reads. */
interface RefreshingQuery {
  /** A refresh failed while data from an earlier load is still there */
  isRefetchError: boolean
  isFetching: boolean
  refetch: () => unknown
}

/**
 * Props for `RefreshFailed` (src/components/ui/load-failed.tsx) from the
 * queries a screen shows: failed when a refresh of any of them failed, and a
 * retry that runs again those that did.
 */
export function refreshOf(...queries: RefreshingQuery[]): {
  failed: boolean
  retrying: boolean
  onRetry: () => void
} {
  const failed = queries.filter((q) => q.isRefetchError)
  return {
    failed: failed.length > 0,
    retrying: failed.some((q) => q.isFetching),
    onRetry: () => {
      for (const q of failed) void q.refetch()
    },
  }
}
