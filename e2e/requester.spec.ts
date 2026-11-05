import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, loginAs, openInApp } from './helpers.ts'

test('requester files a request through the wizard', async ({ page }) => {
  await loginAs(page, '요청자')

  // Start from the service list on the home screen: the project is preselected.
  await page
    .getByRole('region', { name: '어느 서비스에 대한 요청인가요?' })
    .getByRole('link', { name: /고객 포털 웹/ })
    .click()
  await expect(page.getByRole('heading', { name: '어떤 종류의 요청인가요?' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.getByRole('radio', { name: /기존 기능 변경/ }).click() // auto-advances
  await expect(page.getByRole('heading', { name: '어느 화면이나 기능인가요?' })).toBeVisible()
  await page.getByRole('button', { name: '공지사항' }).click()
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: /지금은 어떻고/ })).toBeVisible()
  // Validation keeps the user on the step
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByText('제목을 2자 이상 적어 주세요.')).toBeVisible()
  await page.getByLabel('요청 제목').fill('공지사항 검색 추가')
  await page.getByLabel('지금 동작').fill('공지가 많아 원하는 공지를 찾기 어렵다')
  await page.getByLabel('원하는 동작').fill('제목으로 공지를 검색하고 싶다')
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '무엇이 되면 완료인가요?' })).toBeVisible()
  await page.getByLabel('완료 기준 1').fill('검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다')
  await page.getByRole('button', { name: '기준 추가' }).click()
  await page.getByLabel('완료 기준 2').fill('깔끔하게')
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: /마지막으로/ })).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()

  // Review: the submission check flags the vague criterion but does not block
  await expect(page.getByRole('heading', { name: '이대로 제출할까요?' })).toBeVisible()
  await expect(page.getByText(/확인해 보면 좋은 점 \d+개/)).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.getByRole('button', { name: '요청 제출' }).click()

  await expect(page).toHaveURL(/\/requests\/\d+$/)
  await expect(page.getByRole('heading', { level: 1, name: '공지사항 검색 추가' })).toBeVisible()
  await expect(page.getByText('검토 중').first()).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('wizard draft survives a reload', async ({ page }) => {
  await loginAs(page, '요청자')
  await openInApp(page, '/requests/new?project=p-field')
  await page.getByRole('radio', { name: /버그/ }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('요청 제목').fill('사진이 가끔 안 올라감')
  await expect(page.getByLabel('요청 제목')).toHaveValue('사진이 가끔 안 올라감')
  await page.reload()
  await expect(page.getByText('작성 중이던 요청서를 불러왔어요.')).toBeVisible()
  await expect(page.getByLabel('요청 제목')).toHaveValue('사진이 가끔 안 올라감')
})

test('requester checks the result against the acceptance criteria', async ({ page }) => {
  await loginAs(page, '요청자')
  await openInApp(page, '/requests/1021')
  await expect(page.getByRole('heading', { name: '완료 기준대로 됐는지 확인해 주세요' })).toBeVisible()

  const confirm = page.getByRole('button', { name: '모두 확인했어요' })
  await expect(confirm).toBeDisabled()
  for (const pass of await page.getByRole('button', { name: '됐어요' }).all()) await pass.click()
  await expect(page.getByText('2/2 확인')).toBeVisible()
  await expect(confirm).toBeEnabled()
  await expectNoHorizontalScroll(page)
  await confirm.click()

  await expect(page.getByText('배포 예정').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '완료 기준대로 됐는지 확인해 주세요' })).toBeHidden()
})

test('requester answers the developer’s questions', async ({ page }) => {
  // #1022 belongs to the sales requester, who is not a demo button: sign in with the form.
  await page.goto('/login')
  await page.getByLabel('이메일').fill('sales@example.com')
  await page.getByLabel('비밀번호').fill('demo')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await openInApp(page, '/requests/1022')
  await expect(page.getByRole('heading', { name: '담당자가 물어본 것' })).toBeVisible()
  await page.getByLabel('답변').fill('월간 매출 리포트입니다. 3초 안에 열리면 충분합니다.')
  await page.getByRole('button', { name: '답변 보내기' }).click()
  await expect(page.getByText('요청자 답변')).toBeVisible()
})

test('requester reacts to the preview before the change goes in', async ({ page }) => {
  await loginAs(page, '요청자')
  await openInApp(page, '/requests/1024')
  await expect(page.getByRole('heading', { name: '바뀐 화면 미리 보기' })).toBeVisible()
  await expect(page.getByRole('img', { name: /바뀐 화면 미리보기/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '미리보기 열기' })).toHaveAttribute(
    'href',
    /preview\.example\.com/,
  )
  await expectNoHorizontalScroll(page)

  await page.getByRole('button', { name: '바꿔 주세요' }).click()
  const send = page.getByRole('button', { name: '의견 보내기' })
  await expect(send).toBeDisabled()
  await page.getByLabel('무엇을 바꿀까요?').fill('안내 문구를 빨간색으로 보여 주세요.')
  await send.click()
  await expect(page.getByText('보낸 의견')).toBeVisible()
  await expect(page.getByText('안내 문구를 빨간색으로 보여 주세요.').first()).toBeVisible()
})

test('requester confirms how the AI read the request', async ({ page }) => {
  await loginAs(page, '요청자')
  await openInApp(page, '/requests/1028')
  await expect(page.getByRole('heading', { name: '이렇게 진행해도 될까요?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '이번에 바꾸지 않는 것' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  // Going ahead without the choices points at what is missing instead of a dead button.
  await page.getByRole('button', { name: '이대로 진행해 주세요' }).click()
  await expect(page.getByRole('alert')).toHaveText('골라야 할 항목이 2개 남았어요.')
  await expect(page.getByRole('radio').first()).toBeFocused()

  await page.getByRole('radio', { name: '목록에 없는 새 화면이에요' }).check()
  await page.getByRole('radio', { name: /아니요, 요청한 화면만/ }).check()
  await page.getByLabel('덧붙일 말').fill('배너는 다음 달에 따로 요청할게요.')
  await page.getByRole('button', { name: '이대로 진행해 주세요' }).click()

  await expect(page.getByRole('heading', { name: '요청자가 확인한 진행 범위' })).toBeVisible()
  // The note shows on the card and in the timeline.
  await expect(page.getByText('배너는 다음 달에 따로 요청할게요.').first()).toBeVisible()
  await expect(page.getByText('검토 중').first()).toBeVisible()
})

test('requester sends the AI’s reading back with a note', async ({ page }) => {
  await loginAs(page, '요청자')
  await openInApp(page, '/requests/1028')
  await page.getByRole('button', { name: '다르게 해 주세요' }).click()
  await page.getByLabel('어떻게 다른지 알려 주세요').fill('메인 배너는 빼고 공지 목록만 바꿔 주세요.')
  await page.getByRole('button', { name: '다시 정리해 주세요' }).click()
  // The AI rewrites it (6 s in the mock) and asks again, with the note in the summary.
  await expect(page.getByText('다시 정리는 1번 더 요청할 수 있어요.')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/말씀하신 ‘메인 배너는 빼고 공지 목록만/)).toBeVisible()
})

test('requester files audit findings pasted from a table', async ({ page }) => {
  await loginAs(page, '요청자')
  await openInApp(page, '/requests/new?project=p-portal')
  await page.getByRole('radio', { name: /외부 요건 대응/ }).click() // auto-advances
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByLabel('요청 제목').fill('보안 점검 지적 조치')
  await page.getByLabel('원하는 동작').fill('현장평가 지적 2건을 기준에 맞게 고친다')
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '받은 지적을 항목별로 적어 주세요' })).toBeVisible()
  await page.getByLabel('어디서 받은 지적인가요?').fill('보안 점검 현장평가')
  await page
    .getByLabel('표에서 붙여 넣기')
    .fill(
      '지적 24\t2.3.1\t처리방침 링크가 없다\t링크가 항상 보인다\n지적 25\t오류 문구가 계정 유무를 알려 준다',
    )
  await page.getByRole('button', { name: '항목으로 가져오기' }).click()
  await expect(page.getByText('항목 2', { exact: true })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '이대로 제출할까요?' })).toBeVisible()
  await page.getByRole('button', { name: '요청 제출' }).click()
  await expect(page).toHaveURL(/\/requests\/\d+$/)
  // Each finding became an acceptance criterion.
  await expect(page.getByText('[지적 24] 링크가 항상 보인다')).toBeVisible()
  await expect(page.getByText('[지적 25] 오류 문구가 계정 유무를 알려 준다')).toBeVisible()
})
