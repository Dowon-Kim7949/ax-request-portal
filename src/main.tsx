// i18n first: the language decides the mock seed and every text below.
import i18n, { currentLocale } from './i18n'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { configureClient, type ClientHooks } from './api/client'
import { createQueryClient } from './api/query-client'
import App from './App.tsx'
import { BootError } from './app/boot'
import { expireSession } from './app/session-sync'
import { startThemeSync } from './app/theme'
import { env } from './config/env'
import './index.css'
import { useSession } from './stores/session'

const BOOT_RELOAD_KEY = 'ax-request-portal:boot-reloaded'
const MOCK_START_TIMEOUT_MS = 8_000

/**
 * Registering the mock service worker can fail transiently: when a reload
 * interrupts the first registration, WebKit either rejects the script fetch
 * or never settles. Starting a second worker in the same page could answer
 * requests twice, so the recovery is one automatic reload — by then the
 * worker has finished installing in the background — and after that a retry
 * screen instead of a blank page.
 *
 * Resolves with the client hook that re-attaches the mock after its worker
 * restarts later on (an idle tab), see `reattachIfBypassed`.
 */
async function startMockOrRecover(): Promise<NonNullable<ClientHooks['recover']>> {
  const { startMockApi, reattachIfBypassed } = await import('./mocks/browser')
  try {
    await Promise.race([
      startMockApi(currentLocale()),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`mock API did not start within ${MOCK_START_TIMEOUT_MS} ms`)),
          MOCK_START_TIMEOUT_MS,
        ),
      ),
    ])
    sessionStorage.removeItem(BOOT_RELOAD_KEY)
    return reattachIfBypassed
  } catch (err) {
    if (!sessionStorage.getItem(BOOT_RELOAD_KEY)) {
      sessionStorage.setItem(BOOT_RELOAD_KEY, '1')
      window.location.reload()
      return new Promise<never>(() => {}) // keep the boot spinner until the reload happens
    }
    sessionStorage.removeItem(BOOT_RELOAD_KEY)
    throw err
  }
}

async function bootstrap() {
  const container = document.getElementById('root')
  if (!container) throw new Error('#root element is missing from index.html')
  const root = createRoot(container)
  startThemeSync()
  const queryClient = createQueryClient()

  const clientHooks: ClientHooks = {
    getToken: () => useSession.getState().token,
    // The server refused the token: drop the session and the cached data; the login screen keeps `next`.
    onUnauthorized: () => expireSession(queryClient),
    getLanguage: currentLocale,
    messages: {
      network: () => i18n.t('errors.network'),
      http: (status) => i18n.t('errors.http', { status }),
      contract: () => i18n.t('errors.contract'),
    },
  }
  configureClient(clientHooks)

  if (env.apiMock) {
    // Loaded only in mock mode, so a production build against a real backend ships no mock code paths.
    try {
      configureClient({ ...clientHooks, recover: await startMockOrRecover() })
    } catch (err) {
      console.error('[boot] mock API failed to start', err)
      root.render(<BootError detail={err instanceof Error ? err.message : String(err)} />)
      return
    }
  }

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
