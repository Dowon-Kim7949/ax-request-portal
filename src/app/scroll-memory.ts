import { useContext, useLayoutEffect, type RefObject } from 'react'
import { UNSAFE_DataRouterStateContext, useLocation } from 'react-router'

const STORAGE_KEY = 'ax-request-portal:scroll-regions'
const MAX_ENTRIES = 100
/** How long a restore waits for the content (data still loading) before it gives up. */
const RESTORE_WINDOW_MS = 3_000
/** Anything the person does to scroll themselves ends a restore still waiting for content. */
const TAKEOVER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

let positions: Map<string, number> | undefined

function store(): Map<string, number> {
  if (positions) return positions
  positions = new Map()
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as [string, number][]
    for (const [slot, top] of saved) positions.set(slot, top)
  } catch {
    // A damaged entry only costs the remembered positions.
  }
  // Like the router's own restoration, positions survive a reload of the tab.
  window.addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...(positions ?? [])]))
    } catch {
      // Storage full or blocked: positions stay for this page's life only.
    }
  })
  return positions
}

function remember(map: Map<string, number>, slot: string, top: number) {
  map.delete(slot) // re-inserted last: the oldest entries are the first to go
  map.set(slot, top)
  if (map.size > MAX_ENTRIES) map.delete(map.keys().next().value as string)
}

/**
 * What React Router's <ScrollRestoration> does for the window, for a scroll
 * region inside a page: back and forward put the region where it was, any
 * other navigation (a link, a changed filter) starts it at the top, unless it
 * was made with `preventScrollReset` or goes to a #hash. Positions
 * are kept per history entry (`location.key`) and per region `id`, so a page
 * with two scrolling columns keeps both.
 *
 * When the list is not there yet (its data still loading), the position is
 * applied again as the content grows, until it fits, the person scrolls, or
 * a few seconds pass.
 */
export function useScrollMemory(ref: RefObject<HTMLElement | null>, id: string) {
  const { key, hash } = useLocation()
  // A move made with `preventScrollReset` (the wizard's own ?draft= updates while someone types)
  // keeps the position, as it does for the window. The router exposes it only through this context.
  // It changes with the location; a run for it alone puts back the position just remembered.
  const preventReset = useContext(UNSAFE_DataRouterStateContext)?.preventScrollReset ?? false

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const map = store()
    const slot = `${key}:${id}`
    const saved = map.get(slot)
    // Nothing remembered for this entry, and the move asked to stay, or the address has a #hash
    // whose target the page has scrolled into view (a child's layout effect, already run):
    // starting at the top would undo either.
    const stay = saved === undefined && (preventReset || hash !== '')
    const target = stay ? el.scrollTop : (saved ?? 0)
    if (stay) remember(map, slot, target)
    else el.scrollTop = target

    let stopWaiting = () => {}
    if (!stay && el.scrollTop < target - 1 && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        el.scrollTop = target
        if (el.scrollTop >= target - 1) stopWaiting()
      })
      const timer = window.setTimeout(() => stopWaiting(), RESTORE_WINDOW_MS)
      stopWaiting = () => {
        observer.disconnect()
        window.clearTimeout(timer)
        for (const type of TAKEOVER_EVENTS) el.removeEventListener(type, stopWaiting)
      }
      for (const child of el.children) observer.observe(child)
      for (const type of TAKEOVER_EVENTS) el.addEventListener(type, stopWaiting, { passive: true })
    }

    const onScroll = () => remember(map, slot, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      stopWaiting()
      el.removeEventListener('scroll', onScroll)
    }
  }, [ref, key, hash, preventReset, id])
}
