/**
 * Unsubmitted requests on this device: what the person wrote that the server
 * (their account's saved drafts) does not have yet. An entry is written as
 * they type and deleted once the server holds the same thing, so the device
 * keeps as little as it can. Signing out deletes it all (src/stores/session.ts);
 * an expiry keeps it for when the same person signs in again.
 *
 * Kept apart from the wizard and the sync engine (src/features/drafts) so the
 * session can delete it without loading either. The content itself (the
 * wizard's values) is opaque here: the wizard reads it with a shape-only
 * schema.
 */
import * as z from 'zod'

/** localStorage key of `userId`'s drafts on this device. */
export const draftsKey = (userId: string) => `ax-request-portal:drafts:${userId}`

/** Where the wizard kept its one draft before drafts were saved to the account; moved on first start. */
export const legacyDraftKey = (userId: string) => `ax-request-portal:draft:${userId}`

const DRAFTS_KEY_PREFIX = 'ax-request-portal:drafts:'

/** Id of a draft the server has not seen yet. A server id never starts with it. */
export const LOCAL_ID_PREFIX = 'local-'
export const isLocalId = (id: string) => id.startsWith(LOCAL_ID_PREFIX)

/** A fresh local id. `getRandomValues` rather than `randomUUID`: the latter needs a secure context. */
export function newLocalId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return LOCAL_ID_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * One draft on this device. `localId` is its key: the server id once the
 * server has it, a local id before. `draftId` and `baseVersion` say which
 * server draft and version the content was written over; `conflict` and
 * `limited` are set by the sync engine (saved elsewhere meanwhile; the
 * account holds as many drafts as allowed).
 */
export interface LocalDraft<C = unknown> {
  localId: string
  draftId?: string
  baseVersion?: number
  /** Wizard step the person was on */
  step: number
  content: C
  updatedAt: string
  /** Not on the server yet. Entries the server has are deleted rather than kept clean. */
  dirty: boolean
  conflict?: boolean
  limited?: boolean
}

/** Where a draft went: a local id the server answered with `id` at `version`. */
export interface DraftAlias {
  id: string
  version: number
  at: string
}

/** How long a local id keeps pointing at the server draft it became (an open tab, a back button, a reload). */
const ALIAS_TTL_MS = 24 * 60 * 60 * 1000

const LocalDraftShape = z.object({
  localId: z.string().min(1),
  draftId: z.string().min(1).optional(),
  baseVersion: z.int().positive().optional(),
  step: z.int().nonnegative(),
  content: z.unknown(),
  updatedAt: z.string(),
  dirty: z.boolean(),
  conflict: z.boolean().optional(),
  limited: z.boolean().optional(),
})
const AliasShape = z.object({ id: z.string().min(1), version: z.int().positive(), at: z.string() })

interface Stored {
  v: 1
  entries: Record<string, LocalDraft>
  aliases: Record<string, DraftAlias>
}

const empty = (): Stored => ({ v: 1, entries: {}, aliases: {} })

/**
 * What became of a write: kept whole, kept without the attachments' data
 * (their ids and names stay, so the server copy keeps them), or not kept on
 * this device at all (this tab still holds it in memory and can send it).
 */
export type LocalSaveResult = 'saved' | 'withoutAttachments' | 'failed'

/* ---------- reading ---------- */

/** Parses what storage holds; anything unreadable counts as nothing, one bad entry drops only itself. */
function parse(raw: string | null): Stored {
  if (!raw) return empty()
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return empty()
  }
  const value = data as { v?: unknown; entries?: unknown; aliases?: unknown } | null
  if (!value || value.v !== 1 || !value.entries || typeof value.entries !== 'object') return empty()
  const stored = empty()
  for (const [key, entry] of Object.entries(value.entries as Record<string, unknown>)) {
    const ok = LocalDraftShape.safeParse(entry)
    if (ok.success && ok.data.localId === key) stored.entries[key] = ok.data as LocalDraft
  }
  if (value.aliases && typeof value.aliases === 'object') {
    for (const [key, alias] of Object.entries(value.aliases as Record<string, unknown>)) {
      const ok = AliasShape.safeParse(alias)
      if (ok.success) stored.aliases[key] = ok.data
    }
  }
  return stored
}

/** The last value read, so a screen asking on every render does not parse the same text again. */
let lastRead: { key: string; raw: string | null; stored: Stored } | null = null

function readStorage(userId: string): Stored {
  const key = draftsKey(userId)
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    raw = null
  }
  if (lastRead && lastRead.key === key && lastRead.raw === raw) return clone(lastRead.stored)
  const stored = parse(raw)
  lastRead = { key, raw, stored }
  return clone(stored)
}

const clone = (s: Stored): Stored => ({ v: 1, entries: { ...s.entries }, aliases: { ...s.aliases } })

/**
 * What this tab holds that storage could not: the whole state when the last
 * write failed, or the full copies of entries written without their
 * attachments' data. Gone with the tab, cleared by the next full write.
 */
const unsavedState = new Map<string, Stored>()
const fullCopies = new Map<string, Map<string, LocalDraft>>()

/** This device's drafts for `userId`: storage, with what only this tab could keep laid over it. */
function load(userId: string): Stored {
  const whole = unsavedState.get(userId)
  if (whole) return clone(whole)
  const stored = readStorage(userId)
  for (const [key, full] of fullCopies.get(userId) ?? []) {
    // Only over the very write it was kept for: another tab may have written that draft since.
    if (stored.entries[key]?.updatedAt === full.updatedAt) stored.entries[key] = full
  }
  return stored
}

/** Every draft on this device for `userId`, most recently written first. */
export function listLocalDrafts(userId: string): LocalDraft[] {
  return Object.values(load(userId).entries).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getLocalDraft(userId: string, localId: string): LocalDraft | undefined {
  return load(userId).entries[localId]
}

/**
 * Where `id` leads now: a local id the server has answered for becomes that
 * server id (with the version it answered), through every hop. Anything else
 * comes back as it is.
 */
export function resolveDraftId(userId: string, id: string): { id: string; version?: number } {
  const { aliases } = load(userId)
  let current: { id: string; version?: number } = { id }
  for (let hops = 0; hops < 5; hops++) {
    const alias = aliases[current.id]
    if (!alias) break
    current = { id: alias.id, version: alias.version }
  }
  return current
}

/* ---------- writing ---------- */

/** The same state with every inline attachment's data (its URL) left out; null when there was none. */
function withoutAttachmentData(state: Stored): { state: Stored; stripped: Set<string> } | null {
  const stripped = new Set<string>()
  const entries: Record<string, LocalDraft> = {}
  for (const [key, entry] of Object.entries(state.entries)) {
    const content = entry.content as { attachments?: unknown } | null
    const list = content && typeof content === 'object' ? content.attachments : undefined
    if (Array.isArray(list) && list.some((a) => (a as { url?: unknown } | null)?.url)) {
      stripped.add(key)
      const attachments = list.map((a: unknown) => (a && typeof a === 'object' ? { ...a, url: '' } : a))
      entries[key] = { ...entry, content: { ...content, attachments } }
    } else {
      entries[key] = entry
    }
  }
  return stripped.size ? { state: { ...state, entries }, stripped } : null
}

function write(userId: string, state: Stored): boolean {
  try {
    localStorage.setItem(draftsKey(userId), JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

function pruneAliases(state: Stored, now: number) {
  for (const [key, alias] of Object.entries(state.aliases)) {
    const at = Date.parse(alias.at)
    if (!Number.isFinite(at) || now - at > ALIAS_TTL_MS) delete state.aliases[key]
  }
}

/**
 * Applies `change` to this device's drafts and writes them back. Storage full:
 * the attachments' data goes first (the words and attachment ids stay); if even
 * that does not fit, this tab keeps the change in memory.
 */
function commit(
  userId: string,
  change: (state: Stored) => void,
): { result: LocalSaveResult; stripped: Set<string> } {
  const state = load(userId)
  change(state)
  pruneAliases(state, Date.now())
  let outcome: { result: LocalSaveResult; stripped: Set<string> }
  if (write(userId, state)) {
    unsavedState.delete(userId)
    fullCopies.delete(userId)
    outcome = { result: 'saved', stripped: new Set() }
  } else {
    const light = withoutAttachmentData(state)
    if (light && write(userId, light.state)) {
      unsavedState.delete(userId)
      const copies = new Map<string, LocalDraft>()
      for (const key of light.stripped) copies.set(key, state.entries[key]!)
      fullCopies.set(userId, copies)
      outcome = { result: 'withoutAttachments', stripped: light.stripped }
    } else {
      unsavedState.set(userId, clone(state))
      outcome = { result: 'failed', stripped: new Set() }
    }
  }
  notify(userId)
  return outcome
}

/** Writes one draft. The result is about this draft: another's attachments may be what did not fit. */
export function putLocalDraft(userId: string, entry: LocalDraft): LocalSaveResult {
  const { result, stripped } = commit(userId, (state) => {
    state.entries[entry.localId] = entry
  })
  return result === 'withoutAttachments' && !stripped.has(entry.localId) ? 'saved' : result
}

/** Changes one draft in place (nothing when it is gone); `change` returning null deletes it. */
export function updateLocalDraft(
  userId: string,
  localId: string,
  change: (entry: LocalDraft) => LocalDraft | null,
): LocalDraft | null | undefined {
  const entry = getLocalDraft(userId, localId)
  if (!entry) return undefined
  const next = change(entry)
  commit(userId, (state) => {
    if (next) state.entries[localId] = next
    else delete state.entries[localId]
  })
  return next
}

export function removeLocalDraft(userId: string, localId: string): void {
  if (!getLocalDraft(userId, localId)) return
  commit(userId, (state) => {
    delete state.entries[localId]
  })
}

/**
 * The server answered for the draft kept as `fromId`: it is now `next` (kept
 * under its server id), or nothing when the server has all of it. A local id
 * keeps pointing at the server draft, for a screen still holding it.
 */
export function settleLocalDraft(
  userId: string,
  fromId: string,
  next: LocalDraft | null,
  alias?: { id: string; version: number },
): void {
  commit(userId, (state) => {
    delete state.entries[fromId]
    if (next) state.entries[next.localId] = next
    if (alias && alias.id !== fromId) {
      state.aliases[fromId] = { ...alias, at: new Date().toISOString() }
    }
  })
}

/** Deletes everything this device keeps of `userId`'s drafts, the pre-account draft included. */
export function clearDrafts(userId: string): void {
  unsavedState.delete(userId)
  fullCopies.delete(userId)
  lastRead = null
  try {
    localStorage.removeItem(draftsKey(userId))
    localStorage.removeItem(legacyDraftKey(userId))
  } catch {
    // Storage blocked: nothing was kept there.
  }
  notify(userId)
}

/* ---------- the draft from before drafts were saved to the account ---------- */

/** The pre-account draft as stored (JSON text), or null. */
export function readLegacyDraft(userId: string): string | null {
  try {
    return localStorage.getItem(legacyDraftKey(userId))
  } catch {
    return null
  }
}

export function removeLegacyDraft(userId: string): void {
  try {
    localStorage.removeItem(legacyDraftKey(userId))
  } catch {
    // Storage blocked: nothing to remove.
  }
}

/* ---------- changes ---------- */

type Listener = (userId: string | null) => void
const listeners = new Set<Listener>()

function notify(userId: string | null) {
  for (const listener of [...listeners]) listener(userId)
}

/** Another tab wrote drafts (null: it cleared all of storage). */
function onStorage(event: StorageEvent) {
  if (event.storageArea !== localStorage) return
  if (event.key === null) notify(null)
  else if (event.key.startsWith(DRAFTS_KEY_PREFIX)) notify(event.key.slice(DRAFTS_KEY_PREFIX.length))
}

/**
 * Calls `listener` after every change to the drafts on this device, made in
 * this tab or another, with whose drafts changed (null: possibly anyone's).
 */
export function subscribeLocalDrafts(listener: Listener): () => void {
  if (!listeners.size && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}
