/**
 * Dark mode: follows the system, can be overridden, persists, and never
 * flashes white before the app starts.
 */
import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, loginAs } from './helpers.ts'

const DARK_CANVAS = 'rgb(13, 18, 29)'
const LIGHT_CANVAS = 'rgb(243, 245, 248)'

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test.describe('system dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('applies before the app script runs (no white flash)', async ({ page }) => {
    // Hold the app bundle: whatever is dark now comes from the inline script in <head> alone.
    await page.route(/\/assets\/index-[^/]+\.js$/, () => {})
    await page.goto('/login', { waitUntil: 'commit' })
    await page.waitForSelector('.boot-spinner')
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(
      DARK_CANVAS,
    )
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0d121d')
  })

  test('the app keeps it dark once running', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await bodyBackground(page)).toBe(DARK_CANVAS)
  })

  test('every screen renders dark without overflow', async ({ page }) => {
    test.setTimeout(90_000)
    const plan = {
      요청자: [
        '/',
        '/requests/new?project=p-portal&step=1',
        '/requests/1021',
        '/requests/1028',
        '/schedule',
        '/settings',
      ],
      담당자: ['/work', '/requests/1024', '/requests/1026'],
      경영진: ['/dashboard'],
      관리자: ['/admin/users'],
      운영자: ['/ops/usage', '/ops/agents', '/ops/pricing', '/ops/budget'],
    } as const
    for (const [role, routes] of Object.entries(plan)) {
      await loginAs(page, role as keyof typeof plan)
      for (const route of routes) {
        await page.goto(route)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        expect(await bodyBackground(page), route).toBe(DARK_CANVAS)
        await expectNoHorizontalScroll(page)
      }
    }
  })

  test('the user can choose light even when the system is dark, and it sticks', async ({ page }) => {
    await loginAs(page, '요청자')
    await page.goto('/settings')
    await page.getByRole('radio', { name: '밝게' }).click()
    expect(await bodyBackground(page)).toBe(LIGHT_CANVAS)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: '설정' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f5f8')
  })
})

test('the login screen toggles dark mode', async ({ page }) => {
  await page.goto('/login')
  expect(await bodyBackground(page)).toBe(LIGHT_CANVAS)
  await page.getByRole('button', { name: '어두운 화면으로 보기' }).click()
  expect(await bodyBackground(page)).toBe(DARK_CANVAS)
  await expect(page.getByRole('button', { name: '밝은 화면으로 보기' })).toBeVisible()
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0d121d')
})
