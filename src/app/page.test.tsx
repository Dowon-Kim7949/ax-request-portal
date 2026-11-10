import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import '@/i18n'
import { PageHeader } from './page'

describe('the page header', () => {
  it('puts a status chip beside the title, outside the heading', () => {
    render(
      <MemoryRouter>
        <PageHeader title="AI 사용량" description="이번 달 사용량" badge={<span>추정</span>} />
      </MemoryRouter>,
    )
    const heading = screen.getByRole('heading', { level: 1, name: 'AI 사용량' })
    // Same row as the title, centred on it — not after the description.
    expect(heading.parentElement).toContainElement(screen.getByText('추정'))
    expect(heading.parentElement).toHaveClass('items-center')
    expect(screen.getByText('이번 달 사용량').parentElement).not.toBe(heading.parentElement)
  })
})
