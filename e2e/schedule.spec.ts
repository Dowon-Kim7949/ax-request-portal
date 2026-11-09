import { expect, test } from './fixtures.ts'
import { expectNoHorizontalScroll, loginAs, openInApp, viewportOf } from './helpers.ts'

/** The template's head-office time zone (`organization.timeZone` in src/config/app.config.ts). */
const HQ_TIME_ZONE = 'Asia/Seoul'

/** The head office's YYYY-MM-DD `days` from now: the seed's release dates and the calendar follow it. */
function hqDate(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HQ_TIME_ZONE }).format(Date.now() + days * 86_400_000)
}

/** YYYY-MM → "2026년 11월", the calendar's name */
function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}

test('the release schedule shows a month at a time on a tablet or a desktop, and stays a list on a phone', async ({
  page,
}, info) => {
  await loginAs(page, '요청자')

  if (viewportOf(info) === 'phone') {
    // A link to the month, sent from a desktop, still opens the list, with no way to switch.
    await openInApp(page, '/schedule?view=month')
    await expect(page.getByRole('heading', { name: '이번 주' })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('radiogroup', { name: '보기' })).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    return
  }

  await openInApp(page, '/schedule')
  await expect(page.getByRole('heading', { level: 1, name: '배포 일정' })).toBeVisible()

  await page.getByRole('radiogroup', { name: '보기' }).getByRole('radio', { name: '월' }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('view') === 'month')
  const thisMonth = hqDate(0).slice(0, 7)
  await expect(page.getByRole('table', { name: monthName(thisMonth) })).toBeVisible()
  await expect(page.getByRole('button', { name: '이번 달' })).toBeDisabled()
  await expectNoHorizontalScroll(page)

  // #1019 ships the head office's tomorrow, which may fall in the next month.
  const releaseMonth = hqDate(1).slice(0, 7)
  if (releaseMonth !== thisMonth) await page.getByRole('button', { name: '다음 달' }).click()
  const calendar = page.getByRole('table', { name: monthName(releaseMonth) })
  const release = calendar.getByRole('link', { name: /^#1019 / })
  await expect(release).toBeVisible()

  await release.click()
  await expect(page).toHaveURL(/\/requests\/1019$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Back returns to the same month, not to the list.
  await page.goBack()
  await expect(calendar).toBeVisible()

  await page.getByRole('button', { name: '다음 달' }).click()
  await expect(page).toHaveURL((url) => url.searchParams.has('month'))
  await page.getByRole('button', { name: '이번 달' }).click()
  await expect(page.getByRole('table', { name: monthName(thisMonth) })).toBeVisible()
  await expect(page).toHaveURL((url) => !url.searchParams.has('month'))

  await page.getByRole('radio', { name: '목록' }).click()
  await expect(page.getByRole('heading', { name: '이번 주' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})
