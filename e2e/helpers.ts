import { expect, type Page, type TestInfo } from '@playwright/test'

export type Viewport = 'phone' | 'tablet' | 'desktop'

export function viewportOf(info: TestInfo): Viewport {
  return info.project.name as Viewport
}

/**
 * Opens the login screen, signed out. The session is dropped from a static
 * file of the same origin, where the app is not running: inside the app a
 * /me response still in flight would save the session again.
 */
async function openLoginScreen(page: Page, brandName: string) {
  await page.goto('/favicon.svg')
  await page.evaluate(() => localStorage.removeItem('ax-request-portal:session'))
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: brandName })).toBeVisible()
}

/** Signs in through the demo buttons on the login screen (mock mode). */
export async function loginAs(page: Page, role: '요청자' | '경영진' | '담당자' | '관리자' | '운영자') {
  await openLoginScreen(page, 'AX 업무 요청')
  await page.getByRole('button', { name: new RegExp(`${role}로 시작`) }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Same as loginAs, for a browser whose language is English. */
export async function loginAsEnglish(
  page: Page,
  role: 'Requester' | 'Executive' | 'Developer' | 'Admin' | 'Operator',
) {
  await openLoginScreen(page, 'AX Request Portal')
  await page.getByRole('button', { name: new RegExp(`Sign in as ${role}`) }).click()
  await expect(page).not.toHaveURL(/\/login/)
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
