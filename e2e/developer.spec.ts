import { expect, test } from '@playwright/test'
import { addDaysIso, expectNoHorizontalScroll, loginAs } from './helpers.ts'

test('developer runs AI work from the report and approves the merge request', async ({ page }) => {
  test.setTimeout(90_000)
  await loginAs(page, '담당자')
  await expect(page.getByRole('heading', { name: /내 차례인 요청/ })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/requests/1026')
  await expect(page.getByRole('heading', { name: '구현 확인 보고서' })).toBeVisible()
  await expect(page.getByText('조건부 가능').first()).toBeVisible()
  // What the AI could not confirm, and the project rule the plan breaks
  await expect(page.getByRole('heading', { name: '확인되지 않은 가정' })).toBeVisible()
  await expect(page.getByText('충돌', { exact: true })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.getByRole('button', { name: '작업 수행' }).click()
  const run = page.getByRole('dialog', { name: 'AI에게 작업을 맡길까요?' })
  // Every assumption has to be ticked before the AI may start.
  const start = run.getByRole('button', { name: '작업 수행' })
  await expect(start).toBeDisabled()
  await run.getByRole('checkbox', { name: /앱을 다시 배포하지 않아도/ }).check()
  await expect(start).toBeEnabled()
  await run.getByLabel('담당자 메모').fill('동의 상태는 서버 임시 저장으로 옮겨 주세요.')
  await start.click()
  await expect(page.getByText('AI 작업 중').first()).toBeVisible()
  await expect(page.getByText('AI가 작업하고 있어요')).toBeVisible()

  // The simulated AI takes 20 s; the detail page polls by itself.
  await expect(page.getByRole('button', { name: '승인하고 반영' })).toBeVisible({ timeout: 40_000 })
  await expect(page.getByText(/기존 테스트 \d+\/\d+ 통과/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'MR 열기' })).toHaveAttribute('href', /merge_requests/)

  // Record one regression check and plan the release before approving.
  const regression = page
    .getByRole('group')
    .filter({ has: page.getByRole('button', { name: '통과' }) })
    .first()
  await regression.getByRole('button', { name: '통과' }).click()
  await expect(regression.getByRole('button', { name: '통과' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('배포 예정일').fill(addDaysIso(3))
  await page.getByRole('button', { name: '일정 저장' }).click()
  await expect(page.getByText('배포 예정일을 저장했어요.', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: '승인하고 반영' }).click()
  await expect(page.getByText('확인 요청').first()).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('developer asks the requester the report’s open question', async ({ page }) => {
  await loginAs(page, '담당자')
  await page.goto('/requests/1026')
  await page.getByRole('button', { name: /요청자에게 묻기/ }).click()
  const ask = page.getByRole('dialog', { name: '요청자에게 무엇을 물을까요?' })
  await expect(ask.getByLabel('질문 1')).toHaveValue(/약관 전문 팝업/)
  await ask.getByRole('button', { name: '제출' }).click()
  await expect(page.getByText('추가 정보 필요').first()).toBeVisible()
})

test('developer sends the AI back with a revision note', async ({ page }) => {
  await loginAs(page, '담당자')
  await page.goto('/requests/1024')
  await expect(page.getByText('MR !57')).toBeVisible()
  await expect(page.getByText('기존 테스트 128/128 통과')).toBeVisible()
  await page.getByRole('button', { name: '수정 요청' }).click()
  const sheet = page.getByRole('dialog', { name: 'AI에게 무엇을 고치라고 할까요?' })
  await sheet.getByLabel('수정할 내용').fill('잠금 해제 버튼에 확인 대화상자를 추가해 주세요.')
  await sheet.getByRole('button', { name: '수정 요청' }).click()
  await expect(page.getByText('AI 작업 중').first()).toBeVisible()
  await expect(page.getByText('2번째 시도')).toBeVisible()
})

test('developer marks a scheduled request as released', async ({ page }) => {
  await loginAs(page, '담당자')
  await page.goto('/requests/1019')
  await page.getByRole('button', { name: '배포 완료' }).click()
  await page
    .getByRole('dialog', { name: '실제 서비스에 반영됐나요?' })
    .getByRole('button', { name: '배포 완료' })
    .click()
  await expect(page.getByText('완료', { exact: true }).first()).toBeVisible()
})

test('assigned list and regression queue fit the screen', async ({ page }) => {
  await loginAs(page, '담당자')
  await page.goto('/work')
  await expect(page.getByRole('heading', { level: 1, name: '배정된 요청' })).toBeVisible()
  await expect(page.getByRole('link', { name: /#1024/ })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.getByRole('radio', { name: /요청자 확인 대기/ }).click()
  await expect(page.getByRole('link', { name: /#1021/ })).toBeVisible()

  await page.goto('/work/regression')
  await expect(page.getByRole('heading', { level: 1, name: '회귀 테스트' })).toBeVisible()
  await expect(page.getByRole('link', { name: '로그인 5회 실패 시 안내 문구 추가' })).toBeVisible()
  await expectNoHorizontalScroll(page)
})
