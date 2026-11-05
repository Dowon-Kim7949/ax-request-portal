/**
 * Turns a `data:` URL into a Blob. Browsers refuse to open a data: URL in a
 * tab (Chromium blocks every top-level navigation to one), so a file kept as
 * a data: URL is opened through a blob: URL made from it instead.
 * Returns null when the URL is not a data: URL or cannot be decoded.
 */
export function dataUrlToBlob(url: string): Blob | null {
  const comma = url.indexOf(',')
  if (!/^data:/i.test(url) || comma < 0) return null
  const meta = url.slice(5, comma).split(';')
  const first = meta[0] ?? ''
  const type = first.includes('/') ? first.toLowerCase() : ''
  const payload = url.slice(comma + 1)
  try {
    if (meta.slice(1).some((m) => m.toLowerCase() === 'base64')) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type })
    }
    return new Blob([decodeURIComponent(payload)], { type })
  } catch {
    return null
  }
}
