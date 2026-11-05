import { describe, expect, it } from 'vitest'
import { dataUrlToBlob } from './data-url'

describe('dataUrlToBlob', () => {
  it('decodes base64 data with its type', async () => {
    const blob = dataUrlToBlob(`data:image/png;base64,${btoa('\x89PNG\r\n')}`)
    expect(blob?.type).toBe('image/png')
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    )
  })

  it('decodes percent-encoded text', async () => {
    const blob = dataUrlToBlob(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg>한</svg>')}`)
    expect(blob?.type).toBe('image/svg+xml')
    expect(await blob!.text()).toBe('<svg>한</svg>')
  })

  it('returns null for anything else', () => {
    expect(dataUrlToBlob('https://example.com/a.png')).toBeNull()
    expect(dataUrlToBlob('data:image/png;base64')).toBeNull()
    expect(dataUrlToBlob('data:image/png;base64,%%%')).toBeNull()
  })
})
