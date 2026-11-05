import { describe, expect, it } from 'vitest'
import { Attachment, Project, WorkPreview } from './model'
import { dataUrlType, FileUrl, ImageUrl, isSafeUrl, LinkUrl, opensInline, WebUrl, type UrlKind } from './url'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const SVG =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'
const PDF = 'data:application/pdf;base64,JVBERi0xLjQ='

describe('isSafeUrl', () => {
  it.each<[string, UrlKind[]]>([
    ['https://gitlab.example.com/acme/portal/-/merge_requests/57', ['web', 'link', 'file', 'image']],
    ['HTTP://preview.example.com/', ['web', 'link', 'file', 'image']],
    ['/api/attachments/att-1/file', ['link', 'file', 'image']],
    ['/', ['link', 'file', 'image']],
    [PNG, ['file', 'image']],
    [SVG, ['file', 'image']],
    [PDF, ['file']],
    ['blob:https://portal.example.com/2f6b1c3e-2a4d-4bde-9f1e-1a2b3c4d5e6f', ['file', 'image']],
  ])('accepts %s for %j', (url, kinds) => {
    for (const kind of ['web', 'link', 'file', 'image'] as const) {
      expect(isSafeUrl(url, kind), kind).toBe(kinds.includes(kind))
    }
  })

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:,hello',
    'data:image/png<script>,x',
    'data:application/xhtml+xml,<x/>',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'mailto:someone@example.com',
    '//evil.example/path',
    '/\\evil.example/path',
    '/\t/evil.example/path',
    '/ok path',
    'http://',
    'relative/path',
    'blob:',
    '',
  ])('refuses %j everywhere', (url) => {
    for (const kind of ['web', 'link', 'file', 'image'] as const)
      expect(isSafeUrl(url, kind), kind).toBe(false)
  })

  it('reads the media type of a data: URL', () => {
    expect(dataUrlType(PNG)).toBe('image/png')
    expect(dataUrlType('DATA:Image/PNG;base64,AA==')).toBe('image/png')
    expect(dataUrlType(SVG)).toBe('image/svg+xml')
    expect(dataUrlType('data:,hello')).toBeNull()
    expect(dataUrlType('https://example.com')).toBeNull()
  })

  it('opens only types a browser shows without running anything', () => {
    for (const type of ['image/png', 'image/JPEG', 'image/webp', 'application/pdf']) {
      expect(opensInline(type), type).toBe(true)
    }
    for (const type of ['image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/plain', '', null]) {
      expect(opensInline(type), String(type)).toBe(false)
    }
  })
})

describe('contract URL fields', () => {
  it('validates with the same rules', () => {
    expect(WebUrl.safeParse('https://github.com/acme/x').success).toBe(true)
    expect(WebUrl.safeParse('/relative').success).toBe(false)
    expect(LinkUrl.safeParse('/relative').success).toBe(true)
    expect(LinkUrl.safeParse(PNG).success).toBe(false)
    expect(FileUrl.safeParse(PDF).success).toBe(true)
    expect(ImageUrl.safeParse(PDF).success).toBe(false)
  })

  it('refuses script URLs in attachments, previews, merge requests and repositories', () => {
    const attachment = { id: 'att-1', name: 'a.png', size: 1, mimeType: 'image/png', url: PNG }
    expect(Attachment.safeParse(attachment).success).toBe(true)
    expect(Attachment.safeParse({ ...attachment, url: 'javascript:alert(1)' }).success).toBe(false)
    expect(Attachment.safeParse({ ...attachment, url: 'data:text/html,<b>x</b>' }).success).toBe(false)

    const shot = { id: 's1', url: SVG, alt: 'after' }
    expect(WorkPreview.safeParse({ url: 'https://preview.example.com/1', screenshots: [shot] }).success).toBe(
      true,
    )
    expect(WorkPreview.safeParse({ url: 'javascript:alert(1)', screenshots: [] }).success).toBe(false)
    expect(WorkPreview.safeParse({ screenshots: [{ ...shot, url: PDF }] }).success).toBe(false)

    const repo = Project.shape.repository
    expect(repo.safeParse({ provider: 'gitlab', url: 'https://gitlab.example.com/acme/x' }).success).toBe(
      true,
    )
    expect(repo.safeParse({ provider: 'gitlab', url: 'javascript:alert(1)//x' }).success).toBe(false)
  })
})
