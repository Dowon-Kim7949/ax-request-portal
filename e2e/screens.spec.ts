/**
 * Visual capture of key screens for manual review (not an assertion suite).
 * Run: SCREENS=1 npx playwright test e2e/screens.spec.ts
 */
import { test } from '@playwright/test'
import { loginAs } from './helpers.ts'

test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture screenshots')

const OUT = process.env.SCREENS_DIR ?? 'test-results/screens'

test('capture requester screens', async ({ page }, info) => {
  const shot = async (name: string) => {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${OUT}/${info.project.name}-${name}.png`, fullPage: true })
  }
  await loginAs(page, '요청자')
  await page.getByRole('link', { name: /#1021/ }).waitFor()
  await shot('home')

  await page.goto('/requests/new?project=p-portal&step=1')
  await page.getByRole('radio', { name: /버그/ }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('요청 제목').waitFor()
  await shot('wizard-describe')

  await page.goto('/requests/1024')
  await page.getByRole('heading', { name: '진행 기록' }).waitFor()
  await shot('detail-1024')

  await page.goto('/requests')
  await page.getByRole('link', { name: /#1021/ }).waitFor()
  await shot('my-requests')

  await page.goto('/schedule')
  await page.getByRole('heading', { name: '이번 주' }).waitFor()
  await shot('schedule')
})
