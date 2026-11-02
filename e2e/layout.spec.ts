/**
 * Edge viewports the three main projects don't cover: the smallest phone
 * still in use (320 px) and a tablet held sideways. Width is all that matters
 * here, so these run once, in the desktop (Chromium) project.
 */
import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, loginAs } from './helpers.ts'

const VIEWPORTS = [
  { name: 'small phone', width: 320, height: 568, nav: 'tabs' },
  { name: 'tablet landscape', width: 1080, height: 810, nav: 'rail' },
] as const

const ROUTES = {
  요청자: [
    '/',
    '/requests/new?project=p-portal&step=1',
    '/requests',
    '/requests/1021',
    '/schedule',
    '/notifications',
    '/settings/notifications',
  ],
  담당자: ['/work', '/work/regression', '/requests/1024', '/requests/1026'],
  경영진: ['/dashboard'],
  관리자: ['/admin/projects', '/admin/users', '/admin/budget'],
} as const

async function settle(page: Page) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  // Skeletons gone = data rendered; long titles are what overflow.
  await expect(page.locator('.animate-pulse.bg-line\\/70')).toHaveCount(0)
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    // Runs in the desktop project only (see testIgnore in playwright.config.ts).
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const [role, routes] of Object.entries(ROUTES)) {
      test(`${role} screens fit ${vp.width}px`, async ({ page }) => {
        await loginAs(page, role as keyof typeof ROUTES)
        for (const route of routes) {
          await page.goto(route)
          await settle(page)
          await expectNoHorizontalScroll(page)
          if (vp.nav === 'tabs' && route !== '/requests/new?project=p-portal&step=1') {
            await expect(page.getByRole('navigation', { name: '하단 메뉴' }), route).toBeVisible()
          }
          if (vp.nav === 'rail') {
            await expect(page.getByRole('button', { name: '메뉴 펼치기' }), route).toBeVisible()
          }
        }
      })
    }
  })
}
