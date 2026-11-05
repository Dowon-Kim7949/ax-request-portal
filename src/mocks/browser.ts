import { setupWorker } from 'msw/browser'
import { appConfig } from '../config/app.config'
import { env } from '../config/env'
import type { User } from '../domain/model'
import type { ServerLanguage } from './copy'
import { createHandlers, MOCK_RESPONSE_HEADER } from './handlers'
import { DEMO_ACCOUNT_IDS } from './seed'
import { MOCK_STORAGE_FULL_EVENT } from './signals'
import { createMockStore, REVISION_KEY, type MockStore } from './store'

/** How long a re-attach waits for the worker to confirm before the request fails as it would have */
export const REATTACH_TIMEOUT_MS = 3_000

let store: MockStore | undefined
let registration: ServiceWorkerRegistration | undefined
let reattaching: Promise<boolean> | undefined

/** localStorage, or null where the browser blocks it (reading the property itself can throw). */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Starts the in-browser mock API. Only imported when VITE_API_MOCK is not "false". */
export async function startMockApi(language: ServerLanguage): Promise<MockStore> {
  const storage = browserStorage()
  store = createMockStore({
    reportSeconds: appConfig.mock.reportSeconds,
    workSeconds: appConfig.mock.workSeconds,
    rolePermissions: appConfig.rolePermissions,
    scopeCheck: appConfig.workflow.scopeCheck,
    storage,
    language,
    onSaveError: () => window.dispatchEvent(new Event(MOCK_STORAGE_FULL_EVENT)),
  })
  // Every tab keeps a copy of the demo data in memory; take up another tab's save right away
  // (requests also check before they change anything, see `sync`).
  window.addEventListener('storage', (event) => {
    if (event.storageArea === storage && event.key === REVISION_KEY) store?.sync()
  })
  const worker = setupWorker(...createHandlers(store))
  registration = await worker.start({
    serviceWorker: { url: `${env.base}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
  return store
}

/**
 * Browsers stop an idle service worker (Chrome after about 30 s), and MSW's
 * 5 s keep-alive cannot prevent it in a background tab, whose timers are
 * throttled. The restarted worker has forgotten which pages it mocks and sends
 * their requests to the network — on GitHub Pages, a 404 page.
 *
 * Given a response without the mock's mark, this sends the worker MSW's own
 * activation message again and resolves true once the worker confirms, so the
 * caller can repeat the request. The page keeps its client id and MSW keeps its
 * listeners, so nothing is registered twice (unlike starting a second worker).
 * `MOCK_ACTIVATE` / `MOCKING_ENABLED` belong to the worker script of the
 * installed MSW version; e2e/mock-api.spec.ts fails if an upgrade changes them.
 */
export function reattachIfBypassed(response: Response): Promise<boolean> {
  if (response.headers.has(MOCK_RESPONSE_HEADER)) return Promise.resolve(false)
  // Requests sent together come back bypassed together: one message is enough.
  reattaching ??= reattach().finally(() => {
    reattaching = undefined
  })
  return reattaching
}

function reattach(): Promise<boolean> {
  const container = navigator.serviceWorker
  const worker = registration?.active ?? container?.controller
  if (!container || !worker) return Promise.resolve(false)
  return new Promise((resolve) => {
    const finish = (enabled: boolean) => {
      clearTimeout(timer)
      container.removeEventListener('message', onMessage)
      resolve(enabled)
    }
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: unknown } | null)?.type
      if (event.source === worker && type === 'MOCKING_ENABLED') finish(true)
    }
    const timer = setTimeout(() => finish(false), REATTACH_TIMEOUT_MS)
    container.addEventListener('message', onMessage)
    worker.postMessage('MOCK_ACTIVATE')
  })
}

/** Rebuilds the demo data in `language` (the "reset demo data" action). */
export function resetMockData(language: ServerLanguage): void {
  store?.reset(language)
}

/**
 * Untouched demo data follows a language switch; once someone has changed
 * anything, the data is kept and the settings screen explains how to reset.
 * Returns true when the data was rebuilt.
 */
export function followLanguage(language: ServerLanguage): boolean {
  if (!store || store.engine.state.language === language || store.engine.state.dirty) return false
  store.reset(language)
  return true
}

/** The demo accounts as they exist in the current data (names follow its language). */
export function demoAccounts(): User[] {
  const users = store?.engine.state.users ?? []
  return DEMO_ACCOUNT_IDS.map((id) => users.find((u) => u.id === id)).filter((u): u is User => Boolean(u))
}

export function demoDataLanguage(): ServerLanguage | undefined {
  return store?.engine.state.language
}
