/**
 * Automated accessibility scan (axe-core) of every main screen, signed in as
 * each role, in the light and the dark theme. Serious and critical findings
 * fail the test; the rule set is WCAG 2.2 A/AA plus axe's best practices.
 *
 * Runs in the phone and desktop projects (see testIgnore in playwright.config.ts).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from './fixtures.ts'
import {
  COLD_START_TIMEOUT,
  keepDraftOffline,
  loginAs,
  openInApp,
  SEEDED_DRAFTS,
  seedSavedDrafts,
} from './helpers.ts'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

/**
 * Rules switched off on purpose, each with the reason. Keep this list short:
 * a finding is fixed in the UI unless there is a reason it cannot be. Empty:
 * everything the first scan found was fixed.
 */
const EXCLUDED_RULES: Record<string, string> = {}

const FAILING_IMPACTS = new Set(['serious', 'critical'])

/** Waits until the screen has its heading and its data (no skeletons left). */
async function settle(page: Page) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.animate-pulse.bg-line\\/70')).toHaveCount(0)
}

/** Scans the page as it is now; a soft assertion, so one test reports every screen it visits. */
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(Object.keys(EXCLUDED_RULES))
    .analyze()
  const failing = results.violations
    .filter((v) => FAILING_IMPACTS.has(v.impact ?? ''))
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes
          .slice(0, 5)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
    )
  expect.soft(failing, label).toEqual([])
}

/** Opens `path` in the running app, waits for it to settle and scans it. */
async function visit(page: Page, path: string) {
  await openInApp(page, path)
  await settle(page)
  await scan(page, path)
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    // Animations finish at once, so a scan never catches a half-faded colour.
    test.use({ colorScheme, reducedMotion: 'reduce' })

    test('login screen', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByRole('heading', { level: 1, name: 'AX 업무 요청' })).toBeVisible({
        timeout: COLD_START_TIMEOUT,
      })
      await scan(page, '/login')
    })

    test('requester screens', async ({ page }) => {
      test.setTimeout(90_000)
      await loginAs(page, '요청자')
      await settle(page)
      await scan(page, '/ (requester home)')
      for (const path of [
        '/requests',
        '/requests/1021',
        '/requests/1024',
        '/requests/1028',
        '/schedule',
        '/notifications',
        // The month view on wider screens (phones keep the list). After another screen:
        // openInApp waits for the heading to change, and a new query keeps the same screen.
        '/schedule?view=month',
        '/settings',
      ]) {
        await visit(page, path)
      }
    })

    test('wizard, every step', async ({ page }) => {
      test.setTimeout(90_000)
      await loginAs(page, '요청자')
      await visit(page, '/requests/new')
      await page.getByRole('radio', { name: /고객 포털 웹/ }).click() // auto-advances
      await expect(page.getByRole('heading', { name: '어떤 종류의 요청인가요?' })).toBeVisible()
      await scan(page, 'wizard: type')
      await page.getByRole('radio', { name: /기존 기능 변경/ }).click() // auto-advances
      await expect(page.getByRole('heading', { name: '어느 화면이나 기능인가요?' })).toBeVisible()
      await scan(page, 'wizard: targets')
      await page.getByRole('button', { name: '공지사항' }).click()
      await page.getByRole('button', { name: '다음' }).click()
      await expect(page.getByRole('heading', { name: /지금은 어떻고/ })).toBeVisible()
      // With the field errors showing.
      await page.getByRole('button', { name: '다음' }).click()
      await expect(page.getByText('제목을 2자 이상 적어 주세요.')).toBeVisible()
      await scan(page, 'wizard: describe (errors)')
      await page.getByLabel('요청 제목').fill('공지사항 검색 추가')
      await page.getByLabel('지금 동작').fill('공지가 많아 원하는 공지를 찾기 어렵다')
      await page.getByLabel('원하는 동작').fill('제목으로 공지를 검색하고 싶다')
      await page.getByRole('button', { name: '다음' }).click()
      await expect(page.getByRole('heading', { name: '무엇이 되면 완료인가요?' })).toBeVisible()
      await scan(page, 'wizard: criteria')
      await page.getByLabel('완료 기준 1').fill('검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다')
      await page.getByRole('button', { name: '다음' }).click()
      await expect(page.getByRole('heading', { name: /마지막으로/ })).toBeVisible()
      await scan(page, 'wizard: extra')
      await page.getByRole('button', { name: '다음' }).click()
      await expect(page.getByRole('heading', { name: '이대로 제출할까요?' })).toBeVisible()
      await expect(page.getByRole('button', { name: '요청 제출' })).toBeEnabled()
      await scan(page, 'wizard: review')
    })

    test('saved drafts', async ({ page }) => {
      test.setTimeout(90_000)
      // With both marks on show: a conflict, and a draft on this device only.
      await keepDraftOffline(page, SEEDED_DRAFTS.ko.offline)
      await loginAs(page, '요청자')
      await seedSavedDrafts(page)
      await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_START_TIMEOUT })
      await settle(page)
      const home = page.getByRole('region', { name: '임시 저장' })
      await expect(home.getByText('4/20')).toBeVisible()
      await expect(home.getByText('이 기기에만')).toBeVisible()
      await scan(page, '/ (requester home, saved drafts)')

      await openInApp(page, '/requests')
      await settle(page)
      await expect(page.locator('#drafts').getByText('4/20')).toBeVisible()
      await page.getByRole('button', { name: '5개 모두 보기' }).click()
      await expect(page.locator('#drafts').getByText('충돌')).toBeVisible()
      await scan(page, '/requests (saved drafts, all)')
      await page.getByRole('button', { name: `${SEEDED_DRAFTS.ko.offline} 삭제` }).click()
      await expect(page.getByRole('dialog', { name: '이 초안을 삭제할까요?' })).toBeVisible()
      await scan(page, '/requests (delete draft sheet)')
      await page.keyboard.press('Escape')

      await openInApp(page, '/')
      await openInApp(page, '/requests/new')
      await expect(page.getByRole('link', { name: /임시 저장된 초안 5개/ })).toBeVisible()
      await scan(page, 'wizard (saved drafts notice)')
    })

    test('developer screens', async ({ page }) => {
      test.setTimeout(90_000)
      await loginAs(page, '담당자')
      await settle(page)
      await scan(page, '/ (developer home)')
      for (const path of ['/work', '/work/regression', '/requests/1024']) await visit(page, path)
      await visit(page, '/requests/1026')
      // The run sheet, with its assumptions to tick.
      await page.getByRole('button', { name: '작업 수행' }).click()
      await expect(page.getByRole('dialog', { name: 'AI에게 작업을 맡길까요?' })).toBeVisible()
      await scan(page, '/requests/1026 (run sheet)')
    })

    test('executive screens', async ({ page }) => {
      await loginAs(page, '경영진')
      await settle(page)
      await scan(page, '/ (executive home)')
      await visit(page, '/dashboard')
    })

    test('admin screens', async ({ page }) => {
      await loginAs(page, '관리자')
      await settle(page)
      await scan(page, '/ (admin home)')
      await visit(page, '/admin/users')
      await page.getByRole('button', { name: '팀 관리' }).click()
      await expect(page.getByRole('dialog', { name: '팀' })).toBeVisible()
      await scan(page, '/admin/users (teams sheet)')
      await page.keyboard.press('Escape')
      await visit(page, '/admin/projects')
      await page.getByRole('button', { name: '프로젝트 추가' }).click()
      await expect(page.getByRole('dialog', { name: '프로젝트 추가' })).toBeVisible()
      await scan(page, '/admin/projects (new project sheet)')
    })

    test('operator screens', async ({ page }) => {
      test.setTimeout(90_000)
      await loginAs(page, '운영자')
      await settle(page)
      await scan(page, '/ (operator home)')
      for (const path of ['/ops/usage', '/ops/agents', '/ops/pricing', '/ops/budget']) await visit(page, path)
    })
  })
}
