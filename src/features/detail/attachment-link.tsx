/** One attachment of a request: images and PDFs open in a new tab, other files download. */
import { FileText } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Attachment } from '@/domain/model'
import { dataUrlType, isSafeUrl, opensInline } from '@/domain/url'
import { dataUrlToBlob } from '@/lib/data-url'
import { formatBytes } from '@/lib/format'

const DATA_URL = /^data:/i
/** Long enough for the new tab to load the file; the URL is not needed after that. */
const OBJECT_URL_LIFETIME_MS = 60_000

function download(href: string, name: string): void {
  const link = document.createElement('a')
  link.href = href
  link.download = name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
}

/**
 * Browsers refuse to open a data: URL in a tab (Chromium blocks every
 * top-level navigation to one), so a file kept as a data: URL is opened through
 * a blob: URL made from it on click. A type the browser would not show by
 * itself (SVG, HTML…) becomes plain bytes and is downloaded, never run as a
 * page of the portal. Returns false when the browser cannot do this, and the
 * link's own download attribute takes over.
 */
function openDataUrl(dataUrl: string, name: string): boolean {
  const blob = typeof URL.createObjectURL === 'function' ? dataUrlToBlob(dataUrl) : null
  if (!blob) return false
  const inline = opensInline(blob.type)
  const href = URL.createObjectURL(inline ? blob : new Blob([blob], { type: 'application/octet-stream' }))
  // A blocked pop-up falls back to a download.
  if (!inline || !window.open(href, '_blank')) download(href, name)
  setTimeout(() => URL.revokeObjectURL(href), OBJECT_URL_LIFETIME_MS)
  return true
}

export function AttachmentLink({ attachment: a }: { attachment: Attachment }) {
  const { t } = useTranslation()
  const safe = isSafeUrl(a.url, 'file')
  const isData = safe && DATA_URL.test(a.url)
  const inline = opensInline(isData ? dataUrlType(a.url) : a.mimeType)
  const thumbnail = a.mimeType.startsWith('image/') && isSafeUrl(a.url, 'image')

  const content = (
    <>
      {thumbnail ? (
        <img src={a.url} alt="" className="size-8 rounded object-cover" />
      ) : (
        <FileText className="size-4 text-ink-400" aria-hidden />
      )}
      <span className="max-w-40 truncate">{a.name}</span>
      <span className="text-xs text-ink-400">{formatBytes(a.size)}</span>
    </>
  )

  if (!safe) {
    // Defence in depth: the contract already refuses such a URL.
    return (
      <span className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-ink-600 ring-1 ring-line">
        {content}
        <span className="text-xs text-ink-500">{t('detail.attachment.blocked')}</span>
      </span>
    )
  }

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Plain clicks only; a modified or middle click keeps the browser's own behaviour (download).
    if (!isData || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (openDataUrl(a.url, a.name)) e.preventDefault()
  }

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      // A data: URL can only be downloaded as it is; same-origin files download under their
      // own name; a server's own URL decides for itself.
      download={isData || !inline ? a.name : undefined}
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm ring-1 ring-line hover:ring-brand-500"
    >
      {content}
      <span className="sr-only">
        {' '}
        ({t(inline ? 'detail.attachment.newTab' : 'detail.attachment.download')})
      </span>
    </a>
  )
}
