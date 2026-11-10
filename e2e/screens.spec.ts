/**
 * Visual capture of key screens for manual review (not an assertion suite).
 * Run: SCREENS=1 npx playwright test e2e/screens.spec.ts
 */
import { expect, test } from './fixtures.ts'
import { keepDraftOffline, loginAs, openInApp, SEEDED_DRAFTS, seedSavedDrafts } from './helpers.ts'

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
  // The type moves on by itself; "다음" before the next step shows would act on the type step again.
  await expect(page.getByRole('heading', { name: '어느 화면이나 기능인가요?' })).toBeVisible()
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

test('capture saved drafts', async ({ page }, info) => {
  const shot = async (name: string) => {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${OUT}/${info.project.name}-${name}.png`, fullPage: true })
  }
  const settled = () => expect(page.locator('.animate-pulse.bg-line\\/70')).toHaveCount(0)
  const { offline } = SEEDED_DRAFTS.ko
  await keepDraftOffline(page, offline)
  await loginAs(page, '요청자')
  await seedSavedDrafts(page)
  await page.reload()
  await page.getByRole('region', { name: '임시 저장' }).getByText('4/20').waitFor()
  await settled()
  await shot('drafts-home')

  await openInApp(page, '/requests')
  await page.locator('#drafts').getByText('이 기기에만').waitFor()
  await settled()
  await shot('drafts-requests')
  await page.getByRole('button', { name: /모두 보기/ }).click()
  await shot('drafts-requests-all')
  await page.getByRole('button', { name: `${offline} 삭제` }).click()
  await page.getByRole('dialog').waitFor()
  await shot('drafts-delete')
  await page.keyboard.press('Escape')

  await openInApp(page, '/')
  await openInApp(page, '/requests/new')
  await page.getByRole('link', { name: /임시 저장된 초안/ }).waitFor()
  await shot('drafts-wizard-notice')

  await page.emulateMedia({ colorScheme: 'dark' })
  await openInApp(page, '/requests')
  await page.locator('#drafts').getByText('이 기기에만').waitFor()
  await shot('drafts-requests-dark')
  await openInApp(page, '/')
  await page.getByRole('region', { name: '임시 저장' }).waitFor()
  await settled()
  await shot('drafts-home-dark')
})
