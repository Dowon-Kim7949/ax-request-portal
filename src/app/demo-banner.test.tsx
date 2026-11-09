import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { DemoBanner } from './demo-banner'

// env.apiMock is fixed at build time; the getter lets each test pick a mode.
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

afterEach(async () => {
  build.apiMock = true
  await i18n.changeLanguage('ko')
})

describe('DemoBanner', () => {
  it('marks every signed-in screen of a mock build with a labelled strip', () => {
    render(<DemoBanner />)
    const bar = screen.getByRole('complementary', { name: '데모 모드' })
    expect(bar).toHaveTextContent('데모 모드 · 데이터는 이 브라우저에만 저장돼요')
    // Nothing to close: it stays for as long as the build is a demo.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('sits inside the login layout as plain text, not as another landmark', () => {
    render(<DemoBanner variant="inline" />)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.getByText('데모 모드').closest('p')).toHaveTextContent(
      '데모 모드 · 데이터는 이 브라우저에만 저장돼요',
    )
  })

  it('follows the language', async () => {
    await i18n.changeLanguage('en')
    render(<DemoBanner />)
    expect(screen.getByRole('complementary', { name: 'Demo mode' })).toHaveTextContent(
      'Demo mode · Data stays in this browser only',
    )
  })

  it('renders nothing in a build against a real backend', () => {
    build.apiMock = false
    const { container } = render(
      <>
        <DemoBanner />
        <DemoBanner variant="inline" />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
