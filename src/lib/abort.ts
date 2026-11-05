/** Small AbortSignal helpers shared by the API client and the deployment check. */

/**
 * A signal that aborts after `ms`, with a `TimeoutError` reason. Unlike
 * `AbortSignal.timeout` its timer can be cleared once the work is done, and it
 * runs on the page's own `setTimeout` (so tests can drive it with fake timers).
 */
export function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  if (!(ms > 0) || !Number.isFinite(ms)) return { signal: controller.signal, clear: () => {} }
  const timer = setTimeout(
    () => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    ms,
  )
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

/**
 * Aborts as soon as any of `signals` does, with that signal's reason.
 * `AbortSignal.any` where the browser has it (all current ones); the same by
 * hand otherwise (Safari before 17.4, Chrome before 116).
 */
export function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([...signals])
  const controller = new AbortController()
  const aborted = signals.find((s) => s.aborted)
  if (aborted) {
    controller.abort(aborted.reason)
    return controller.signal
  }
  const detach = () => {
    for (const s of signals) s.removeEventListener('abort', onAbort)
  }
  function onAbort(this: AbortSignal) {
    detach()
    controller.abort(this.reason)
  }
  for (const s of signals) s.addEventListener('abort', onAbort)
  return controller.signal
}
