/**
 * The notch inset at the top of an iOS home-screen app is padded once: by the
 * demo banner when the build shows one, otherwise by the header. jsdom cannot
 * resolve env(), so this checks the classes that place them.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { AppShell } from './shell'

const build = vi.hoisted(() => ({ apiMock: true }))
vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/env')>()
  return {
    ...actual,
    env: {
      ...actual.env,
      get apiMock() {
        return build.apiMock
      },
    },
  }
})

const t = createTestApi()
beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  await signInAs('u-kim')
})
afterEach(() => {
  build.apiMock = true
})
afterAll(() => t.server.close())

function renderShell() {
  const router = createMemoryRouter(
    [{ path: '/', element: <AppShell />, children: [{ index: true, element: <h1>홈</h1> }] }],
    { initialEntries: ['/'] },
  )
  const view = render(
    <QueryClientProvider client={testQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...view, header: screen.getByRole('banner') }
}

describe('the top of the signed-in shell', () => {
  it('lets the demo banner take the notch inset, and pins the header below it', async () => {
    const { header, container } = renderShell()
    await screen.findByRole('heading', { name: '홈' })
    const banner = screen.getByRole('complementary', { name: '데모 모드' })
    expect(banner.className).toContain('env(safe-area-inset-top)')
    expect(header).not.toHaveClass('pt-safe')
    expect(header).toHaveClass('top-[env(safe-area-inset-top)]')
    // What scrolls under the status bar once the banner is gone is covered.
    expect(container.querySelector('[aria-hidden].fixed.top-0')).not.toBeNull()
  })

  it('lets the header take the inset without a banner', async () => {
    build.apiMock = false
    const { header, container } = renderShell()
    await screen.findByRole('heading', { name: '홈' })
    expect(screen.queryByRole('complementary', { name: '데모 모드' })).toBeNull()
    expect(header).toHaveClass('top-0', 'pt-safe')
    expect(container.querySelector('[aria-hidden].fixed.top-0')).toBeNull()
  })
})
