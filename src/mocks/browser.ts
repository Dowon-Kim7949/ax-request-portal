import { setupWorker } from 'msw/browser'
import { appConfig } from '../config/app.config'
import { env } from '../config/env'
import { createHandlers } from './handlers'
import { createMockStore, type MockStore } from './store'

let store: MockStore | undefined

/** Starts the in-browser mock API. Only imported when VITE_API_MOCK is not "false". */
export async function startMockApi(): Promise<MockStore> {
  store = createMockStore({
    reportSeconds: appConfig.mock.reportSeconds,
    workSeconds: appConfig.mock.workSeconds,
    rolePermissions: appConfig.rolePermissions,
    storage: typeof localStorage === 'undefined' ? null : localStorage,
  })
  const worker = setupWorker(...createHandlers(store))
  await worker.start({
    serviceWorker: { url: `${env.base}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
  return store
}

/** Rebuilds the demo data (used by the "reset demo" action). */
export function resetMockData(): void {
  store?.reset()
}
