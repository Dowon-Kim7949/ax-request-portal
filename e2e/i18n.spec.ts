/**
 * English UI end to end: an English browser gets English chrome, English
 * server text and English demo data — with no Korean left on any screen.
 * Labels that are deliberately in another language carry a `lang` attribute
 * (the "한국어" option in the language switch) and are excluded.
 */
import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, loginAsEnglish as signIn } from './helpers.ts'

/** Hangul anywhere on screen, except inside elements marked as another language. */
async function koreanOnScreen(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[lang]:not([lang^="en"]), script, style').forEach((el) => el.remove())
    return clone.innerText.match(/[가-힣][^\n]{0,30}/g) ?? []
  })
}

async function settle(page: Page) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.animate-pulse.bg-line\\/70')).toHaveCount(0)
}

test.describe('English browser', () => {
  test.use({ locale: 'en-US' })

  test('login screen is in English', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1, name: 'AX Request Portal' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('button', { name: /Sign in as Requester/ })).toBeVisible()
    expect(await koreanOnScreen(page)).toEqual([])
    await expectNoHorizontalScroll(page)
  })

  test('every screen of every role is free of Korean', async ({ page }) => {
    test.setTimeout(90_000)
    const plan = {
      Requester: [
        '/',
        '/requests/new?project=p-portal&step=1',
        '/requests',
        '/requests/1021',
        '/requests/1028',
        '/schedule',
        '/notifications',
        '/settings',
      ],
      Developer: ['/work', '/work/regression', '/requests/1024', '/requests/1026'],
      Executive: ['/dashboard'],
      Admin: ['/admin/projects', '/admin/users'],
      Operator: ['/', '/ops/usage', '/ops/agents', '/ops/pricing', '/ops/budget'],
    } as const
    for (const [role, routes] of Object.entries(plan)) {
      await signIn(page, role as keyof typeof plan)
      for (const route of routes) {
        await page.goto(route)
        await settle(page)
        expect(await koreanOnScreen(page), `${role} ${route}`).toEqual([])
        await expectNoHorizontalScroll(page)
      }
    }
  })

  test('a requester files and checks requests in English', async ({ page }) => {
    await signIn(page, 'Requester')
    await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible()

    await page.goto('/requests/new?project=p-portal&step=1')
    await expect(page.getByRole('heading', { name: 'What kind of request is it?' })).toBeVisible()
    await page.getByRole('radio', { name: /Change/ }).click() // auto-advances
    await expect(page.getByRole('heading', { name: 'Which screen or feature?' })).toBeVisible()
    await page.getByRole('button', { name: 'Notices' }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: /What happens now, and/ })).toBeVisible()
    await page.getByLabel('Request title').fill('Search notices by title')
    await page.getByLabel('What happens now').fill('Notices are hard to find')
    await page.getByLabel('What should happen').fill('Make search somehow nicer')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'What does done look like?' })).toBeVisible()
    await page
      .getByLabel('Acceptance criterion 1')
      .fill('When I type a word, only notices with it in the title are shown')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Anything else we should know?' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Ready to submit?' })).toBeVisible()
    // The submission check answers in English too
    await expect(page.getByText(/Words like "somehow"/)).toBeVisible()
    await page.getByRole('button', { name: 'Submit request' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Search notices by title' })).toBeVisible()
    await expect(page.getByText('Under review').first()).toBeVisible()

    await page.goto('/requests/1021')
    await expect(page.getByRole('heading', { name: 'Check the result against each criterion' })).toBeVisible()
    const confirm = page.getByRole('button', { name: 'Everything works' })
    await expect(confirm).toBeDisabled()
    for (const pass of await page.getByRole('button', { name: 'Works', exact: true }).all())
      await pass.click()
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByText('Release scheduled').first()).toBeVisible()
  })
})

test('switching language at runtime changes the UI and untouched demo data', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /요청자로 시작/ }).click()
  await expect(page.getByText('안녕하세요, 김기획님')).toBeVisible()

  await page.goto('/settings')
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  // Nothing was changed yet, so the demo data followed the language.
  await page.goto('/')
  await expect(page.getByText('Hello, Mina Kim')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible()
  expect(await koreanOnScreen(page)).toEqual([])
})

test('edited demo data keeps its language and the settings page says how to reset', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /요청자로 시작/ }).click()
  await expect(page.getByText('안녕하세요, 김기획님')).toBeVisible()
  await page.goto('/requests/1021')
  await expect(page.getByRole('heading', { name: '완료 기준대로 됐는지 확인해 주세요' })).toBeVisible()
  const confirm = page.getByRole('button', { name: '모두 확인했어요' })
  for (const pass of await page.getByRole('button', { name: '됐어요', exact: true }).all()) await pass.click()
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByText('배포 예정').first()).toBeVisible()

  await page.goto('/settings')
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(page.getByText(/Demo data keeps the language it was created in/)).toBeVisible()
  await page.goto('/requests/1021')
  // UI is English, the request someone already worked on stays as written
  await expect(page.getByText('Release scheduled').first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '마이페이지 안내 문구 수정' })).toBeVisible()
})
