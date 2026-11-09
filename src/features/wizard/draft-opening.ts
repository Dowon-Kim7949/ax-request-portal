/**
 * What the wizard opens with, from ?draft=: a new request, a draft kept on
 * this device only (a local id), or one of the account's drafts (a server id),
 * set against what this device still holds of it.
 */
import { ApiError } from '@/api/client'
import type { SavedDraft } from '@/api/contract'
import { unlinked } from '@/features/drafts/sync-core'
import { getLocalDraft, isLocalId, resolveDraftId, updateLocalDraft, type LocalDraft } from '@/stores/draft'
import {
  draftContentOf,
  readDraftValues,
  savedDraftValues,
  toDraftContent,
  type WizardValues,
} from './schema'

/** What the account holds of the open draft, as far as this screen knows. */
export interface ServerCopy {
  id: string
  version: number
  /** Its step and content (`baselineOf`), to tell whether the form holds anything the account does not */
  baseline: string
}

/** The step and values as the account would store them, for comparing. */
export const baselineOf = (step: number, values: WizardValues) =>
  JSON.stringify([step, toDraftContent(values)])

/** The same for a draft as this device keeps it (`baselineOf` of its values). */
export const baselineOfContent = (step: number, content: unknown) =>
  JSON.stringify([step, draftContentOf(content)])

/** The words and choices of a draft, whatever its step (values or content as this device keeps it), for comparing. */
export const wordsOf = (content: unknown) => JSON.stringify(draftContentOf(content))

/** What the form starts from. */
export interface FormStart {
  values: WizardValues
  /** Where the draft is kept on this device (a local or server id); null for a new request until something is written */
  key: string | null
  server: ServerCopy | null
  /** Saved elsewhere since this device's copy was written: the person chooses which to keep */
  conflict: boolean
  /** Names of attachments that could not be shown again */
  droppedAttachments: string[]
  /** Attachments the account's copy lists that no longer exist */
  missingAttachments: number
  /** The account's draft was deleted or submitted elsewhere; this device's copy goes on as a new draft */
  gone: boolean
}

export type Opening =
  | { kind: 'new' }
  | { kind: 'local'; key: string; entry: LocalDraft }
  | { kind: 'server'; key: string; entry?: LocalDraft }
  | { kind: 'missing' }

/** What ?draft= can name: a local id, or a server id (DRAFT_ID_PATTERN in the contract). */
const DRAFT_PARAM = /^[A-Za-z0-9_-]{1,100}$/

/**
 * Reads ?draft= against this device. A local id the server has since saved
 * leads to that server id. Anything that cannot be a draft's id (a link
 * mistyped or made up) is a draft that cannot be found.
 */
export function openDraft(userId: string, param: string | null): Opening {
  if (!param) return { kind: 'new' }
  if (!DRAFT_PARAM.test(param)) return { kind: 'missing' }
  const { id } = resolveDraftId(userId, param)
  const entry = getLocalDraft(userId, id)
  if (isLocalId(id)) return entry ? { kind: 'local', key: id, entry } : { kind: 'missing' }
  return entry ? { kind: 'server', key: id, entry } : { kind: 'server', key: id }
}

const fresh = (values: WizardValues): Omit<FormStart, 'key' | 'server'> => ({
  values,
  conflict: false,
  droppedAttachments: [],
  missingAttachments: 0,
  gone: false,
})

export function startNew(values: WizardValues): FormStart {
  return { ...fresh(values), key: null, server: null }
}

/** A draft the server has not seen: this device's copy, or null when it is not a draft. */
export function startLocal(entry: LocalDraft): FormStart | null {
  const restored = readDraftValues(entry.content)
  if (!restored) return null
  return {
    ...fresh(restored.values),
    key: entry.localId,
    server: null,
    droppedAttachments: restored.droppedAttachments,
  }
}

/**
 * One of the account's drafts, given the answer to reading it and this
 * device's copy (`entry`), if any:
 * - Read, no copy here: the account's version.
 * - Read, a copy written over the version the account still has: the copy
 *   (newer), sent soon. Over an older version: a conflict, written down so
 *   nothing is sent until the person chooses; the copy stays on screen.
 * - Gone (404): with a copy, it goes on as a new draft; without, not found.
 * - Not reachable: with a copy, that copy; without, failed.
 */
export function startServer(
  userId: string,
  key: string,
  entry: LocalDraft | undefined,
  answer: { data: SavedDraft } | { error: unknown },
): FormStart | 'notFound' | 'failed' {
  const known = 'data' in answer ? answer.data.attachments : []
  const local = entry?.dirty ? readDraftValues(entry.content, known) : null
  if ('data' in answer) {
    const saved = answer.data
    const restored = savedDraftValues(saved)
    const server = { id: saved.id, version: saved.version, baseline: baselineOf(saved.step, restored.values) }
    if (!entry || !local) {
      return { ...fresh(restored.values), key, server, missingAttachments: restored.missingAttachments }
    }
    const current = entry.draftId === saved.id && entry.baseVersion === saved.version && !entry.conflict
    if (!current) updateLocalDraft(userId, entry.localId, (e) => ({ ...e, conflict: true }))
    return {
      ...fresh(local.values),
      key,
      server,
      conflict: !current,
      droppedAttachments: local.droppedAttachments,
    }
  }
  const gone = answer.error instanceof ApiError && answer.error.status === 404
  if (!entry || !local) return gone ? 'notFound' : 'failed'
  if (gone) {
    updateLocalDraft(userId, entry.localId, unlinked)
    return {
      ...fresh(local.values),
      key,
      server: null,
      droppedAttachments: local.droppedAttachments,
      gone: true,
    }
  }
  const server =
    entry.draftId && entry.baseVersion !== undefined
      ? { id: entry.draftId, version: entry.baseVersion, baseline: '' }
      : null
  return {
    ...fresh(local.values),
    key,
    server,
    conflict: Boolean(entry.conflict),
    droppedAttachments: local.droppedAttachments,
  }
}
