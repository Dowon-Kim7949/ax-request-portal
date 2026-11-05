import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { env } from '@/config/env'

/**
 * Says that this build runs on the in-browser mock API: what people enter is
 * kept in their own browser and never reaches a server. It cannot be
 * dismissed, and a build against a real backend (VITE_API_MOCK=false) never
 * renders it.
 *
 * - `bar`: a slim strip at the top of the signed-in shell. It sits above the
 *   sticky header and scrolls away with the page, so the header (and the
 *   wizard's step bar pinned under it) keep their height. It takes the notch
 *   inset at the top of the screen instead of the header (see AppShell). It
 *   is its own landmark because it sits outside `header` and `main`.
 * - `inline`: a small note inside a page's own layout (the login screen).
 */
export function DemoBanner({ variant = 'bar' }: { variant?: 'bar' | 'inline' }) {
  const { t } = useTranslation()
  if (!env.apiMock) return null

  const label = t('demoBanner.label')
  const text = (
    <>
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-bold">{label}</strong> · {t('demoBanner.detail')}
      </span>
    </>
  )

  if (variant === 'inline') {
    return (
      <p className="flex items-center gap-1.5 self-start rounded-lg bg-warning-50 px-2.5 py-1 text-xs leading-5 font-medium text-warning-fg ring-1 ring-warning-600/25">
        {text}
      </p>
    )
  }

  return (
    <aside
      aria-label={label}
      className="flex items-center justify-center gap-1.5 border-b border-warning-600/20 bg-warning-50 pt-[calc(0.25rem+env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-1 pl-[max(1rem,env(safe-area-inset-left))] text-center text-xs leading-5 font-medium text-warning-fg"
    >
      {text}
    </aside>
  )
}
