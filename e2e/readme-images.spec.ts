/**
 * Regenerates the screenshots in docs/images used by the README.
 * Run: README_IMAGES=1 npx playwright test e2e/readme-images.spec.ts
 */
import { test, type Page } from '@playwright/test'
import { loginAs } from './helpers.ts'

test.skip(!process.env.README_IMAGES, 'set README_IMAGES=1 to regenerate docs/images')

async function shot(page: Page, file: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300) // let toasts and transitions settle
  await page.screenshot({ path: `docs/images/${file}.png`, scale: 'css' })
}

test('readme images', async ({ page }, info) => {
  const device = info.project.name

  if (device === 'phone') {
    await loginAs(page, '요청자')
    await page.getByRole('link', { name: /#1021/ }).waitFor()
    await shot(page, 'phone-home')

    await page.goto('/requests/new?project=p-portal&step=1')
    await page.getByRole('radio', { name: /기존 기능 변경/ }).click()
    await page.getByRole('button', { name: '공지사항' }).click()
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByLabel('요청 제목').fill('공지사항 검색 추가')
    await page.getByLabel('지금 동작').fill('공지가 많아 원하는 공지를 찾기 어렵다')
    await page.getByLabel('원하는 동작').fill('제목으로 공지를 검색하고 싶다')
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByLabel('완료 기준 1').fill('검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다')
    await shot(page, 'phone-wizard')

    await page.goto('/requests/1021')
    const checklist = page.getByRole('heading', { name: '완료 기준대로 됐는지 확인해 주세요' })
    await checklist.waitFor()
    await page.getByRole('button', { name: '됐어요' }).first().click()
    await checklist.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -80))
    await shot(page, 'phone-verify')
  }

  if (device === 'desktop') {
    await loginAs(page, '담당자')
    await page.goto('/requests/1024')
    await page.getByRole('button', { name: '승인하고 반영' }).waitFor()
    await shot(page, 'desktop-review')
  }

  if (device === 'tablet') {
    await loginAs(page, '경영진')
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.getByRole('heading', { name: '프로젝트별 현황' }).waitFor()
    await page.waitForTimeout(500)
    await shot(page, 'tablet-dashboard')
  }
})
