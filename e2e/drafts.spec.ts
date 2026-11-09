/**
 * Saved drafts end to end: a draft is saved to the account while it is
 * written, listed on the home screen and the requests page, continued at the
 * step it was left on (on this device or another), deleted from the list, and
 * gone once submitted; signing out deletes what this device keeps of it.
 *
 * The mock API keeps its data (the "server") in the browser's storage, next to
 * what the app keeps on the device. Another device is a new browser context
 * given the server's data and nothing of the device's.
 */
import type { Browser, TestInfo } from '@playwright/test'
import { expect, keepFramesRunning, test, type Page } from './fixtures.ts'
import {
  COLD_START_TIMEOUT,
  expectNoHorizontalScroll,
  expectSignedIn,
  loginAs,
  openInApp,
  signOut,
  viewportOf,
} from './helpers.ts'

const MOCK_DB_PREFIX = 'ax-request-portal:mock-db'
/** What the app keeps of drafts on this device (and the key from before drafts were saved to the account). */
const DEVICE_DRAFT_KEY = /^ax-request-portal:drafts?:/

/**
 * Opens a new request. From another screen: openInApp moves the way the back
 * button does, and the wizard keeps its form for moves like that.
 */
async function startRequest(page: Page, query = '') {
  await openInApp(page, '/')
  await openInApp(page, `/requests/new${query}`)
}

/**
 * Starts a request for the field app and writes its title, then waits until
 * the account has it: a draft at step 4 of 7 ("요청 내용").
 */
async function writeDraft(page: Page, title: string) {
  await startRequest(page, '?project=p-field')
  await page.getByRole('radio', { name: /버그/ }).click() // auto-advances
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('요청 제목').fill(title)
  await expect(page.getByText('계정에 저장됨')).toBeVisible()
}

/** The account's drafts, asked of the mock API directly (as the signed-in person). */
async function accountDrafts(page: Page): Promise<Array<{ id: string; title: string }>> {
  return page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('ax-request-portal:session') ?? '{}') as {
      state?: { token?: string }
    }
    const response = await fetch('/api/drafts', {
      headers: { Authorization: `Bearer ${session.state?.token ?? ''}` },
    })
    return (await response.json()) as Array<{ id: string; title: string }>
  })
}

/** Keys this device holds drafts under. */
const deviceDraftKeys = (page: Page) =>
  page.evaluate(
    (pattern) => Object.keys(localStorage).filter((k) => new RegExp(pattern).test(k)),
    DEVICE_DRAFT_KEY.source,
  )

/** The saved drafts on the requests page, and one of them by its title. */
const draftsList = (page: Page) => page.locator('#drafts')
const draftRow = (page: Page, title: string) =>
  draftsList(page).getByRole('listitem').filter({ hasText: title })

/** Another device: same viewport and settings, the server's data, nothing of this device's. */
async function otherDevice(browser: Browser, page: Page, info: TestInfo, browserName: string) {
  const state = await page.context().storageState()
  const origins = state.origins.map((origin) => ({
    ...origin,
    localStorage: origin.localStorage.filter((item) => item.name.startsWith(MOCK_DB_PREFIX)),
  }))
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId, baseURL } =
    info.project.use
  const context = await browser.newContext({
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    locale,
    timezoneId,
    baseURL,
    storageState: { cookies: [], origins },
  })
  await keepFramesRunning(context, browserName)
  return context
}

test('a draft saved while it is written is listed on home and my requests, and continues where it was left', async ({
  page,
}) => {
  await loginAs(page, '요청자')
  await writeDraft(page, '사진이 가끔 안 올라감')

  // Home: the latest drafts, and the way to all of them.
  await openInApp(page, '/')
  const home = page.getByRole('region', { name: '임시 저장' })
  const homeRow = home.getByRole('listitem').filter({ hasText: '사진이 가끔 안 올라감' })
  await expect(homeRow).toContainText('4/7')
  await expect(homeRow).toContainText('요청 내용')
  await expect(homeRow).toContainText('현장 작업자 앱')
  await expect(homeRow).not.toContainText('이 기기에만')
  await expectNoHorizontalScroll(page)
  await home.getByRole('link', { name: '임시 저장함 전체 보기' }).click()

  // My requests, scrolled to the drafts.
  await expect(page).toHaveURL(/\/requests#drafts$/)
  await expect(draftsList(page)).toBeInViewport()
  await expect(draftsList(page).getByText('1/20')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await draftRow(page, '사진이 가끔 안 올라감')
    .getByRole('link', { name: /이어 쓰기/ })
    .click()

  // The same step and words.
  await expect(page.getByRole('heading', { name: /지금은 어떻고/ })).toBeVisible()
  await expect(page.getByLabel('요청 제목')).toHaveValue('사진이 가끔 안 올라감')
  await expect(page.getByText('계정에 저장됨')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('step')).toBe('3')

  // A new request points to the drafts there are to continue.
  await startRequest(page)
  await page.getByRole('link', { name: /임시 저장된 초안 1개/ }).click()
  await expect(page).toHaveURL(/\/requests#drafts$/)
  await expect(draftsList(page)).toBeInViewport()
})

test('another device signed in to the same account lists the draft and continues it', async ({
  page,
  browser,
  browserName,
}, info) => {
  await loginAs(page, '요청자')
  await writeDraft(page, '다른 기기에서 이어 쓸 초안')

  const context = await otherDevice(browser, page, info, browserName)
  try {
    const other = await context.newPage()
    await loginAs(other, '요청자')
    await openInApp(other, '/requests')
    const row = draftRow(other, '다른 기기에서 이어 쓸 초안')
    await expect(row).toBeVisible()
    await expect(row).not.toContainText('이 기기에만')
    await row.getByRole('link', { name: /이어 쓰기/ }).click()
    await expect(other.getByLabel('요청 제목')).toHaveValue('다른 기기에서 이어 쓸 초안', {
      timeout: COLD_START_TIMEOUT,
    })
    await expect(other.getByText('계정에 저장됨')).toBeVisible()
    await expectNoHorizontalScroll(other)
  } finally {
    await context.close()
  }
})

test('signing out deletes the drafts kept on this device, after asking about the unsent ones; the account keeps its own', async ({
  page,
}, info) => {
  await loginAs(page, '요청자')
  await writeDraft(page, '계정에 저장된 초안')

  // The connection drops: the next draft stays on this device.
  await page.evaluate(() => {
    const send = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      if (/\/api\/drafts/.test(url) && method !== 'GET')
        return Promise.reject(new TypeError('Failed to fetch'))
      return send(input, init)
    }
  })
  await startRequest(page, '?project=p-portal')
  await page.getByRole('radio', { name: /기존 기능 변경/ }).click() // auto-advances
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('요청 제목').fill('이 기기에만 있는 초안')
  // The line under the progress bar (a live region repeats it for screen readers).
  await expect(page.locator('span', { hasText: /^이 기기에만 저장됨 · 연결되면 올려요$/ })).toBeVisible()

  await openInApp(page, '/requests')
  await expect(draftRow(page, '이 기기에만 있는 초안')).toContainText('이 기기에만')
  await expect(draftRow(page, '계정에 저장된 초안')).not.toContainText('이 기기에만')
  expect(await deviceDraftKeys(page)).not.toEqual([])

  await signOut(page, viewportOf(info))
  const confirm = page.getByRole('dialog', { name: '로그아웃할까요?' })
  await expect(confirm).toContainText('이 기기에만 저장된 초안 1개')
  await confirm.getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL(/\/login/)
  expect(await deviceDraftKeys(page)).toEqual([])

  await page.getByRole('button', { name: /요청자로 시작/ }).click()
  await expectSignedIn(page)
  await openInApp(page, '/requests')
  await expect(draftRow(page, '계정에 저장된 초안')).toBeVisible()
  await expect(draftsList(page).getByText('이 기기에만 있는 초안')).toHaveCount(0)
})

test('a draft is deleted from the list after asking', async ({ page }) => {
  await loginAs(page, '요청자')
  await writeDraft(page, '남길 초안')
  await writeDraft(page, '지울 초안')
  await openInApp(page, '/requests')

  await draftsList(page).getByRole('button', { name: '지울 초안 삭제' }).click()
  const dialog = page.getByRole('dialog', { name: '이 초안을 삭제할까요?' })
  await expect(dialog).toContainText('지울 초안')
  await expect(dialog).toContainText('이 기기와 계정에서 모두 지워지고 되돌릴 수 없어요.')
  await dialog.getByRole('button', { name: '삭제' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('초안을 삭제했어요.')).toBeVisible()
  await expect(draftRow(page, '지울 초안')).toHaveCount(0)
  await expect(draftRow(page, '남길 초안')).toBeVisible()
  // Its row is gone; focus stays in the section.
  await expect(draftsList(page).getByRole('heading', { name: '임시 저장' })).toBeFocused()
  expect((await accountDrafts(page)).map((d) => d.title)).toEqual(['남길 초안'])
})

test('a submitted draft leaves the list', async ({ page }) => {
  await loginAs(page, '요청자')
  await writeDraft(page, '제출할 초안')
  await openInApp(page, '/requests')
  await draftRow(page, '제출할 초안')
    .getByRole('link', { name: /이어 쓰기/ })
    .click()

  await page.getByLabel('원하는 동작').fill('사진이 한 번에 올라갔으면 한다')
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('완료 기준 1').fill('사진을 올리면 목록에 바로 보인다')
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: /마지막으로/ })).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: '이대로 제출할까요?' })).toBeVisible()
  await page.getByRole('button', { name: '요청 제출' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '제출할 초안' })).toBeVisible()

  await openInApp(page, '/requests')
  await expect(page.getByRole('link', { name: /제출할 초안/ })).toBeVisible()
  await expect(draftsList(page)).toHaveCount(0)
  expect(await accountDrafts(page)).toEqual([])
})

test.describe('small phone', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test('the drafts fit 320px, with a long title and the notice on a new request', async ({ page }, info) => {
    // The width is all that matters: once, in the desktop project (as layout.spec.ts).
    test.skip(viewportOf(info) !== 'desktop', '320px is checked in the desktop project')
    await loginAs(page, '요청자')
    const long = '현장에서 사진을 여러 장 한꺼번에 올리면 가끔 마지막 사진만 빠진 채로 올라가는 문제'
    await writeDraft(page, long)
    for (const path of ['/', '/requests']) {
      await openInApp(page, path)
      const row = page.getByRole('listitem').filter({ hasText: '현장에서 사진을' })
      await expect(row).toBeVisible()
      await expectNoHorizontalScroll(page)
      const box = (await row.boundingBox())!
      expect(box.x + box.width, `${path}: right edge`).toBeLessThanOrEqual(320)
      // Both actions stay full touch targets.
      for (const action of [row.getByRole('link', { name: /이어 쓰기/ }), row.getByRole('button')]) {
        const size = (await action.boundingBox())!
        expect(size.height, `${path}: touch target`).toBeGreaterThanOrEqual(44)
      }
    }
    await startRequest(page)
    await expect(page.getByRole('link', { name: /임시 저장된 초안 1개/ })).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

test.describe('interaction states', () => {
  test('pointer, focus ring, and a busy, locked sheet while deleting', async ({ page }, info) => {
    // Mouse cursors: desktop only (touch screens have none).
    test.skip(viewportOf(info) !== 'desktop', 'cursors are checked in the desktop project')
    await loginAs(page, '요청자')
    for (const n of [1, 2, 3, 4]) await writeDraft(page, `초안 ${n}`)
    await openInApp(page, '/requests')
    const list = draftsList(page)
    await expect(list.getByRole('listitem')).toHaveCount(3)

    const cursor = (el: Element) => getComputedStyle(el).cursor
    const continueLink = draftRow(page, '초안 4').getByRole('link', { name: /이어 쓰기/ })
    const deleteButton = list.getByRole('button', { name: '초안 4 삭제' })
    const more = list.getByRole('button', { name: '4개 모두 보기' })
    for (const target of [continueLink, deleteButton, more])
      expect(await target.evaluate(cursor)).toBe('pointer')

    // Showing all, and back.
    await more.click()
    await expect(list.getByRole('listitem')).toHaveCount(4)
    await expect(list.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true')

    // A keyboard user sees where focus is.
    await continueLink.focus()
    await page.keyboard.press('Tab')
    await expect(deleteButton).toBeFocused()
    const ring = await deleteButton.evaluate((el) => {
      const style = getComputedStyle(el)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(ring).toEqual({ style: 'solid', width: '2px' })

    // Deleting takes a moment: the sheet says it is busy and cannot be dismissed meanwhile.
    await page.evaluate(() => {
      const send = window.fetch.bind(window)
      window.fetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input)
        if (/\/api\/drafts\//.test(url) && init?.method === 'DELETE') {
          await new Promise((resolve) => setTimeout(resolve, 1_500))
        }
        return send(input, init)
      }
    })
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '이 초안을 삭제할까요?' })
    const confirm = dialog.getByRole('button', { name: '삭제' })
    const cancel = dialog.getByRole('button', { name: '취소' })
    for (const target of [confirm, cancel]) expect(await target.evaluate(cursor)).toBe('pointer')
    await confirm.click()
    await expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(await confirm.evaluate(cursor)).toBe('progress')
    await expect(cancel).toBeDisabled()
    expect(await cancel.evaluate(cursor)).toBe('not-allowed')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(draftRow(page, '초안 4')).toHaveCount(0)
  })
})

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark' })

  test('the drafts take the dark colours', async ({ page }) => {
    await loginAs(page, '요청자')
    await writeDraft(page, '어두운 화면의 초안')
    await openInApp(page, '/requests')
    const row = draftRow(page, '어두운 화면의 초안')
    await expect(row).toBeVisible()
    /** Relative luminance of a computed `rgb(…)` colour (0 black – 1 white). */
    const luminance = (el: Element, prop: string) => {
      const read = (node: Element) => getComputedStyle(node)[prop as 'color' | 'backgroundColor']
      let node: Element | null = el
      let value = read(el)
      // A transparent background shows its container's.
      while (prop === 'backgroundColor' && node && /rgba\(0, 0, 0, 0\)|transparent/.test(value)) {
        node = node.parentElement
        value = node ? read(node) : value
      }
      const [r, g, b] = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map((c) => {
        const s = Number(c) / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    await expect(page.locator('html')).toHaveClass(/(^| )dark( |$)/)
    expect(await row.evaluate(luminance, 'backgroundColor')).toBeLessThan(0.1)
    expect(await row.locator('p').first().evaluate(luminance, 'color')).toBeGreaterThan(0.6)
    await expectNoHorizontalScroll(page)
  })
})
