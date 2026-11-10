/**
 * Big screens: a page built from `Page` parts (src/app/page.tsx) fills the
 * window and only its list scrolls, in a region of its own. These set their
 * own viewports, so they run once, in the desktop project.
 */
import { expect, test, type Page } from './fixtures.ts'
import { expectNoHorizontalScroll, loginAs, openInApp } from './helpers.ts'

/** Routes laid out to fit, per demo account (`fit: true` in src/app/router.tsx). */
const FIT_ROUTES = {
  담당자: ['/work?filter=open', '/notifications'],
  요청자: ['/notifications'],
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
  return page.locator('[data-scroll-region]')
}

/** Left and right content edges of the header, the page's fixed top and its list. */
async function contentEdges(page: Page) {
  return page.evaluate(() => {
    const edges = (el: Element | null) => {
      if (!el) return null
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return [box.left + parseFloat(style.paddingLeft), box.right - parseFloat(style.paddingRight)]
    }
    return {
      header: edges(document.querySelector('header > div')),
      top: edges(document.querySelector('[data-page-top] > div')),
      list: edges(document.querySelector('[data-scroll-region] > div')),
    }
  })
}

for (const size of FIT_SIZES) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size })

    for (const [role, routes] of Object.entries(FIT_ROUTES)) {
      test(`${role}: the page fits the window and its list scrolls on its own`, async ({ page }) => {
        await loginAs(page, role as keyof typeof FIT_ROUTES)
        for (const route of routes) {
          await openInApp(page, route)
          await settle(page)
          const doc = await page.evaluate(() => ({
            scroll: document.documentElement.scrollHeight,
            client: document.documentElement.clientHeight,
          }))
          expect(doc.scroll, `${route}: the window does not scroll`).toBeLessThanOrEqual(doc.client)
          await expect(page.getByRole('region', { name: /목록/ })).toHaveAttribute('tabindex', '0')
          await expectNoHorizontalScroll(page)

          // The header, the fixed top and the list share their edges, scrollbar or not.
          const { header, top, list } = await contentEdges(page)
          for (const [part, value] of Object.entries({ top, list })) {
            expect(value?.[0], `${route}: ${part} left edge`).toBeCloseTo(header![0], 0)
            expect(value?.[1], `${route}: ${part} right edge`).toBeCloseTo(header![1], 0)
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
