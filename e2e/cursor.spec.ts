/**
 * Cursor contract (mouse users): everything that does something on click shows
 * a pointer, disabled controls show not-allowed, busy ones show progress.
 * Checks the computed style of every visible interactive element, so a new
 * button that forgets it fails here. Desktop only: touch screens have no cursor.
 */
import { expect, test, type Page } from '@playwright/test'
import { COLD_START_TIMEOUT, loginAs, openInApp } from './helpers.ts'

async function expectCursorContract(page: Page, where: string) {
  // With a sheet open the page behind it leaves the accessibility tree, so wait on the dialog instead.
  const dialog = page.getByRole('dialog')
  if (await dialog.count()) await expect(dialog).toBeVisible()
  else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.animate-pulse.bg-line\\/70')).toHaveCount(0)
  const offenders = await page.evaluate(() => {
    const interactive = [
      'button',
      'a[href]',
      'select',
      'summary',
      '[role="button"]',
      '[role="switch"]',
      '[role="radio"]',
      '[role="tab"]',
      'label[for]',
    ].join(',')
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(interactive)) {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue
      // A label only acts like a button when it opens a hidden control (the file picker).
      if (el instanceof HTMLLabelElement) {
        const target = el.htmlFor ? document.getElementById(el.htmlFor) : null
        if (!(target instanceof HTMLInputElement) || target.type !== 'file') continue
      }
      const expected = el.matches('[aria-busy="true"]')
        ? 'progress'
        : el.matches(':disabled, [aria-disabled="true"]')
          ? 'not-allowed'
          : 'pointer'
      const actual = getComputedStyle(el).cursor
      if (actual !== expected) {
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)
        out.push(`<${el.tagName.toLowerCase()}> "${name}" cursor=${actual}, expected ${expected}`)
      }
    }
    return out
  })
  expect(offenders, where).toEqual([])
}

test('login screen', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_START_TIMEOUT })
  await expectCursorContract(page, '/login')
})

test('requester screens', async ({ page }) => {
  await loginAs(page, '요청자')
  for (const route of [
    '/',
    '/requests/new?project=p-portal&step=1',
    '/requests',
    '/requests/1021',
    '/requests/1028',
    '/requests/1029',
    '/schedule',
    '/notifications',
    '/settings',
  ]) {
    await openInApp(page, route)
    await expectCursorContract(page, route)
  }
  // Inside the account menu, and with a disabled button on screen (confirm needs every criterion).
  await openInApp(page, '/requests/1021')
  await expect(page.getByRole('button', { name: '모두 확인했어요' })).toBeDisabled()
  await page.getByRole('button', { name: '내 계정' }).click()
  await expectCursorContract(page, 'account menu + disabled confirm')
})

test('developer screens and sheets', async ({ page }) => {
  await loginAs(page, '담당자')
  for (const route of ['/work', '/work/regression', '/requests/1024', '/requests/1026']) {
    await openInApp(page, route)
    await expectCursorContract(page, route)
  }
  await page.getByRole('button', { name: '작업 수행' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectCursorContract(page, 'run-work sheet')
})

test('executive, admin and operator screens', async ({ page }) => {
  await loginAs(page, '경영진')
  await openInApp(page, '/dashboard')
  await expectCursorContract(page, '/dashboard')

  await loginAs(page, '관리자')
  for (const route of ['/admin/projects', '/admin/users']) {
    await openInApp(page, route)
    await expectCursorContract(page, route)
  }
  await openInApp(page, '/admin/projects')
  await page.getByRole('button', { name: '프로젝트 추가' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectCursorContract(page, 'project sheet')

  await loginAs(page, '운영자')
  for (const route of ['/', '/ops/usage', '/ops/agents', '/ops/pricing', '/ops/budget']) {
    await openInApp(page, route)
    await expectCursorContract(page, route)
  }
  await openInApp(page, '/ops/usage')
  await page.getByText('표로 보기').click()
  await expectCursorContract(page, 'usage table view')
  await openInApp(page, '/ops/agents')
  await page.getByRole('button', { name: 'Anthropic 키 바꾸기' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectCursorContract(page, 'provider key sheet')
})
