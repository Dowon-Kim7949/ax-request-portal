import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, loginAs } from './helpers.ts'

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

test('admin changes a role, adds a project and sets the AI budget', async ({ page }) => {
  await loginAs(page, '관리자')

  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { level: 1, name: '사용자와 역할' })).toBeVisible()
  await expect(page.getByLabel('한운영 역할')).toBeDisabled() // cannot demote yourself
  await page.getByLabel('이영업 역할').selectOption('developer')
  await expect(page.getByText('저장했어요.')).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/admin/projects')
  await page.getByRole('button', { name: '프로젝트 추가' }).click()
  const form = page.getByRole('dialog', { name: '프로젝트 추가' })
  await form.getByLabel('이름', { exact: true }).fill('사내 위키 검색')
  await form.getByLabel('설명').fill('사내 문서를 찾는 검색 화면')
  await form.getByLabel('저장소 주소').fill('https://gitlab.example.com/acme/wiki-search')
  await form.getByRole('button', { name: '정개발' }).click()
  await form.getByRole('textbox', { name: '화면 이름' }).first().fill('검색 결과')
  await form.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('프로젝트를 저장했어요.')).toBeVisible()
  await expect(page.getByText('사내 위키 검색')).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/admin/budget')
  await expect(page.getByRole('meter')).toBeVisible()
  await page.getByLabel('월 한도 (원)').fill('300000')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('한도를 저장했어요.')).toBeVisible()
  await expect(page.getByText(/한도 30만 원 중/)).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('notifications can be read and configured', async ({ page }) => {
  await loginAs(page, '요청자')
  await page.getByRole('link', { name: /^알림 \(\d+\)$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: '알림' })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.getByRole('button', { name: '모두 읽음' }).click()
  await expect(page.getByRole('link', { name: '알림', exact: true })).toBeVisible()

  await page.goto('/settings/notifications')
  const messenger = page.getByRole('switch', { name: /메신저/ })
  await expect(messenger).toHaveAttribute('aria-checked', 'false')
  await messenger.click()
  await expect(messenger).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('알림 설정을 저장했어요.')).toBeVisible()
})
