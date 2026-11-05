import { expect, test } from './fixtures.ts'
import { loginAs, viewportOf } from './helpers.ts'

test('a skip link is the first tab stop and moves focus to the main content', async ({ page }, info) => {
  // WebKit does not tab to links unless the user turns that on, so the phone
  // and tablet projects (WebKit) cannot exercise a keyboard-only path.
  test.skip(viewportOf(info) !== 'desktop', 'keyboard navigation runs on the desktop project')
  await loginAs(page, '요청자')
  await expect(page.getByRole('heading', { name: '어떤 일을 도와드릴까요?' })).toBeVisible()

  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: '본문으로 건너뛰기' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()

  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
  await expect(page).not.toHaveURL(/#main/)
})

test('animations and transitions finish at once when reduced motion is requested', async ({ page }) => {
  await loginAs(page, '요청자')
  await expect(page.getByRole('heading', { name: '어떤 일을 도와드릴까요?' })).toBeVisible()
  await expect(page.getByRole('link', { name: /#1021/ })).toBeVisible()

  // How many elements would visibly move: any transition or animation longer than 1 ms.
  const moving = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('*')].filter((el) => {
          const s = getComputedStyle(el)
          const longest = (v: string) =>
            Math.max(...v.split(',').map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 0.001 : 1)))
          return longest(s.transitionDuration) > 0.001 || longest(s.animationDuration) > 0.001
        }).length,
    )

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(await moving()).toBeGreaterThan(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await moving()).toBe(0)
})
