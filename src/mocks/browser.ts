import { setupWorker } from 'msw/browser'
import { appConfig } from '../config/app.config'
import { env } from '../config/env'
import type { User } from '../domain/model'
import type { ServerLanguage } from './copy'
import { createHandlers } from './handlers'
import { DEMO_ACCOUNT_IDS } from './seed'
import { createMockStore, type MockStore } from './store'

let store: MockStore | undefined

/** Starts the in-browser mock API. Only imported when VITE_API_MOCK is not "false". */
export async function startMockApi(language: ServerLanguage): Promise<MockStore> {
  store = createMockStore({
    reportSeconds: appConfig.mock.reportSeconds,
    workSeconds: appConfig.mock.workSeconds,
    rolePermissions: appConfig.rolePermissions,
    storage: typeof localStorage === 'undefined' ? null : localStorage,
    language,
  })
  const worker = setupWorker(...createHandlers(store))
  await worker.start({
    serviceWorker: { url: `${env.base}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
  return store
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
