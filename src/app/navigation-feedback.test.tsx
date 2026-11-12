import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useSlowNavigation } from './navigation-feedback'
import { NavigationProgress } from './navigation-progress'

function Layout() {
  const loading = useSlowNavigation()
  return (
    <>
      <NavigationProgress active={loading} />
      <main aria-busy={loading || undefined}>
        <Link to="/slow">slow</Link>
        <Outlet />
      </main>
    </>
  )
}

describe('navigation feedback', () => {
  it('shows a progress bar and marks the page busy while a page is slow to load', async () => {
    let finish!: () => void
    const loaded = new Promise<void>((resolve) => (finish = resolve))
    const router = createMemoryRouter([
      {
        path: '/',
        Component: Layout,
        children: [
          { index: true, element: <p>home</p> },
          {
            path: 'slow',
            lazy: async () => {
              await loaded
              return { Component: () => <p>slow page</p> }
            },
          },
        ],
      },
    ])
    render(<RouterProvider router={router} />)
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument()

    act(() => screen.getByRole('link', { name: 'slow' }).click())
    // Not at once: a quick navigation would only flash it.
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument()
    expect(await screen.findByTestId('navigation-progress')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')

    await act(async () => finish())
    expect(await screen.findByText('slow page')).toBeInTheDocument()
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy')
  })
})
