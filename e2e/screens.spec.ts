/**
 * Visual capture of key screens for manual review (not an assertion suite).
 * Run: SCREENS=1 npx playwright test e2e/screens.spec.ts
 */
import { test } from './fixtures.ts'
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

test('capture developer, executive and admin screens', async ({ page }, info) => {
  const shot = async (name: string) => {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${OUT}/${info.project.name}-${name}.png`, fullPage: true })
  }
  await loginAs(page, '담당자')
  await page.goto('/requests/1024')
  await page.getByRole('button', { name: '승인하고 반영' }).waitFor()
  await shot('dev-1024')
  await page.goto('/requests/1026')
  await page.getByRole('heading', { name: '구현 확인 보고서' }).waitFor()
  await shot('dev-1026-report')

  await loginAs(page, '경영진')
  await page.goto('/dashboard')
  await page.getByRole('heading', { name: '프로젝트별 현황' }).waitFor()
  await shot('dashboard')

  await loginAs(page, '관리자')
  await page.goto('/admin/projects')
  await page.getByText('고객 포털 웹').first().waitFor()
  await shot('admin-projects')
})
