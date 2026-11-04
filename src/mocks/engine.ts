/**
 * In-memory backend used by the mock API. It applies the same lifecycle
 * rules a real backend must (src/domain/lifecycle.ts) and simulates the AI
 * from timestamps, so progress survives page reloads.
 *
 * Language: errors are thrown as keys and rendered per request; notifications
 * are stored as keys and rendered when read; AI text is written in the
 * language of the call that makes the AI finish (like a model would).
 */
import type { AiSettingsInput, ProjectInput, RegressionQueue, RequestScope } from '../api/contract'
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
import { finishWork, generateReport, phaseAt, simulateUsage, type UsageShape } from './ai'
import { renderNotification, type ErrorKey, type NotificationKey, type ServerLanguage } from './copy'

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/** Bump when the stored shape changes: older demo data is discarded and reseeded. */
export const STATE_VERSION = 4

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

export interface MockState {
  version: typeof STATE_VERSION
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
  attachments: Attachment[]
}

export interface EngineOptions {
  reportSeconds: number
  workSeconds: number
  rolePermissions: RolePermissions
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
  readonly code:
    'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'invalid_transition' | 'guard_failed'
  readonly key: ErrorKey
  readonly params: Record<string, string | number>
  constructor(
    status: number,
    code: HttpError['code'],
    key: ErrorKey,
    params: Record<string, string | number> = {},
  ) {
    super(key)
    this.status = status
    this.code = code
    this.key = key
    this.params = params
  }
}

const DAY = 86_400_000

const GUARD_ERRORS: Record<GuardName, ErrorKey> = {
  criteriaAllPassed: 'needAllPassed',
  criteriaOneFailed: 'needOneFailed',
  assumptionsUnchecked: 'assumptionsUnchecked',
}

export function toDate(iso: string): string {
  return iso.slice(0, 10)
}

/** Local calendar date (YYYY-MM-DD) — what a person means by "today". */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10)
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
    }
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

    switch (req.status) {
      case 'review':
        send(devs, 'reportReady', { title: req.title }, true)
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
        if (req.infoRequest?.answer) send(devs, 'requesterAnswered', {}, false)
        break
      case 'rejected':
        send(requester, 'rejected', { reason: req.rejectionReason ?? req.title }, false)
        break
      case 'in_progress':
        send(requester, 'workStarted', { title: req.title }, false)
        break
      case 'code_review':
        send(devs, 'workFinished', {}, true)
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
      req = this.apply({ ...req, report }, { event: 'reportReady' }, { type: 'ai' }, at)
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
    return precheckDraft(draft, localDate(now), lang)
  }

  createRequest(user: User, draft: RequestDraft, now: Date, lang: ServerLanguage): WorkRequest {
    this.require(user, 'request:create')
    const project = this.project(draft.projectId)
    if (!project || !project.active) throw new HttpError(400, 'bad_request', 'projectNotFound')
    const unknownTarget = draft.targetIds.find((t) => !project.targets.some((pt) => pt.id === t))
    if (unknownTarget) throw new HttpError(400, 'bad_request', 'unknownTarget', { target: unknownTarget })

    const at = now.toISOString()
    const id = this.state.nextRequestId++
    const attachments = draft.attachmentIds
      .map((aid) => this.state.attachments.find((a) => a.id === aid))
      .filter((a): a is Attachment => Boolean(a))

    let req: WorkRequest = {
      id,
      title: draft.title,
      projectId: draft.projectId,
      type: draft.type,
      targetIds: draft.targetIds,
      ...(draft.targetOther ? { targetOther: draft.targetOther } : {}),
      currentBehavior: draft.currentBehavior,
      desiredBehavior: draft.desiredBehavior,
      acceptanceCriteria: draft.acceptanceCriteria.map((c, i) => ({ id: `c${i + 1}`, text: c.text })),
      ...(draft.outOfScope ? { outOfScope: draft.outOfScope } : {}),
      attachments,
      ...(draft.desiredDate ? { desiredDate: draft.desiredDate } : {}),
      ...(draft.desiredDateReason ? { desiredDateReason: draft.desiredDateReason } : {}),
      requesterId: user.id,
      ...(project.ownerIds[0] ? { assigneeId: project.ownerIds[0] } : {}),
      status: 'submitted',
      createdAt: at,
      updatedAt: at,
      precheck: precheckDraft(draft, localDate(now), lang),
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
    if (command.event === 'runWork' || command.event === 'requestRevision') {
      // Both start an AI run, the cost that repeats per request. 0 means no limit.
      const limit = this.state.budget.perRequestLimitKrw
      if (overRequestLimit(this.requestSpentKrw(req.id), limit)) {
        throw new HttpError(409, 'guard_failed', 'requestBudgetExceeded', { limit })
      }
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

  updateRegression(
    user: User,
    id: number,
    checks: Array<{ id: string; result: 'pending' | 'passed' | 'failed' }>,
    now: Date,
  ): WorkRequest {
    const req = this.getRequest(user, id)
    if (!this.isResponsible(user, req)) throw new HttpError(403, 'forbidden', 'developerOnlyRegression')
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

  addAttachment(user: User, file: { name: string; size: number; type: string; url: string }): Attachment {
    this.require(user, 'request:create')
    const attachment: Attachment = {
      id: this.newId('att'),
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      url: file.url,
    }
    this.state.attachments.push(attachment)
    return attachment
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
    const daily = group((e) => `${localDate(new Date(e.at))}/${e.provider}`)
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
    return this.state.aiUsage.filter((e) => localDate(new Date(e.at)).startsWith(month))
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
    const today = localDate(now)
    const prev = (() => {
      const [y, m] = month.split('-').map(Number) as [number, number]
      return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    })()
    const reqs = this.state.requests
    // While a month is in progress, compare it with the same span of the previous month,
    // not the whole of it — otherwise every month looks like a collapse on day 2.
    const lastDay = month === today.slice(0, 7) ? today.slice(8, 10) : '31'
    const filed = (r: WorkRequest) => localDate(new Date(r.createdAt))
    const receivedPrevMonth = reqs.filter((r) => {
      const d = filed(r)
      return d.startsWith(prev) && d.slice(8, 10) <= lastDay
    }).length
    const open = reqs.filter((r) => !isTerminal(r.status))
    const doneInMonth = reqs.filter((r) => r.status === 'done' && r.release?.releasedAt?.startsWith(month))
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
      const date = r.release?.releasedAt
        ? localDate(new Date(r.release.releasedAt))
        : r.release?.scheduledDate
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
