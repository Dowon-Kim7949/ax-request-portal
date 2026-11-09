import { expect, test } from './fixtures.ts'
import { COLD_START_TIMEOUT, expectNoHorizontalScroll, loginAs, viewportOf } from './helpers.ts'

test('login screen fits the viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_START_TIMEOUT })
  await expect(page).toHaveURL(/\/login/)
  await expectNoHorizontalScroll(page)
})

test('navigation adapts to the device', async ({ page }, info) => {
  await loginAs(page, '요청자')
  await expect(page.getByRole('heading', { name: '어떤 일을 도와드릴까요?' })).toBeVisible()
  // Check overflow only after the data-driven cards are in: long titles are what widen a page.
  await expect(page.getByText(/진행 중인 요청 \d+건/)).toBeVisible()
  await expect(page.getByRole('link', { name: /#1021/ })).toBeVisible()
  await expectNoHorizontalScroll(page)

  const tabs = page.getByRole('navigation', { name: '하단 메뉴' })
  const sidebarLink = page.getByRole('navigation', { name: '주 메뉴' }).first()

  switch (viewportOf(info)) {
    case 'phone':
      await expect(tabs).toBeVisible()
      await expect(sidebarLink).toBeHidden()
      await tabs.getByRole('link', { name: '내 요청' }).click()
      break
    case 'tablet':
      await expect(tabs).toBeHidden()
      // Icon rail: labels are hidden, links are named by aria-label
      await page.getByRole('link', { name: '내 요청' }).first().click()
      break
    case 'desktop':
      await expect(tabs).toBeHidden()
      await page
        .getByRole('navigation', { name: '주 메뉴' })
        .getByRole('link', { name: '내 요청' })
        .first()
        .click()
      break
  }
  await expect(page.getByRole('heading', { level: 1, name: '내 요청' })).toBeVisible()
  await expect(page.getByRole('link', { name: /#1021/ })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { level: 1, name: '배포 일정' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '이번 주' })).toBeVisible()
  await expectNoHorizontalScroll(page)
})
