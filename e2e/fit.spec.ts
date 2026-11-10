/**
 * Big screens: a page built from `Page` parts (src/app/page.tsx) fills the
 * window and only its list scrolls, in a region of its own. These set their
 * own viewports, so they run once, in the desktop project.
 */
import { expect, test, type Page } from './fixtures.ts'
import { expectNoHorizontalScroll, loginAs, openInApp } from './helpers.ts'

/** Every screen of the signed-in app, per demo account (each `page()` route is `fit`, src/app/router.tsx). */
const FIT_ROUTES = {
  요청자: [
    '/',
    '/requests/new?project=p-portal&step=1',
    '/requests',
    '/requests/1021',
    '/requests/1028',
    '/schedule',
    '/notifications',
    '/schedule?view=month', // after another screen, as openInApp needs
    '/settings',
  ],
  담당자: ['/', '/work?filter=open', '/work/regression', '/requests/1024', '/notifications'],
  경영진: ['/dashboard'],
  관리자: ['/admin/projects', '/admin/users'],
  운영자: ['/ops/usage', '/ops/agents', '/ops/pricing', '/ops/budget'],
} as const

const FIT_SIZES = [
  { width: 1920, height: 1080 }, // FHD
  { width: 1280, height: 720 }, // the smallest window laid out to fit
]

async function settle(page: Page) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.animate-pulse.bg-line\\/70')).toHaveCount(0)
}

function region(page: Page) {
  return page.locator('[data-scroll-region]').first()
}

/**
 * Left and right content edges of the header, the page's fixed top and its
 * scrolling part. With several columns, the part spans from the first one's
 * left edge to the last one's right edge.
 */
async function contentEdges(page: Page) {
  return page.evaluate(() => {
    const edges = (el: Element) => {
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return [box.left + parseFloat(style.paddingLeft), box.right - parseFloat(style.paddingRight)]
    }
    const top = document.querySelector('[data-page-top] > div')
    const parts = [...document.querySelectorAll('[data-scroll-region] > div')].map(edges)
    return {
      header: edges(document.querySelector('header > div')!),
      top: top ? edges(top) : null,
      list: parts.length ? [Math.min(...parts.map((p) => p[0])), Math.max(...parts.map((p) => p[1]))] : null,
    }
  })
}

for (const size of FIT_SIZES) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size })

    for (const [role, routes] of Object.entries(FIT_ROUTES)) {
      test(`${role}: every screen fits the window and scrolls inside its regions`, async ({ page }) => {
        test.setTimeout(60_000)
        await loginAs(page, role as keyof typeof FIT_ROUTES)
        for (const route of routes) {
          await openInApp(page, route)
          await settle(page)
          const doc = await page.evaluate(() => ({
            scroll: document.documentElement.scrollHeight,
            client: document.documentElement.clientHeight,
          }))
          expect(doc.scroll, `${route}: the window does not scroll`).toBeLessThanOrEqual(doc.client)
          // Each scrolling part is a named region a keyboard can reach.
          const regions = page.locator('[data-scroll-region]')
          expect(await regions.count(), `${route}: scroll regions`).toBeGreaterThan(0)
          for (const r of await regions.all()) {
            await expect(r, route).toHaveAttribute('role', 'region')
            await expect(r, route).toHaveAttribute('tabindex', '0')
            await expect(r, route).toHaveAttribute('aria-label', /\S/)
          }
          await expectNoHorizontalScroll(page)

          // The header, the fixed top and the scrolling part share their edges, scrollbar or not.
          const { header, top, list } = await contentEdges(page)
          for (const [part, value] of Object.entries({ top, list })) {
            if (!value) continue
            expect(value[0], `${route}: ${part} left edge`).toBeCloseTo(header[0], 0)
            expect(value[1], `${route}: ${part} right edge`).toBeCloseTo(header[1], 0)
          }
        }
      })
    }
  })
}

test.describe('scroll positions', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('back returns the list to where it was; a new visit or another filter starts at the top', async ({
    page,
  }) => {
    await loginAs(page, '담당자')
    await openInApp(page, '/notifications')
    await settle(page)
    const list = region(page)
    await list.evaluate((el) => el.scrollTo(0, 1200))
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(1200)
    // The line under the fixed top shows once the list has moved beneath it.
    await expect(list).toHaveAttribute('data-scrolled', '')

    await openInApp(page, '/requests/1024')
    await page.goBack()
    await settle(page)
    await expect.poll(() => region(page).evaluate((el) => el.scrollTop)).toBe(1200)

    await openInApp(page, '/requests/1024')
    await openInApp(page, '/notifications')
    await settle(page)
    await expect.poll(() => region(page).evaluate((el) => el.scrollTop)).toBe(0)
    await expect(region(page)).not.toHaveAttribute('data-scrolled', '')

    await openInApp(page, '/work?filter=closed')
    await settle(page)
    await region(page).evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect.poll(() => region(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await page.getByRole('radio', { name: /진행 중 전체/ }).click()
    await expect(page).toHaveURL(/filter=open/)
    await expect.poll(() => region(page).evaluate((el) => el.scrollTop)).toBe(0)
  })

  test('a keyboard scrolls the list', async ({ page }) => {
    await loginAs(page, '담당자')
    await openInApp(page, '/notifications')
    await settle(page)
    await region(page).focus()
    await page.keyboard.press('PageDown')
    await expect.poll(() => region(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  })

  test('the wizard keeps its place when typing saves the draft and moves ?draft=', async ({ page }) => {
    await loginAs(page, '요청자')
    await openInApp(page, '/requests/new?project=p-portal')
    await page.getByRole('radio', { name: /버그/ }).click() // auto-advances
    await expect(page.getByRole('heading', { name: '어느 화면이나 기능인가요?' })).toBeVisible()
    await page.getByRole('button', { name: '다음' }).click()
    const title = page.getByLabel('요청 제목')
    await expect(title).toBeVisible()
    await expect(page).not.toHaveURL(/draft=/)

    const step = region(page)
    expect(
      await step.evaluate((el) => el.scrollHeight - el.clientHeight),
      'the step scrolls',
    ).toBeGreaterThan(20)
    await step.evaluate((el) => el.scrollTo(0, 20))
    // Type without scrolling the field into view: only the save may move the region, and must not.
    await title.evaluate((el) => (el as HTMLInputElement).focus({ preventScroll: true }))
    await page.keyboard.type('스크롤 위치')
    // The first save gives the form a draft id: a replace with preventScrollReset.
    await expect(page).toHaveURL(/draft=/)
    // Once the save has rendered, the step is still where it was (give or take its notices), not at the top.
    await expect(page.getByText('계정에 저장됨')).toBeVisible()
    expect(await step.evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(20)
  })
})

test.describe('below the fit size', () => {
  // A laptop window too short to fit: the window scrolls as on every other screen.
  test.use({ viewport: { width: 1366, height: 650 } })

  test('the window scrolls and the list is no region of its own', async ({ page }) => {
    await loginAs(page, '담당자')
    await openInApp(page, '/notifications')
    await settle(page)
    const doc = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      client: document.documentElement.clientHeight,
    }))
    expect(doc.scroll).toBeGreaterThan(doc.client)
    await expect(page.getByRole('region', { name: /목록/ })).toHaveCount(0)
    await expect(region(page)).not.toHaveAttribute('tabindex')
  })
})
