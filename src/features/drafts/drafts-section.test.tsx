import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { call } from '@/api/client'
import { api } from '@/api/contract'
import { keys } from '@/api/queries'
import { EMPTY_VALUES, toDraftContent, type WizardValues } from '@/features/wizard/schema'
import { clearDrafts, getLocalDraft, putLocalDraft, type LocalDraft } from '@/stores/draft'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { DraftsSection } from './drafts-section'
import { resetDraftSync } from './sync'

const t = createTestApi()
const USER = 'u-kim'
const serverError = () =>
  HttpResponse.json({ code: 'internal', message: '잠시 점검 중이에요.' }, { status: 500 })

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  t.server.resetHandlers()
  resetDraftSync()
  clearDrafts(USER)
  await signInAs(USER)
  for (const draft of await call(api.listDrafts)) await call(api.deleteDraft, { params: { id: draft.id } })
})
afterAll(() => t.server.close())

/** A draft in the account, saved a minute after the one before. */
async function saveToAccount(values: Partial<WizardValues>, step = 3) {
  t.advance(60)
  return call(api.createDraft, { body: { step, content: toDraftContent({ ...EMPTY_VALUES, ...values }) } })
}

/** A draft written on this device, later than anything the account holds. */
function keepLocal(localId: string, values: Partial<WizardValues>, over: Partial<LocalDraft> = {}) {
  putLocalDraft(USER, {
    localId,
    step: 4,
    content: { ...EMPTY_VALUES, ...values },
    updatedAt: '2026-11-03T00:00:00.000Z',
    dirty: true,
    ...over,
  })
}

function renderDrafts(variant: 'page' | 'home', qc = testQueryClient()) {
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/requests']}>
        <DraftsSection variant={variant} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}

const region = () => screen.findByRole('region', { name: '임시 저장' })

/** A promise the test opens when a held-back answer may go out. */
function gate() {
  let open!: () => void
  const closed = new Promise<void>((resolve) => (open = resolve))
  return { closed, open }
}
// Hidden too: an open sheet hides the page behind it from the accessibility tree.
const items = (section: HTMLElement) => within(section).getAllByRole('listitem', { hidden: true })

describe('the saved drafts on the requests page', () => {
  it('holds as much room as the list took last time while the account’s drafts are read', async () => {
    await saveToAccount({ title: '하나' })
    await saveToAccount({ title: '둘' })
    const first = render(
      <QueryClientProvider client={testQueryClient()}>
        <MemoryRouter initialEntries={['/requests']}>
          <DraftsSection variant="page" />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(async () => expect(items(await region())).toHaveLength(2))
    first.unmount()

    // Opened again, fresh: the answer is slow.
    const answer = gate()
    t.server.use(
      http.get('*/api/drafts', async () => {
        await answer.closed
      }),
    )
    renderDrafts('page')
    const section = await region()
    const placeholder = within(section).getByTestId('drafts-placeholder')
    expect(placeholder.children[0]!.children).toHaveLength(2)
    expect(within(section).queryAllByRole('listitem')).toHaveLength(0)

    answer.open()
    await waitFor(() => expect(items(section)).toHaveLength(2))
    expect(within(section).queryByTestId('drafts-placeholder')).toBeNull()
  })

  it('holds no room for someone whose list was empty last time', async () => {
    const answer = gate()
    t.server.use(
      http.get('*/api/drafts', async () => {
        await answer.closed
      }),
    )
    renderDrafts('page')
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(screen.queryByRole('region')).toBeNull()
    answer.open()
  })

  it('shows nothing when there are no drafts', async () => {
    const qc = renderDrafts('page')
    await waitFor(() => expect(qc.getQueryState(keys.drafts())?.status).toBe('success'))
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('lists the account’s drafts and this device’s, newest first, each continued where it was left', async () => {
    await saveToAccount({ title: '공지 검색 추가', projectId: 'p-portal' }, 3)
    await saveToAccount({ projectId: '' }, 1)
    keepLocal('local-a', { title: '사진 업로드 오류', projectId: 'p-field' })
    renderDrafts('page')

    const section = await region()
    expect(section).toHaveAttribute('id', 'drafts')
    await waitFor(() => expect(items(section)).toHaveLength(3))
    const [mine, untitled, first] = items(section)
    // Project names come with the project list.
    expect(await within(mine!).findByText('현장 작업자 앱')).toBeInTheDocument()
    expect(mine).toHaveTextContent('사진 업로드 오류')
    expect(mine).toHaveTextContent('이 기기에만')
    expect(mine).toHaveTextContent('7단계 중 5단계')
    expect(mine).toHaveTextContent('완료 기준')
    expect(within(mine!).getByRole('link', { name: '이어 쓰기: 사진 업로드 오류' })).toHaveAttribute(
      'href',
      '/requests/new?draft=local-a&step=4',
    )
    expect(untitled).toHaveTextContent('제목 없는 초안')
    expect(untitled).toHaveTextContent('요청 유형')
    expect(untitled).not.toHaveTextContent('이 기기에만')
    expect(first).toHaveTextContent('공지 검색 추가')
    expect(first).toHaveTextContent('고객 포털 웹')
    // When it was saved, as a time.
    // (Twice in the markup: in the meta line from sm, beside the actions on a phone.)
    expect(within(first!).getAllByText(/저장$/)[0]?.querySelector('time')).toHaveAttribute('dateTime')
    // How many the account holds, of how many it may.
    expect(within(section).getByText('계정에 저장된 초안 2개, 최대 20개')).toBeInTheDocument()
  })

  it('names the criteria step after the request type, as the wizard does', async () => {
    await saveToAccount({ title: '보안 점검 지적 조치', type: 'checklist' }, 4)
    keepLocal('local-b', { title: '현장평가 후속', type: 'checklist' })
    renderDrafts('page')

    const section = await region()
    await waitFor(() => expect(items(section)).toHaveLength(2))
    for (const item of items(section)) {
      expect(item).toHaveTextContent('지적 항목')
      expect(item).not.toHaveTextContent('완료 기준')
    }
  })

  it('shows this device’s newer words for a draft in the account, and a conflict as one', async () => {
    const saved = await saveToAccount({ title: '예전 제목' })
    keepLocal(saved.id, { title: '고친 제목' }, { draftId: saved.id, baseVersion: 1, conflict: true })
    renderDrafts('page')

    const section = await region()
    await waitFor(() => expect(within(section).getByText('계정에 저장된 초안 1개, 최대 20개')))
    expect(items(section)).toHaveLength(1)
    expect(items(section)[0]).toHaveTextContent('고친 제목')
    expect(items(section)[0]).toHaveTextContent('충돌')
    expect(screen.queryByText('예전 제목')).toBeNull()
  })

  it('shows the latest three, and every one on request', async () => {
    for (const n of [1, 2, 3, 4, 5]) await saveToAccount({ title: `초안 ${n}` })
    renderDrafts('page')

    const section = await region()
    await waitFor(() => expect(items(section)).toHaveLength(3))
    expect(items(section).map((li) => within(li).getByText(/^초안 \d$/).textContent)).toEqual([
      '초안 5',
      '초안 4',
      '초안 3',
    ])
    const more = within(section).getByRole('button', { name: '5개 모두 보기' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(more).toHaveAttribute('aria-controls', within(section).getByRole('list').id)

    await userEvent.click(more)
    expect(items(section)).toHaveLength(5)
    expect(within(section).getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('deletes a draft after asking, from the account and this device, and keeps focus in the section', async () => {
    await saveToAccount({ title: '남길 초안' })
    const doomed = await saveToAccount({ title: '지울 초안' })
    keepLocal(doomed.id, { title: '지울 초안' }, { draftId: doomed.id, baseVersion: 1 })
    renderDrafts('page')

    const section = await region()
    await waitFor(() => expect(items(section)).toHaveLength(2))
    await userEvent.click(within(section).getByRole('button', { name: '지울 초안 삭제' }))
    const dialog = screen.getByRole('dialog', { name: '이 초안을 삭제할까요?' })
    expect(dialog).toHaveTextContent('지울 초안')
    expect(dialog).toHaveTextContent('이 기기와 계정에서 모두 지워지고 되돌릴 수 없어요.')

    // Changing one's mind leaves it, and focus goes back to its delete button.
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(items(section)).toHaveLength(2)
    await waitFor(() => expect(within(section).getByRole('button', { name: '지울 초안 삭제' })).toHaveFocus())

    await userEvent.click(within(section).getByRole('button', { name: '지울 초안 삭제' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(items(section)).toHaveLength(1)
    expect((await call(api.listDrafts)).map((d) => d.title)).toEqual(['남길 초안'])
    expect(getLocalDraft(USER, doomed.id)).toBeUndefined()
    // Its row is gone: focus goes to the section rather than nowhere.
    await waitFor(() => expect(within(section).getByRole('heading', { name: '임시 저장' })).toHaveFocus())
  })

  it('deletes a draft only this device has without asking the account, and the section goes with the last one', async () => {
    keepLocal('local-a', { title: '기기에만 있는 초안' })
    renderDrafts('page')

    const section = await region()
    await userEvent.click(within(section).getByRole('button', { name: '기기에만 있는 초안 삭제' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('이 기기에서 지워지고 되돌릴 수 없어요.')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull())
    expect(getLocalDraft(USER, 'local-a')).toBeUndefined()
  })

  it('keeps asking when the account’s copy could not be deleted', async () => {
    await saveToAccount({ title: '안 지워지는 초안' })
    t.server.use(http.delete('*/api/drafts/:id', serverError))
    renderDrafts('page')

    const section = await region()
    await userEvent.click(await within(section).findByRole('button', { name: '안 지워지는 초안 삭제' }))
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' })
    await userEvent.click(confirm)
    await waitFor(() => expect(confirm).not.toHaveAttribute('aria-busy'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(items(section)).toHaveLength(1)

    t.server.resetHandlers()
    await userEvent.click(confirm)
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull())
  })

  it('says the account’s drafts could not be read, shows this device’s meanwhile, and reads them on retry', async () => {
    await saveToAccount({ title: '계정의 초안' })
    keepLocal('local-a', { title: '기기의 초안' })
    t.server.use(http.get('*/api/drafts', serverError))
    renderDrafts('page')

    const section = await region()
    expect(await within(section).findByText('불러오지 못했어요')).toBeInTheDocument()
    expect(items(section).map((li) => li.textContent)).toEqual([expect.stringContaining('기기의 초안')])

    t.server.resetHandlers()
    await userEvent.click(within(section).getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(items(section)).toHaveLength(2))
    expect(within(section).queryByText('불러오지 못했어요')).toBeNull()
  })
})

describe('the saved drafts on the home screen', () => {
  it('shows the latest three and leads to all of them', async () => {
    for (const n of [1, 2, 3, 4]) await saveToAccount({ title: `초안 ${n}` })
    renderDrafts('home')

    const section = await region()
    await waitFor(() => expect(items(section)).toHaveLength(3))
    expect(section).not.toHaveAttribute('id')
    expect(within(section).queryByRole('button', { name: /모두 보기/ })).toBeNull()
    expect(within(section).getByRole('link', { name: '임시 저장함 전체 보기' })).toHaveAttribute(
      'href',
      '/requests#drafts',
    )
  })

  it('is not there for people who may not file requests, who are not asked for drafts either', async () => {
    let asked = 0
    t.server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname.endsWith('/drafts')) asked += 1
    })
    await signInAs('u-yoon') // the operator
    renderDrafts('home')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('region')).toBeNull()
    expect(asked).toBe(0)
    t.server.events.removeAllListeners()
  })
})
