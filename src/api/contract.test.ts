import { describe, expect, it } from 'vitest'
import { STEPS } from '@/features/wizard/schema'
import { DRAFT_STEP_MAX, RequestSubmission } from './contract'

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
})
