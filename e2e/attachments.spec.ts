import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, loginAs } from './helpers.ts'

/** A 1×1 PNG: small enough for the demo to keep it inline as a data: URL. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

// Browsers refuse to open a data: URL in a tab; the link opens the file through a blob: URL instead.
test('an attached screenshot opens in a new tab', async ({ page, context }) => {
  await loginAs(page, '요청자')
  await page.goto('/requests/new?project=p-portal')
  await page.getByRole('radio', { name: /기존 기능 변경/ }).click() // auto-advances
  await page.getByRole('button', { name: '공지사항' }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('요청 제목').fill('첨부한 화면처럼 바꾸기')
  await page.getByLabel('원하는 동작').fill('첨부한 화면처럼 공지 목록을 바꾸고 싶다')
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('완료 기준 1').fill('공지 목록을 열면 첨부한 화면처럼 보인다')
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: /마지막으로/ })).toBeVisible()
  await page
    .locator('#wizard-files')
    .setInputFiles({ name: 'screen.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText('screen.png')).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByRole('button', { name: '요청 제출' }).click()
  await expect(page).toHaveURL(/\/requests\/\d+$/)

  const link = page.getByRole('link', { name: /screen\.png.*새 탭에서 열림/ })
  await expect(link).toBeVisible()
  await expectNoHorizontalScroll(page)
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()])
  await expect(tab).toHaveURL(/^blob:/)
  await tab.close()
})
