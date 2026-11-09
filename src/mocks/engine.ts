/**
 * In-memory backend used by the mock API. It applies the same lifecycle
 * rules a real backend must (src/domain/lifecycle.ts) and simulates the AI
 * from timestamps, so progress survives page reloads.
 *
 * Language: errors are thrown as keys and rendered per request; notifications
 * are stored as keys and rendered when read; AI text is written in the
 * language of the call that makes the AI finish (like a model would).
 */
import type {
  AiSettingsInput,
  ApiErrorBody,
  DraftContent,
  PreviewFeedbackInput,
  ProjectInput,
  RegressionQueue,
  RequestScope,
  RequestSubmission,
  SavedDraft,
  SavedDraftSummary,
} from '../api/contract'
import { appConfig } from '../config/app.config'
import {
  addUsage,
  AI_PROVIDERS,
  AI_TASKS,
  bookUsage,
  normalizeUsage,
  priceOf,
  overRequestLimit,
  resolveSelection,
  runtimeFor,
  selectionsInUse,
  ZERO_USAGE,
  type AiPricing,
  type AiProjectOverride,
  type AiProvider,
  type AiSelection,
  type AiSettings,
  type AiTask,
  type AiTaskSelections,
  type AiUsageEntry,
  type ProviderConnection,
  type TokenUsage,
} from '../domain/ai'
import {
  applyTransition,
  isAuthorized,
  isTerminal,
  LifecycleError,
  type AnyCommand,
  type GuardName,
  type TransitionCommand,
} from '../domain/lifecycle'
import type {
  Actor,
  AiUsageReport,
  Attachment,
  Budget,
  DashboardSummary,
  Notification,
  NotificationSettings,
  PrecheckIssue,
  Project,
  ReleaseScheduleItem,
  RequestAiUsage,
  RequestDraft,
  RequestStatus,
  User,
  WorkRequest,
  WorkRequestSummary,
} from '../domain/model'
import { precheckDraft } from '../domain/precheck'
import { hasPermission, type Permission, type RolePermissions } from '../domain/roles'
import { addCalendarDays, dateInTimeZone, hqTimeZone } from '../lib/time-zone'
import { finishWork, generateReport, generateScope, phaseAt, simulateUsage, type UsageShape } from './ai'
import { renderNotification, type ErrorKey, type NotificationKey, type ServerLanguage } from './copy'

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/** Bump when the stored shape changes: older demo data is discarded and reseeded. */
export const STATE_VERSION = 6

/** Notifications kept per person; older ones are dropped as new ones arrive. */
export const NOTIFICATIONS_PER_USER_MAX = 200

/** What the operator configures. Keys are never stored, only their last four characters. */
export interface AiOperations {
  selections: AiTaskSelections
  overrides: AiProjectOverride[]
  providers: Partial<Record<AiProvider, { keyHint: string; updatedAt: string }>>
  pricing: AiPricing
}

export interface StoredNotification {
  id: string
  userId: string
  requestId?: number
  key: NotificationKey
  params: Record<string, string | number>
  createdAt: string
  readAt?: string
}

/** An upload as the mock keeps it: the API never returns who uploaded it. */
export interface StoredAttachment extends Attachment {
  /** Only the uploader can attach it to a request */
  ownerId: string
}

function publicAttachment({ ownerId: _owner, ...attachment }: StoredAttachment): Attachment {
  return attachment
}

/** A saved draft as the mock keeps it: only its owner can read, change or delete it. */
export interface StoredDraft {
  id: string
  ownerId: string
  /** The client's own id for it, so a create repeated after a lost answer makes no second draft */
  clientId?: string
  /** Wizard step the person was last on */
  step: number
  content: DraftContent
  /** 1 when created, one more on every update */
  version: number
  createdAt: string
  updatedAt: string
}

export interface MockState {
  version: typeof STATE_VERSION
  /** Counts saves, so a tab can tell that another tab has saved since it last read (see store.ts) */
  revision: number
  seededAt: string
  /** Language the demo data was written in */
  language: ServerLanguage
  /** Set by the first change a person makes; untouched demo data can be re-seeded in another language */
  dirty: boolean
  seq: number
  nextRequestId: number
  users: User[]
  projects: Project[]
  requests: WorkRequest[]
  notifications: StoredNotification[]
  notificationSettings: Record<string, NotificationSettings>
  budget: Pick<Budget, 'monthlyLimitKrw' | 'perRequestLimitKrw' | 'alertThresholdPct'>
  ai: AiOperations
  /** Usage ledger: one entry per model call or agent run, priced when booked */
  aiUsage: AiUsageEntry[]
  attachments: StoredAttachment[]
  /** Unsubmitted requests, saved per person; the most recently changed last */
  drafts: StoredDraft[]
}

export interface EngineOptions {
  reportSeconds: number
  workSeconds: number
  rolePermissions: RolePermissions
  /** Ask the requester to confirm the AI's reading before a developer reviews it (default on) */
  scopeCheck?: boolean
  /**
   * The business calendar: "today" for desired and release dates, delays, and
   * daily/monthly totals. Defaults to the head office (appConfig.organization.timeZone);
   * a real backend must use the same setting.
   */
  timeZone?: string
  /** Saved drafts one person may keep. Defaults to appConfig.drafts.maxPerAccount. */
  draftsPerAccount?: number
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  inApp: true,
  email: true,
  messenger: false,
  onlyActionRequired: false,
}

/** Thrown by engine operations; the MSW layer renders `key` in the request's language. */
export class HttpError extends Error {
  readonly status: number
  readonly code: Exclude<ApiErrorBody['code'], 'internal'>
  readonly key: ErrorKey
  readonly params: Record<string, string | number>
  /** Body fields the error is about (`issues[].path`), e.g. `attachmentIds.1` */
  readonly paths: string[]
  constructor(
    status: number,
    code: HttpError['code'],
    key: ErrorKey,
    params: Record<string, string | number> = {},
    paths: string[] = [],
  ) {
    super(key)
    this.status = status
    this.code = code
    this.key = key
    this.params = params
    this.paths = paths
  }
}

const DAY = 86_400_000

const GUARD_ERRORS: Record<GuardName, ErrorKey> = {
  criteriaAllPassed: 'needAllPassed',
  criteriaOneFailed: 'needOneFailed',
  assumptionsUnchecked: 'assumptionsUnchecked',
  scopeUnanswered: 'scopeUnanswered',
  scopeRevisionsUsed: 'scopeRevisionsUsed',
  releaseUnscheduled: 'releaseUnscheduled',
}

/**
 * Calendar date (YYYY-MM-DD) of an instant on the business calendar: what the
 * company means by "today", wherever the server or the viewer is.
 */
export function businessDate(at: Date | string, timeZone = hqTimeZone()): string {
  return dateInTimeZone(at, timeZone)
}

/** Calendar arithmetic on YYYY-MM-DD; no time zone involved. */
export function addDays(date: string, days: number): string {
  return addCalendarDays(date, days)
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class MockEngine {
  readonly state: MockState
  private readonly opts: EngineOptions

  constructor(state: MockState, opts: EngineOptions) {
    this.state = state
    this.opts = opts
  }

  /* ---------- helpers ---------- */

  /** Business-calendar date of an instant (see EngineOptions.timeZone). */
  dateOf(at: Date | string): string {
    return businessDate(at, this.opts.timeZone)
  }

  /** "Today" on the business calendar. */
  today(now: Date): string {
    return this.dateOf(now)
  }

  newId(prefix: string): string {
    this.state.seq += 1
    return `${prefix}-${this.state.seq}`
  }

  can(user: User, permission: Permission): boolean {
    return hasPermission(user, permission, this.opts.rolePermissions)
  }

  require(user: User, permission: Permission): void {
    if (!this.can(user, permission)) throw new HttpError(403, 'forbidden', 'forbidden')
  }

  user(id: string): User | undefined {
    return this.state.users.find((u) => u.id === id)
  }

  project(id: string): Project | undefined {
    return this.state.projects.find((p) => p.id === id)
  }

  private findRequest(id: number): WorkRequest {
    const req = this.state.requests.find((r) => r.id === id)
    if (!req) throw new HttpError(404, 'not_found', 'requestNotFound', { id })
    return req
  }

  private replace(next: WorkRequest): WorkRequest {
    const i = this.state.requests.findIndex((r) => r.id === next.id)
    this.state.requests[i] = next
    return next
  }

  private responsibleDevelopers(req: WorkRequest): string[] {
    const owners = this.project(req.projectId)?.ownerIds ?? []
    return [...new Set([...(req.assigneeId ? [req.assigneeId] : []), ...owners])]
  }

  canRead(user: User, req: WorkRequest): boolean {
    return (
      req.requesterId === user.id ||
      this.can(user, 'request:read:all') ||
      this.responsibleDevelopers(req).includes(user.id)
    )
  }

  private isResponsible(user: User, req: WorkRequest): boolean {
    return isAuthorized('runWork', {
      user,
      request: { ...req, status: 'review' },
      project: this.project(req.projectId),
      rolePermissions: this.opts.rolePermissions,
    })
  }

  /** The model a task uses for a project right now. */
  selectionFor(projectId: string, task: AiTask): AiSelection {
    return resolveSelection(
      { defaults: this.state.ai.selections, projectOverrides: this.state.ai.overrides },
      projectId,
      task,
    )
  }

  /**
   * Books one AI job: the provider's usage report (simulated here, returned by
   * the call in production), normalized and priced at today's table.
   */
  bookAi(
    task: AiTask,
    selection: AiSelection,
    shape: UsageShape,
    at: string,
    requestId?: number,
  ): AiUsageEntry | undefined {
    const tokens = normalizeUsage(simulateUsage(task, selection.provider, shape))
    const entry = bookUsage(this.state.ai.pricing, {
      id: this.newId('ai'),
      at,
      task,
      selection,
      tokens,
      ...(requestId !== undefined ? { requestId } : {}),
    })
    if (entry) this.state.aiUsage.push(entry)
    return entry
  }

  /** AI spending booked against one request, all months. */
  private requestSpentKrw(requestId: number): number {
    return this.state.aiUsage.reduce((sum, e) => (e.requestId === requestId ? sum + e.costKrw : sum), 0)
  }

  /** Adds the AI usage of a request for viewers who see engineering detail. */
  present(user: User, req: WorkRequest): WorkRequest {
    if (!this.can(user, 'report:read')) return req
    const entries = this.state.aiUsage.filter((e) => e.requestId === req.id)
    const aiUsage: RequestAiUsage = {
      spentKrw: Math.round(entries.reduce((n, e) => n + e.costKrw, 0) * 100) / 100,
      limitKrw: this.state.budget.perRequestLimitKrw,
      entries,
    }
    return { ...req, aiUsage }
  }

  private shapeOf(req: WorkRequest, attempt: number): UsageShape {
    return { seed: req.id, criteria: req.acceptanceCriteria.length, targets: req.targetIds.length, attempt }
  }

  /** Coding agent and model a new work run starts with. */
  private agentFor(projectId: string): NonNullable<WorkRequest['work']>['agent'] & object {
    const sel = this.selectionFor(projectId, 'work')
    return { ...sel, runtime: runtimeFor('work', sel.provider) }
  }

  /* ---------- notifications ---------- */

  private notify(
    userIds: string[],
    key: NotificationKey,
    params: Record<string, string | number>,
    requestId: number,
    actionRequired: boolean,
    now: Date,
    except?: string,
  ): void {
    for (const userId of new Set(userIds)) {
      if (userId === except) continue
      const settings = this.state.notificationSettings[userId] ?? DEFAULT_NOTIFICATION_SETTINGS
      if (!settings.inApp || (settings.onlyActionRequired && !actionRequired)) continue
      this.state.notifications.push({
        id: this.newId('n'),
        userId,
        requestId,
        key,
        params,
        createdAt: now.toISOString(),
      })
      this.trimNotifications(userId)
    }
  }

  /** Keeps a person's newest notifications, so the stored demo data stops growing. */
  private trimNotifications(userId: string): void {
    const mine = this.state.notifications.map((n, i) => ({ n, i })).filter(({ n }) => n.userId === userId)
    if (mine.length <= NOTIFICATIONS_PER_USER_MAX) return
    // Newest first; of two at the same moment, the one added later.
    mine.sort((a, b) => b.n.createdAt.localeCompare(a.n.createdAt) || b.i - a.i)
    const drop = new Set(mine.slice(NOTIFICATIONS_PER_USER_MAX).map(({ n }) => n))
    this.state.notifications = this.state.notifications.filter((n) => !drop.has(n))
  }

  private notifyStatus(req: WorkRequest, now: Date, actorId?: string): void {
    const devs = this.responsibleDevelopers(req)
    const requester = [req.requesterId]
    const send = (
      to: string[],
      key: NotificationKey,
      params: Record<string, string | number>,
      action: boolean,
    ) => this.notify(to, key, params, req.id, action, now, actorId)

    const last = req.timeline.at(-1)?.event
    switch (req.status) {
      case 'scope_check':
        send(requester, 'scopeCheck', { title: req.title }, true)
        break
      case 'review':
        send(devs, last === 'approveScope' ? 'scopeApproved' : 'reportReady', { title: req.title }, true)
        break
      case 'info_needed':
        send(
          requester,
          'infoNeeded',
          { questions: req.infoRequest?.questions.join(' / ') ?? req.title },
          true,
        )
        break
      case 'reporting':
        // A new reading after "not quite" stays between the requester and the AI.
        if (last === 'provideInfo') send(devs, 'requesterAnswered', {}, false)
        break
      case 'rejected':
        send(requester, 'rejected', { reason: req.rejectionReason ?? req.title }, false)
        break
      case 'in_progress':
        send(requester, 'workStarted', { title: req.title }, false)
        break
      case 'code_review':
        send(devs, 'workFinished', {}, true)
        // Optional for the requester, so not "your turn".
        if (req.work?.preview) send(requester, 'previewReady', { title: req.title }, false)
        break
      case 'verification':
        send(requester, 'pleaseCheck', { count: req.acceptanceCriteria.length }, true)
        break
      case 'changes_requested':
        send(devs, 'issueReported', { title: req.title }, true)
        break
      case 'release_scheduled':
        send(devs, 'scheduleRelease', {}, true)
        break
      case 'done':
        send(requester, 'released', { title: req.title }, false)
        break
      case 'cancelled':
        send(devs, 'cancelled', { title: req.title }, false)
        break
      case 'submitted':
        break
    }
  }

  private render(n: StoredNotification, lang: ServerLanguage): Notification {
    const { title, body } = renderNotification(lang, n.key, n.params, n.requestId)
    return {
      id: n.id,
      ...(n.requestId ? { requestId: n.requestId } : {}),
      title,
      body,
      createdAt: n.createdAt,
      ...(n.readAt ? { readAt: n.readAt } : {}),
    }
  }

  /* ---------- AI simulation ---------- */

  private apply(req: WorkRequest, command: AnyCommand, actor: Actor, now: Date): WorkRequest {
    try {
      return applyTransition(req, command, { actor, now, newId: () => this.newId('tl') })
    } catch (err) {
      if (err instanceof LifecycleError) {
        if (err.code === 'guard_failed') throw new HttpError(409, 'guard_failed', GUARD_ERRORS[err.guard!])
        if (err.code === 'forbidden') throw new HttpError(403, 'forbidden', 'notYourStep')
        throw new HttpError(409, 'invalid_transition', 'invalidTransition')
      }
      throw err
    }
  }

  /** When did the request last enter `status`? */
  private enteredAt(req: WorkRequest, status: RequestStatus): number {
    for (let i = req.timeline.length - 1; i >= 0; i--) {
      const entry = req.timeline[i]!
      if (entry.to === status) return Date.parse(entry.at)
    }
    return Date.parse(req.updatedAt)
  }

  /** Advances one request's AI job to `now`. Returns true when something changed. */
  advanceRequest(id: number, now: Date, lang: ServerLanguage): boolean {
    let req = this.findRequest(id)
    const project = this.project(req.projectId)
    if (!project) return false

    if (req.status === 'reporting') {
      const done = this.enteredAt(req, 'reporting') + this.opts.reportSeconds * 1000
      if (now.getTime() < done) return false
      const at = new Date(done)
      const selection = this.selectionFor(req.projectId, 'report')
      this.bookAi(
        'report',
        selection,
        this.shapeOf(req, (req.report?.revision ?? 0) + 1),
        at.toISOString(),
        req.id,
      )
      const report = { ...generateReport(req, project, at, lang), generatedBy: selection }
      // Nothing to confirm when the AI cannot or need not do the work: a developer takes over.
      const confirm =
        this.opts.scopeCheck !== false && (report.verdict === 'feasible' || report.verdict === 'conditional')
      const scope = confirm ? { proposal: generateScope(req, project, report, lang) } : undefined
      req = this.apply(
        { ...req, report, scope },
        { event: confirm ? 'scopeReady' : 'reportReady' },
        { type: 'ai' },
        at,
      )
      this.replace(req)
      this.notifyStatus(req, at)
      return true
    }

    if (req.status === 'in_progress' && req.work) {
      const started = Date.parse(req.work.startedAt)
      const progress = (now.getTime() - started) / (this.opts.workSeconds * 1000)
      if (progress < 1) {
        const phase = phaseAt(progress)
        if (phase === req.work.phase) return false
        this.replace({ ...req, work: { ...req.work, phase } })
        return true
      }
      const at = new Date(started + this.opts.workSeconds * 1000)
      const finished = finishWork(req, project, at, lang)
      const regression = finished.regression
      const agent = req.work.agent ?? this.agentFor(req.projectId)
      const entry = this.bookAi(
        'work',
        { provider: agent.provider, model: agent.model },
        this.shapeOf(req, req.work.attempt),
        at.toISOString(),
        req.id,
      )
      const work = { ...finished.work, agent, ...(entry ? { costKrw: entry.costKrw } : {}) }
      req = this.apply({ ...req, work, regression }, { event: 'workFinished' }, { type: 'ai' }, at)
      this.replace(req)
      this.notifyStatus(req, at)
      return true
    }
    return false
  }

  /** Advances every running AI job. Called before each API response. */
  tick(now: Date, lang: ServerLanguage): boolean {
    let changed = false
    for (const req of [...this.state.requests]) {
      if (req.status === 'reporting' || req.status === 'in_progress') {
        changed = this.advanceRequest(req.id, now, lang) || changed
      }
    }
    return changed
  }

  /* ---------- requests ---------- */

  precheck(user: User, draft: RequestDraft, now: Date, lang: ServerLanguage): PrecheckIssue[] {
    this.require(user, 'request:create')
    if (this.project(draft.projectId)) {
      const shape = {
        seed: draft.title.length + draft.desiredBehavior.length,
        criteria: draft.acceptanceCriteria.length,
        targets: draft.targetIds.length,
        attempt: 1,
      }
      this.bookAi('precheck', this.selectionFor(draft.projectId, 'precheck'), shape, now.toISOString())
    }
    return precheckDraft(draft, this.today(now), lang)
  }

  createRequest(user: User, draft: RequestSubmission, now: Date, lang: ServerLanguage): WorkRequest {
    this.require(user, 'request:create')
    const project = this.project(draft.projectId)
    if (!project || !project.active) throw new HttpError(400, 'bad_request', 'projectNotFound')
    const unknownTarget = draft.targetIds.find((t) => !project.targets.some((pt) => pt.id === t))
    if (unknownTarget) throw new HttpError(400, 'bad_request', 'unknownTarget', { target: unknownTarget })

    this.requireAttachments(user, draft.attachmentIds, 'attachmentIds')
    const attachments = this.attachmentsOf(user.id, draft.attachmentIds)
    const at = now.toISOString()
    const id = this.state.nextRequestId++

    // A checklist request is checked item by item: every finding becomes an acceptance criterion.
    const checklist =
      draft.type === 'checklist'
        ? (draft.checklist ?? []).map((item, i) => ({
            id: `k${i + 1}`,
            criterionId: `c${i + 1}`,
            ref: item.ref,
            ...(item.clause ? { clause: item.clause } : {}),
            finding: item.finding,
            ...(item.expected ? { expected: item.expected } : {}),
          }))
        : undefined
    const criteria = checklist
      ? checklist.map((k) => ({
          id: k.criterionId,
          text: `[${k.ref}] ${k.expected ?? k.finding}`.slice(0, 300),
        }))
      : draft.acceptanceCriteria.map((c, i) => ({ id: `c${i + 1}`, text: c.text }))

    let req: WorkRequest = {
      id,
      title: draft.title,
      projectId: draft.projectId,
      type: draft.type,
      targetIds: draft.targetIds,
      ...(draft.targetOther ? { targetOther: draft.targetOther } : {}),
      currentBehavior: draft.currentBehavior,
      desiredBehavior: draft.desiredBehavior,
      acceptanceCriteria: criteria,
      ...(checklist ? { checklist } : {}),
      ...(checklist && draft.checklistSource ? { checklistSource: draft.checklistSource } : {}),
      ...(draft.outOfScope ? { outOfScope: draft.outOfScope } : {}),
      attachments,
      ...(draft.desiredDate ? { desiredDate: draft.desiredDate } : {}),
      ...(draft.desiredDateReason ? { desiredDateReason: draft.desiredDateReason } : {}),
      requesterId: user.id,
      ...(project.ownerIds[0] ? { assigneeId: project.ownerIds[0] } : {}),
      status: 'submitted',
      createdAt: at,
      updatedAt: at,
      precheck: precheckDraft(draft, this.today(now), lang),
      regression: [],
      verification: [],
      timeline: [
        {
          id: this.newId('tl'),
          at,
          actor: { type: 'user', userId: user.id },
          event: 'created',
          to: 'submitted',
        },
      ],
    }
    req = this.apply(req, { event: 'startReport' }, { type: 'system' }, now)
    this.state.requests.push(req)
    // The draft it was written in has done its job. Someone else's, or one already gone, is ignored.
    if (draft.draftId) {
      this.state.drafts = this.state.drafts.filter((d) => d.id !== draft.draftId || d.ownerId !== user.id)
    }
    return req
  }

  transition(
    user: User,
    id: number,
    command: TransitionCommand,
    now: Date,
    lang: ServerLanguage,
  ): WorkRequest {
    this.tick(now, lang)
    const req = this.findRequest(id)
    if (!this.canRead(user, req)) throw new HttpError(404, 'not_found', 'requestNotFound', { id })
    const ctx = {
      user,
      request: req,
      project: this.project(req.projectId),
      rolePermissions: this.opts.rolePermissions,
    }
    if (!isAuthorized(command.event, ctx)) throw new HttpError(403, 'forbidden', 'notYourStep')
    let next = this.apply(req, command, { type: 'user', userId: user.id }, now)
    if (
      command.event === 'runWork' ||
      command.event === 'requestRevision' ||
      command.event === 'reviseScope'
    ) {
      // Each starts an AI job someone chose to repeat. 0 means no limit. Answering a
      // developer's question (provideInfo) also rewrites the report but is never refused,
      // or the requester would be stuck.
      const limit = this.state.budget.perRequestLimitKrw
      if (overRequestLimit(this.requestSpentKrw(req.id), limit)) {
        throw new HttpError(409, 'guard_failed', 'requestBudgetExceeded', { limit })
      }
    }
    if (command.event === 'runWork' || command.event === 'requestRevision') {
      if (!next.assigneeId) next = { ...next, assigneeId: user.id }
      if (next.work) next = { ...next, work: { ...next.work, agent: this.agentFor(next.projectId) } }
    }
    this.replace(next)
    this.notifyStatus(next, now, user.id)
    return next
  }

  getRequest(user: User, id: number): WorkRequest {
    const req = this.findRequest(id)
    if (!this.canRead(user, req)) throw new HttpError(404, 'not_found', 'requestNotFound', { id })
    return req
  }

  listRequests(
    user: User,
    query: { scope: RequestScope; status?: string; projectId?: string; q?: string },
  ): WorkRequestSummary[] {
    if (query.scope === 'all') this.require(user, 'request:read:all')
    if (query.scope === 'assigned') this.require(user, 'request:review')
    const statuses = query.status ? new Set(query.status.split(',')) : null
    const q = query.q?.trim().toLowerCase().replace(/^#/, '')

    return this.state.requests
      .filter((r) => {
        if (query.scope === 'mine' && r.requesterId !== user.id) return false
        if (
          query.scope === 'assigned' &&
          user.role !== 'admin' &&
          !this.responsibleDevelopers(r).includes(user.id)
        )
          return false
        if (statuses && !statuses.has(r.status)) return false
        if (query.projectId && r.projectId !== query.projectId) return false
        if (q && !r.title.toLowerCase().includes(q) && String(r.id) !== q) return false
        return true
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((r) => ({
        id: r.id,
        title: r.title,
        projectId: r.projectId,
        type: r.type,
        status: r.status,
        requesterId: r.requesterId,
        ...(r.assigneeId ? { assigneeId: r.assigneeId } : {}),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        ...(r.desiredDate ? { desiredDate: r.desiredDate } : {}),
        ...(r.report ? { verdict: r.report.verdict } : {}),
        ...(r.work ? { workPhase: r.work.phase } : {}),
        ...(r.release?.scheduledDate ? { scheduledDate: r.release.scheduledDate } : {}),
      }))
  }

  saveVerification(user: User, id: number, checks: WorkRequest['verification'], now: Date): WorkRequest {
    const req = this.getRequest(user, id)
    if (req.requesterId !== user.id) throw new HttpError(403, 'forbidden', 'requesterOnlyVerify')
    if (req.status !== 'verification') throw new HttpError(409, 'invalid_transition', 'notInVerification')
    const byId = new Map(checks.map((c) => [c.criterionId, c]))
    return this.replace({
      ...req,
      updatedAt: now.toISOString(),
      verification: req.acceptanceCriteria.map(
        (c) => byId.get(c.id) ?? { criterionId: c.id, result: 'pending' },
      ),
    })
  }

  /** Advisory: recorded on the run and sent to the developers; the status does not change. */
  previewFeedback(user: User, id: number, input: PreviewFeedbackInput, now: Date): WorkRequest {
    const req = this.getRequest(user, id)
    if (req.requesterId !== user.id) throw new HttpError(403, 'forbidden', 'requesterOnlyPreview')
    if (req.status !== 'code_review' || !req.work?.preview) {
      throw new HttpError(409, 'invalid_transition', 'noPreviewNow')
    }
    const at = now.toISOString()
    const note = input.note?.trim()
    const next = this.replace({
      ...req,
      updatedAt: at,
      work: {
        ...req.work,
        previewFeedback: { at, by: user.id, verdict: input.verdict, ...(note ? { note } : {}) },
      },
      timeline: [
        ...req.timeline,
        {
          id: this.newId('tl'),
          at,
          actor: { type: 'user', userId: user.id },
          event: `preview_${input.verdict}`,
          ...(note ? { note } : {}),
        },
      ],
    })
    this.notify(
      this.responsibleDevelopers(req),
      input.verdict === 'needs_change' ? 'previewChange' : 'previewGood',
      { title: req.title, note: note ?? '' },
      req.id,
      input.verdict === 'needs_change',
      now,
      user.id,
    )
    return next
  }

  updateRegression(
    user: User,
    id: number,
    checks: Array<{ id: string; result: 'pending' | 'passed' | 'failed' }>,
    now: Date,
  ): WorkRequest {
    const req = this.getRequest(user, id)
    if (!this.isResponsible(user, req)) throw new HttpError(403, 'forbidden', 'developerOnlyRegression')
    if (isTerminal(req.status)) throw new HttpError(409, 'invalid_transition', 'requestClosed')
    const byId = new Map(checks.map((c) => [c.id, c.result]))
    return this.replace({
      ...req,
      updatedAt: now.toISOString(),
      regression: req.regression.map((r) => ({ ...r, result: byId.get(r.id) ?? r.result })),
    })
  }

  updateRelease(
    user: User,
    id: number,
    input: { scheduledDate?: string; note?: string },
    now: Date,
  ): WorkRequest {
    const req = this.getRequest(user, id)
    if (!this.isResponsible(user, req)) throw new HttpError(403, 'forbidden', 'developerOnlySchedule')
    if (!['code_review', 'verification', 'changes_requested', 'release_scheduled'].includes(req.status)) {
      throw new HttpError(409, 'invalid_transition', 'cannotScheduleNow')
    }
    // A new date cannot be in the past on the business calendar. Re-sending the
    // date already set (only the note changes) stays possible after it has passed.
    const today = this.today(now)
    if (
      input.scheduledDate &&
      input.scheduledDate !== req.release?.scheduledDate &&
      input.scheduledDate < today
    ) {
      throw new HttpError(400, 'bad_request', 'releaseDateInPast', { today })
    }
    const at = now.toISOString()
    const next = this.replace({
      ...req,
      updatedAt: at,
      release: { ...req.release, ...input },
      timeline: [
        ...req.timeline,
        {
          id: this.newId('tl'),
          at,
          actor: { type: 'user', userId: user.id },
          event: 'release_updated',
          ...(input.scheduledDate ? { note: input.scheduledDate } : {}),
        },
      ],
    })
    if (input.scheduledDate) {
      this.notify(
        [req.requesterId],
        'releaseDateSet',
        { date: input.scheduledDate },
        req.id,
        false,
        now,
        user.id,
      )
    }
    return next
  }

  regressionQueue(user: User): RegressionQueue {
    this.require(user, 'regression:view')
    return this.state.requests
      .filter((r) => r.regression.length > 0 && !isTerminal(r.status))
      .filter((r) => user.role === 'admin' || this.responsibleDevelopers(r).includes(user.id))
      .map((r) => ({
        requestId: r.id,
        title: r.title,
        projectId: r.projectId,
        status: r.status,
        checks: r.regression,
      }))
  }

  /** The person's own upload of that id. Ids are easy to guess: someone else's counts as missing. */
  private ownAttachment(ownerId: string, id: string): StoredAttachment | undefined {
    const stored = this.state.attachments.find((a) => a.id === id)
    return stored && stored.ownerId === ownerId ? stored : undefined
  }

  /**
   * Refuses ids that are not the person's uploads, naming each by its place
   * (issues[].path = <field>.<index>) so the form can say which to upload again.
   */
  private requireAttachments(user: User, ids: readonly string[], field: string): void {
    const missing = ids.flatMap((id, i) => (this.ownAttachment(user.id, id) ? [] : [`${field}.${i}`]))
    if (missing.length) throw new HttpError(400, 'bad_request', 'attachmentNotFound', {}, missing)
  }

  /** The owner's uploads among `ids`, each once, in order; ids that resolve to nothing are skipped. */
  private attachmentsOf(ownerId: string, ids: readonly string[]): Attachment[] {
    return [...new Set(ids)].flatMap((id) => {
      const stored = this.ownAttachment(ownerId, id)
      return stored ? [publicAttachment(stored)] : []
    })
  }

  addAttachment(user: User, file: { name: string; size: number; type: string; url: string }): Attachment {
    this.require(user, 'request:create')
    const stored: StoredAttachment = {
      id: this.newId('att'),
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      url: file.url,
      ownerId: user.id,
    }
    this.state.attachments.push(stored)
    return publicAttachment(stored)
  }

  /* ---------- saved drafts ---------- */

  /** A draft of the person's own; anyone else's is "not found", like one that never existed. */
  private findDraft(user: User, id: string): StoredDraft {
    const draft = this.state.drafts.find((d) => d.id === id && d.ownerId === user.id)
    if (!draft) throw new HttpError(404, 'not_found', 'draftNotFound')
    return draft
  }

  private presentDraft(draft: StoredDraft): SavedDraft {
    const attachments = this.attachmentsOf(draft.ownerId, draft.content.attachmentIds ?? [])
    return { ...this.summarizeDraft(draft, attachments.length), content: draft.content, attachments }
  }

  private summarizeDraft(draft: StoredDraft, attachmentCount: number): SavedDraftSummary {
    const { projectId, type } = draft.content
    return {
      id: draft.id,
      title: draft.content.title?.trim() ?? '',
      ...(projectId ? { projectId } : {}),
      ...(type ? { type } : {}),
      step: draft.step,
      attachmentCount,
      version: draft.version,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }
  }

  listDrafts(user: User): SavedDraftSummary[] {
    this.require(user, 'request:create')
    // Most recently changed first; of two changed in the same moment, the later change (stored last).
    return this.state.drafts
      .map((draft, i) => ({ draft, i }))
      .filter(({ draft }) => draft.ownerId === user.id)
      .sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt) || b.i - a.i)
      .map(({ draft }) =>
        this.summarizeDraft(
          draft,
          this.attachmentsOf(draft.ownerId, draft.content.attachmentIds ?? []).length,
        ),
      )
  }

  getDraft(user: User, id: string): SavedDraft {
    this.require(user, 'request:create')
    return this.presentDraft(this.findDraft(user, id))
  }

  createDraft(
    user: User,
    input: { step: number; content: DraftContent; clientId?: string | undefined },
    now: Date,
  ): SavedDraft {
    this.require(user, 'request:create')
    // Made already, and the answer was lost: the same draft, as it is now.
    const made = input.clientId
      ? this.state.drafts.find((d) => d.ownerId === user.id && d.clientId === input.clientId)
      : undefined
    if (made) return this.presentDraft(made)
    const limit = this.opts.draftsPerAccount ?? appConfig.drafts.maxPerAccount
    if (this.state.drafts.filter((d) => d.ownerId === user.id).length >= limit) {
      throw new HttpError(409, 'limit_reached', 'draftLimit', { limit })
    }
    this.requireAttachments(user, input.content.attachmentIds ?? [], 'content.attachmentIds')
    const at = now.toISOString()
    const draft: StoredDraft = {
      id: this.newId('draft'),
      ownerId: user.id,
      ...(input.clientId ? { clientId: input.clientId } : {}),
      step: input.step,
      content: input.content,
      version: 1,
      createdAt: at,
      updatedAt: at,
    }
    this.state.drafts.push(draft)
    return this.presentDraft(draft)
  }

  /** Replaces step and content, but only over the version the change was based on. */
  updateDraft(
    user: User,
    id: string,
    input: { baseVersion: number; step: number; content: DraftContent },
    now: Date,
  ): SavedDraft {
    this.require(user, 'request:create')
    const current = this.findDraft(user, id)
    if (input.baseVersion !== current.version) throw new HttpError(409, 'conflict', 'draftConflict')
    this.requireAttachments(user, input.content.attachmentIds ?? [], 'content.attachmentIds')
    const next: StoredDraft = {
      ...current,
      step: input.step,
      content: input.content,
      version: current.version + 1,
      updatedAt: now.toISOString(),
    }
    this.state.drafts = [...this.state.drafts.filter((d) => d !== current), next]
    return this.presentDraft(next)
  }

  deleteDraft(user: User, id: string): void {
    this.require(user, 'request:create')
    const draft = this.findDraft(user, id)
    this.state.drafts = this.state.drafts.filter((d) => d !== draft)
  }

  /* ---------- users & projects ---------- */

  createUser(actor: User, input: { name: string; email: string; role: User['role']; team?: string }): User {
    this.require(actor, 'user:manage')
    if (input.role === 'operator') throw new HttpError(403, 'forbidden', 'operatorProvisioned')
    if (this.state.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new HttpError(400, 'bad_request', 'emailTaken')
    }
    const user: User = { id: this.newId('u'), active: true, ...input }
    this.state.users.push(user)
    return user
  }

  updateUser(actor: User, id: string, patch: Partial<Pick<User, 'role' | 'team' | 'active'>>): User {
    this.require(actor, 'user:manage')
    const i = this.state.users.findIndex((u) => u.id === id)
    if (i < 0) throw new HttpError(404, 'not_found', 'userNotFound')
    // Operators run the service; an organization admin can neither make nor change one.
    if (this.state.users[i]!.role === 'operator' || patch.role === 'operator') {
      throw new HttpError(403, 'forbidden', 'operatorProvisioned')
    }
    if (id === actor.id && (patch.active === false || (patch.role && patch.role !== actor.role))) {
      throw new HttpError(400, 'bad_request', 'cannotChangeSelf')
    }
    const next = { ...this.state.users[i]!, ...patch }
    this.state.users[i] = next
    return next
  }

  saveProject(actor: User, input: ProjectInput, id?: string): Project {
    this.require(actor, 'project:manage')
    const unknownOwner = input.ownerIds.find(
      (o) => this.user(o)?.role !== 'developer' && this.user(o)?.role !== 'admin',
    )
    if (unknownOwner) throw new HttpError(400, 'bad_request', 'ownersMustBeDevelopers')
    const existing = id ? this.project(id) : undefined
    if (id && !existing) throw new HttpError(404, 'not_found', 'projectNotFound')
    const project: Project = {
      id: existing?.id ?? this.newId('p'),
      ...input,
      targets: input.targets.map((t) => ({ ...t, id: t.id ?? this.newId('t') })),
      constraints: input.constraints.map(({ id, text, reference }) => ({
        id: id ?? this.newId('pc'),
        text,
        ...(reference ? { reference } : {}),
      })),
      wikiStats: existing?.wikiStats ?? { verifiedDocs: 0, totalDocs: 0 },
    }
    if (existing) this.state.projects[this.state.projects.indexOf(existing)] = project
    else this.state.projects.push(project)
    return project
  }

  /* ---------- notifications ---------- */

  /** A person who never saved settings (e.g. invited later) gets the defaults. */
  notificationSettings(user: User): NotificationSettings {
    return this.state.notificationSettings[user.id] ?? { ...DEFAULT_NOTIFICATION_SETTINGS }
  }

  notificationsFor(user: User, lang: ServerLanguage): Notification[] {
    return this.state.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map((n) => this.render(n, lang))
  }

  markRead(user: User, id: string | 'all', now: Date, lang: ServerLanguage): Notification | undefined {
    const at = now.toISOString()
    let found: StoredNotification | undefined
    for (const n of this.state.notifications) {
      if (n.userId !== user.id || (id !== 'all' && n.id !== id)) continue
      n.readAt ??= at
      found = n
    }
    if (id !== 'all' && !found) throw new HttpError(404, 'not_found', 'notificationNotFound')
    return found ? this.render(found, lang) : undefined
  }

  /* ---------- AI operations (service operator) ---------- */

  aiSettings(user: User): AiSettings {
    this.require(user, 'agent:manage')
    const providers: ProviderConnection[] = AI_PROVIDERS.map((provider) => {
      const p = this.state.ai.providers[provider]
      return p
        ? { provider, connected: true, keyHint: p.keyHint, updatedAt: p.updatedAt }
        : { provider, connected: false }
    })
    return { defaults: this.state.ai.selections, projectOverrides: this.state.ai.overrides, providers }
  }

  /** A selection must name a priced model of a connected provider. */
  private checkSelection(sel: AiSelection, pricing: AiPricing = this.state.ai.pricing): void {
    if (!this.state.ai.providers[sel.provider]) {
      throw new HttpError(400, 'bad_request', 'providerNotConnected', { provider: sel.provider })
    }
    if (!priceOf(pricing, sel))
      throw new HttpError(400, 'bad_request', 'modelNotPriced', { model: sel.model })
  }

  updateAiSettings(user: User, input: AiSettingsInput): AiSettings {
    this.require(user, 'agent:manage')
    const seen = new Set<string>()
    for (const o of input.projectOverrides) {
      if (!this.project(o.projectId)) throw new HttpError(400, 'bad_request', 'projectNotFound')
      const key = `${o.projectId}/${o.task}`
      if (seen.has(key)) throw new HttpError(400, 'bad_request', 'checkInput')
      seen.add(key)
    }
    for (const sel of selectionsInUse(input)) this.checkSelection(sel)
    this.state.ai.selections = input.defaults
    this.state.ai.overrides = input.projectOverrides
    return this.aiSettings(user)
  }

  setProviderKey(user: User, provider: AiProvider, apiKey: string, now: Date): ProviderConnection {
    this.require(user, 'agent:manage')
    // The mock keeps only the hint. A real backend stores the key encrypted and never returns it.
    const p = { keyHint: apiKey.slice(-4), updatedAt: now.toISOString() }
    this.state.ai.providers[provider] = p
    return { provider, connected: true, ...p }
  }

  removeProviderKey(user: User, provider: AiProvider): void {
    this.require(user, 'agent:manage')
    const inUse = selectionsInUse({
      defaults: this.state.ai.selections,
      projectOverrides: this.state.ai.overrides,
    })
    if (inUse.some((s) => s.provider === provider)) {
      throw new HttpError(409, 'guard_failed', 'providerInUse', { provider })
    }
    delete this.state.ai.providers[provider]
  }

  aiPricing(user: User): AiPricing {
    if (!this.can(user, 'agent:manage') && !this.can(user, 'usage:view')) {
      throw new HttpError(403, 'forbidden', 'forbidden')
    }
    return this.state.ai.pricing
  }

  /** New prices apply to usage booked from now on; booked entries keep their price. */
  updateAiPricing(user: User, pricing: AiPricing): AiPricing {
    this.require(user, 'agent:manage')
    const inUse = selectionsInUse({
      defaults: this.state.ai.selections,
      projectOverrides: this.state.ai.overrides,
    })
    const dropped = inUse.find((s) => !priceOf(pricing, s))
    if (dropped) throw new HttpError(409, 'guard_failed', 'modelInUse', { model: dropped.model })
    this.state.ai.pricing = pricing
    return pricing
  }

  aiUsageReport(user: User, month: string): AiUsageReport {
    this.require(user, 'usage:view')
    const entries = this.usageIn(month)
    const money = (n: number) => Math.round(n)
    type Acc = { calls: number; costKrw: number; tokens: TokenUsage }
    const group = <K>(keyOf: (e: AiUsageEntry) => K) => {
      const m = new Map<K, Acc>()
      for (const e of entries) {
        const k = keyOf(e)
        const a = m.get(k) ?? { calls: 0, costKrw: 0, tokens: ZERO_USAGE }
        m.set(k, { calls: a.calls + 1, costKrw: a.costKrw + e.costKrw, tokens: addUsage(a.tokens, e.tokens) })
      }
      return m
    }
    const byProvider = group((e) => e.provider)
    const byModel = group((e) => `${e.provider}/${e.model}`)
    const byTask = group((e) => e.task)
    const daily = group((e) => `${this.dateOf(e.at)}/${e.provider}`)
    const byRequest = group((e) => e.requestId ?? 0)
    byRequest.delete(0)
    return {
      month,
      totalKrw: money(entries.reduce((n, e) => n + e.costKrw, 0)),
      totalUsd: Math.round(entries.reduce((n, e) => n + e.costUsd, 0) * 100) / 100,
      calls: entries.length,
      monthlyLimitKrw: this.state.budget.monthlyLimitKrw,
      alertThresholdPct: this.state.budget.alertThresholdPct,
      usdKrw: this.state.ai.pricing.usdKrw,
      pricingAsOf: this.state.ai.pricing.asOf,
      byProvider: AI_PROVIDERS.filter((p) => byProvider.has(p)).map((provider) => {
        const a = byProvider.get(provider)!
        return { provider, calls: a.calls, costKrw: money(a.costKrw), tokens: a.tokens }
      }),
      byModel: [...byModel.entries()]
        .map(([key, a]) => {
          const [provider, ...rest] = key.split('/')
          return {
            provider: provider as AiProvider,
            model: rest.join('/'),
            calls: a.calls,
            costKrw: money(a.costKrw),
            tokens: a.tokens,
          }
        })
        .sort((x, y) => y.costKrw - x.costKrw),
      byTask: AI_TASKS.filter((t) => byTask.has(t)).map((task) => {
        const a = byTask.get(task)!
        return { task, calls: a.calls, costKrw: money(a.costKrw) }
      }),
      daily: [...daily.entries()]
        .map(([key, a]) => {
          const [date, provider] = key.split('/') as [string, AiProvider]
          return { date, provider, costKrw: money(a.costKrw) }
        })
        .sort((x, y) => x.date.localeCompare(y.date) || x.provider.localeCompare(y.provider)),
      topRequests: [...byRequest.entries()]
        .sort((x, y) => y[1].costKrw - x[1].costKrw)
        .slice(0, 10)
        .flatMap(([requestId, a]) => {
          const req = this.state.requests.find((r) => r.id === requestId)
          return req
            ? [{ requestId, projectId: req.projectId, costKrw: money(a.costKrw), calls: a.calls }]
            : []
        }),
    }
  }

  /* ---------- insights ---------- */

  private usageIn(month: string): AiUsageEntry[] {
    return this.state.aiUsage.filter((e) => this.dateOf(e.at).startsWith(month))
  }

  budget(month: string): Budget {
    const inMonth = this.usageIn(month)
    const byModel = new Map<string, { provider: AiProvider; model: string; spentKrw: number }>()
    for (const e of inMonth) {
      const key = `${e.provider}/${e.model}`
      const row = byModel.get(key) ?? { provider: e.provider, model: e.model, spentKrw: 0 }
      row.spentKrw += e.costKrw
      byModel.set(key, row)
    }
    return {
      month,
      ...this.state.budget,
      spentKrw: Math.round(inMonth.reduce((n, e) => n + e.costKrw, 0)),
      byModel: [...byModel.values()]
        .map((r) => ({ ...r, spentKrw: Math.round(r.spentKrw) }))
        .sort((a, b) => b.spentKrw - a.spentKrw),
    }
  }

  isDelayed(r: WorkRequest, today: string): boolean {
    if (isTerminal(r.status)) return false
    if (r.release?.scheduledDate && r.release.scheduledDate < today) return true
    return Boolean(r.desiredDate && r.desiredDate < today && r.status !== 'release_scheduled')
  }

  dashboard(user: User, month: string, now: Date): DashboardSummary {
    this.require(user, 'dashboard:view')
    const today = this.today(now)
    const prev = (() => {
      const [y, m] = month.split('-').map(Number) as [number, number]
      return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    })()
    const reqs = this.state.requests
    // While a month is in progress, compare it with the same span of the previous month,
    // not the whole of it — otherwise every month looks like a collapse on day 2.
    const lastDay = month === today.slice(0, 7) ? today.slice(8, 10) : '31'
    const filed = (r: WorkRequest) => this.dateOf(r.createdAt)
    const receivedPrevMonth = reqs.filter((r) => {
      const d = filed(r)
      return d.startsWith(prev) && d.slice(8, 10) <= lastDay
    }).length
    const open = reqs.filter((r) => !isTerminal(r.status))
    const released = (r: WorkRequest) => (r.release?.releasedAt ? this.dateOf(r.release.releasedAt) : '')
    const doneInMonth = reqs.filter((r) => r.status === 'done' && released(r).startsWith(month))
    const leads = doneInMonth.map((r) => (Date.parse(r.release!.releasedAt!) - Date.parse(r.createdAt)) / DAY)
    const delayed = open.filter((r) => this.isDelayed(r, today))
    const weekEnd = addDays(today, 7)

    const upcoming = new Map<string, { date: string; projectId: string; requestIds: number[] }>()
    for (const r of reqs) {
      const date = r.release?.scheduledDate
      if (r.status !== 'release_scheduled' || !date || date < today || date > weekEnd) continue
      const key = `${date}|${r.projectId}`
      const item = upcoming.get(key) ?? { date, projectId: r.projectId, requestIds: [] }
      item.requestIds.push(r.id)
      upcoming.set(key, item)
    }

    return {
      month,
      received: reqs.filter((r) => filed(r).startsWith(month)).length,
      receivedPrevMonth,
      inProgress: open.length,
      delayed: delayed.length,
      done: doneInMonth.length,
      ...(leads.length
        ? { avgLeadTimeDays: Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 }
        : {}),
      aiCostKrw: this.budget(month).spentKrw,
      aiBudgetKrw: this.state.budget.monthlyLimitKrw,
      aiAlertThresholdPct: this.state.budget.alertThresholdPct,
      byProject: this.state.projects.map((p) => ({
        projectId: p.id,
        done: doneInMonth.filter((r) => r.projectId === p.id).length,
        inProgress: open.filter((r) => r.projectId === p.id).length,
      })),
      upcomingReleases: [...upcoming.values()].sort((a, b) => a.date.localeCompare(b.date)),
      attention: {
        infoNeeded: open.filter((r) => r.status === 'info_needed').length,
        delayedRequestIds: delayed.map((r) => r.id).sort((a, b) => a - b),
      },
    }
  }

  releases(user: User, from?: string, to?: string): ReleaseScheduleItem[] {
    this.require(user, 'schedule:view')
    const groups = new Map<string, ReleaseScheduleItem>()
    // The schedule is company-wide on purpose: "when does it ship?" is the question sales asks most.
    for (const r of this.state.requests) {
      if (r.status === 'cancelled' || r.status === 'rejected') continue
      const date = r.release?.releasedAt ? this.dateOf(r.release.releasedAt) : r.release?.scheduledDate
      if (!date || (from && date < from) || (to && date > to)) continue
      const key = `${date}|${r.projectId}`
      const item = groups.get(key) ?? { date, projectId: r.projectId, requests: [] }
      item.requests.push({ id: r.id, title: r.title, status: r.status })
      groups.set(key, item)
    }
    return [...groups.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.projectId.localeCompare(b.projectId),
    )
  }
}
