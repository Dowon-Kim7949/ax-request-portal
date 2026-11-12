import { matchRoutes, type RouteObject } from 'react-router'

/**
 * Loads a page's code before it is opened, so the first visit does not wait
 * for it (and the navigation progress bar has nothing to show). The router
 * registers its routes here; each `page()` route keeps its loader in
 * `handle.preload`. Without registered routes (unit tests) nothing happens.
 */
let preloadRoutes: RouteObject[] = []

export function setPreloadRoutes(routes: RouteObject[]) {
  preloadRoutes = routes
}

export function preloadPage(path: string) {
  for (const match of matchRoutes(preloadRoutes, path) ?? []) {
    const preload = (match.route.handle as { preload?: () => Promise<unknown> } | undefined)?.preload
    // A failed preload is harmless: the navigation loads the page again and handles the failure.
    preload?.().catch(() => {})
  }
}

/** Whether the viewer asked to save data (Chrome's Data Saver, Android's Lite mode). */
function savesData() {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
}

/**
 * Preloads the given pages once the browser is idle after the first screen,
 * unless the viewer saves data. Returns a cancel function.
 */
export function preloadWhenIdle(paths: readonly string[]): () => void {
  if (savesData() || !paths.length) return () => {}
  const run = () => paths.forEach(preloadPage)
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 5000 })
    return () => window.cancelIdleCallback(id)
  }
  // Safari has no requestIdleCallback: wait until the first screen has had its turn.
  const id = window.setTimeout(run, 2000)
  return () => window.clearTimeout(id)
}
