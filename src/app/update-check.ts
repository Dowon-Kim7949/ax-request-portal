/**
 * Tells an open tab that a newer build has been deployed.
 *
 * A static deployment replaces every file, but a tab keeps running the code it
 * loaded, and its lazy page chunks (hashed file names) disappear. The build
 * writes its id into the bundle and into `version.json` (vite.config.ts); the
 * tab compares the two when someone comes back to it, every few minutes, and
 * right away when a page's code fails to load.
 */
import { timeoutSignal } from '@/lib/abort'

/** The build this tab is running */
export const BUILD_ID = __BUILD_ID__

export const CHECK_INTERVAL_MS = 5 * 60_000
/** A check that hangs (captive portal, stalled connection) would hold back every later one. */
export const FETCH_TIMEOUT_MS = 10_000

/** The id of the deployed build, or null when it cannot be read in time (offline, dev server). */
export async function fetchDeployedBuildId(base = import.meta.env.BASE_URL): Promise<string | null> {
  const deadline = timeoutSignal(FETCH_TIMEOUT_MS)
  try {
    // A unique query gets past CDN caches (GitHub Pages keeps files for 10 minutes).
    const res = await fetch(`${base}version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: deadline.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { buildId?: unknown }
    return typeof data.buildId === 'string' ? data.buildId : null
  } catch {
    return null
  } finally {
    deadline.clear()
  }
}

/**
 * A check that calls `onUpdate` once per newer build: dismissing the notice
 * keeps it away until yet another build is deployed. Concurrent calls share one
 * request.
 */
export function createUpdateCheck(
  current: string,
  onUpdate: (deployed: string) => void,
  fetchDeployed: () => Promise<string | null> = () => fetchDeployedBuildId(),
): () => Promise<void> {
  let announced: string | undefined
  let pending: Promise<void> | undefined
  const run = async () => {
    const deployed = await fetchDeployed()
    if (!deployed || deployed === current || deployed === announced) return
    announced = deployed
    onUpdate(deployed)
  }
  return () => {
    pending ??= run().finally(() => {
      pending = undefined
    })
    return pending
  }
}

let checkNow: (() => Promise<void>) | undefined

/**
 * Starts checking in production builds; returns the cleanup. The dev server
 * has no version.json and reloads by itself.
 */
export function watchForUpdates(onUpdate: (deployed: string) => void): () => void {
  if (import.meta.env.DEV) return () => {}
  const check = createUpdateCheck(BUILD_ID, onUpdate)
  checkNow = check
  const whenVisible = () => {
    if (document.visibilityState === 'visible') void check()
  }
  const onPreloadError = () => void check()
  document.addEventListener('visibilitychange', whenVisible)
  window.addEventListener('vite:preloadError', onPreloadError)
  const timer = window.setInterval(whenVisible, CHECK_INTERVAL_MS)
  return () => {
    document.removeEventListener('visibilitychange', whenVisible)
    window.removeEventListener('vite:preloadError', onPreloadError)
    window.clearInterval(timer)
    if (checkNow === check) checkNow = undefined
  }
}

/**
 * A page's code could not be loaded — after a deployment, the tab's hashed
 * chunk files are gone. Each browser words a failed dynamic import differently
 * (Chrome, Firefox, Safari), and Vite reports a failed CSS preload itself.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'ChunkLoadError' ||
    /dynamically imported module|importing a module script failed|unable to preload css/i.test(error.message)
  )
}

/** Called when a page's code fails to load: the usual cause is a deployment. */
export function checkForUpdateNow(): void {
  void checkNow?.()
}
