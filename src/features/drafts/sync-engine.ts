/**
 * Sends the drafts kept on this device to the account, one request at a time
 * (so each update carries the version the previous one answered), and applies
 * the answers with the rules in sync-core.ts. No React: the app wires it up in
 * sync.ts and hooks.ts; tests drive it directly.
 */
import type { DraftContent, SavedDraft, SavedDraftInput, SavedDraftUpdate } from '@/api/contract'
import { getLocalDraft, listLocalDrafts, settleLocalDraft, type LocalDraft } from '@/stores/draft'
import { outcomeOf, requestFor, settle, shouldSend, type Outcome, type SyncTrigger } from './sync-core'

/** The draft endpoints, as the engine uses them. `remove` treats a draft that is already gone as removed. */
export interface DraftApi {
  create: (body: SavedDraftInput) => Promise<SavedDraft>
  update: (id: string, body: SavedDraftUpdate) => Promise<SavedDraft>
  remove: (id: string) => Promise<void>
}

export interface DraftSyncOptions {
  userId: string
  api: DraftApi
  /** The account's copy of a draft's content, or null when it is not a draft */
  toContent: (content: unknown) => DraftContent | null
  /**
   * Whether the engine may still act for `userId`: signed in as them. After a
   * sign-out (here or in another tab), an expiry or a sign-in as someone else
   * nothing is sent and no answer is written down.
   */
  isActive: () => boolean
  /** How long typing pauses before a draft is sent (`schedule`) */
  delayMs?: number
}

/** Where a draft's sending stands, apart from what its entry says (conflict, limited). */
export type SendState = 'idle' | 'scheduled' | 'sending' | 'offline' | 'refused'

export type DraftSyncEvent =
  /** The server saved the entry sent as `localId`; `next` is where it lives now (null: nothing left on this device) */
  | { type: 'saved'; localId: string; sent: LocalDraft; draft: SavedDraft; next: LocalDraft | null }
  /** The server draft was gone (deleted or submitted elsewhere): the entry goes on as a new draft */
  | { type: 'gone'; localId: string; draftId: string }
  /** A server draft nothing wanted was deleted */
  | { type: 'removed'; draftId: string }
  /** A send started or ended, or the entry's flags changed */
  | { type: 'state'; localId: string }

export const DRAFT_SYNC_DELAY_MS = 1_000
/** Sends of one draft in a row before the engine lets it wait for the next trigger */
const MAX_SENDS_IN_A_ROW = 5

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class DraftSyncEngine {
  readonly userId: string
  private readonly api: DraftApi
  private readonly toContent: DraftSyncOptions['toContent']
  private readonly isActive: () => boolean
  private readonly delayMs: number

  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  /** Drafts waiting to be sent, in order, with why */
  private readonly queue = new Map<string, SyncTrigger>()
  /** Drafts being submitted or deleted: nothing new is sent for them */
  private readonly held = new Set<string>()
  private readonly states = new Map<string, SendState>()
  /** Attachments the server said it cannot find; left out of every send */
  private readonly missingAttachments = new Set<string>()
  /** Keys drafts left when the server saved them (a local id → the server id) */
  private readonly moved = new Map<string, string>()
  private readonly listeners = new Set<(event: DraftSyncEvent) => void>()
  private loop: Promise<void> | null = null
  private current: { localId: string; done: Promise<void> } | null = null
  private stopped = false

  constructor(options: DraftSyncOptions) {
    this.userId = options.userId
    this.api = options.api
    this.toContent = options.toContent
    this.isActive = options.isActive
    this.delayMs = options.delayMs ?? DRAFT_SYNC_DELAY_MS
  }

  get isStopped(): boolean {
    return this.stopped
  }

  /** Sends `localId` once typing has paused for a moment. */
  schedule(localId: string): void {
    if (this.stopped) return
    this.clearTimer(localId)
    this.timers.set(
      localId,
      setTimeout(() => {
        this.timers.delete(localId)
        void this.sync('input', localId)
      }, this.delayMs),
    )
    if (this.state(localId) !== 'sending') this.setState(localId, 'scheduled')
  }

  /**
   * Sends every draft that needs it (or only `localId`) now. Resolves once
   * nothing is waiting any more, or right away when there is nothing to do.
   */
  sync(trigger: SyncTrigger, localId?: string): Promise<void> {
    if (this.stopped || !this.isActive()) return Promise.resolve()
    const keys = localId ? [localId] : listLocalDrafts(this.userId).map((e) => e.localId)
    for (const key of keys) {
      if (this.held.has(key)) continue
      this.clearTimer(key)
      if (!this.queue.has(key)) this.queue.set(key, trigger)
    }
    return this.run()
  }

  /**
   * Sends everything now and waits at most `timeoutMs`. Resolves with how many
   * drafts the server still does not have (a conflict, a full account, no
   * connection, or still on their way).
   */
  async flush(timeoutMs: number): Promise<number> {
    await Promise.race([this.sync('leave'), wait(timeoutMs)])
    return listLocalDrafts(this.userId).filter((e) => e.dirty).length
  }

  /**
   * Stops sending `localId` (a submission is about to take it) and waits at
   * most `timeoutMs` for a request already out for it. Resolves with the key
   * the draft lives under afterwards: a new draft the server just saved moves
   * to its server id. `release` or `forget` ends the hold.
   */
  async pause(localId: string, timeoutMs: number): Promise<string> {
    this.hold(localId)
    const current = this.current
    if (current?.localId === localId) await Promise.race([current.done, wait(timeoutMs)])
    return this.whereIs(localId)
  }

  /** Lets `localId` be sent again (a submission failed), and sends it soon. */
  release(localId: string): void {
    this.held.delete(localId)
    if (getLocalDraft(this.userId, localId)) this.schedule(localId)
  }

  /**
   * Drops `localId` for good (submitted or deleted): nothing waiting is sent
   * and the draft leaves this device. A request already out for it can still
   * be answered: a new draft saved that way is deleted at once (see `settle`).
   */
  forget(localId: string): void {
    this.held.delete(localId)
    this.clearTimer(localId)
    this.queue.delete(localId)
    if (getLocalDraft(this.userId, localId)) settleLocalDraft(this.userId, localId, null)
    this.setState(localId, 'idle')
  }

  /** Tries the drafts the account had no room for again (one was just deleted). */
  freed(): Promise<void> {
    return this.sync('freed')
  }

  state(localId: string): SendState {
    return this.states.get(localId) ?? 'idle'
  }

  subscribe(listener: (event: DraftSyncEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** For good: another person signed in. Requests already out are answered into nothing. */
  stop(): void {
    this.stopped = true
    for (const key of [...this.timers.keys()]) this.clearTimer(key)
    this.queue.clear()
  }

  /* ---------- inside ---------- */

  private hold(localId: string) {
    this.held.add(localId)
    this.clearTimer(localId)
    this.queue.delete(localId)
  }

  /** Where the draft once kept as `localId` lives now (it moves to its server id once saved). */
  private whereIs(localId: string): string {
    let key = localId
    for (let hops = 0; hops < 5 && this.moved.has(key); hops++) key = this.moved.get(key)!
    return key
  }

  private clearTimer(localId: string) {
    const timer = this.timers.get(localId)
    if (timer !== undefined) clearTimeout(timer)
    this.timers.delete(localId)
    if (this.states.get(localId) === 'scheduled') this.setState(localId, 'idle')
  }

  private setState(localId: string, state: SendState) {
    if (this.states.get(localId) === state) return
    if (state === 'idle') this.states.delete(localId)
    else this.states.set(localId, state)
    this.emit({ type: 'state', localId })
  }

  private emit(event: DraftSyncEvent) {
    for (const listener of [...this.listeners]) listener(event)
  }

  private run(): Promise<void> {
    if (this.loop) return this.loop
    // Set before it runs: with nothing to send, `drain` ends in the same tick it starts.
    const loop: Promise<void> = this.drain().then(
      () => {
        if (this.loop === loop) this.loop = null
        // Queued while the last answer was being written down: carry on.
        return this.queue.size && !this.stopped ? this.run() : undefined
      },
      (error: unknown) => {
        if (this.loop === loop) this.loop = null
        throw error
      },
    )
    this.loop = loop
    return loop
  }

  private async drain(): Promise<void> {
    const sends = new Map<string, number>()
    while (!this.stopped && this.queue.size) {
      const [localId, trigger] = this.queue.entries().next().value as [string, SyncTrigger]
      this.queue.delete(localId)
      const count = (sends.get(localId) ?? 0) + 1
      sends.set(localId, count)
      const again = await this.sendOne(localId, trigger)
      if (again && count < MAX_SENDS_IN_A_ROW && !this.queue.has(again) && !this.timers.has(again)) {
        this.queue.set(again, 'again')
      }
    }
  }

  /** Sends one draft and applies the answer. Resolves with the key to send again, if any. */
  private async sendOne(localId: string, trigger: SyncTrigger): Promise<string | null> {
    if (!this.isActive() || this.held.has(localId)) return null
    const entry = getLocalDraft(this.userId, localId)
    if (!entry || !shouldSend(entry, trigger)) {
      this.setState(localId, 'idle')
      return null
    }
    const request = requestFor(entry, this.toContent, this.missingAttachments)
    if (request === null) {
      this.setState(localId, 'refused')
      return null
    }
    if (request === 'conflict') {
      this.apply(localId, entry, { kind: 'conflict' })
      return null
    }

    let release!: () => void
    this.current = { localId, done: new Promise<void>((resolve) => (release = resolve)) }
    this.setState(localId, 'sending')
    let outcome: Outcome
    try {
      const draft =
        request.kind === 'create'
          ? await this.api.create(request.body)
          : await this.api.update(request.id, request.body)
      outcome = { kind: 'saved', draft }
    } catch (error) {
      outcome = outcomeOf(error, request.body.content.attachmentIds ?? [])
    }
    try {
      // Signed out (or someone else signed in) meanwhile: the answer is not this device's business any more.
      if (this.stopped || !this.isActive()) return null
      if (
        outcome.kind === 'refused' &&
        outcome.missingAttachments.some((id) => !this.missingAttachments.has(id))
      ) {
        for (const id of outcome.missingAttachments) this.missingAttachments.add(id)
        this.setState(localId, 'idle')
        return localId
      }
      return this.apply(localId, entry, outcome)
    } finally {
      this.current = null
      release()
    }
  }

  /** Writes down what the answer means for the draft sent as `localId`. Resolves with the key to send again. */
  private apply(localId: string, sent: LocalDraft, outcome: Outcome): string | null {
    const result = settle(getLocalDraft(this.userId, localId), sent, outcome)
    if (result.orphan) void this.removeOrphan(result.orphan)
    const nextKey = result.next ? result.next.localId : localId
    if (result.next !== undefined) settleLocalDraft(this.userId, localId, result.next, result.alias)
    const movedTo = result.next ? result.next.localId : result.alias?.id
    if (movedTo && movedTo !== localId) {
      this.moved.set(localId, movedTo)
      if (this.held.delete(localId)) this.held.add(movedTo)
    }
    this.setState(
      localId,
      outcome.kind === 'offline' ? 'offline' : outcome.kind === 'refused' ? 'refused' : 'idle',
    )
    if (outcome.kind === 'saved' && !result.orphan && result.alias) {
      this.emit({ type: 'saved', localId, sent, draft: outcome.draft, next: result.next ?? null })
    }
    if (result.gone && sent.draftId) this.emit({ type: 'gone', localId, draftId: sent.draftId })
    if (result.next) this.emit({ type: 'state', localId: nextKey })
    return result.again ? nextKey : null
  }

  private async removeOrphan(draftId: string) {
    try {
      await this.api.remove(draftId)
      if (this.isActive()) this.emit({ type: 'removed', draftId })
    } catch {
      // Left on the server: it shows in the person's drafts, where they can delete it.
    }
  }
}
