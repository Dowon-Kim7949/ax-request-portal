/**
 * React side of the draft sync: the app-wide hook that runs it, and what
 * screens read from it (where an open draft stands, the drafts on this
 * device) or ask of it (delete a draft).
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { dropSavedDraft, keys, storeSavedDraft, useDeleteDraft } from '@/api/queries'
import { useCan, useCurrentUser } from '@/app/hooks'
import { getLocalDraft, listLocalDrafts, subscribeLocalDrafts, type LocalDraft } from '@/stores/draft'
import { draftSync, migrateLegacyDraft } from './sync'

/**
 * Runs the draft sync while someone who may file requests is signed in: moves
 * the pre-account draft, sends what is waiting on start, when the connection
 * comes back and when the page is hidden, and keeps the cached drafts in step
 * with what the sync saved. Rendered once, in the signed-in shell.
 */
export function useDraftSync(): void {
  const user = useCurrentUser()
  const allowed = useCan()('request:create')
  const qc = useQueryClient()

  useEffect(() => {
    if (!allowed) return
    const engine = draftSync(user.id)
    migrateLegacyDraft(user.id)
    const off = engine.subscribe((event) => {
      if (event.type === 'saved') storeSavedDraft(qc, event.draft)
      else if (event.type === 'removed') dropSavedDraft(qc, event.draftId)
      else if (event.type === 'gone') void qc.invalidateQueries({ queryKey: keys.drafts() })
    })
    void engine.sync('boot')
    const onOnline = () => void engine.sync('online')
    // A phone may discard a hidden tab without warning: send what is waiting first.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void engine.sync('hidden')
    }
    const onPageHide = () => void engine.sync('hidden')
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      off()
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [user.id, allowed, qc])
}

/**
 * Where a draft open on screen stands:
 * - `saving`: on its way to the server, or about to be;
 * - `saved`: the server has all of it;
 * - `local`: kept on this device only for now (no connection; sent when there is one);
 * - `limited`: kept on this device only, because the account holds as many drafts as allowed;
 * - `conflict`: saved elsewhere meanwhile; the person chooses which to keep.
 */
export type DraftSaveState = 'saving' | 'saved' | 'local' | 'limited' | 'conflict'

/** Calls back on any change to the drafts on this device or to how their sending stands. */
function useDraftChanges(userId: string) {
  return useCallback(
    (onChange: () => void) => {
      const offLocal = subscribeLocalDrafts((changed) => {
        if (changed === null || changed === userId) onChange()
      })
      const offSync = draftSync(userId).subscribe(onChange)
      return () => {
        offLocal()
        offSync()
      }
    },
    [userId],
  )
}

/**
 * The save state of the draft kept as `key` (null before anything was
 * written). `onServer`: the server holds a version of it, so a draft with
 * nothing left on this device is saved.
 */
export function useDraftSaveState(
  userId: string,
  key: string | null,
  onServer: boolean,
): DraftSaveState | null {
  const subscribe = useDraftChanges(userId)
  return useSyncExternalStore(subscribe, () => {
    if (!key) return null
    const entry = getLocalDraft(userId, key)
    const send = draftSync(userId).state(key)
    if (entry?.conflict) return 'conflict'
    if (send === 'sending' || send === 'scheduled') return 'saving'
    if (entry?.limited) return 'limited'
    if (entry?.dirty) return 'local'
    return onServer ? 'saved' : null
  })
}

/** The draft kept as `key` on this device, kept up to date (another tab may write it). */
export function useLocalDraft(userId: string, key: string | null): LocalDraft | undefined {
  const subscribe = useDraftChanges(userId)
  const snapshot = useSyncExternalStore(subscribe, () => {
    const entry = key ? getLocalDraft(userId, key) : undefined
    return entry ? JSON.stringify(entry) : ''
  })
  return useMemo(() => (snapshot ? (JSON.parse(snapshot) as LocalDraft) : undefined), [snapshot])
}

/**
 * Every draft on this device for the signed-in person, most recently written
 * first: the ones the server does not have yet (a local id), and the ones with
 * changes still on their way. Kept up to date across tabs.
 */
export function useLocalDrafts(): LocalDraft[] {
  const user = useCurrentUser()
  const subscribe = useDraftChanges(user.id)
  const cache = useRef<{ text: string; list: LocalDraft[] }>({ text: '[]', list: [] })
  return useSyncExternalStore(subscribe, () => {
    const list = listLocalDrafts(user.id)
    const text = JSON.stringify(list)
    if (text !== cache.current.text) cache.current = { text, list }
    return cache.current.list
  })
}

/**
 * Deletes a draft: whatever this device keeps of it (`localId`) and the
 * server's copy (`draftId`; one already gone counts as deleted). A draft on
 * its way to the server when it was deleted is deleted there once it arrives.
 * Rejects when the server's copy could not be deleted (this device's is gone
 * by then).
 */
export function useDiscardDraft() {
  const user = useCurrentUser()
  const { mutateAsync } = useDeleteDraft()
  return useCallback(
    async ({ localId, draftId }: { localId?: string | null; draftId?: string | null }) => {
      const engine = draftSync(user.id)
      if (localId) engine.forget(localId)
      if (draftId) {
        await mutateAsync(draftId)
        // A slot in the account freed up: drafts it had no room for can go now.
        void engine.freed()
      }
    },
    [user.id, mutateAsync],
  )
}
