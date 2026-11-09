/**
 * The saved drafts as a list shows them: the account's, with what this device
 * holds laid over them (words not sent yet, or drafts the account does not
 * have at all), most recently written first. No React, no storage.
 */
import type { SavedDraftSummary } from '@/api/contract'
import { draftContentOf, STEPS } from '@/features/wizard/schema'
import type { LocalDraft } from '@/stores/draft'
import type { SendState } from './sync-engine'

/**
 * Where a draft in the list stands:
 * - `saved`: the account has all of it;
 * - `saving`: on its way there now;
 * - `local`: on this device only for now (no connection, or the account is full);
 * - `conflict`: saved elsewhere meanwhile; the wizard asks which to keep.
 */
export type DraftRowState = 'saved' | 'saving' | 'local' | 'conflict'

export interface DraftRow {
  /** What the wizard opens it by (?draft=): its server id, or a local id */
  id: string
  /** Its title without surrounding spaces; empty when there is none */
  title: string
  projectId?: string
  /** Request type, when chosen: the criteria step is named after it ("findings" for a checklist) */
  type?: SavedDraftSummary['type']
  /** Wizard step the person was last on, within the wizard's steps */
  step: number
  updatedAt: string
  state: DraftRowState
  /** This device's copy, deleted with it */
  localId?: string
  /** The account's copy, deleted with it */
  draftId?: string
}

/** How many drafts a section shows before "show all" (requests page) or "see all" (home). */
export const DRAFTS_SHOWN = 3

/** Where the wizard continues a draft: that draft, at the step the person was on. */
export const continuePath = (row: Pick<DraftRow, 'id' | 'step'>) =>
  `/requests/new?draft=${encodeURIComponent(row.id)}&step=${row.step}`

const LAST_STEP = STEPS.length - 1

const clampStep = (step: number) => Math.min(Math.max(Math.trunc(step), 0), LAST_STEP)

/**
 * One draft on this device as a row, given how its sending stands; null when
 * its content is not a draft (the wizard could not open it either).
 */
export function localRow(entry: LocalDraft, send: SendState): DraftRow | null {
  const content = draftContentOf(entry.content)
  if (!content) return null
  const state: DraftRowState = entry.conflict
    ? 'conflict'
    : send === 'sending' || send === 'scheduled'
      ? 'saving'
      : entry.dirty
        ? 'local'
        : 'saved'
  return {
    id: entry.localId,
    title: (content.title ?? '').trim(),
    ...(content.projectId ? { projectId: content.projectId } : {}),
    ...(content.type ? { type: content.type } : {}),
    step: clampStep(entry.step),
    updatedAt: entry.updatedAt,
    state,
    localId: entry.localId,
    ...(entry.draftId ? { draftId: entry.draftId } : {}),
  }
}

const time = (iso: string) => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * The account's drafts (`server`, undefined until read) with this device's
 * rows (`local`, see `localRow`) laid over them: a row for a draft the
 * account has shows this device's newer words, and still deletes the
 * account's copy.
 */
export function mergeDraftRows(
  server: readonly SavedDraftSummary[] | undefined,
  local: readonly DraftRow[],
): DraftRow[] {
  const rows = new Map<string, DraftRow>()
  for (const d of server ?? []) {
    rows.set(d.id, {
      id: d.id,
      title: d.title,
      ...(d.projectId ? { projectId: d.projectId } : {}),
      ...(d.type ? { type: d.type } : {}),
      step: clampStep(d.step),
      updatedAt: d.updatedAt,
      state: 'saved',
      draftId: d.id,
    })
  }
  for (const row of local) {
    const saved = rows.get(row.id)
    rows.set(row.id, saved && !row.draftId ? { ...row, draftId: saved.draftId } : row)
  }
  // Newest first; equal times keep the account's order (it lists the last changed first).
  return [...rows.values()].sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
}
