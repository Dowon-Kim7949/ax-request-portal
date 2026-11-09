import { describe, expect, it } from 'vitest'
import type { SavedDraftSummary } from '@/api/contract'
import { EMPTY_VALUES } from '@/features/wizard/schema'
import type { LocalDraft } from '@/stores/draft'
import { continuePath, localRow, mergeDraftRows } from './rows'

const summary = (over: Partial<SavedDraftSummary> & { id: string }): SavedDraftSummary => ({
  title: '',
  step: 0,
  attachmentCount: 0,
  version: 1,
  createdAt: '2026-11-02T01:00:00.000Z',
  updatedAt: '2026-11-02T01:00:00.000Z',
  ...over,
})

const entry = (over: Partial<LocalDraft> & { localId: string }): LocalDraft => ({
  step: 3,
  content: { ...EMPTY_VALUES, title: '  기기 초안  ', projectId: 'p-field' },
  updatedAt: '2026-11-02T02:00:00.000Z',
  dirty: true,
  ...over,
})

describe('a draft on this device as a row', () => {
  it('takes its title, project and step from what was written', () => {
    expect(localRow(entry({ localId: 'local-a' }), 'idle')).toEqual({
      id: 'local-a',
      title: '기기 초안',
      projectId: 'p-field',
      step: 3,
      updatedAt: '2026-11-02T02:00:00.000Z',
      state: 'local',
      localId: 'local-a',
    })
  })

  it('says where it stands: on its way, on this device only, or in conflict', () => {
    const local = entry({ localId: 'local-a' })
    expect(localRow(local, 'scheduled')?.state).toBe('saving')
    expect(localRow(local, 'sending')?.state).toBe('saving')
    expect(localRow(local, 'offline')?.state).toBe('local')
    expect(localRow({ ...local, limited: true }, 'idle')?.state).toBe('local')
    // A conflict waits for the person, whatever the sending does.
    expect(localRow({ ...local, conflict: true }, 'sending')?.state).toBe('conflict')
    expect(localRow({ ...local, dirty: false }, 'idle')?.state).toBe('saved')
  })

  it('keeps the step within the wizard, and skips what is not a draft', () => {
    expect(localRow(entry({ localId: 'a', step: 42 }), 'idle')?.step).toBe(6)
    expect(localRow(entry({ localId: 'a', step: -1 }), 'idle')?.step).toBe(0)
    expect(localRow(entry({ localId: 'a', content: 'not a draft' }), 'idle')).toBeNull()
    // An empty project is no project.
    expect(localRow(entry({ localId: 'a', content: EMPTY_VALUES }), 'idle')).not.toHaveProperty('projectId')
  })
})

describe('the account’s drafts with this device’s', () => {
  it('lists both, the most recently written first', () => {
    const rows = mergeDraftRows(
      [
        summary({ id: 'draft-2', title: '둘', updatedAt: '2026-11-02T03:00:00.000Z' }),
        summary({ id: 'draft-1', title: '하나', step: 9, updatedAt: '2026-11-02T01:00:00.000Z' }),
      ],
      [localRow(entry({ localId: 'local-a' }), 'idle')!],
    )
    expect(rows.map((r) => [r.id, r.title, r.state])).toEqual([
      ['draft-2', '둘', 'saved'],
      ['local-a', '기기 초안', 'local'],
      ['draft-1', '하나', 'saved'],
    ])
    expect(rows[0]).toMatchObject({ draftId: 'draft-2' })
    expect(rows[1]).not.toHaveProperty('draftId')
    expect(rows[2]?.step).toBe(6)
  })

  it('shows this device’s newer words over the account’s, and still deletes the account’s copy', () => {
    const rows = mergeDraftRows(
      [summary({ id: 'draft-1', title: '예전 제목' })],
      // Kept under the server id; the link to it was dropped (the account's copy looked gone).
      [localRow(entry({ localId: 'draft-1', conflict: true }), 'idle')!],
    )
    expect(rows).toEqual([expect.objectContaining({ id: 'draft-1', title: '기기 초안', state: 'conflict' })])
    expect(rows[0]).toMatchObject({ localId: 'draft-1', draftId: 'draft-1' })
  })

  it('shows this device’s drafts while the account’s are not read yet', () => {
    expect(mergeDraftRows(undefined, [localRow(entry({ localId: 'local-a' }), 'idle')!])).toHaveLength(1)
    expect(mergeDraftRows(undefined, [])).toEqual([])
  })
})

it('continues a draft at the step it was left on', () => {
  expect(continuePath({ id: 'draft-3', step: 4 })).toBe('/requests/new?draft=draft-3&step=4')
  expect(continuePath({ id: 'a b', step: 0 })).toBe('/requests/new?draft=a%20b&step=0')
})
