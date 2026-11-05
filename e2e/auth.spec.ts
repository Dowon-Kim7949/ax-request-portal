import { expect, test, type Page } from '@playwright/test'
import { loginAs, viewportOf, type Viewport } from './helpers.ts'

const FORBIDDEN = '이 작업을 할 권한이 없어요.'
const REQUESTER_HOME = '어떤 일을 도와드릴까요?'

/** Opens `path` signed out (the session is dropped from a static file, as in helpers.ts). */
async function openSignedOut(page: Page, path: string) {
  await page.goto('/favicon.svg')
  await page.evaluate(() => localStorage.removeItem('ax-request-portal:session'))
  await page.goto(path)
}

async function startAsRequester(page: Page) {
  await page.getByRole('button', { name: /요청자로 시작/ }).click()
}

/** Signs out through the account menu (tablet, desktop) or the "more" sheet (phone). */
async function signOut(page: Page, viewport: Viewport) {
  if (viewport === 'phone') {
    await page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('button', { name: '더보기' }).click()
    await page.getByRole('dialog', { name: '더보기' }).getByRole('button', { name: '로그아웃' }).click()
  } else {
    await page.getByRole('button', { name: '내 계정' }).click()
    await page.getByRole('button', { name: '로그아웃' }).click()
  }
}

test('signing out of an admin page and in as a requester starts at home', async ({ page }, info) => {
  await loginAs(page, '관리자')
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { level: 1, name: '사용자와 역할' })).toBeVisible()

  await signOut(page, viewportOf(info))
  // A sign-out on purpose does not carry the page into the next sign-in.
  await expect(page).toHaveURL((url) => url.pathname === '/login' && url.search === '')

  await startAsRequester(page)
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await expect(page.getByRole('heading', { name: REQUESTER_HOME })).toBeVisible()
  await expect(page.getByText(FORBIDDEN)).toHaveCount(0)
})

test('a deep link opened signed out returns there after signing in', async ({ page }) => {
  await openSignedOut(page, '/schedule')
  await expect(page).toHaveURL(
    (url) => url.pathname === '/login' && url.searchParams.get('next') === '/schedule',
  )

  await startAsRequester(page)
  await expect(page).toHaveURL((url) => url.pathname === '/schedule')
  await expect(page.getByRole('heading', { level: 1, name: '배포 일정' })).toBeVisible()
})

test('a next the new user may not open lands on home instead of "not allowed"', async ({ page }) => {
  await openSignedOut(page, `/login?next=${encodeURIComponent('/admin/users')}`)

  await startAsRequester(page)
  await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '')
  await expect(page.getByRole('heading', { name: REQUESTER_HOME })).toBeVisible()
  await expect(page.getByText(FORBIDDEN)).toHaveCount(0)
})

test('a signed-in visit to /login?next=/login goes home once, without a loop', async ({ page }) => {
  await loginAs(page, '요청자')
  let navigations = 0
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations++
  })

  await page.goto(`/login?next=${encodeURIComponent('/login')}`)
  await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '')
  await expect(page.getByRole('heading', { name: REQUESTER_HOME })).toBeVisible()
  // The load itself plus one redirect; a loop would keep replacing the URL.
  expect(navigations).toBeLessThanOrEqual(3)
})
