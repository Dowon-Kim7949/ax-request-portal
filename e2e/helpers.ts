import { expect, type Page, type TestInfo } from '@playwright/test'

export type Viewport = 'phone' | 'tablet' | 'desktop'

export function viewportOf(info: TestInfo): Viewport {
  return info.project.name as Viewport
}

/** Signs in through the demo buttons on the login screen (mock mode). */
export async function loginAs(page: Page, role: '요청자' | '경영진' | '담당자' | '관리자') {
  await page.goto('/login')
  const demo = page.getByRole('button', { name: new RegExp(`${role}로 시작`) })
  const loginHeading = page.getByRole('heading', { level: 1, name: 'AX 업무 요청' })
  await expect(loginHeading.or(page.getByRole('navigation').first())).toBeVisible()
  if (!(await loginHeading.isVisible())) {
    // Already signed in: /login sends us away, so drop the session and come back.
    await page.evaluate(() => localStorage.removeItem('ax-request-portal:session'))
    await page.goto('/login')
  }
  await demo.click()
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
