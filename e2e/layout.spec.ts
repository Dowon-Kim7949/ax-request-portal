/**
 * Edge viewports the three main projects don't cover: the smallest phone
 * still in use (320 px) and a tablet held sideways. Width is all that matters
 * here, so these run once, in the desktop (Chromium) project.
 */
import { expect, test, type Locator, type Page } from './fixtures.ts'
import {
  COLD_START_TIMEOUT,
  expectNoHorizontalScroll,
  loginAs,
  loginAsEnglish,
  openInApp,
} from './helpers.ts'

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
    '/requests/1028',
    '/requests/1029',
    '/schedule',
    '/notifications',
    '/settings',
  ],
  담당자: ['/work', '/work/regression', '/requests/1024', '/requests/1026'],
  경영진: ['/dashboard'],
  관리자: ['/admin/projects', '/admin/users'],
  운영자: ['/', '/ops/usage', '/ops/agents', '/ops/pricing', '/ops/budget'],
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
          await openInApp(page, route)
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

// English words run longer than Korean ones: check the narrowest phone in English too.
test.describe('small phone in English', () => {
  test.use({ viewport: { width: 320, height: 568 }, locale: 'en-US' })

  const EN_ROUTES = {
    Requester: [
      '/',
      '/requests/new?project=p-portal&step=2',
      '/requests',
      '/requests/1021',
      '/requests/1028',
      '/requests/1029',
      '/schedule',
      '/settings',
    ],
    Developer: ['/work', '/requests/1024', '/requests/1026'],
    Executive: ['/dashboard'],
    Admin: ['/admin/projects', '/admin/users'],
    Operator: ['/', '/ops/usage', '/ops/agents', '/ops/pricing', '/ops/budget'],
  } as const

  for (const [role, routes] of Object.entries(EN_ROUTES)) {
    test(`${role} screens fit 320px in English`, async ({ page }) => {
      await loginAsEnglish(page, role as keyof typeof EN_ROUTES)
      for (const route of routes) {
        await openInApp(page, route)
        await settle(page)
        await expectNoHorizontalScroll(page)
      }
    })
  }
})

/**
 * Notices and error states that the walks above never meet: they need a far
 * time zone, an expired session or a failed load. Each must fit the narrowest
 * phone without widening the page or cutting its own text off.
 */
test.describe('small phone: notices and error states', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  /** On screen, inside the viewport's width, and nothing in it cut off sideways. */
  async function expectFits(page: Page, locator: Locator, what: string) {
    await expect(locator, what).toBeVisible()
    const box = (await locator.boundingBox())!
    const width = page.viewportSize()!.width
    expect(box.x, `${what}: left edge`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `${what}: right edge`).toBeLessThanOrEqual(width)
    expect(
      await locator.evaluate((el) => el.scrollWidth - el.clientWidth),
      `${what}: clipped`,
    ).toBeLessThanOrEqual(0)
    await expectNoHorizontalScroll(page)
  }

  test('the demo banner, on the login screen and signed in', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_START_TIMEOUT })
    await expectFits(page, page.locator('p', { hasText: '데모 모드' }), 'login demo notice')
    await loginAs(page, '요청자')
    await expectFits(page, page.getByRole('complementary', { name: '데모 모드' }), 'demo banner')
  })

  test.describe('far from the head office', () => {
    test.use({ timezoneId: 'America/Los_Angeles' })

    test('the time zone settings and a detail screen with both clocks', async ({ page }) => {
      await loginAs(page, '요청자')
      await openInApp(page, '/settings')
      const section = page.getByRole('region', { name: '시간대', exact: true })
      // The preview of both clocks, then the manual picker with its long zone names.
      await expect(section.getByText(/한국 \d{1,2}월/)).toBeVisible()
      await expectFits(page, section, 'time zone section')
      await section.getByRole('radio', { name: /직접 선택/ }).click()
      await section.getByLabel('시간대 찾기').fill('Los Angeles')
      await expect(section.getByRole('combobox', { name: '시간대', exact: true })).toBeVisible()
      await expectFits(page, section, 'time zone section, picking a zone')

      await openInApp(page, '/requests/1017')
      const log = page.locator('ol', { has: page.locator('time') }).last()
      await expect(log.getByText(/한국 \d{1,2}월/).first()).toBeVisible()
      await expectFits(page, log, 'progress log with Korea time')
    })
  })

  test('the session-expired notice on the login screen', async ({ page }) => {
    await loginAs(page, '요청자')
    // The server stops accepting the token: replaced from a static page, where the app is not running.
    await page.goto('/favicon.svg')
    await page.evaluate(() => {
      const key = 'ax-request-portal:session'
      const stored = JSON.parse(localStorage.getItem(key)!) as { state: { token: string } }
      stored.state.token = 'mock-token.no-such-user'
      localStorage.setItem(key, JSON.stringify(stored))
    })
    await page.goto('/requests')
    // The visible notice; screen readers hear the same words from a status message.
    const notice = page.locator('p:not([role="status"])', { hasText: '로그인이 만료됐어요.' })
    await expect(notice).toBeVisible({ timeout: COLD_START_TIMEOUT })
    await expect(page).toHaveURL(
      (url) => url.pathname === '/login' && url.searchParams.get('next') === '/requests',
    )
    await expectFits(page, notice, 'session-expired notice')
  })

  test('a screen whose data failed to load', async ({ page }) => {
    await loginAs(page, '요청자')
    // An answer that breaks the API contract fails the load at once (it is not retried):
    // one request's title is stored as a number, from a static page where the app is not running.
    await page.goto('/favicon.svg')
    await page.evaluate(() => {
      const key = 'ax-request-portal:mock-db'
      const state = JSON.parse(localStorage.getItem(key)!) as {
        requests: Array<{ id: number; title: unknown }>
      }
      state.requests.find((r) => r.id === 1021)!.title = 1021
      localStorage.setItem(key, JSON.stringify(state))
    })
    // Home: the list that holds it fails inside its card (compact).
    await page.goto('/')
    const compact = page.getByRole('status').filter({ hasText: '불러오지 못했어요' })
    await expect(compact.first()).toBeVisible({ timeout: COLD_START_TIMEOUT })
    await expectFits(page, compact.first(), 'compact load error')
    // Its detail screen fails as a whole.
    await openInApp(page, '/requests/1021')
    const full = page.getByRole('alert').filter({ hasText: '불러오지 못했어요' })
    await expectFits(page, full, 'load error screen')
    await expect(full.getByRole('button', { name: '다시 시도' })).toBeVisible()
  })
})
