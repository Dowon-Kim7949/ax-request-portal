import { expect, test } from './fixtures.ts'
import { expectNoHorizontalScroll, loginAs, openInApp } from './helpers.ts'

test('operator connects a provider, picks models, edits prices and reads usage', async ({ page }) => {
  test.setTimeout(90_000)
  await loginAs(page, '운영자')
  await expect(page.getByRole('heading', { name: 'AI 운영' })).toBeVisible()
  await expect(page.getByRole('meter')).toBeVisible()
  await expectNoHorizontalScroll(page)

  // A key is write-only: only its last four characters come back.
  await openInApp(page, '/ops/agents')
  await expect(page.getByRole('heading', { level: 1, name: 'AI 에이전트' })).toBeVisible()
  await page.getByRole('button', { name: 'Anthropic 키 바꾸기' }).click()
  const keySheet = page.getByRole('dialog', { name: 'Anthropic API 키' })
  await keySheet.getByLabel('API 키').fill('short')
  await keySheet.getByRole('button', { name: '저장' }).click()
  await expect(keySheet.getByText('8자 이상이어야 해요.')).toBeVisible()
  await keySheet.getByLabel('API 키').fill('sk-ant-test-0000-9z8y')
  await keySheet.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('키를 저장했어요.')).toBeVisible()
  await expect(page.getByText(/키 ••••9z8y/)).toBeVisible()
  await expect(page.getByText('sk-ant-test-0000-9z8y')).toHaveCount(0)

  // Reports move to GPT. Saving stays off, with the reason shown, until something changes.
  const save = page.getByRole('button', { name: '저장', exact: true })
  await expect(save).toBeDisabled()
  await expect(page.getByText('저장된 설정과 같아요.')).toBeVisible()
  await page.getByLabel('구현 확인 보고서', { exact: true }).selectOption({ label: 'GPT-6.1 Sol' })
  await expect(page.getByText('저장하지 않은 변경이 있어요.')).toBeVisible()
  await save.click()
  await expect(page.getByText('저장했어요. 다음 AI 호출부터 적용돼요.')).toBeVisible()

  // A provider still in use cannot be disconnected.
  await page.getByRole('button', { name: 'OpenAI 연결 끊기' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '연결 끊기' }).click()
  await expect(page.getByText(/연결을 끊을 수 없습니다/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expectNoHorizontalScroll(page)

  // Prices: a model in use cannot be removed; a new rate applies from now on.
  await openInApp(page, '/ops/pricing')
  await expect(page.getByRole('button', { name: 'Claude Opus 5.5 빼기' })).toBeDisabled()
  await page.getByLabel('환율 (원/달러)').fill('1500')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('단가표를 저장했어요.')).toBeVisible()
  await expectNoHorizontalScroll(page)

  // Usage: Claude next to GPT, a daily chart with a table behind it, the new rate.
  await openInApp(page, '/ops/usage')
  await expect(page.getByRole('heading', { level: 1, name: 'AI 사용량' })).toBeVisible()
  await expect(page.getByText('1,500원/달러')).toBeVisible()
  await expect(page.getByRole('img', { name: /^Claude \d+%, GPT \d+%$/ })).toBeVisible()
  await page.getByText('표로 보기').click()
  await expect(page.getByRole('columnheader', { name: 'Claude' })).toBeVisible()
  // Who spent it: each team as booked, each person by name beside their team.
  await expect(page.getByRole('region', { name: '팀별' }).getByText('기획팀')).toBeVisible()
  await expect(page.getByRole('region', { name: '사람별' }).getByText('김기획')).toBeVisible()
  await expectNoHorizontalScroll(page)

  // The budget moved from the admin screens; the old address still leads to it.
  await openInApp(page, '/admin/budget')
  await expect(page).toHaveURL(/\/ops\/budget$/)
  await expect(page.getByRole('meter')).toBeVisible()
  await page.getByLabel('월 한도 (원)').fill('300000')
  await page.getByLabel('요청 1건 한도 (원)').fill('1')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('한도를 저장했어요.')).toBeVisible()
  await expect(page.getByText(/한도 30만 원 중/)).toBeVisible()
  await expectNoHorizontalScroll(page)

  // The developer sees what the request cost and why the run button is off.
  await loginAs(page, '담당자')
  await openInApp(page, '/requests/1026')
  await expect(page.getByRole('heading', { name: 'AI 사용량' })).toBeVisible()
  await expect(page.getByText('Claude Opus 5.5').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '작업 수행' })).toBeDisabled()
  await expect(page.getByText(/요청당 한도\(1원\)에 닿아/)).toBeVisible()
  await expectNoHorizontalScroll(page)
})
