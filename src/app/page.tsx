import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { FIT_QUERY, useMediaQuery } from '@/lib/use-media-query'
import { useScrollMemory } from './scroll-memory'

/*
 * Page layout parts, for a route whose handle says `fit` (src/app/router.tsx).
 *
 *   <Page>
 *     <PageTop>header, filters</PageTop>
 *     <PageScroll label="…">the list</PageScroll>
 *   </Page>
 *
 * On a big screen (the `fit:` variant: at least 1280 × 720) the page fills the
 * window under the shell header: the top stays put and only the list scrolls,
 * in a region as wide as the content column, so the wheel works over the side
 * margins too and the scrollbar sits at the window's edge. Anywhere else the
 * parts are plain blocks and the window scrolls, as on every other page.
 */

/** The page itself: a column that fills the space under the shell header on a big screen. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div data-page className="fit:flex fit:min-h-0 fit:flex-1 fit:flex-col">
      {children}
    </div>
  )
}

/** What stays in place above the list: the page header, filters, notices about the whole page. */
export function PageTop({ children }: { children: ReactNode }) {
  return (
    <div data-page-top className="pt-4 md:pt-6 fit:shrink-0">
      <div className="page-band">{children}</div>
    </div>
  )
}

/**
 * The part that scrolls on a big screen. There it is a named region a
 * keyboard can focus and scroll, since not every browser lets a keyboard
 * reach a scroll area that has no link or button of its own. Back and forward
 * bring it back to where it was (`useScrollMemory`).
 */
export function PageScroll({
  label,
  id = 'main',
  className,
  children,
}: {
  /** The region's accessible name, e.g. "배정된 요청 목록" */
  label: string
  /** Tells two scrolling parts of one page apart, for their remembered positions */
  id?: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fit = useMediaQuery(FIT_QUERY)
  useScrollMemory(ref, id)

  // `data-scrolled` draws a line under the page's top once the list has moved beneath it.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mark = () => el.toggleAttribute('data-scrolled', el.scrollTop > 0)
    mark()
    el.addEventListener('scroll', mark, { passive: true })
    return () => el.removeEventListener('scroll', mark)
  }, [])

  return (
    <div
      ref={ref}
      data-scroll-region={id}
      role={fit ? 'region' : undefined}
      aria-label={fit ? label : undefined}
      tabIndex={fit ? 0 : undefined}
      // relative: visually hidden text (sr-only, absolutely placed) is laid out inside the region;
      // otherwise it sits below the window and gives the page a scrollbar after all.
      className="relative fit:min-h-0 fit:flex-1 fit:[scrollbar-gutter:stable_both-edges] fit:overflow-y-auto fit:focus-visible:-outline-offset-2"
    >
      {/* pt-1 in a region: room for a focus ring on the first row, which the region would clip. */}
      <div
        className={cn('page-column pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12 fit:pt-1', className)}
      >
        {children}
      </div>
    </div>
  )
}

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Shows a back link (always on phones, where there is no sidebar) */
  back?: { to: string; label?: string }
  /** A status chip about the whole page ("estimate"), shown beside the title */
  badge?: ReactNode
  /** Buttons for the page; they sit at the right, or wrap below on a phone */
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  back,
  badge,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className={cn('mb-5 flex flex-col gap-3 sm:mb-6', className)}>
      {back ? (
        <Link
          to={back.to}
          className="-ml-2 inline-flex h-10 w-fit items-center gap-0.5 rounded-lg pr-3 pl-1 text-sm font-semibold text-ink-500 hover:bg-surface hover:text-ink-900"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {back.label ?? t('common.back')}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow ? <div className="text-sm font-semibold text-accent">{eyebrow}</div> : null}
          {badge ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-2xl leading-tight font-bold tracking-tight text-ink-900 sm:text-[28px]">
                {title}
              </h1>
              {badge}
            </div>
          ) : (
            <h1 className="text-2xl leading-tight font-bold tracking-tight text-ink-900 sm:text-[28px]">
              {title}
            </h1>
          )}
          {description ? <p className="text-[15px] text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
