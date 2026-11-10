import { expect, type Page, type TestInfo } from '@playwright/test'

export type Viewport = 'phone' | 'tablet' | 'desktop'

export function viewportOf(info: TestInfo): Viewport {
  return info.project.name as Viewport
}

/**
 * How long a full page load may take to show its first screen. In a new
 * browser context it includes installing the mock's service worker, and the
 * app itself gives its mock 8 s to start before it reloads
 * (MOCK_START_TIMEOUT_MS in src/main.tsx): a test should not give up sooner.
 */
export const COLD_START_TIMEOUT = 10_000

/**
 * Opens the login screen, signed out. The session is dropped from a static
 * file of the same origin, where the app is not running: inside the app a
 * /me response still in flight would save the session again.
 */
async function openLoginScreen(page: Page, brandName: string) {
  await page.goto('/favicon.svg')
  await page.evaluate(() => localStorage.removeItem('ax-request-portal:session'))
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: brandName })).toBeVisible({
    timeout: COLD_START_TIMEOUT,
  })
}

/**
 * Waits until the app has left the login screen for good. Signing in moves on
 * twice (the sign-in call's success, and the screen's own redirect once it
 * sees the session), and the URL changes before the screen does: a move made
 * in between (openInApp) can be overtaken by the second one. Once the login
 * form has gone, both have been made.
 */
export async function expectSignedIn(page: Page) {
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
}

/** Signs in through the demo buttons on the login screen (mock mode). */
export async function loginAs(page: Page, role: '요청자' | '경영진' | '담당자' | '관리자' | '운영자') {
  await openLoginScreen(page, 'AX 업무 요청')
  await page.getByRole('button', { name: new RegExp(`${role}로 시작`) }).click()
  await expectSignedIn(page)
}

/** Signs out through the account menu (tablet, desktop) or the "more" sheet (phone). */
export async function signOut(page: Page, viewport: Viewport) {
  if (viewport === 'phone') {
    await page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('button', { name: '더보기' }).click()
    await page.getByRole('dialog', { name: '더보기' }).getByRole('button', { name: '로그아웃' }).click()
  } else {
    await page.getByRole('button', { name: '내 계정' }).click()
    await page.getByRole('button', { name: '로그아웃' }).click()
  }
}

/**
 * Hands the browser to another role the way a person would: sign out (which
 * lands on /login without `next`) and start again from a demo button.
 */
export async function switchRole(page: Page, viewport: Viewport, role: Parameters<typeof loginAs>[1]) {
  await signOut(page, viewport)
  await expect(page).toHaveURL((url) => url.pathname === '/login' && url.search === '')
  await page.getByRole('button', { name: new RegExp(`${role}로 시작`) }).click()
  await expectSignedIn(page)
}

/** Same as loginAs, for a browser whose language is English. */
export async function loginAsEnglish(
  page: Page,
  role: 'Requester' | 'Executive' | 'Developer' | 'Admin' | 'Operator',
) {
  await openLoginScreen(page, 'AX Request Portal')
  await page.getByRole('button', { name: new RegExp(`Sign in as ${role}`) }).click()
  await expectSignedIn(page)
}

/**
 * Opens `path` inside the running app, as a link would: no page load.
 *
 * page.goto loads the page again, which starts the app and its mock API from
 * scratch (the mock's code, its data from storage, the service worker
 * handshake, then the session and the screen's data). In WebKit under a
 * parallel run that start alone takes 2–4 s before a screen shows its
 * heading, so a walk through many screens with page.goto spent its 5 s
 * expectations on start-ups and failed now and then. Keep page.goto where the
 * start itself is under test.
 *
 * The router is moved the way the browser's back and forward buttons move it
 * (a history entry plus `popstate`, with the state shape React Router writes).
 * It keeps the old screen up while the new one's code loads, so this returns
 * once the old screen's main heading has gone: what the caller checks next is
 * the new screen. For that the old screen must have its heading first (it
 * could otherwise appear after the move). Two visits in a row to the same
 * screen with its data cached would keep the heading and time out here, loudly.
 */
export async function openInApp(page: Page, path: string) {
  const target = new URL(path, page.url())
  const here = new URL(page.url())
  if (target.pathname === here.pathname && target.search === here.search) return
  await expect(page.locator('h1').first()).toBeVisible()
  await page.evaluate((to) => {
    document.querySelector('h1')?.setAttribute('data-e2e-leaving', '')
    const idx = ((window.history.state as { idx?: number } | null)?.idx ?? 0) + 1
    window.history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx }, '', to)
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  }, path)
  await expect(page.locator('h1[data-e2e-leaving]')).toHaveCount(0)
}

/** Local YYYY-MM-DD `days` from today (what <input type="date"> expects). */
export function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Fails when the page scrolls sideways — the most common phone layout bug —
 * or when a page's own scroll region does (on a big screen a list scrolls
 * inside one, where the page's width would not show it).
 */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ...[...document.querySelectorAll('[data-scroll-region]')].map((el) => el.scrollWidth - el.clientWidth),
    ),
  )
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
}

/** Titles of the saved drafts `seedSavedDrafts` makes, per UI language. */
export const SEEDED_DRAFTS = {
  ko: {
    untitled: '제목 없는 초안',
    conflict: '공지사항 검색 추가',
    conflictHere: '공지사항 검색 추가 (제목 검색만)',
    long: '마이페이지에서 결제 수단을 바꾸면 확인 메일이 두 번 오는 문제를 고쳐 주세요',
    field: '사진이 가끔 안 올라감',
    offline: '출장 중에 쓴 초안',
  },
  en: {
    untitled: 'Untitled draft',
    conflict: 'Search notices',
    conflictHere: 'Search notices (titles only)',
    long: 'Changing the payment method on My page sends the confirmation email twice, please fix it',
    field: 'Photos sometimes fail to upload',
    offline: 'Written on a business trip',
  },
} as const

type SeededTitles = (typeof SEEDED_DRAFTS)[keyof typeof SEEDED_DRAFTS]

/**
 * From the next page load on, saving the draft titled `title` fails as it
 * would without a connection: it stays a draft on this device only.
 */
export async function keepDraftOffline(page: Page, title: string) {
  await page.addInitScript((offline) => {
    const send = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const body = typeof init?.body === 'string' ? init.body : ''
      if (body.includes(JSON.stringify(offline))) return Promise.reject(new TypeError('Failed to fetch'))
      return send(input, init)
    }
  }, title)
}

/**
 * Saved drafts as an account accumulates them: four in the account (one
 * untitled, one with a long title), plus on this device newer words over one
 * of them that was saved elsewhere since (a conflict) and a draft the account
 * does not have (sent on the next load; see `keepDraftOffline`). Call signed
 * in, then load the page again.
 */
export async function seedSavedDrafts(page: Page, titles: SeededTitles = SEEDED_DRAFTS.ko) {
  await page.evaluate(async (t) => {
    const session = JSON.parse(localStorage.getItem('ax-request-portal:session') ?? '{}') as {
      state?: { token?: string; user?: { id: string } }
    }
    const post = async (step: number, content: object) => {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.state?.token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step, content }),
      })
      return (await response.json()) as { id: string; version: number }
    }
    await post(1, { projectId: 'p-admin' })
    const conflicted = await post(4, { projectId: 'p-portal', type: 'change', title: t.conflict })
    await post(3, { projectId: 'p-portal', type: 'change', title: t.long })
    await post(3, { projectId: 'p-field', type: 'bug', title: t.field })
    const values = (title: string, projectId: string) => ({
      projectId,
      type: 'change',
      targetIds: [],
      targetOther: '',
      title,
      currentBehavior: '',
      desiredBehavior: '',
      acceptanceCriteria: [{ text: '' }],
      checklistSource: '',
      checklist: [],
      outOfScope: '',
      attachments: [],
      desiredDate: '',
      desiredDateReason: '',
    })
    const updatedAt = new Date().toISOString()
    localStorage.setItem(
      `ax-request-portal:drafts:${session.state?.user?.id ?? ''}`,
      JSON.stringify({
        v: 1,
        entries: {
          [conflicted.id]: {
            localId: conflicted.id,
            draftId: conflicted.id,
            baseVersion: conflicted.version,
            step: 4,
            content: values(t.conflictHere, 'p-portal'),
            updatedAt,
            dirty: true,
            conflict: true,
          },
          'local-seeded': {
            localId: 'local-seeded',
            step: 2,
            content: values(t.offline, 'p-field'),
            updatedAt,
            dirty: true,
          },
        },
        aliases: {},
      }),
    )
  }, titles)
}
