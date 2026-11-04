import { expect, test } from '@playwright/test'
import { loginAs } from './helpers.ts'

test('the in-browser mock API answers contract calls', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const result = await page.evaluate(async () => {
    const login = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'planner@example.com', password: 'demo' }),
    })
    const session = (await login.json()) as { token: string }
    const list = await fetch('/api/requests?scope=mine', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    const requests = (await list.json()) as unknown[]
    return { login: login.status, list: list.status, count: requests.length }
  })

  expect(result.login).toBe(200)
  expect(result.list).toBe(200)
  expect(result.count).toBeGreaterThan(0)
})

/**
 * Regression: browsers stop an idle service worker (Chrome after about 30 s;
 * a background tab throttles MSW's keep-alive timer). The restarted worker no
 * longer knew this page and sent its API calls to the network, where GitHub
 * Pages answers 404, so every screen showed an error until a reload.
 */
test('API calls still reach the mock after its service worker restarts', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'stopping a service worker needs the Chrome DevTools Protocol')
  await loginAs(page, '요청자')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('ServiceWorker.enable')
  await cdp.send('ServiceWorker.stopAllWorkers')

  // A screen whose data is not cached yet, opened without a reload.
  await page.getByRole('link', { name: '배포 일정' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '배포 일정' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible()
  await expect(page.getByText('문제가 생겼습니다')).toHaveCount(0)
})
