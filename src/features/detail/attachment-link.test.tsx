import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { Attachment } from '@/domain/model'
import { AttachmentLink } from './attachment-link'

const PNG = `data:image/png;base64,${btoa('\x89PNG\r\n')}`
const SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')}`

const attachment = (patch: Partial<Attachment>): Attachment => ({
  id: 'att-1',
  name: 'screen.png',
  size: 2048,
  mimeType: 'image/png',
  url: PNG,
  ...patch,
})

describe('AttachmentLink', () => {
  const created: Blob[] = []
  const downloads: string[] = []
  beforeAll(() => {
    // jsdom has no object URLs and does not navigate; record what would be opened instead.
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob)
      return `blob:http://localhost/${created.length}`
    })
    URL.revokeObjectURL = vi.fn()
  })
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download}@${this.href}`)
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    created.length = 0
    downloads.length = 0
  })

  it('opens an inlined image through a blob: URL in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    render(<AttachmentLink attachment={attachment({})} />)
    const link = screen.getByRole('link', { name: /screen\.png.*새 탭에서 열림/ })
    // Without script help a data: URL can still be saved.
    expect(link).toHaveAttribute('download', 'screen.png')

    const click = fireEvent.click(link)
    expect(click).toBe(false) // default prevented
    expect(open).toHaveBeenCalledWith('blob:http://localhost/1', '_blank')
    expect(created[0]?.type).toBe('image/png')
    expect(downloads).toEqual([])
  })

  it('downloads when the browser blocks the new tab', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(<AttachmentLink attachment={attachment({})} />)
    fireEvent.click(screen.getByRole('link'))
    expect(downloads).toEqual(['screen.png@blob:http://localhost/1'])
  })

  it('downloads an inlined SVG as plain bytes instead of opening it as a page', () => {
    const open = vi.spyOn(window, 'open')
    render(
      <AttachmentLink attachment={attachment({ name: 'logo.svg', mimeType: 'image/svg+xml', url: SVG })} />,
    )
    fireEvent.click(screen.getByRole('link', { name: /logo\.svg.*내려받기/ }))
    expect(open).not.toHaveBeenCalled()
    expect(created[0]?.type).toBe('application/octet-stream')
    expect(downloads).toEqual(['logo.svg@blob:http://localhost/1'])
  })

  it('links files the browser or a server keeps directly', () => {
    const { unmount } = render(
      <AttachmentLink
        attachment={attachment({
          name: 'spec.pdf',
          mimeType: 'application/pdf',
          url: 'blob:http://localhost/a',
        })}
      />,
    )
    const pdf = screen.getByRole('link', { name: /spec\.pdf.*새 탭에서 열림/ })
    expect(pdf).toHaveAttribute('href', 'blob:http://localhost/a')
    expect(pdf).toHaveAttribute('target', '_blank')
    expect(pdf).not.toHaveAttribute('download')
    unmount()

    render(
      <AttachmentLink
        attachment={attachment({
          name: 'notes.txt',
          mimeType: 'text/plain',
          url: 'https://files.example.com/n',
        })}
      />,
    )
    expect(screen.getByRole('link', { name: /notes\.txt/ })).toHaveAttribute('download', 'notes.txt')
    expect(created).toEqual([])
  })

  it('shows an unsafe URL as text, not a link', () => {
    render(<AttachmentLink attachment={attachment({ name: 'evil.png', url: 'javascript:alert(1)' })} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('evil.png')).toBeInTheDocument()
    expect(screen.getByText('열 수 없는 주소')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})
