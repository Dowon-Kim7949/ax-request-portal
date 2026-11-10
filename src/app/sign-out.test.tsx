/**
 * Signing out from the shell: drafts on their way are sent first, and the
 * person is asked before signing out deletes drafts that never reached the
 * account.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { call } from '@/api/client'
import { api } from '@/api/contract'
import { resetDraftSync } from '@/features/drafts/sync'
import { EMPTY_VALUES } from '@/features/wizard/schema'
import { clearDrafts, draftsKey, putLocalDraft } from '@/stores/draft'
import { useSession } from '@/stores/session'
import { createTestApi } from '@/test/mock-api'
import { signInAs, testQueryClient } from '@/test/session'
import { RequireAuth } from './guards'
import { permissionsFor } from './router'
import { AppShell } from './shell'

const t = createTestApi()
const USER = 'u-kim'

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  t.server.resetHandlers()
  resetDraftSync()
  clearDrafts(USER)
  await signInAs(USER)
  for (const draft of await call(api.listDrafts)) await call(api.deleteDraft, { params: { id: draft.id } })
})
afterAll(() => t.server.close())

function renderShell() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <h1>로그인 화면</h1> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AppShell permissionsFor={permissionsFor} />
          </RequireAuth>
        ),
        children: [{ index: true, element: <h1>홈</h1> }],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={testQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

async function signOutFromMenu() {
  await userEvent.click(await screen.findByRole('button', { name: /내 계정/ }))
  await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))
}

const keep = (localId: string, title: string, extra: { conflict?: boolean; draftId?: string } = {}) =>
  putLocalDraft(USER, {
    localId,
    step: 3,
    content: { ...EMPTY_VALUES, title },
    updatedAt: new Date().toISOString(),
    dirty: true,
    ...(extra.draftId ? { draftId: extra.draftId, baseVersion: 1 } : {}),
    ...(extra.conflict ? { conflict: true } : {}),
  })

describe('signing out', () => {
  it('signs out at once when no draft is waiting', async () => {
    renderShell()
    await screen.findByRole('heading', { name: '홈' })
    await signOutFromMenu()
    expect(await screen.findByRole('heading', { name: '로그인 화면' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sends drafts on their way first, so the account keeps them', async () => {
    // Held while the shell starts, so the draft is still waiting when the person signs out.
    t.server.use(http.post('*/api/drafts', () => HttpResponse.error(), { once: true }))
    keep('local-a', '로그아웃 전에 쓴 것')
    renderShell()
    await screen.findByRole('heading', { name: '홈' })
    await signOutFromMenu()

    expect(await screen.findByRole('heading', { name: '로그인 화면' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(draftsKey(USER))).toBeNull()
    await signInAs(USER)
    expect((await call(api.listDrafts)).map((d) => d.title)).toEqual(['로그아웃 전에 쓴 것'])
  })

  it('asks before deleting drafts that could not reach the account, and can be called off', async () => {
    keep('draft-x', '충돌 난 초안', { draftId: 'draft-x', conflict: true })
    renderShell()
    await screen.findByRole('heading', { name: '홈' })

    await signOutFromMenu()
    const dialog = await screen.findByRole('dialog', { name: '로그아웃할까요?' })
    expect(dialog).toHaveTextContent('이 기기에만 저장된 초안 1개가 있어요')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The menu that held "sign out" is gone: focus is back on the account button.
    expect(screen.getByRole('button', { name: /내 계정/ })).toHaveFocus()
    expect(useSession.getState().user?.id).toBe(USER)
    expect(localStorage.getItem(draftsKey(USER))).not.toBeNull()

    await signOutFromMenu()
    await screen.findByRole('dialog', { name: '로그아웃할까요?' })
    // The dialog's own button, not the menu's.
    const buttons = screen.getAllByRole('button', { name: '로그아웃' })
    await userEvent.click(buttons.at(-1)!)
    expect(await screen.findByRole('heading', { name: '로그인 화면' })).toBeInTheDocument()
    expect(localStorage.getItem(draftsKey(USER))).toBeNull()
  })
})
