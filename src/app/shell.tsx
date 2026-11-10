import { useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  Ellipsis,
  LogOut,
  RotateCcw,
  Settings,
} from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, ScrollRestoration, useMatches } from 'react-router'
import { toast } from 'sonner'
import { useNotifications } from '@/api/queries'
import { Sheet } from '@/components/ui/sheet'
import { env } from '@/config/env'
import { useDraftSync } from '@/features/drafts/hooks'
import { currentLocale } from '@/i18n'
import { cn } from '@/lib/cn'
import { useBrand } from './brand'
import { resetDemoData } from './demo'
import { DemoBanner } from './demo-banner'
import { useCan, useCurrentUser } from './hooks'
import { phoneTabs, visibleNav, type NavItem } from './nav'
import type { RouteHandle } from './router'
import { useSignOut } from './sign-out'

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

/**
 * Text drawn by CSS (initials, a counter) inside a control whose name already
 * says it. As DOM text it would be part of the control's visible label, and a
 * visible label must be contained in the accessible name (WCAG 2.5.3): "AX",
 * "11" or "김" are not words of "AX 업무 요청", "알림 (11)" or "내 계정 김기획".
 */
function Glyph({ text, className }: { text: string; className?: string }) {
  return <span aria-hidden data-glyph={text} className={cn('before:content-[attr(data-glyph)]', className)} />
}

function BrandMark({ compact }: { compact?: boolean }) {
  const brand = useBrand()
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label={brand.name}>
      <Glyph
        text={brand.shortName}
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-inverse text-[13px] font-black tracking-tight text-on-inverse"
      />
      {compact ? null : <span className="text-[15px] font-bold text-ink-900">{brand.name}</span>}
    </Link>
  )
}

function useUnreadCount(): number {
  const { data } = useNotifications()
  return data?.filter((n) => !n.readAt).length ?? 0
}

function NotificationBell() {
  const { t } = useTranslation()
  const unread = useUnreadCount()
  return (
    <Link
      to="/notifications"
      className="relative grid size-11 place-items-center rounded-full text-ink-600 hover:bg-muted"
      aria-label={unread ? `${t('nav.notifications')} (${unread})` : t('nav.notifications')}
    >
      <Bell className="size-5.5" aria-hidden />
      {unread ? (
        <Glyph
          text={unread > 99 ? '99+' : String(unread)}
          className="absolute top-1.5 right-1.5 grid min-w-4.5 place-items-center rounded-full bg-danger-600 px-1 text-[10px] leading-4.5 font-bold text-white"
        />
      ) : null}
    </Link>
  )
}

function useAccountActions() {
  const signOut = useSignOut()
  const qc = useQueryClient()
  const { t } = useTranslation()
  return {
    logout: signOut.signOut,
    /** Asks before signing out deletes drafts that never reached the account; render it once per caller */
    signOutDialog: signOut.dialog,
    resetDemo: env.apiMock
      ? async () => {
          await resetDemoData(currentLocale())
          await qc.invalidateQueries()
          toast.success(t('nav.resetDemoDone'))
        }
      : undefined,
  }
}

/**
 * Account disclosure (button + panel), not an ARIA menu: three plain links and
 * buttons don't need roving focus, and dropping the menu primitive removes
 * ~40 KB (floating-ui, collection, menu) from the first load.
 */
function AccountMenu() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const actions = useAccountActions()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item =
    'flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-ink-700 hover:bg-muted focus-visible:bg-muted'
  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-full pr-3 pl-1.5 text-sm font-semibold text-ink-700 hover:bg-muted"
      >
        <Glyph
          text={user.name.slice(0, 1)}
          className="grid size-8 place-items-center rounded-full bg-brand-100 text-[13px] font-bold text-accent-strong"
        />
        {/* Named "내 계정", plus the user's name where it shows (the words a voice user would say). */}
        <span className="sr-only">{t('nav.account')}</span>{' '}
        <span className="hidden lg:inline">{user.name}</span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute top-full right-0 z-50 mt-1.5 w-60 animate-fade-in rounded-2xl bg-surface p-1.5 shadow-xl ring-1 ring-line"
        >
          <div className="px-3 py-2.5">
            <p className="font-bold text-ink-900">{user.name}</p>
            <p className="text-xs text-ink-500">
              {t(`role.${user.role}`)} · {user.email}
            </p>
          </div>
          <div className="my-1 h-px bg-line" aria-hidden />
          <Link to="/settings" className={item} onClick={close}>
            <Settings className="size-4" aria-hidden />
            {t('nav.settings')}
          </Link>
          {actions.resetDemo ? (
            <button
              type="button"
              className={item}
              onClick={() => {
                close()
                void actions.resetDemo?.()
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              {t('nav.resetDemo')}
            </button>
          ) : null}
          <button
            type="button"
            className={item}
            onClick={() => {
              // The panel goes: a sign-out the person is asked about gives focus back to the account button.
              triggerRef.current?.focus()
              close()
              actions.logout()
            }}
          >
            <LogOut className="size-4" aria-hidden />
            {t('nav.logout')}
          </button>
        </div>
      ) : null}
      {actions.signOutDialog}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar (tablet rail / desktop)                                     */
/* ------------------------------------------------------------------ */

function SideLink({
  item,
  expanded,
  onNavigate,
}: {
  item: NavItem
  expanded: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const label = t(`nav.${item.key}`)
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={expanded ? undefined : label}
      aria-label={expanded ? undefined : label}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors',
          isActive ? 'bg-brand-50 text-accent-strong' : 'text-ink-600 hover:bg-muted hover:text-ink-900',
          !expanded && 'justify-center px-0',
        )
      }
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      {expanded ? <span className="truncate">{label}</span> : null}
    </NavLink>
  )
}

function Sidebar({ items }: { items: NavItem[] }) {
  const { t } = useTranslation()
  // Below xl the sidebar is an icon rail; it can be opened as an overlay.
  const [open, setOpen] = useState(false)

  const main = items.filter((i) => i.group === 'main')
  const sections = (['admin', 'ops'] as const)
    .map((group) => ({ group, items: items.filter((i) => i.group === group) }))
    .filter((s) => s.items.length)

  const body = (expanded: boolean, onNavigate?: () => void) => (
    <>
      <div className={cn('flex h-16 items-center', expanded ? 'justify-between px-4' : 'justify-center')}>
        <BrandMark compact={!expanded} />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label={t('nav.mainLabel')}>
        {main.map((i) => (
          <SideLink key={i.key} item={i} expanded={expanded} onNavigate={onNavigate} />
        ))}
        {sections.map((section) => (
          <Fragment key={section.group}>
            <p className={cn('mt-5 mb-1 px-3 text-xs font-semibold text-ink-400', !expanded && 'sr-only')}>
              {t(`nav.${section.group}`)}
            </p>
            {section.items.map((i) => (
              <SideLink key={i.key} item={i} expanded={expanded} onNavigate={onNavigate} />
            ))}
          </Fragment>
        ))}
      </nav>
    </>
  )

  return (
    <>
      {/* Desktop: always expanded */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface xl:flex">
        {body(true)}
      </aside>

      {/* Tablet: rail + expandable overlay */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col border-r border-line bg-surface md:flex xl:hidden">
        {body(false)}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="m-3 grid h-11 place-items-center rounded-xl text-ink-500 hover:bg-muted"
          aria-label={t('nav.expand')}
          aria-expanded={open}
        >
          <ChevronsRight className="size-5" aria-hidden />
        </button>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 hidden md:block xl:hidden">
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-black/40"
            aria-label={t('nav.collapse')}
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-64 animate-slide-left flex-col bg-surface shadow-2xl">
            {body(true, () => setOpen(false))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="m-3 flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-muted"
            >
              <ChevronsLeft className="size-5" aria-hidden />
              {t('nav.collapse')}
            </button>
          </aside>
        </div>
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Phone tab bar + "more" sheet                                        */
/* ------------------------------------------------------------------ */

function BottomNav({ items }: { items: NavItem[] }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const actions = useAccountActions()
  const [moreOpen, setMoreOpen] = useState(false)
  const close = () => setMoreOpen(false)
  const { tabs, rest } = phoneTabs(items)

  const tab =
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors'

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-safe backdrop-blur md:hidden"
        aria-label={t('nav.tabsLabel')}
      >
        <div className="flex">
          {tabs.map((i) => (
            <NavLink
              key={i.key}
              to={i.to}
              end={i.end}
              className={({ isActive }) => cn(tab, isActive ? 'text-accent' : 'text-ink-500')}
            >
              {i.key === 'newRequest' ? (
                <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-white">
                  <i.icon className="size-4.5" aria-hidden />
                </span>
              ) : (
                // The same 32 px box as the "new request" circle, so every label lines up.
                <span className="grid size-8 place-items-center">
                  <i.icon className="size-6" aria-hidden />
                </span>
              )}
              {t(`nav.${i.key}`)}
            </NavLink>
          ))}
          <button
            type="button"
            className={cn(tab, 'text-ink-500')}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
          >
            <span className="grid size-8 place-items-center">
              <Ellipsis className="size-6" aria-hidden />
            </span>
            {t('common.more')}
          </button>
        </div>
      </nav>

      <Sheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={t('common.more')}
        closeLabel={t('common.close')}
      >
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-muted p-3">
          <CircleUserRound className="size-9 text-ink-400" aria-hidden />
          <div>
            <p className="font-bold">{user.name}</p>
            <p className="text-xs text-ink-500">
              {t(`role.${user.role}`)} · {user.email}
            </p>
          </div>
        </div>
        <ul className="flex flex-col gap-1">
          {rest.map((i) => (
            <li key={i.key}>
              <SideLink item={i} expanded onNavigate={close} />
            </li>
          ))}
          <li>
            <Link
              to="/settings"
              onClick={close}
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-ink-600 hover:bg-muted"
            >
              <Settings className="size-5" aria-hidden />
              {t('nav.settings')}
            </Link>
          </li>
          {actions.resetDemo ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  close()
                  void actions.resetDemo?.()
                }}
                className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-ink-600 hover:bg-muted"
              >
                <RotateCcw className="size-5" aria-hidden />
                {t('nav.resetDemo')}
              </button>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              onClick={() => {
                close()
                actions.logout()
              }}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-danger-fg hover:bg-danger-50"
            >
              <LogOut className="size-5" aria-hidden />
              {t('nav.logout')}
            </button>
          </li>
        </ul>
      </Sheet>
      {actions.signOutDialog}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

/**
 * First tab stop on every signed-in screen (WCAG 2.4.1). It moves focus in
 * code rather than following `#main`, so the URL hash and the router stay
 * untouched.
 */
function SkipLink() {
  const { t } = useTranslation()
  return (
    <a
      href="#main"
      onClick={(e) => {
        e.preventDefault()
        document.getElementById('main')?.focus()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-surface focus:px-4 focus:text-[15px] focus:font-semibold focus:text-ink-900 focus:shadow-lg"
    >
      {t('nav.skipToContent')}
    </a>
  )
}

export function AppShell() {
  // Drafts reach the account from any screen, not only the wizard's.
  useDraftSync()
  const can = useCan()
  const items = visibleNav(can)
  const handles = useMatches().map((m) => m.handle as RouteHandle | undefined)
  const focus = handles.some((h) => h?.focus)
  // A page made of `Page` parts fills the window on a big screen; only its lists scroll (src/app/page.tsx).
  const fit = handles.some((h) => h?.fit)

  return (
    <div data-fit={fit || undefined} className={cn('min-h-dvh', fit && 'fit:flex fit:h-dvh fit:flex-col')}>
      <SkipLink />
      <Sidebar items={items} />
      <div className={cn('md:pl-[76px] xl:pl-64', fit && 'fit:flex fit:min-h-0 fit:flex-1 fit:flex-col')}>
        {/* On a phone the demo notice is a strip above the header; from a tablet up, a box in the header. */}
        <DemoBanner className="md:hidden" />
        {/*
          The notch inset (an iOS home-screen app draws under the status bar) is padded once: by the
          demo strip on a phone when there is one, otherwise by the header. With the strip, the header
          sticks just below the inset once the strip has scrolled away, and this strip keeps the page
          from showing through under the status bar.
        */}
        {env.apiMock ? (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-canvas/90 backdrop-blur md:hidden"
          />
        ) : null}
        <header
          className={cn(
            'sticky z-20 border-b border-line/70 bg-canvas/90 backdrop-blur',
            env.apiMock ? 'top-[env(safe-area-inset-top)] md:top-0 md:pt-safe' : 'top-0 pt-safe',
          )}
        >
          <div className="page-band flex h-14 items-center justify-between gap-2 md:h-16">
            {/* The brand moves to the sidebar from a tablet up; the demo notice takes its place. */}
            <div className="flex min-w-0 items-center">
              <div className="md:hidden">
                <BrandMark />
              </div>
              <DemoBanner variant="inline" className="hidden self-auto md:flex" />
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <div className="hidden md:block">
                <AccountMenu />
              </div>
            </div>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'outline-none',
            fit
              ? 'fit:flex fit:min-h-0 fit:flex-1 fit:flex-col'
              : 'page-column pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-6 md:pb-12',
          )}
        >
          <Outlet />
        </main>
      </div>
      {focus ? null : <BottomNav items={items} />}
      <ScrollRestoration />
    </div>
  )
}
