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

test('the tablet rail opens its menu as a dialog that keeps focus until it closes', async ({
  page,
}, info) => {
  test.skip(viewportOf(info) !== 'desktop', 'keyboard navigation runs on the desktop project')
  // A landscape tablet: an icon rail, whose full menu opens over the page.
  await page.setViewportSize({ width: 1080, height: 810 })
  await loginAs(page, '관리자')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  const expand = page.getByRole('button', { name: '메뉴 펼치기' })
  const menu = page.getByRole('dialog', { name: '주 메뉴' })
  const focusInMenu = () => menu.evaluate((el) => el.contains(document.activeElement))

  // Opening moves focus into the menu, and Tab and Shift+Tab stay there.
  await expand.click()
  await expect(menu).toBeVisible()
  await expect.poll(focusInMenu).toBe(true)
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    expect(await focusInMenu(), `Tab ${i + 1}`).toBe(true)
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await focusInMenu(), `Shift+Tab ${i + 1}`).toBe(true)
  }

  // Escape closes it and gives focus back to the button that opened it.
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(expand).toBeFocused()

  // A click on the dimmed page closes it too, and so does following a link.
  await expand.click()
  await expect(menu).toBeVisible()
  // Radix starts listening for outside clicks a tick after opening (so the opening click does not
  // close it): a click in that tick is ignored, so try again.
  await expect(async () => {
    await page.mouse.click(1000, 400)
    await expect(menu).toBeHidden({ timeout: 500 })
  }).toPass()
  await expand.click()
  await menu.getByRole('link', { name: '사용자와 역할' }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: '사용자와 역할' })).toBeVisible()
})
