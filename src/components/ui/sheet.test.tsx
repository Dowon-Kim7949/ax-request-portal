import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import '@/i18n'
import { Sheet } from './sheet'

function Opener({ onCloseAutoFocus }: { onCloseAutoFocus?: (event: Event) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        삭제
      </button>
      <button type="button">다른 곳</button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="이 초안을 삭제할까요?"
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            취소
          </button>
        }
        {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
      />
    </>
  )
}

describe('Sheet', () => {
  it('gives focus back to what opened it, however it is closed', async () => {
    render(<Opener />)
    const opener = screen.getByRole('button', { name: '삭제' })

    await userEvent.click(opener)
    await screen.findByRole('dialog', { name: '이 초안을 삭제할까요?' })
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(opener).toHaveFocus()

    await userEvent.click(opener)
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(opener).toHaveFocus()

    await userEvent.click(opener)
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(opener).toHaveFocus()
  })

  it('lets the screen move focus itself instead', async () => {
    render(
      <Opener
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          screen.getByRole('button', { name: '다른 곳' }).focus()
        }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: '다른 곳' })).toHaveFocus()
  })
})
