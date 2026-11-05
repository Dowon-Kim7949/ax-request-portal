/**
 * Which URLs the API may hand to the browser. Every URL in a response ends up
 * in an `href` or a `src`, so a `javascript:` URL — or a `data:text/html` one
 * opened in a tab — would run inside the portal's origin. The contract
 * validates every URL field with these rules, and the screens check again
 * before they render a link.
 *
 * Pure TypeScript: a backend should apply the same rules when it stores a URL.
 */
import * as z from 'zod'

/**
 * - `web`: an absolute http(s) URL (repositories).
 * - `link`: something to open — `web`, or a path on this site starting with `/`.
 * - `file`: an uploaded file — `link`, `data:` with an image or PDF type, or `blob:`
 *   (files the browser keeps, as the demo does).
 * - `image`: an image to show — `link`, `data:image/…` or `blob:`.
 */
export type UrlKind = 'web' | 'link' | 'file' | 'image'

const SCHEME = /^([a-z][a-z\d+.-]*):/i
const DATA_TYPE = /^data:([a-z]+\/[a-z\d.+-]+)?[;,]/i

/**
 * Whitespace, control characters and backslashes: browsers drop or reinterpret
 * them (`/\evil.example` and `/<tab>/evil.example` both lead off the site), so a
 * URL that contains one may go somewhere other than it appears to.
 */
function hasAmbiguousChars(url: string): boolean {
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i)
    if (c <= 0x20 || c === 0x7f || c === 0x5c) return true
  }
  return false
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== ''
  } catch {
    return false
  }
}

/** Media type of a `data:` URL in lower case; null when it is not one or names no type. */
export function dataUrlType(url: string): string | null {
  return DATA_TYPE.exec(url)?.[1]?.toLowerCase() ?? null
}

export function isSafeUrl(url: string, kind: UrlKind = 'link'): boolean {
  if (typeof url !== 'string' || url === '') return false
  // A path on this site; `//host` and `/\host` would leave it.
  if (url.startsWith('/')) return kind !== 'web' && !hasAmbiguousChars(url) && url[1] !== '/'
  const scheme = SCHEME.exec(url)?.[1]?.toLowerCase()
  switch (scheme) {
    case 'http':
    case 'https':
      return !hasAmbiguousChars(url) && isHttpUrl(url)
    case 'blob':
      return (kind === 'file' || kind === 'image') && url.length > 'blob:'.length && !hasAmbiguousChars(url)
    case 'data': {
      if (kind !== 'file' && kind !== 'image') return false
      const type = dataUrlType(url)
      if (!type) return false
      return type.startsWith('image/') || (kind === 'file' && type === 'application/pdf')
    }
    default:
      return false
  }
}

/**
 * File types a browser shows by itself without running anything from the file.
 * Everything else (SVG and HTML included) is downloaded instead of opened, so a
 * file someone uploaded never runs as a page of the portal.
 */
const INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'application/pdf',
])

export function opensInline(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && INLINE_TYPES.has(mimeType.toLowerCase()))
}

/* ------------------------------------------------------------------ */
/* Contract schemas                                                    */
/* ------------------------------------------------------------------ */

/** The refinement does not show in the OpenAPI document; `format` and the field descriptions do. */
const safeUrl = (kind: UrlKind, message: string) =>
  z
    .string()
    .refine((u) => isSafeUrl(u, kind), { message })
    .meta({ format: kind === 'web' ? 'uri' : 'uri-reference' })

/** Absolute http(s) URL. */
export const WebUrl = safeUrl('web', 'Must be an absolute http(s) URL')

/** http(s) URL or a path on this site starting with "/". */
export const LinkUrl = safeUrl('link', 'Must be an http(s) URL or a path on this site')

/** A link URL, or data: (image/* or application/pdf) or blob: for files the browser keeps. */
export const FileUrl = safeUrl(
  'file',
  'Must be an http(s) URL, a path on this site, data: (image or PDF) or blob:',
)

/** A link URL, data:image/* or blob:. */
export const ImageUrl = safeUrl('image', 'Must be an http(s) URL, a path on this site, data:image/* or blob:')
