/**
 * Time zones: timestamps follow the device's time zone, and detail screens add
 * head-office (Korea) time when the clock differs. Date-only values (desired
 * dates, release dates) are calendar dates and read the same everywhere.
 */
import { expect, keepFramesRunning, test, type Page } from './fixtures.ts'
import { expectNoHorizontalScroll, loginAs } from './helpers.ts'

/** "한국 11월 5일 오전 11:00" */
const HQ_TIME = /한국 \d{1,2}월 \d{1,2}일 (오전|오후) \d{1,2}:\d{2}/
const PACIFIC = /\((PST|PDT)\)/

/** #1017: the requester's, with a desired date and a long progress log. */
const DETAIL = '/requests/1017'

async function openDetail(page: Page) {
  await loginAs(page, '요청자')
  await page.goto(DETAIL)
  await expect(page.getByRole('heading', { name: '진행 기록' })).toBeVisible()
  // The progress log has rendered its times.
  await expect(page.locator('ol time').first()).toBeVisible()
}

const desiredDate = (page: Page) =>
  page.locator('dt', { hasText: '희망 일정' }).locator('xpath=following-sibling::dd[1]')

test.describe('viewer in Los Angeles', () => {
  test.use({ timezoneId: 'America/Los_Angeles' })

  test('detail screens show local time with Korea time next to it', async ({ page }) => {
    await openDetail(page)
    await expect(page.locator('ol').getByText(PACIFIC).first()).toBeVisible()
    await expect(page.locator('ol').getByText(HQ_TIME).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('turning off head-office time in Settings removes it', async ({ page }) => {
    await loginAs(page, '요청자')
    await page.goto('/settings')
    const section = page.getByRole('region', { name: '시간대', exact: true })
    await expect(section.getByRole('radio', { name: /자동/ })).toHaveAttribute('aria-checked', 'true')
    await expect(section.getByText('America/Los_Angeles', { exact: false }).first()).toBeVisible()
    // The preview shows both clocks until head-office time is turned off.
    await expect(section.getByText(HQ_TIME)).toBeVisible()
    const toggle = section.getByRole('switch', { name: /본사 시각 함께 보기/ })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(section.getByText(HQ_TIME)).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await page.goto(DETAIL)
    await expect(page.locator('ol time').first()).toBeVisible()
    await expect(page.locator('ol').getByText(PACIFIC).first()).toBeVisible()
    await expect(page.getByText(HQ_TIME)).toHaveCount(0)
  })

  test('a time zone picked in Settings wins over the device', async ({ page }) => {
    await loginAs(page, '요청자')
    await page.goto('/settings')
    const section = page.getByRole('region', { name: '시간대', exact: true })
    await section.getByRole('radio', { name: /직접 선택/ }).click()
    await section.getByLabel('시간대 찾기').fill('Seoul')
    await section.getByRole('combobox', { name: '시간대', exact: true }).selectOption('Asia/Seoul')
    await expect(section.getByText(/본사와 시각이 같아서/)).toBeVisible()
    await expect(section.getByText(HQ_TIME)).toHaveCount(0)

    await page.goto(DETAIL)
    await expect(page.locator('ol time').first()).toBeVisible()
    await expect(page.getByText(PACIFIC)).toHaveCount(0)
    await expect(page.getByText(HQ_TIME)).toHaveCount(0)
  })
})

test.describe('viewer in Seoul', () => {
  test.use({ timezoneId: 'Asia/Seoul' })

  test('sees times as before, with nothing added', async ({ page }) => {
    await openDetail(page)
    await expect(page.getByText(HQ_TIME)).toHaveCount(0)
    await expect(page.getByText(/\((GMT|UTC)[+-]?\d*\)/)).toHaveCount(0)
  })
})

test('date-only values read the same date in Seoul and in Los Angeles', async ({
  browser,
  browserName,
}, testInfo) => {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, colorScheme } =
    testInfo.project.use
  const dates: string[] = []
  for (const timezoneId of ['Asia/Seoul', 'America/Los_Angeles']) {
    const context = await browser.newContext({
      baseURL,
      viewport,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      locale,
      colorScheme,
      timezoneId,
    })
    await keepFramesRunning(context, browserName)
    const page = await context.newPage()
    await openDetail(page)
    await expect(desiredDate(page)).toHaveText(/\d{1,2}월 \d{1,2}일/)
    dates.push((await desiredDate(page).innerText()).trim())
    await context.close()
  }
  expect(dates[1]).toBe(dates[0])
})
