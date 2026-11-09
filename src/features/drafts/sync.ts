/**
 * The app's draft sync: one engine for the signed-in person, talking to the
 * real client, and the move of the draft kept before drafts were saved to
 * the account.
 */
import { ApiError, call } from '@/api/client'
import { api } from '@/api/contract'
import {
  draftContentOf,
  firstInvalidStep,
  hasWrittenContent,
  readDraftValues,
} from '@/features/wizard/schema'
import {
  listLocalDrafts,
  newLocalId,
  putLocalDraft,
  readLegacyDraft,
  removeLegacyDraft,
  removeLocalDraft,
} from '@/stores/draft'
import { useSession } from '@/stores/session'
import { DraftSyncEngine, type DraftApi } from './sync-engine'

/** How long signing out or submitting waits for drafts on their way to the server. */
export const DRAFT_SETTLE_TIMEOUT_MS = 3_000

/** The draft endpoints through the app's client. A draft already gone counts as deleted. */
export const draftApi: DraftApi = {
  get: (id) => call(api.getDraft, { params: { id } }),
  create: (body) => call(api.createDraft, { body }),
  update: (id, body) => call(api.updateDraft, { params: { id }, body }),
  remove: async (id) => {
    try {
      await call(api.deleteDraft, { params: { id } })
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
    }
  },
}

const createEngine = (userId: string) =>
  new DraftSyncEngine({
    userId,
    api: draftApi,
    toContent: draftContentOf,
    isActive: () => {
      const session = useSession.getState()
      return Boolean(session.token) && session.user?.id === userId
    },
  })

let engine: DraftSyncEngine | null = null
/** Engines that send nothing, for screens still holding the draft of someone no longer signed in */
const idle = new Map<string, DraftSyncEngine>()

/**
 * The sync engine of `userId`. One per tab, for the person signed in: asking
 * for them stops the previous person's, whose late answers then change
 * nothing. Asked for anyone else (a screen still open after another tab
 * signed in as someone else), an engine that sends nothing.
 */
export function draftSync(userId: string): DraftSyncEngine {
  if (engine && engine.userId === userId && !engine.isStopped) return engine
  if (useSession.getState().user?.id !== userId) {
    let stopped = idle.get(userId)
    if (!stopped) {
      stopped = createEngine(userId)
      stopped.stop()
      idle.set(userId, stopped)
    }
    return stopped
  }
  engine?.stop()
  engine = createEngine(userId)
  return engine
}

/** Tests: forget the engines, so the next one starts clean. */
export function resetDraftSync(): void {
  engine?.stop()
  engine = null
  idle.clear()
}

/**
 * Moves the one draft kept before drafts were saved to the account into the
 * new store, as a draft for the sync to send. The old copy is deleted only
 * once the new one is written; one with nothing written in it is just deleted.
 */
export function migrateLegacyDraft(userId: string): void {
  const raw = readLegacyDraft(userId)
  if (raw === null) return
  let content: unknown
  try {
    content = JSON.parse(raw)
  } catch {
    content = null
  }
  const restored = readDraftValues(content)
  if (!restored || !hasWrittenContent(restored.values)) {
    removeLegacyDraft(userId)
    return
  }
  const localId = newLocalId()
  const result = putLocalDraft(userId, {
    localId,
    step: firstInvalidStep(restored.values),
    // As stored: attachments this version cannot show are still the server's to keep.
    content: { ...restored.values, attachments: (content as { attachments?: unknown }).attachments ?? [] },
    updatedAt: new Date().toISOString(),
    dirty: true,
  })
  if (result === 'failed') {
    // Kept only in this tab's memory: the next start tries again, rather than sending it twice.
    removeLocalDraft(userId, localId)
    return
  }
  removeLegacyDraft(userId)
}

/**
 * Before signing out: sends what is waiting, for at most `timeoutMs`.
 * Resolves with how many drafts are still on this device only (no connection,
 * a full account, a conflict), which signing out would delete.
 */
export async function flushDraftsBeforeSignOut(
  userId: string,
  timeoutMs = DRAFT_SETTLE_TIMEOUT_MS,
): Promise<number> {
  if (!listLocalDrafts(userId).length) return 0
  return draftSync(userId).flush(timeoutMs)
}
