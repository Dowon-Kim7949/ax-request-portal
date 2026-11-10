/**
 * The e2e build runs on the mock API (VITE_API_MOCK unset), so it is a demo
 * build: the login screen and every signed-in screen must say so, without
 * a way to close the notice and without widening a phone screen. On a phone
 * the notice is a strip above the header; from a tablet up it is a box at the
 * left of the header, where the brand has moved to the sidebar.
 */
import { expect, test } from './fixtures.ts'
import { COLD_START_TIMEOUT, expectNoHorizontalScroll, loginAs, openInApp, viewportOf } from './helpers.ts'

const NOTICE = '데모 모드 · 데이터는 이 브라우저에만 저장돼요'

test('a demo build says so on the login screen and on signed-in screens', async ({ page }, info) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_START_TIMEOUT })
  await expect(page.locator('p', { hasText: NOTICE })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await loginAs(page, '요청자')
  const phone = viewportOf(info) === 'phone'
  const strip = page.getByRole('complementary', { name: '데모 모드' })
  const box = page.getByRole('banner').locator('p', { hasText: NOTICE })
  for (const route of ['/', '/requests', '/settings', '/notifications']) {
    await openInApp(page, route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    const notice = phone ? strip : box
    await expect(notice, route).toBeVisible()
    await expect(notice, route).toHaveText(NOTICE)
    await expect(notice.getByRole('button'), route).toHaveCount(0)
    // One notice at a time: the other one is not shown, and not read out either.
    await expect(phone ? box : strip, route).toBeHidden()
    await expectNoHorizontalScroll(page)
  }
})
