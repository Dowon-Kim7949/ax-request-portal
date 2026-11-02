import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { configureClient } from './api/client'
import { createQueryClient } from './api/query-client'
import App from './App.tsx'
import { env } from './config/env'
import './index.css'
import { useSession } from './stores/session'

async function bootstrap() {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root element is missing from index.html')

  configureClient({
    getToken: () => useSession.getState().token,
    onUnauthorized: () => useSession.getState().clear(),
  })

  if (env.apiMock) {
    // Loaded only in mock mode, so a production build against a real backend ships no mock code paths.
    const { startMockApi } = await import('./mocks/browser')
    await startMockApi()
  }

  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={createQueryClient()}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
