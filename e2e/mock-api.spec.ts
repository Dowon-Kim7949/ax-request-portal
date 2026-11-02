import { expect, test } from '@playwright/test'

test('the in-browser mock API answers contract calls', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const result = await page.evaluate(async () => {
    const login = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'planner@example.com', password: 'demo' }),
    })
    const session = (await login.json()) as { token: string }
    const list = await fetch('/api/requests?scope=mine', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    const requests = (await list.json()) as unknown[]
    return { login: login.status, list: list.status, count: requests.length }
  })

  expect(result.login).toBe(200)
  expect(result.list).toBe(200)
  expect(result.count).toBeGreaterThan(0)
})
