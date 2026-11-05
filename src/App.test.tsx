import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { createQueryClient } from './api/query-client'
import App from './App'

describe('App', () => {
  // The login screen imports the mock API modules on mount to list the demo
  // accounts. Load them first, or that import can outlive the test environment.
  // The screen itself is a lazy route: loading it here keeps a cold, busy run
  // from spending the query's wait on the import.
  beforeAll(async () => {
    await Promise.all([
      import('./mocks/browser'),
      import('./mocks/seed'),
      import('./features/auth/login-page'),
    ])
  })

  it('sends signed-out visitors to the login screen', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <App />
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'AX 업무 요청' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })
})
