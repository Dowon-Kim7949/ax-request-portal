import { expect, test } from './fixtures.ts'
import { expectNoHorizontalScroll, loginAs, openInApp } from './helpers.ts'

test('executive reads the company dashboard', async ({ page }) => {
  await loginAs(page, '경영진')
  await page.getByRole('link', { name: '회사 전체 현황 보기' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '전체 현황' })).toBeVisible()
  await expect(page.getByText('이번 달 접수')).toBeVisible()
  await expect(page.getByRole('heading', { name: '프로젝트별 현황' })).toBeVisible()
  await expect(page.getByRole('img', { name: /고객 포털 웹 진행 중/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '#1017' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.getByRole('button', { name: '이전 달' }).click()
  await expect(page.getByRole('button', { name: '다음 달' })).toBeEnabled()
})

test('admin changes a role and adds a project', async ({ page }) => {
  await loginAs(page, '관리자')

  await openInApp(page, '/admin/users')
  await expect(page.getByRole('heading', { level: 1, name: '사용자와 역할' })).toBeVisible()
  await expect(page.getByLabel('한운영 역할')).toBeDisabled() // cannot demote yourself
  await page.getByLabel('이영업 역할').selectOption('developer')
  await expect(page.getByText('저장했어요.')).toBeVisible()
  await expectNoHorizontalScroll(page)

  // Teams: add one, move someone into it, rename it; the person follows the new name.
  await page.getByRole('button', { name: '팀 관리' }).click()
  const teams = page.getByRole('dialog', { name: '팀' })
  await teams.getByLabel('새 팀 이름').fill('AX 추진팀')
  await teams.getByRole('button', { name: '팀 추가' }).click()
  await expect(page.getByText('팀을 추가했어요.')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByLabel('이영업 팀').selectOption({ label: 'AX 추진팀' })
  await expect(page.getByText('sales@example.com · AX 추진팀')).toBeVisible()
  await page.getByRole('button', { name: '팀 관리' }).click()
  await teams.getByLabel('팀 이름: AX 추진팀').fill('AX 혁신팀')
  await teams.getByRole('button', { name: 'AX 추진팀 이름 저장' }).click()
  await expect(page.getByText('팀 이름을 바꿨어요.')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.keyboard.press('Escape')
  await expect(page.getByText('sales@example.com · AX 혁신팀')).toBeVisible()

  await openInApp(page, '/admin/projects')
  await page.getByRole('button', { name: '프로젝트 추가' }).click()
  const form = page.getByRole('dialog', { name: '프로젝트 추가' })
  await form.getByLabel('이름', { exact: true }).fill('사내 위키 검색')
  await form.getByLabel('설명').fill('사내 문서를 찾는 검색 화면')
  await form.getByLabel('저장소 주소').fill('https://gitlab.example.com/acme/wiki-search')
  await form.getByRole('button', { name: '정개발' }).click()
  await form.getByRole('textbox', { name: '화면 이름' }).first().fill('검색 결과')
  await form.getByRole('button', { name: '제약 추가' }).click()
  await form.getByRole('textbox', { name: '제약', exact: true }).fill('검색 기록은 30일 뒤 지운다')
  await form.getByRole('textbox', { name: '근거', exact: true }).fill('개인정보 처리 지침 7조')
  await form.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('프로젝트를 저장했어요.')).toBeVisible()
  await expect(page.getByText('사내 위키 검색')).toBeVisible()
  await expectNoHorizontalScroll(page)

  // The AI side of the service is the operator's: no budget menu, and operator rows are locked.
  await expect(page.getByRole('link', { name: 'AI 비용 한도' })).toHaveCount(0)
  await openInApp(page, '/admin/users')
  await expect(page.getByLabel('윤시스템 역할')).toBeDisabled()
  await expect(page.getByText('운영자 계정은 서비스가 관리해요.')).toBeVisible()
  await expect(page.getByLabel('이영업 역할').locator('option[value="operator"]')).toHaveCount(0)
})

test('notifications can be read and configured', async ({ page }) => {
  await loginAs(page, '요청자')
  await page.getByRole('link', { name: /^알림 \(\d+\)$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: '알림' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.getByRole('button', { name: '모두 읽음' }).click()
  await expect(page.getByRole('link', { name: '알림', exact: true })).toBeVisible()

  // The old address still works: notification settings now live on the settings page.
  await openInApp(page, '/settings/notifications')
  await expect(page).toHaveURL(/\/settings$/)
  const messenger = page.getByRole('switch', { name: /메신저/ })
  await expect(messenger).toHaveAttribute('aria-checked', 'false')
  await messenger.click()
  await expect(messenger).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('알림 설정을 저장했어요.')).toBeVisible()
})

test("executive files a request and reads it among their own, besides reading everyone else's", async ({
  page,
}) => {
  // An executive holds the requester's permissions as well (DEFAULT_ROLE_PERMISSIONS).
  await loginAs(page, '경영진')
  await expect(page.getByRole('link', { name: '새 요청' }).first()).toBeVisible()
  // A developer's queue is not theirs: the menu leaves it out, and the address refuses.
  await expect(page.getByRole('link', { name: '배정된 요청' })).toHaveCount(0)

  await openInApp(page, '/requests/new?project=p-portal')
  await page.getByRole('radio', { name: /기존 기능 변경/ }).click() // auto-advances
  await expect(page.getByRole('heading', { name: '어느 화면이나 기능인가요?' })).toBeVisible()
  await page.getByRole('button', { name: '공지사항' }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: /지금은 어떻고/ })).toBeVisible()
  await page.getByLabel('요청 제목').fill('공지 게시 승인 단계 추가')
  await page.getByLabel('지금 동작').fill('공지가 작성 즉시 게시된다')
  await page.getByLabel('원하는 동작').fill('팀장이 승인한 공지만 게시된다')
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: '무엇이 되면 완료인가요?' })).toBeVisible()
  await page.getByLabel('완료 기준 1').fill('승인 전 공지는 목록에 보이지 않는다')
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: /마지막으로/ })).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { name: '이대로 제출할까요?' })).toBeVisible()
  await page.getByRole('button', { name: '요청 제출' }).click()

  await expect(page).toHaveURL(/\/requests\/\d+$/)
  await expect(page.getByRole('heading', { level: 1, name: '공지 게시 승인 단계 추가' })).toBeVisible()
  await expect(page.getByText('요청자 박대표')).toBeVisible()

  await openInApp(page, '/requests')
  await expect(page.getByRole('link', { name: /공지 게시 승인 단계 추가/ })).toBeVisible()

  // Everyone's requests are open to them (request:read:all): one another person filed.
  await openInApp(page, '/requests/1021')
  await expect(page.getByRole('heading', { level: 1, name: '마이페이지 안내 문구 수정' })).toBeVisible()
  await expect(page.getByText('요청자 김기획')).toBeVisible()

  await openInApp(page, '/work')
  await expect(page.getByText('이 작업을 할 권한이 없어요.')).toBeVisible()
  await expectNoHorizontalScroll(page)
})
