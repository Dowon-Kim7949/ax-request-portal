import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_ROW,
  EMPTY_VALUES,
  firstInvalidStep,
  hasWrittenContent,
  loadDraft,
  parseChecklist,
  saveDraft,
  STEPS,
  toDraft,
} from './schema'

describe('draft storage', () => {
  const userId = 'u-draft-test'
  const photo = {
    id: 'att-1',
    name: 'screen.png',
    size: 120_000,
    mimeType: 'image/png',
    url: `data:image/png;base64,${'A'.repeat(64)}`,
  }
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('keeps the words without the attachments when storage is full', () => {
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (value.includes('data:')) throw new DOMException('full', 'QuotaExceededError')
      original.call(this, key, value)
    })
    const values = { ...EMPTY_VALUES, title: '사진이 안 올라감', attachments: [photo] }
    expect(saveDraft(userId, values)).toBe('withoutAttachments')
    expect(loadDraft(userId)).toMatchObject({ title: '사진이 안 올라감', attachments: [] })
  })

  it('reports a draft it could not keep at all', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveDraft(userId, { ...EMPTY_VALUES, title: '제목', attachments: [photo] })).toBe('failed')
    expect(saveDraft(userId, { ...EMPTY_VALUES, title: '제목' })).toBe('failed')
  })

  it('counts only what was written, not one-tap choices, as worth asking about', () => {
    expect(hasWrittenContent(EMPTY_VALUES)).toBe(false)
    expect(
      hasWrittenContent({ ...EMPTY_VALUES, projectId: 'p-portal', type: 'change', targetIds: ['t-notice'] }),
    ).toBe(false)
    expect(hasWrittenContent({ ...EMPTY_VALUES, title: '  ' })).toBe(false)
    expect(hasWrittenContent({ ...EMPTY_VALUES, title: '검색' })).toBe(true)
    expect(hasWrittenContent({ ...EMPTY_VALUES, acceptanceCriteria: [{ text: '보인다' }] })).toBe(true)
    expect(hasWrittenContent({ ...EMPTY_VALUES, checklist: [{ ...EMPTY_ROW, finding: '링크 없음' }] })).toBe(
      true,
    )
  })
})

describe('parseChecklist', () => {
  it('reads rows copied from a table, with or without the clause and header', () => {
    const pasted = [
      '번호\t조항\t지적 내용\t기대 결과',
      '지적 24\t2.3.1\t처리방침 링크가 없다\t링크가 항상 보인다',
      '지적 25\t오류 문구가 계정 유무를 알려 준다\t구분하지 않는다',
      '',
      '지적 27 | 연락처가 그대로 보인다',
      '로그 보관 기간이 짧다',
    ].join('\n')
    expect(parseChecklist(pasted)).toEqual([
      { ref: '지적 24', clause: '2.3.1', finding: '처리방침 링크가 없다', expected: '링크가 항상 보인다' },
      {
        ref: '지적 25',
        clause: '',
        finding: '오류 문구가 계정 유무를 알려 준다',
        expected: '구분하지 않는다',
      },
      { ref: '지적 27', clause: '', finding: '연락처가 그대로 보인다', expected: '' },
      { ref: '4', clause: '', finding: '로그 보관 기간이 짧다', expected: '' },
    ])
  })
})

describe('wizard schema for audit findings', () => {
  const base = {
    ...EMPTY_VALUES,
    projectId: 'p-portal',
    type: 'checklist' as const,
    title: '보안 점검 지적 조치',
    desiredBehavior: '지적을 고친다',
  }
  const criteriaStep = STEPS.findIndex((s) => s.key === 'criteria')

  it('asks for findings instead of acceptance criteria', () => {
    expect(firstInvalidStep(base)).toBe(criteriaStep)
    const half = { ...base, checklist: [{ ...EMPTY_ROW, finding: '링크가 없다' }] }
    expect(firstInvalidStep(half)).toBe(criteriaStep) // a finding needs its number
    const ok = { ...base, checklist: [{ ...EMPTY_ROW, ref: '지적 1', finding: '링크가 없다' }, EMPTY_ROW] }
    expect(firstInvalidStep(ok)).toBe(STEPS.length - 1)
    expect(toDraft(ok)).toMatchObject({
      acceptanceCriteria: [],
      checklist: [{ ref: '지적 1', finding: '링크가 없다' }],
    })
  })

  it('leaves other request types on acceptance criteria', () => {
    const change = { ...base, type: 'change' as const }
    expect(firstInvalidStep(change)).toBe(criteriaStep)
    expect(
      toDraft({ ...change, acceptanceCriteria: [{ text: '검색하면 결과가 보인다' }] }).checklist,
    ).toBeUndefined()
  })
})
