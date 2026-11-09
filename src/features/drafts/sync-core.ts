/**
 * The rules of draft syncing, without timers, storage or React: which drafts
 * to send, what to send, and what a draft on this device becomes once the
 * server has answered. The engine (sync-engine.ts) runs them.
 */
import { ApiError } from '@/api/client'
import {
  DRAFT_STEP_MAX,
  type DraftContent,
  type SavedDraft,
  type SavedDraftInput,
  type SavedDraftUpdate,
} from '@/api/contract'
import type { LocalDraft } from '@/stores/draft'

/**
 * Why a sync runs: typing paused (`input`), a step changed, the wizard was
 * left, the page was hidden, the app started or someone signed in (`boot`),
 * the connection came back, a slot in the account freed up, the person asked
 * (`manual`), or the engine itself goes again (`again`).
 */
export type SyncTrigger =
  'input' | 'step' | 'leave' | 'hidden' | 'boot' | 'online' | 'freed' | 'manual' | 'again'

/**
 * Whether `entry` goes to the server on this trigger. A conflict waits for the
 * person to choose. A draft the account had no room for is not sent again on
 * every pause in typing, only when something may have changed.
 */
export function shouldSend(entry: LocalDraft, trigger: SyncTrigger): boolean {
  if (!entry.dirty || entry.conflict) return false
  if (entry.limited && trigger === 'input') return false
  return true
}

/** The request that saves `entry`: a new draft, or an update over the version it was written on. */
export type DraftRequest =
  { kind: 'create'; body: SavedDraftInput } | { kind: 'update'; id: string; body: SavedDraftUpdate }

/**
 * What to send for `entry`, without the attachments in `skip` (the server said
 * they are gone); null when its content is not a draft. A draft linked to the
 * server without a known version cannot be sent safely: that is a conflict.
 */
export function requestFor(
  entry: LocalDraft,
  toContent: (content: unknown) => DraftContent | null,
  skip: ReadonlySet<string> = new Set(),
): DraftRequest | 'conflict' | null {
  const content = toContent(entry.content)
  if (!content) return null
  const body = {
    step: Math.min(Math.max(Math.trunc(entry.step), 0), DRAFT_STEP_MAX),
    content: skip.size
      ? { ...content, attachmentIds: (content.attachmentIds ?? []).filter((id) => !skip.has(id)) }
      : content,
  }
  // Its own key names it, so a create repeated after a lost answer makes no second draft.
  if (!entry.draftId) return { kind: 'create', body: { ...body, clientId: entry.localId } }
  if (entry.baseVersion === undefined) return 'conflict'
  return { kind: 'update', id: entry.draftId, body: { ...body, baseVersion: entry.baseVersion } }
}

/** How a send ended. */
export type Outcome =
  /**
   * Saved as `draft`. `stale`: a create answered with the draft an earlier
   * create of the same entry made (its answer was lost), without what was sent this time.
   */
  | { kind: 'saved'; draft: SavedDraft; stale?: boolean }
  /** 409 conflict: saved elsewhere since the version it was written on */
  | { kind: 'conflict' }
  /** 409 limit_reached: the account holds as many drafts as allowed */
  | { kind: 'limit' }
  /** 404: deleted or submitted elsewhere */
  | { kind: 'gone' }
  /** No answer, too slow, a server error or a refused token: try again at the next chance */
  | { kind: 'offline' }
  /** Refused for something sending again will not fix; `missingAttachments` are the ids the server cannot find */
  | { kind: 'refused'; missingAttachments: string[] }

/** The outcome of a failed send. `attachmentIds` are the ids that were sent, to name the missing ones. */
export function outcomeOf(error: unknown, attachmentIds: readonly string[] = []): Outcome {
  if (!(error instanceof ApiError)) return { kind: 'refused', missingAttachments: [] }
  if (error.code === 'network' || error.code === 'timeout' || error.status >= 500 || error.status === 401) {
    return { kind: 'offline' }
  }
  if (error.status === 404) return { kind: 'gone' }
  if (error.status === 409) return error.code === 'limit_reached' ? { kind: 'limit' } : { kind: 'conflict' }
  const missing = (error.issues ?? []).flatMap((issue) => {
    const index = /^content\.attachmentIds\.(\d+)$/.exec(issue.path)?.[1]
    const id = index === undefined ? undefined : attachmentIds[Number(index)]
    return id === undefined ? [] : [id]
  })
  return { kind: 'refused', missingAttachments: [...new Set(missing)] }
}

/** The value with its empty fields left out and its keys in order, for comparing two copies. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonical(v)]),
  )
}

/** Whether the account's `draft` holds exactly the step and content of `body`. */
export function holdsSent(draft: SavedDraft, body: DraftRequest['body']): boolean {
  return (
    draft.step === body.step &&
    JSON.stringify(canonical(draft.content)) === JSON.stringify(canonical(body.content))
  )
}

/** Same words, choices and step: nothing was typed between sending `b` and now holding `a`. */
export function sameInput(a: LocalDraft, b: LocalDraft): boolean {
  return a.step === b.step && JSON.stringify(a.content) === JSON.stringify(b.content)
}

/** The entry without its link to a server draft: a new draft again. */
export function unlinked(entry: LocalDraft): LocalDraft {
  const { draftId: _id, baseVersion: _version, conflict: _conflict, ...rest } = entry
  return rest
}

/** What becomes of the draft on this device after a send. */
export interface Settlement {
  /** The entry to keep (under its `localId`, which may be new); null deletes it; absent leaves it as it is */
  next?: LocalDraft | null
  /** The server answered with this draft for the entry: a local id keeps pointing at it */
  alias?: { id: string; version: number }
  /** A server draft that nothing on this device wants: delete it */
  orphan?: string
  /** Send the entry again now */
  again: boolean
  /** The server draft was gone; the entry is a new draft again */
  gone?: boolean
}

/**
 * What `current` (the entry as it is now, possibly written to while the
 * request was out) becomes, given the `sent` entry and the `outcome`.
 *
 * - Saved, nothing typed since: the server has it all, the entry goes.
 *   Typed since: it stays, linked to the version the server answered.
 *   A create answered with a draft that lacks what was sent (an earlier
 *   create made it): the entry stays, linked to that draft, and is sent again.
 * - A new draft saved for an entry that is gone (submitted, deleted, signed
 *   out of) or that another tab already saved as another draft: the new one
 *   is an orphan, deleted.
 * - Conflict: the person chooses, unless another tab saved the entry over a
 *   newer version meanwhile (its base moved): then it is simply sent again.
 * - Gone: the entry becomes a new draft and is sent as one, so what was typed
 *   here is not lost.
 */
export function settle(current: LocalDraft | undefined, sent: LocalDraft, outcome: Outcome): Settlement {
  const created = !sent.draftId
  if (!current) {
    return outcome.kind === 'saved' && created ? { orphan: outcome.draft.id, again: false } : { again: false }
  }
  switch (outcome.kind) {
    case 'saved': {
      const { draft } = outcome
      if (created ? current.draftId && current.draftId !== draft.id : current.draftId !== sent.draftId) {
        return created ? { orphan: draft.id, again: false } : { again: false }
      }
      // Another tab already holds a newer answer for this draft.
      if (!created && (current.baseVersion ?? 0) > draft.version) return { again: false }
      if (created && outcome.stale) {
        // What this device wrote went on from that draft's first version: sent again over it, so
        // anything saved there since (another device) comes back as a conflict.
        const { conflict: _conflict, limited: _limited, ...rest } = current
        return {
          next: { ...rest, localId: draft.id, draftId: draft.id, baseVersion: 1 },
          alias: { id: draft.id, version: 1 },
          again: true,
        }
      }
      const alias = { id: draft.id, version: draft.version }
      if (sameInput(current, sent)) return { next: null, alias, again: false }
      const { conflict: _conflict, limited: _limited, ...rest } = current
      return {
        next: { ...rest, localId: draft.id, draftId: draft.id, baseVersion: draft.version },
        alias,
        again: true,
      }
    }
    case 'conflict':
      if (current.draftId !== sent.draftId) return { again: false }
      if (current.baseVersion !== sent.baseVersion) return { again: true }
      return { next: { ...current, conflict: true }, again: false }
    case 'limit':
      return current.draftId ? { again: false } : { next: { ...current, limited: true }, again: false }
    case 'gone':
      if (created || current.draftId !== sent.draftId) return { again: false }
      return { next: unlinked(current), again: true, gone: true }
    case 'offline':
    case 'refused':
      return { again: false }
  }
}
