import { expect, test, type Page } from './fixtures.ts'
import { loginAs } from './helpers.ts'

const VERSION_FILE = '**/version.json*'
const SCHEDULE_CHUNK = /\/assets\/schedule-page-[^/]+\.js$/

/**
 * Answers a request whatever the mock's service worker does with it: Chromium
 * shows a request the worker passes on only to context routes, a request it
 * leaves alone only to page routes. WebKit shows neither (hence the skip below).
 */
async function intercept(page: Page, url: string | RegExp, answer: Parameters<Page['route']>[1]) {
  await page.route(url, answer)
  await page.context().route(url, answer)
}

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'WebKit cannot route requests that pass through a service worker')
})

/** Pretends a newer build has been deployed since the page was loaded. */
async function deployNewBuild(page: Page) {
  await intercept(page, VERSION_FILE, (route) => route.fulfill({ json: { buildId: 'newer-build' } }))
}

/** What the browser fires when someone comes back to the tab; resolves once the check has its answer. */
async function returnToTab(page: Page) {
  const checked = page.waitForResponse((res) => new URL(res.url()).pathname.endsWith('/version.json'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await checked
}

test('a new deployment is announced, and the reload button loads it', async ({ page }) => {
  await loginAs(page, '요청자')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // The build this page runs is the deployed one: nothing to announce.
  await returnToTab(page)
  await expect(page.getByText('새 버전이 나왔어요')).toHaveCount(0)

  await deployNewBuild(page)
  await returnToTab(page)
  await expect(page.getByText('새 버전이 나왔어요')).toBeVisible()

  await page.unroute(VERSION_FILE)
  await page.context().unroute(VERSION_FILE)
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '새로고침' }).click()])
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('새 버전이 나왔어요')).toHaveCount(0)
})

test('a screen whose code was replaced by a deployment explains why it failed', async ({ page }) => {
  // After a deployment the old hashed chunk files are gone. Gone from the start: the shell
  // preloads the menu's pages once the first screen is up, and must not get this one.
  await intercept(page, SCHEDULE_CHUNK, (route) => route.fulfill({ status: 404 }))
  await loginAs(page, '요청자')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await deployNewBuild(page)
  await page.getByRole('link', { name: '배포 일정' }).click()

  await expect(page.getByText('새 버전이 나왔어요')).toBeVisible()
  await expect(page.getByRole('button', { name: '새로고침' })).toBeVisible()
})
