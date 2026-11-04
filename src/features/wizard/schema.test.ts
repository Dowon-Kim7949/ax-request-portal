import { describe, expect, it } from 'vitest'
import { EMPTY_ROW, EMPTY_VALUES, firstInvalidStep, parseChecklist, STEPS, toDraft } from './schema'

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
