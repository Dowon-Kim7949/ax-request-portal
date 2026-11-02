import { expect, type Page, type TestInfo } from '@playwright/test'

export type Viewport = 'phone' | 'tablet' | 'desktop'

export function viewportOf(info: TestInfo): Viewport {
  return info.project.name as Viewport
}

/** Signs in through the demo buttons on the login screen (mock mode). */
export async function loginAs(page: Page, role: '요청자' | '경영진' | '담당자' | '관리자') {
  await page.goto('/login')
  await page.getByRole('button', { name: new RegExp(`${role}로 시작`) }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Fails when the page scrolls sideways — the most common phone layout bug. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
}
