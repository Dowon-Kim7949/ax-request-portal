import { expect, type Page, type TestInfo } from '@playwright/test'

export type Viewport = 'phone' | 'tablet' | 'desktop'

export function viewportOf(info: TestInfo): Viewport {
  return info.project.name as Viewport
}

/**
 * How long a full page load may take to show its first screen. In a new
 * browser context it includes installing the mock's service worker, and the
 * app itself gives its mock 8 s to start before it reloads
 * (MOCK_START_TIMEOUT_MS in src/main.tsx): a test should not give up sooner.
 */
export const COLD_START_TIMEOUT = 10_000

/**
 * Opens the login screen, signed out. The session is dropped from a static
 * file of the same origin, where the app is not running: inside the app a
 * /me response still in flight would save the session again.
 */
async function openLoginScreen(page: Page, brandName: string) {
  await page.goto('/favicon.svg')
  await page.evaluate(() => localStorage.removeItem('ax-request-portal:session'))
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: brandName })).toBeVisible({
    timeout: COLD_START_TIMEOUT,
  })
}

/**
 * Waits until the app has left the login screen for good. Signing in moves on
 * twice (the sign-in call's success, and the screen's own redirect once it
 * sees the session), and the URL changes before the screen does: a move made
 * in between (openInApp) can be overtaken by the second one. Once the login
 * form has gone, both have been made.
 */
export async function expectSignedIn(page: Page) {
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
}

/** Signs in through the demo buttons on the login screen (mock mode). */
export async function loginAs(page: Page, role: '요청자' | '경영진' | '담당자' | '관리자' | '운영자') {
  await openLoginScreen(page, 'AX 업무 요청')
  await page.getByRole('button', { name: new RegExp(`${role}로 시작`) }).click()
  await expectSignedIn(page)
}

/** Same as loginAs, for a browser whose language is English. */
export async function loginAsEnglish(
  page: Page,
  role: 'Requester' | 'Executive' | 'Developer' | 'Admin' | 'Operator',
) {
  await openLoginScreen(page, 'AX Request Portal')
  await page.getByRole('button', { name: new RegExp(`Sign in as ${role}`) }).click()
  await expectSignedIn(page)
}

/**
 * Opens `path` inside the running app, as a link would: no page load.
 *
 * page.goto loads the page again, which starts the app and its mock API from
 * scratch (the mock's code, its data from storage, the service worker
 * handshake, then the session and the screen's data). In WebKit under a
 * parallel run that start alone takes 2–4 s before a screen shows its
 * heading, so a walk through many screens with page.goto spent its 5 s
 * expectations on start-ups and failed now and then. Keep page.goto where the
 * start itself is under test.
 *
 * The router is moved the way the browser's back and forward buttons move it
 * (a history entry plus `popstate`, with the state shape React Router writes).
 * It keeps the old screen up while the new one's code loads, so this returns
 * once the old screen's main heading has gone: what the caller checks next is
 * the new screen. For that the old screen must have its heading first (it
 * could otherwise appear after the move). Two visits in a row to the same
 * screen with its data cached would keep the heading and time out here, loudly.
 */
export async function openInApp(page: Page, path: string) {
  const target = new URL(path, page.url())
  const here = new URL(page.url())
  if (target.pathname === here.pathname && target.search === here.search) return
  await expect(page.locator('h1').first()).toBeVisible()
  await page.evaluate((to) => {
    document.querySelector('h1')?.setAttribute('data-e2e-leaving', '')
    const idx = ((window.history.state as { idx?: number } | null)?.idx ?? 0) + 1
    window.history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx }, '', to)
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  }, path)
  await expect(page.locator('h1[data-e2e-leaving]')).toHaveCount(0)
}

/** Local YYYY-MM-DD `days` from today (what <input type="date"> expects). */
export function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Fails when the page scrolls sideways — the most common phone layout bug. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
}
