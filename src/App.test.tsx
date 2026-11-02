import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from './api/query-client'
import App from './App'

describe('App', () => {
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
