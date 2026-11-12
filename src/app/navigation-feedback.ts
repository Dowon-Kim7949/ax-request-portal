import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useMatches, useNavigation } from 'react-router'

/**
 * How long a navigation may take before the progress bar shows. A page whose
 * code is already loaded opens well within it, so the bar does not flash.
 */
const PROGRESS_DELAY_MS = 150

/**
 * Whether a navigation has been pending for longer than `PROGRESS_DELAY_MS`.
 * A page's code loads on its first visit (`page()` in src/app/router.tsx);
 * meanwhile the router keeps the old page on screen, so without a sign the
 * tap looks ignored.
 */
export function useSlowNavigation(): boolean {
  const pending = useNavigation().state !== 'idle'
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!pending) return
    const timer = window.setTimeout(() => setSlow(true), PROGRESS_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      setSlow(false)
    }
  }, [pending])
  return pending && slow
}

/**
 * Fades the page in when the screen changes: another route, not another
 * request on the same route or a search-parameter change. Skipped when the
 * viewer asks for reduced motion (the stylesheet's reduced-motion rule does not
 * reach the Web Animations API) and where `animate` is missing (jsdom).
 */
export function usePageFade(target: RefObject<HTMLElement | null>) {
  const routeId = useMatches().at(-1)?.id
  const shown = useRef(routeId)
  useLayoutEffect(() => {
    if (routeId === shown.current) return
    shown.current = routeId
    const el = target.current
    if (!el || typeof el.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
  }, [routeId, target])
}
