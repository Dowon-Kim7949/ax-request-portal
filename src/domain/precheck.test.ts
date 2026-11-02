import { describe, expect, it } from 'vitest'
import type { RequestDraft } from './model'
import { looksLikeAcceptanceCriterion, precheckDraft } from './precheck'

const TODAY = '2026-11-02'

const good: RequestDraft = {
  projectId: 'p-portal',
  type: 'change',
  title: '로그인 5회 실패 시 안내 문구 추가',
  targetIds: ['t-login'],
  currentBehavior: '비밀번호를 여러 번 틀려도 아무 안내가 없다',
  desiredBehavior: '5번 틀리면 잠시 후 다시 시도하라는 안내가 보였으면 한다',
  acceptanceCriteria: [{ text: '비밀번호를 5번 틀리면 10분 후 다시 시도 안내가 보인다' }],
  attachmentIds: [],
  desiredDate: '2026-11-20',
  desiredDateReason: '고객 약속',
}

describe('precheckDraft', () => {
  it('passes a well-formed draft without issues', () => {
    expect(precheckDraft(good, TODAY)).toEqual([])
  })

  it('flags vague wording and non-checkable criteria without blocking', () => {
    const issues = precheckDraft(
      {
        ...good,
        desiredBehavior: '로그인을 좀 편하게 해 주세요',
        acceptanceCriteria: [{ text: '깔끔하게' }, { text: '대시보드 화면' }],
      },
      TODAY,
    )
    expect(issues.map((i) => `${i.field}:${i.severity}`)).toEqual([
      'desiredBehavior:warning',
      'acceptanceCriteria.0:warning',
      'acceptanceCriteria.1:info',
    ])
  })

  it('asks bug reports for reproduction steps', () => {
    const issues = precheckDraft({ ...good, type: 'bug', currentBehavior: '가끔 안 됨' }, TODAY)
    expect(issues).toContainEqual(expect.objectContaining({ field: 'currentBehavior', severity: 'warning' }))
  })

  it('checks targets, past dates and missing date reasons', () => {
    const issues = precheckDraft(
      { ...good, targetIds: [], desiredDate: '2026-10-01', desiredDateReason: '' },
      TODAY,
    )
    expect(issues.map((i) => i.field)).toEqual(['targetIds', 'desiredDate', 'desiredDateReason'])
  })

  it('does not require targets for non-code requests', () => {
    expect(precheckDraft({ ...good, type: 'non_code', targetIds: [] }, TODAY)).toEqual([])
  })
})

describe('looksLikeAcceptanceCriterion', () => {
  it.each([
    ['로그인하면 첫 화면이 대시보드로 열린다', true],
    ['저장 버튼을 누를 때 완료 메시지가 보인다', true],
    ['대시보드 개선', false],
    ['빠른 로딩', false],
  ])('%s → %s', (text, expected) => {
    expect(looksLikeAcceptanceCriterion(text)).toBe(expected)
  })
})
