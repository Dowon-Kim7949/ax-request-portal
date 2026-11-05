/**
 * The app under the production Content-Security-Policy. `vite preview` sends
 * the policy of deploy/nginx.conf (see previewCsp in vite.config.ts), so every
 * spec runs under it; this one walks through the screens of each role and
 * fails on any violation the browser reports, whether or not it breaks a
 * visible feature (a blocked font, image or inline style).
 */
import { expect, test, type Page } from '@playwright/test'
import { loginAs } from './helpers.ts'

declare global {
  interface Window {
    __cspViolations?: string[]
  }
}

/** CSP reports in the console, collected per test. */
let fromConsole: string[] = []

/** Records violations from the start of every document, including ones before the app runs. */
test.beforeEach(async ({ page }) => {
  fromConsole = []
  page.on('console', (message) => {
    if (/content[- ]security[- ]policy/i.test(message.text())) fromConsole.push(message.text())
  })
  await page.addInitScript(() => {
    window.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations?.push(`${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`)
    })
  })
})

test.afterEach(() => {
  expect(fromConsole).toEqual([])
})

/** Violations reported in the current document so far. */
const violations = (page: Page) => page.evaluate(() => window.__cspViolations ?? [])

/**
 * Opens `path` (a full load, so the app starts again under the policy) and
 * waits for its main heading, then checks the document reported nothing.
 */
async function visit(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path)
  // A cold start of the app and its mock API: allow for a slow, busy machine.
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 10_000 })
  expect(await violations(page), path).toEqual([])
}

test('the policy is sent, and the requester screens keep to it', async ({ page }) => {
  const response = await page.goto('/login')
  expect(response?.headers()['content-security-policy']).toMatch(/script-src 'self' 'sha256-/)
  // Let the app finish starting (the mock's first service worker install) before leaving the page.
  await expect(page.getByRole('heading', { level: 1, name: 'AX 업무 요청' })).toBeVisible({
    timeout: 10_000,
  })
  expect(await violations(page)).toEqual([])

  await loginAs(page, '요청자')
  expect(await violations(page)).toEqual([])
  await visit(page, '/requests/new?project=p-portal', '어떤 종류의 요청인가요?')
  // Preview screenshots and attachments: images from data: and blob: URLs.
  await visit(page, '/requests/1024', /.+/)
  await expect(page.getByRole('img', { name: /바뀐 화면 미리보기/ })).toBeVisible()
  expect(await violations(page)).toEqual([])
  await visit(page, '/schedule', '배포 일정')
  await visit(page, '/settings', '설정')
})

test('the operator screens keep to the policy', async ({ page }) => {
  await loginAs(page, '운영자')
  expect(await violations(page)).toEqual([])
  await visit(page, '/ops/usage', 'AI 사용량')
  await visit(page, '/ops/agents', 'AI 에이전트')
})

test('the executive screens keep to the policy', async ({ page }) => {
  await loginAs(page, '경영진')
  expect(await violations(page)).toEqual([])
  await visit(page, '/dashboard', '전체 현황')
  await visit(page, '/notifications', '알림')
})
