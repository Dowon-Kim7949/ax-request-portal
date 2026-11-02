import { expect, test } from '@playwright/test'

/**
 * Regression: a reload during the very first load used to leave a blank page
 * on WebKit (the mock service worker registration was rejected and nothing
 * rendered). The app now retries and, at worst, shows a retry screen.
 */
test('an interrupted first load still ends on a usable screen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/login', { waitUntil: 'commit' })
  // The app may recover by reloading itself, which interrupts this navigation.
  // That is the behaviour under test, so only the end state is asserted.
  await page.goto('/login', { waitUntil: 'commit' }).catch((err: unknown) => {
    if (!/interrupted/i.test(String(err))) throw err
  })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
  expect(errors.filter((m) => !/Service Worker|mockServiceWorker|access control/i.test(m))).toEqual([])
})
