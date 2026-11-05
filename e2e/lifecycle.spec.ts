/**
 * One request from intake to release, handed between the requester and the
 * developer in one browser the way people do it: sign out (to /login, no
 * `next`) and start again as the other role. The role specs cover each step
 * on seeded requests; this one checks that the steps connect.
 *
 * The mock's AI is real time: the report takes 6 s and the work 20 s
 * (appConfig.mock), and the detail page polls until they finish.
 */
import { expect, test, type Page } from './fixtures.ts'
import {
  addDaysIso,
  expectNoHorizontalScroll,
  loginAs,
  openInApp,
  switchRole,
  viewportOf,
} from './helpers.ts'

const TITLE = '공지사항 첨부파일 미리보기'

/** Opens the request from a list by its title (no deep link: the lists must lead there). */
async function openFromList(page: Page, path: string) {
  await openInApp(page, path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: new RegExp(TITLE) }).click()
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
}

test('a request goes from intake to release', async ({ page }, info) => {
  test.setTimeout(150_000)
  const viewport = viewportOf(info)

  // Requester: files the request through the wizard.
  await loginAs(page, '요청자')
  await openInApp(page, '/requests/new?project=p-portal')
  await page.getByRole('radio', { name: /기존 기능 변경/ }).click() // auto-advances
  await page.getByRole('button', { name: '공지사항' }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('요청 제목').fill(TITLE)
  await page.getByLabel('지금 동작').fill('첨부파일을 내려받아야만 내용을 볼 수 있다')
  await page.getByLabel('원하는 동작').fill('PDF 첨부파일을 공지 화면에서 바로 미리 본다')
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('완료 기준 1').fill('PDF 첨부파일을 누르면 내려받지 않고 공지 화면 안에서 열린다')
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: /마지막으로/ })).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: '이대로 제출할까요?' })).toBeVisible()
  await page.getByRole('button', { name: '요청 제출' }).click()
  await expect(page).toHaveURL(/\/requests\/\d+$/)
  const path = new URL(page.url()).pathname
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()

  // The AI writes the report and its reading of the request; the requester confirms the scope.
  const scope = page.getByRole('heading', { name: '이렇게 진행해도 될까요?' })
  await expect(scope).toBeVisible({ timeout: 20_000 })
  await page.getByRole('radio', { name: /아니요, 요청한 화면만/ }).check()
  await page.getByRole('button', { name: '이대로 진행해 주세요' }).click()
  await expect(page.getByRole('heading', { name: '요청자가 확인한 진행 범위' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  // Developer: finds it in the assigned list, reads the report and lets the AI work.
  await switchRole(page, viewport, '담당자')
  await openFromList(page, '/work')
  await expect(page.getByRole('heading', { name: '구현 확인 보고서' })).toBeVisible()
  await page.getByRole('button', { name: '작업 수행' }).click()
  const run = page.getByRole('dialog', { name: 'AI에게 작업을 맡길까요?' })
  await expect(run).toBeVisible()
  // Every assumption the report made has to be confirmed before the AI may start.
  for (const assumption of await run.getByRole('checkbox').all()) await assumption.check()
  await run.getByRole('button', { name: '작업 수행' }).click()
  await expect(page.getByText('AI가 작업하고 있어요')).toBeVisible()

  // The AI opens a merge request; the developer approves it.
  const approve = page.getByRole('button', { name: '승인하고 반영' })
  await expect(approve).toBeVisible({ timeout: 40_000 })
  await expect(page.getByRole('link', { name: 'MR 열기' })).toHaveAttribute('href', /merge_requests/)
  await expectNoHorizontalScroll(page)
  await approve.click()
  await expect(page.getByText('반영했어요. 요청자에게 결과 확인을 요청했어요.')).toBeVisible()
  await expect(approve).toBeHidden()

  // Requester: checks the result against the acceptance criteria.
  await switchRole(page, viewport, '요청자')
  await openFromList(page, '/requests')
  await expect(page.getByRole('heading', { name: '완료 기준대로 됐는지 확인해 주세요' })).toBeVisible()
  for (const pass of await page.getByRole('button', { name: '됐어요' }).all()) await pass.click()
  await expect(page.getByText('1/1 확인')).toBeVisible()
  await page.getByRole('button', { name: '모두 확인했어요' }).click()
  await expect(page.getByText('확인이 끝났어요. 배포 날짜가 되면 실제 서비스에 반영돼요.')).toBeVisible()

  // Developer: plans the release date, then marks it released.
  await switchRole(page, viewport, '담당자')
  await openInApp(page, path)
  const released = page.getByRole('button', { name: '배포 완료' })
  await expect(released).toBeDisabled() // not before a date is planned
  await page.getByLabel('배포 예정일').fill(addDaysIso(3))
  await page.getByRole('button', { name: '일정 저장' }).click()
  await expect(page.getByText('배포 예정일을 저장했어요.', { exact: false })).toBeVisible()
  await released.click()
  await page
    .getByRole('dialog', { name: '실제 서비스에 반영됐나요?' })
    .getByRole('button', { name: '배포 완료' })
    .click()
  await expect(page.getByText('배포 완료로 기록했어요.')).toBeVisible()
  await expect(released).toBeHidden() // done: nothing left to release
  await expectNoHorizontalScroll(page)

  // The requester sees it done.
  await switchRole(page, viewport, '요청자')
  await openInApp(page, path)
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
  await expect(page.getByText('실제 서비스에 반영됐어요.')).toBeVisible()
})
