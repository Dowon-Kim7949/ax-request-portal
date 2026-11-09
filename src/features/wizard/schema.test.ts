import { describe, expect, it } from 'vitest'
import type { SavedDraft } from '@/api/contract'
import {
  draftContentOf,
  EMPTY_ROW,
  EMPTY_VALUES,
  firstInvalidStep,
  hasWrittenContent,
  missingAttachmentIds,
  parseChecklist,
  readDraftValues,
  savedDraftValues,
  STEPS,
  toDraft,
  toDraftContent,
} from './schema'

const photo = {
  id: 'att-1',
  name: 'screen.png',
  size: 120_000,
  mimeType: 'image/png',
  url: `data:image/png;base64,${'A'.repeat(64)}`,
}

describe('reading a draft kept on this device', () => {
  it('fills what a half-written draft leaves out', () => {
    expect(readDraftValues({ title: '사진이 안 올라감' })?.values).toEqual({
      ...EMPTY_VALUES,
      title: '사진이 안 올라감',
    })
    expect(readDraftValues({ acceptanceCriteria: [], checklist: [] })?.values).toMatchObject({
      acceptanceCriteria: [{ text: '' }],
      checklist: [EMPTY_ROW],
    })
  })

  it('drops only the attachments whose URL is no longer accepted, and keeps the words', () => {
    // An older demo kept any small file inline, e.g. as data:text/plain.
    const note = {
      ...photo,
      id: 'att-2',
      name: 'note.txt',
      mimeType: 'text/plain',
      url: 'data:text/plain;base64,QQ==',
    }
    const restored = readDraftValues({
      ...EMPTY_VALUES,
      title: '사진이 안 올라감',
      attachments: [photo, note],
    })
    expect(restored?.values).toMatchObject({ title: '사진이 안 올라감', attachments: [photo] })
    expect(restored?.droppedAttachments).toEqual(['note.txt'])
  })

  it('takes an attachment kept without its file from the account’s copy when it has it', () => {
    // Written while storage was full: the attachment is there, its data is not.
    const kept = readDraftValues({ title: '사진', attachments: [{ ...photo, url: '' }] }, [photo])
    expect(kept?.values.attachments).toEqual([photo])
    expect(kept?.droppedAttachments).toEqual([])
    expect(
      readDraftValues({ title: '사진', attachments: [{ ...photo, url: '' }] })?.droppedAttachments,
    ).toEqual(['screen.png'])
  })

  it('still drops a draft that is not a draft at all', () => {
    expect(readDraftValues({ title: 42 })).toBeNull()
    expect(readDraftValues('{not json')).toBeNull()
    expect(readDraftValues(null)).toBeNull()
  })
})

describe('the account’s copy of a draft', () => {
  it('keeps attachments by id, and every id when this device could not keep the file', () => {
    const values = { ...EMPTY_VALUES, title: '제목', attachments: [photo] }
    expect(toDraftContent(values)).toMatchObject({ title: '제목', attachmentIds: ['att-1'] })
    expect(toDraftContent(values)).not.toHaveProperty('attachments')
    expect(draftContentOf({ ...values, attachments: [{ ...photo, url: '' }] })?.attachmentIds).toEqual([
      'att-1',
    ])
    expect(draftContentOf({ title: 42 })).toBeNull()
  })

  it('cuts what would not fit the contract instead of being refused', () => {
    const content = toDraftContent({
      ...EMPTY_VALUES,
      title: 'a'.repeat(12_000),
      targetIds: Array(60).fill('t'),
    })
    expect(content.title).toHaveLength(10_000)
    expect(content.targetIds).toHaveLength(50)
  })

  it('reads the account’s copy back, counting attachments that no longer exist', () => {
    const saved: SavedDraft = {
      id: 'draft-1',
      title: '제목',
      step: 3,
      attachmentCount: 1,
      version: 2,
      createdAt: '2026-11-09T01:00:00.000Z',
      updatedAt: '2026-11-09T01:00:00.000Z',
      content: { title: '제목', attachmentIds: ['att-1', 'att-gone', 'att-1'] },
      attachments: [photo],
    }
    const restored = savedDraftValues(saved)
    expect(restored.values).toEqual({ ...EMPTY_VALUES, title: '제목', attachments: [photo] })
    expect(restored.missingAttachments).toBe(1)
  })
})

describe('what is worth keeping', () => {
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

describe('missingAttachmentIds', () => {
  it('maps the issues the server named to the attachments sent', () => {
    const issues = [
      { path: 'attachmentIds.0', message: 'gone' },
      { path: 'attachmentIds.2', message: 'gone' },
      { path: 'attachmentIds.2', message: 'gone' },
    ]
    expect(missingAttachmentIds(issues, ['a', 'b', 'c'])).toEqual(['a', 'c'])
  })

  it('finds nothing in a refusal about something else', () => {
    expect(missingAttachmentIds(undefined, ['a'])).toEqual([])
    expect(missingAttachmentIds([{ path: 'title', message: 'too short' }], ['a'])).toEqual([])
    expect(missingAttachmentIds([{ path: 'attachmentIds.7', message: 'gone' }], ['a'])).toEqual([])
  })
})
