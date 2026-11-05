export interface Debounced {
  /** Runs the function `ms` after the last call */
  schedule: () => void
  /** Runs a scheduled call now (nothing if none is waiting) */
  flush: () => void
  /** Drops a scheduled call */
  cancel: () => void
}

/** Trailing-edge debounce whose last call can be run early (page hidden) or dropped (work submitted). */
export function debounce(fn: () => void, ms: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  return {
    schedule: () => {
      cancel()
      timer = setTimeout(() => {
        timer = undefined
        fn()
      }, ms)
    },
    flush: () => {
      if (timer === undefined) return
      cancel()
      fn()
    },
    cancel,
  }
}
