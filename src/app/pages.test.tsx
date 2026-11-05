import { render, screen } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import '@/i18n'
import { RouteErrorPage, RouteErrorView } from './pages'

const CHUNK_URL = 'https://portal.example.com/assets/schedule-page-3f2a1c.js'

let consoleError: MockInstance<typeof console.error>
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleError.mockRestore()
})

function view(error: unknown, showDetail = false) {
  return render(
    <MemoryRouter>
      <RouteErrorView error={error} showDetail={showDetail} />
    </MemoryRouter>,
  )
}

describe('RouteErrorPage', () => {
  it('explains a page whose code was replaced by a deployment, and offers only a reload', () => {
    view(new TypeError(`Failed to fetch dynamically imported module: ${CHUNK_URL}`))
    expect(screen.getByRole('alert')).toHaveTextContent('새 버전이 배포됐어요')
    expect(screen.getByText('새 버전이 배포되어 화면을 다시 불러와야 해요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '처음으로' })).toBeNull()
    expect(document.body).not.toHaveTextContent(CHUNK_URL)
  })

  it('shows any other failure without its raw message, with a way home and a reload', () => {
    view(new Error('Cannot read properties of undefined (reading "projectId") at /assets/x.js'))
    expect(screen.getByRole('alert')).toHaveTextContent('문제가 생겼습니다')
    expect(screen.getByRole('link', { name: '처음으로' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('projectId')
    expect(screen.queryByText('개발자용 상세 정보')).toBeNull()
  })

  it('keeps the details for the console, and for the page only in development', () => {
    const error = new Error('reading "projectId"')
    view(error, true)
    expect(screen.getByText('개발자용 상세 정보')).toBeInTheDocument()
    expect(document.body).toHaveTextContent('reading "projectId"')
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[route]'), error)
  })

  it('is what the router shows when a page fails to load', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        errorElement: <RouteErrorPage />,
        lazy: () => Promise.reject(new TypeError('Importing a module script failed.')),
      },
    ])
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('새 버전이 배포됐어요')).toBeInTheDocument()
  })
})
