// @vitest-environment node
/**
 * Uploads through the mock API. Runs in Node: under jsdom, Node's fetch cannot
 * read a multipart body (it builds jsdom's File and rejects it), so the
 * requests here are plain fetch calls and responses are checked against the contract.
 */
import { resolveObjectURL } from 'node:buffer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiErrorBody } from '../api/contract'
import { Attachment, WorkRequest, type RequestDraft } from '../domain/model'
import { createTestApi } from '../test/mock-api'

const t = createTestApi()
beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => t.server.close())

const draft: RequestDraft = {
  projectId: 'p-portal',
  type: 'change',
  title: '공지사항 검색 추가',
  targetIds: ['t-notice'],
  currentBehavior: '',
  desiredBehavior: '제목으로 공지를 검색한다',
  acceptanceCriteria: [{ text: '검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다' }],
  attachmentIds: [],
}

const send = (userId: string, path: string, init: RequestInit = {}) =>
  fetch(`http://localhost/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t.tokenFor(userId)}`, ...init.headers },
  })

async function upload(userId: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.set('file', file)
  const res = await send(userId, '/attachments', { method: 'POST', body: form })
  expect(res.status).toBe(201)
  return Attachment.parse(await res.json())
}

function createRequest(userId: string, attachmentIds: string[]) {
  return send(userId, '/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, attachmentIds }),
  })
}

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'screen.png', { type: 'image/png' })

describe('attachments', () => {
  it('inlines a small image, never says who uploaded it, and lets only the uploader attach it', async () => {
    const mine = await upload('u-kim', png())
    expect(mine.url).toBe(`data:image/png;base64,${btoa('\x89PNG')}`)
    expect(mine).not.toHaveProperty('ownerId')

    for (const ids of [[mine.id], ['att-does-not-exist']]) {
      const res = await createRequest('u-lee', ids)
      expect(res.status).toBe(400)
      expect(ApiErrorBody.parse(await res.json()).message).toBe(
        '첨부 파일을 찾을 수 없습니다. 첨부를 지우고 다시 올려 주세요.',
      )
    }

    const res = await createRequest('u-kim', [mine.id, mine.id])
    expect(res.status).toBe(201)
    expect(WorkRequest.parse(await res.json()).attachments).toEqual([mine])
  })

  it('keeps a file a browser could run as a page as plain bytes, for this session only', async () => {
    const page = await upload(
      'u-kim',
      new File(['<script>alert(1)</script>'], 'page.html', { type: 'text/html' }),
    )
    expect(page.mimeType).toBe('text/html')
    expect(page.url).toMatch(/^blob:/)
    // Opening it downloads the bytes instead of rendering them in the portal's origin.
    expect(resolveObjectURL(page.url)?.type).toBe('application/octet-stream')
  })

  it('counts an upload as a change, so a language switch keeps it', async () => {
    t.store.engine.state.dirty = false
    await upload('u-kim', png())
    expect(t.store.engine.state.dirty).toBe(true)
  })
})
