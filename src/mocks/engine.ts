/**
 * In-memory backend used by the mock API. It applies the same lifecycle
 * rules a real backend must (src/domain/lifecycle.ts) and simulates the AI
 * from timestamps, so progress survives page reloads.
 */
import type { ProjectInput, RegressionQueue, RequestScope } from '../api/contract'
import {
  applyTransition,
  isAuthorized,
  isTerminal,
  LifecycleError,
  type AnyCommand,
  type TransitionCommand,
} from '../domain/lifecycle'
import type {
  Actor,
  Attachment,
  Budget,
  DashboardSummary,
  Notification,
  NotificationSettings,
  PrecheckIssue,
  Project,
  ReleaseScheduleItem,
  RequestDraft,
  RequestStatus,
  User,
  WorkRequest,
  WorkRequestSummary,
} from '../domain/model'
import { precheckDraft } from '../domain/precheck'
import { hasPermission, type Permission, type RolePermissions } from '../domain/roles'
import { finishWork, generateReport, phaseAt, PRECHECK_COST_KRW, reportCost } from './ai'

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export const STATE_VERSION = 1

export interface CostEntry {
  at: string
  tier: 'light' | 'heavy'
  krw: number
  requestId?: number
}

export interface MockState {
  version: typeof STATE_VERSION
  seededAt: string
  seq: number
  nextRequestId: number
  users: User[]
  projects: Project[]
  requests: WorkRequest[]
  notifications: Array<Notification & { userId: string }>
  notificationSettings: Record<string, NotificationSettings>
  budget: Pick<Budget, 'monthlyLimitKrw' | 'perRequestLimitKrw' | 'alertThresholdPct'>
  costs: CostEntry[]
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

/** Thrown by engine operations; the MSW layer turns it into an HTTP error. */
export class HttpError extends Error {
  readonly status: number
  readonly code:
    'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'invalid_transition' | 'guard_failed'
  constructor(status: number, code: HttpError['code'], message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const DAY = 86_400_000

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
    if (!this.can(user, permission)) throw new HttpError(403, 'forbidden', '이 작업을 할 권한이 없습니다.')
  }

  user(id: string): User | undefined {
    return this.state.users.find((u) => u.id === id)
  }

  project(id: string): Project | undefined {
    return this.state.projects.find((p) => p.id === id)
  }

  private findRequest(id: number): WorkRequest {
    const req = this.state.requests.find((r) => r.id === id)
    if (!req) throw new HttpError(404, 'not_found', `요청 #${id}을 찾을 수 없습니다.`)
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

  private recordCost(entry: CostEntry): void {
    this.state.costs.push(entry)
  }

  /* ---------- notifications ---------- */

  private notify(
    userIds: string[],
    message: { title: string; body: string; requestId?: number },
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
        createdAt: now.toISOString(),
        ...message,
      })
    }
  }

  private notifyStatus(req: WorkRequest, now: Date, actorId?: string): void {
    const tag = `#${req.id}`
    const devs = this.responsibleDevelopers(req)
    const requester = [req.requesterId]
    const send = (to: string[], title: string, body: string, action: boolean) =>
      this.notify(to, { title: `[${tag}] ${title}`, body, requestId: req.id }, action, now, actorId)

    switch (req.status) {
      case 'review':
        send(devs, '구현 확인 보고서가 준비되었습니다', req.title, true)
        break
      case 'info_needed':
        send(requester, '추가 정보가 필요합니다', req.infoRequest?.questions.join(' / ') ?? req.title, true)
        break
      case 'reporting':
        if (req.infoRequest?.answer)
          send(devs, '요청자가 답변했습니다', '보고서를 다시 쓰고 있습니다.', false)
        break
      case 'rejected':
        send(requester, '진행하지 않기로 했습니다', req.rejectionReason ?? req.title, false)
        break
      case 'in_progress':
        send(requester, '작업을 시작했습니다', req.title, false)
        break
      case 'code_review':
        send(devs, 'AI 작업이 끝났습니다', '변경 내용과 테스트 결과를 검토해 주세요.', true)
        break
      case 'verification':
        send(
          requester,
          '결과를 확인해 주세요',
          `완료 기준 ${req.acceptanceCriteria.length}개를 하나씩 확인해 주시면 됩니다.`,
          true,
        )
        break
      case 'changes_requested':
        send(devs, '확인에서 문제가 나왔습니다', req.title, true)
        break
      case 'release_scheduled':
        send(devs, '배포 일정을 정해 주세요', '요청자가 결과를 확인했습니다.', true)
        break
      case 'done':
        send(requester, '반영되었습니다', req.title, false)
        break
      case 'cancelled':
        send(devs, '요청이 취소되었습니다', req.title, false)
        break
      case 'submitted':
        break
    }
  }

  /* ---------- AI simulation ---------- */

  private apply(req: WorkRequest, command: AnyCommand, actor: Actor, now: Date): WorkRequest {
    try {
      return applyTransition(req, command, { actor, now, newId: () => this.newId('tl') })
    } catch (err) {
      if (err instanceof LifecycleError) {
        const status = err.code === 'forbidden' ? 403 : 409
        throw new HttpError(status, err.code, err.message)
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
  advanceRequest(id: number, now: Date): boolean {
    let req = this.findRequest(id)
    const project = this.project(req.projectId)
    if (!project) return false

    if (req.status === 'reporting') {
      const done = this.enteredAt(req, 'reporting') + this.opts.reportSeconds * 1000
      if (now.getTime() < done) return false
      const at = new Date(done)
      const report = generateReport(req, project, at)
      this.recordCost({ at: at.toISOString(), tier: 'heavy', krw: reportCost(req), requestId: req.id })
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
      const { work, regression } = finishWork(req, project, at)
      this.recordCost({ at: at.toISOString(), tier: 'heavy', krw: work.costKrw ?? 0, requestId: req.id })
      req = this.apply({ ...req, work, regression }, { event: 'workFinished' }, { type: 'ai' }, at)
      this.replace(req)
      this.notifyStatus(req, at)
      return true
    }
    return false
  }

  /** Advances every running AI job. Called before each API response. */
  tick(now: Date): boolean {
    let changed = false
    for (const req of [...this.state.requests]) {
      if (req.status === 'reporting' || req.status === 'in_progress') {
        changed = this.advanceRequest(req.id, now) || changed
      }
    }
    return changed
  }

  /* ---------- requests ---------- */

  precheck(user: User, draft: RequestDraft, now: Date): PrecheckIssue[] {
    this.require(user, 'request:create')
    this.recordCost({ at: now.toISOString(), tier: 'light', krw: PRECHECK_COST_KRW })
    return precheckDraft(draft, localDate(now))
  }

  createRequest(user: User, draft: RequestDraft, now: Date): WorkRequest {
    this.require(user, 'request:create')
    const project = this.project(draft.projectId)
    if (!project || !project.active)
      throw new HttpError(400, 'bad_request', '선택한 프로젝트를 찾을 수 없습니다.')
    const unknownTarget = draft.targetIds.find((t) => !project.targets.some((pt) => pt.id === t))
    if (unknownTarget) throw new HttpError(400, 'bad_request', `알 수 없는 대상입니다: ${unknownTarget}`)

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
      precheck: precheckDraft(draft, localDate(now)),
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

  transition(user: User, id: number, command: TransitionCommand, now: Date): WorkRequest {
    this.tick(now)
    const req = this.findRequest(id)
    if (!this.canRead(user, req)) throw new HttpError(404, 'not_found', `요청 #${id}을 찾을 수 없습니다.`)
    const ctx = {
      user,
      request: req,
      project: this.project(req.projectId),
      rolePermissions: this.opts.rolePermissions,
    }
    if (!isAuthorized(command.event, ctx)) {
      throw new HttpError(403, 'forbidden', '이 단계에서 할 수 있는 작업이 아닙니다.')
    }
    let next = this.apply(req, command, { type: 'user', userId: user.id }, now)
    if ((command.event === 'runWork' || command.event === 'requestRevision') && !next.assigneeId) {
      next = { ...next, assigneeId: user.id }
    }
    this.replace(next)
    this.notifyStatus(next, now, user.id)
    return next
  }

  getRequest(user: User, id: number): WorkRequest {
    const req = this.findRequest(id)
    if (!this.canRead(user, req)) throw new HttpError(404, 'not_found', `요청 #${id}을 찾을 수 없습니다.`)
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
    if (req.requesterId !== user.id)
      throw new HttpError(403, 'forbidden', '요청자만 결과를 확인할 수 있습니다.')
    if (req.status !== 'verification')
      throw new HttpError(409, 'invalid_transition', '지금은 결과 확인 단계가 아닙니다.')
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
    if (!this.isResponsible(user, req))
      throw new HttpError(403, 'forbidden', '담당 개발자만 기록할 수 있습니다.')
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
    if (!this.isResponsible(user, req))
      throw new HttpError(403, 'forbidden', '담당 개발자만 일정을 정할 수 있습니다.')
    if (!['code_review', 'verification', 'changes_requested', 'release_scheduled'].includes(req.status)) {
      throw new HttpError(409, 'invalid_transition', '지금 단계에서는 배포 일정을 정할 수 없습니다.')
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
        { title: `[#${req.id}] 배포 예정일이 정해졌습니다`, body: input.scheduledDate, requestId: req.id },
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
    if (this.state.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new HttpError(400, 'bad_request', '이미 등록된 이메일입니다.')
    }
    const user: User = { id: this.newId('u'), active: true, ...input }
    this.state.users.push(user)
    return user
  }

  updateUser(actor: User, id: string, patch: Partial<Pick<User, 'role' | 'team' | 'active'>>): User {
    this.require(actor, 'user:manage')
    const i = this.state.users.findIndex((u) => u.id === id)
    if (i < 0) throw new HttpError(404, 'not_found', '사용자를 찾을 수 없습니다.')
    if (id === actor.id && (patch.active === false || (patch.role && patch.role !== actor.role))) {
      throw new HttpError(400, 'bad_request', '자신의 역할이나 활성 상태는 바꿀 수 없습니다.')
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
    if (unknownOwner) throw new HttpError(400, 'bad_request', '담당자는 개발자 또는 관리자여야 합니다.')
    const existing = id ? this.project(id) : undefined
    if (id && !existing) throw new HttpError(404, 'not_found', '프로젝트를 찾을 수 없습니다.')
    const project: Project = {
      id: existing?.id ?? this.newId('p'),
      ...input,
      targets: input.targets.map((t) => ({ ...t, id: t.id ?? this.newId('t') })),
      wikiStats: existing?.wikiStats ?? { verifiedDocs: 0, totalDocs: 0 },
    }
    if (existing) this.state.projects[this.state.projects.indexOf(existing)] = project
    else this.state.projects.push(project)
    return project
  }

  /* ---------- notifications ---------- */

  notificationsFor(user: User): Notification[] {
    return this.state.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map(({ userId: _u, ...n }) => n)
  }

  markRead(user: User, id: string | 'all', now: Date): Notification | undefined {
    const at = now.toISOString()
    let found: Notification | undefined
    for (const n of this.state.notifications) {
      if (n.userId !== user.id || (id !== 'all' && n.id !== id)) continue
      n.readAt ??= at
      found = n
    }
    if (id !== 'all' && !found) throw new HttpError(404, 'not_found', '알림을 찾을 수 없습니다.')
    if (!found) return undefined
    const { userId: _u, ...rest } = found as Notification & { userId: string }
    return rest
  }

  /* ---------- insights ---------- */

  budget(month: string): Budget {
    const inMonth = this.state.costs.filter((c) => c.at.startsWith(month))
    const sum = (tier?: CostEntry['tier']) =>
      Math.round(inMonth.filter((c) => !tier || c.tier === tier).reduce((n, c) => n + c.krw, 0))
    return {
      month,
      ...this.state.budget,
      spentKrw: sum(),
      byModel: [
        { tier: 'light', spentKrw: sum('light') },
        { tier: 'heavy', spentKrw: sum('heavy') },
      ],
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
      received: reqs.filter((r) => r.createdAt.startsWith(month)).length,
      receivedPrevMonth: reqs.filter((r) => r.createdAt.startsWith(prev)).length,
      inProgress: open.length,
      delayed: delayed.length,
      done: doneInMonth.length,
      ...(leads.length
        ? { avgLeadTimeDays: Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 }
        : {}),
      aiCostKrw: this.budget(month).spentKrw,
      aiBudgetKrw: this.state.budget.monthlyLimitKrw,
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
