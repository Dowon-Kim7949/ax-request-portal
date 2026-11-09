import { describe, expect, it } from 'vitest'
import { STEPS } from '@/features/wizard/schema'
import { api, DRAFT_ID_PATTERN, DRAFT_STEP_MAX, RequestSubmission, SavedDraftSummary } from './contract'

describe('saved drafts in the contract', () => {
  it('lets a saved draft remember every step of the wizard', () => {
    expect(DRAFT_STEP_MAX).toBe(STEPS.length - 1)
  })

  it('keeps the request rules on a submission that names its draft', () => {
    const submission = {
      projectId: 'p-portal',
      type: 'change',
      title: '공지사항 검색 추가',
      targetIds: [],
      currentBehavior: '',
      desiredBehavior: '제목으로 공지를 검색한다',
      acceptanceCriteria: [{ text: '검색어를 입력하면 제목에 그 단어가 있는 공지만 보인다' }],
      attachmentIds: [],
      draftId: 'draft-1',
    }
    expect(RequestSubmission.parse(submission).draftId).toBe('draft-1')
    // RequestDraft's own checks still apply: a change request needs a criterion.
    expect(RequestSubmission.safeParse({ ...submission, acceptanceCriteria: [] }).success).toBe(false)
  })

  it('says on every draft endpoint who may use it', () => {
    const endpoints = [api.listDrafts, api.getDraft, api.createDraft, api.updateDraft, api.deleteDraft]
    for (const endpoint of endpoints) expect(endpoint.summary).toContain('(request:create)')
  })

  it('keeps a saved draft id apart from the ids the client gives drafts the server has not seen', () => {
    const summary = {
      id: 'draft-1',
      title: '',
      step: 0,
      attachmentCount: 0,
      version: 1,
      createdAt: '2026-11-02T01:00:00.000Z',
      updatedAt: '2026-11-02T01:00:00.000Z',
    }
    expect(SavedDraftSummary.safeParse(summary).success).toBe(true)
    for (const id of ['local-1a2b', '', 'a'.repeat(101), '__proto__/x', 'draft 1']) {
      expect(DRAFT_ID_PATTERN.test(id)).toBe(false)
      expect(SavedDraftSummary.safeParse({ ...summary, id }).success).toBe(false)
    }
  })
})
