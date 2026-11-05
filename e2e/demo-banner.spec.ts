/**
 * The e2e build runs on the mock API (VITE_API_MOCK unset), so it is a demo
 * build: the login screen and every signed-in screen must say so, without
 * a way to close the notice and without widening a phone screen.
 */
import { expect, test } from './fixtures.ts'
import { COLD_START_TIMEOUT, expectNoHorizontalScroll, loginAs, openInApp } from './helpers.ts'

const NOTICE = '데모 모드 · 데이터는 이 브라우저에만 저장돼요'

test('a demo build says so on the login screen and on signed-in screens', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_START_TIMEOUT })
  await expect(page.locator('p', { hasText: NOTICE })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await loginAs(page, '요청자')
  const banner = page.getByRole('complementary', { name: '데모 모드' })
  for (const route of ['/', '/requests', '/settings']) {
    await openInApp(page, route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(banner, route).toBeVisible()
    await expect(banner, route).toHaveText(NOTICE)
    await expect(banner.getByRole('button'), route).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  }
})
