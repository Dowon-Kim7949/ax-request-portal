/**
 * Request Lifecycle — the single source of truth for which status a request
 * can move to, who may move it, and what the move records.
 *
 *   submitted → reporting(AI) → scope_check → review → in_progress(AI)
 *             → code_review → verification → release_scheduled → done
 *
 *   exceptions: reporting → review directly when there is nothing to confirm
 *                 (out of scope, undetermined, or the scope check is off)
 *               scope_check → reporting (requester asks for another reading)
 *               review → info_needed → reporting (report is rewritten)
 *               review | info_needed → rejected
 *               code_review → in_progress (developer asks the AI to revise)
 *               verification → changes_requested → in_progress
 *               submitted..info_needed → cancelled (requester withdraws)
 *
 * The mock API applies these rules; a real backend should port this file
 * (it is pure TypeScript with no browser dependencies).
 */
import * as z from 'zod'
import {
  SCOPE_REVISIONS_MAX,
  type Actor,
  type CriterionCheck,
  type Project,
  type RequestStatus,
  type User,
  type WorkRequest,
} from './model'
import { named } from './registry'
import { DEFAULT_ROLE_PERMISSIONS, hasPermission, type RolePermissions } from './roles'

/* ------------------------------------------------------------------ */
/* Transition table                                                    */
/* ------------------------------------------------------------------ */

export type Party = 'requester' | 'developer' | 'ai' | 'system'

interface TransitionRule {
  from: readonly RequestStatus[]
  to: RequestStatus
  by: Party
}

export const TRANSITIONS = {
  startReport: { from: ['submitted'], to: 'reporting', by: 'system' },
  reportReady: { from: ['reporting'], to: 'review', by: 'ai' },
  scopeReady: { from: ['reporting'], to: 'scope_check', by: 'ai' },
  approveScope: { from: ['scope_check'], to: 'review', by: 'requester' },
  reviseScope: { from: ['scope_check'], to: 'reporting', by: 'requester' },
  requestInfo: { from: ['review'], to: 'info_needed', by: 'developer' },
  provideInfo: { from: ['info_needed'], to: 'reporting', by: 'requester' },
  reject: { from: ['review', 'info_needed'], to: 'rejected', by: 'developer' },
  runWork: { from: ['review', 'changes_requested'], to: 'in_progress', by: 'developer' },
  workFinished: { from: ['in_progress'], to: 'code_review', by: 'ai' },
  requestRevision: { from: ['code_review'], to: 'in_progress', by: 'developer' },
  approveMerge: { from: ['code_review'], to: 'verification', by: 'developer' },
  reportIssue: { from: ['verification'], to: 'changes_requested', by: 'requester' },
  confirmResult: { from: ['verification'], to: 'release_scheduled', by: 'requester' },
  markReleased: { from: ['release_scheduled'], to: 'done', by: 'developer' },
  cancel: {
    from: ['submitted', 'reporting', 'scope_check', 'review', 'info_needed'],
    to: 'cancelled',
    by: 'requester',
  },
} as const satisfies Record<string, TransitionRule>

export type LifecycleEvent = keyof typeof TRANSITIONS

/* ------------------------------------------------------------------ */
/* Commands people can send (AI/system events stay inside the backend) */
/* ------------------------------------------------------------------ */

const checks = z.array(
  z.object({
    criterionId: z.string(),
    result: z.enum(['pending', 'passed', 'failed']),
    note: z.string().max(1000).optional(),
  }),
)

export const TransitionCommand = named(
  'TransitionCommand',
  z.discriminatedUnion('event', [
    z.object({ event: z.literal('requestInfo'), questions: z.array(z.string().trim().min(1)).min(1).max(5) }),
    z.object({ event: z.literal('provideInfo'), answer: z.string().trim().min(1).max(2000) }),
    z.object({
      event: z.literal('approveScope'),
      choices: z.array(z.object({ questionId: z.string(), optionId: z.string() })).max(3),
      note: z.string().trim().max(1000).optional(),
    }),
    z.object({ event: z.literal('reviseScope'), note: z.string().trim().min(1).max(1000) }),
    z.object({ event: z.literal('reject'), reason: z.string().trim().min(1).max(1000) }),
    z.object({
      event: z.literal('runWork'),
      instructions: z.string().trim().max(2000).optional(),
      checkedAssumptions: z
        .array(z.string())
        .max(50)
        .optional()
        .describe("Ids of the report's assumptions the developer confirmed; all of them on the first run"),
    }),
    z.object({ event: z.literal('requestRevision'), note: z.string().trim().min(1).max(2000) }),
    z.object({ event: z.literal('approveMerge') }),
    z.object({ event: z.literal('reportIssue'), checks, note: z.string().trim().max(2000).optional() }),
    z.object({ event: z.literal('confirmResult'), checks }),
    z.object({ event: z.literal('markReleased') }),
    z.object({ event: z.literal('cancel'), reason: z.string().trim().max(1000).optional() }),
  ]),
  'Body of POST /requests/{id}/transitions. AI and system events are not accepted from clients.',
)
export type TransitionCommand = z.infer<typeof TransitionCommand>
export type UserEvent = TransitionCommand['event']

export const USER_EVENTS = TransitionCommand.options.map((o) => o.shape.event.value) as UserEvent[]

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type LifecycleErrorCode = 'invalid_transition' | 'forbidden' | 'guard_failed'

/** Which rule a `guard_failed` broke, so the caller can explain it. */
export type GuardName =
  | 'criteriaAllPassed'
  | 'criteriaOneFailed'
  | 'assumptionsUnchecked'
  | 'scopeUnanswered'
  | 'scopeRevisionsUsed'
  | 'releaseUnscheduled'

export class LifecycleError extends Error {
  readonly code: LifecycleErrorCode
  readonly guard?: GuardName
  constructor(code: LifecycleErrorCode, message: string, guard?: GuardName) {
    super(message)
    this.name = 'LifecycleError'
    this.code = code
    if (guard) this.guard = guard
  }
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function canTransition(status: RequestStatus, event: LifecycleEvent): boolean {
  return (TRANSITIONS[event].from as readonly RequestStatus[]).includes(status)
}

export const TERMINAL_STATUSES: readonly RequestStatus[] = ['done', 'rejected', 'cancelled']

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** Whose move it is. Drives "my turn" lists, dashboards and notifications. */
export type Turn = 'requester' | 'developer' | 'ai' | 'none'

const TURN: Record<RequestStatus, Turn> = {
  submitted: 'ai',
  reporting: 'ai',
  scope_check: 'requester',
  review: 'developer',
  info_needed: 'requester',
  rejected: 'none',
  in_progress: 'ai',
  code_review: 'developer',
  verification: 'requester',
  changes_requested: 'developer',
  release_scheduled: 'developer',
  done: 'none',
  cancelled: 'none',
}

export function turnOf(status: RequestStatus): Turn {
  return TURN[status]
}

/** The seven stages shown in the progress stepper. Exceptions stay on the stage they happened in. */
export const STAGES = ['submitted', 'report', 'review', 'work', 'verification', 'release', 'done'] as const
export type Stage = (typeof STAGES)[number]

const STAGE: Record<RequestStatus, Stage | null> = {
  submitted: 'submitted',
  reporting: 'report',
  scope_check: 'review',
  review: 'review',
  info_needed: 'review',
  rejected: 'review',
  in_progress: 'work',
  code_review: 'work',
  changes_requested: 'work',
  verification: 'verification',
  release_scheduled: 'release',
  done: 'done',
  cancelled: null,
}

export function stageOf(status: RequestStatus): Stage | null {
  return STAGE[status]
}

/**
 * Requesters see a plain-language status; technical states collapse into
 * the same label. Keys resolve through i18n (`status.requester.*`).
 */
export type RequesterStatus =
  | 'reviewing'
  | 'confirm_scope'
  | 'info_needed'
  | 'working'
  | 'please_check'
  | 'fixing'
  | 'release_scheduled'
  | 'done'
  | 'rejected'
  | 'cancelled'

const REQUESTER_STATUS: Record<RequestStatus, RequesterStatus> = {
  submitted: 'reviewing',
  reporting: 'reviewing',
  scope_check: 'confirm_scope',
  review: 'reviewing',
  info_needed: 'info_needed',
  rejected: 'rejected',
  in_progress: 'working',
  code_review: 'working',
  verification: 'please_check',
  changes_requested: 'fixing',
  release_scheduled: 'release_scheduled',
  done: 'done',
  cancelled: 'cancelled',
}

export function requesterStatusOf(status: RequestStatus): RequesterStatus {
  return REQUESTER_STATUS[status]
}

/* ------------------------------------------------------------------ */
/* Authorization                                                       */
/* ------------------------------------------------------------------ */

export interface TransitionContext {
  user: User
  request: Pick<WorkRequest, 'requesterId' | 'assigneeId' | 'status'>
  project: Pick<Project, 'ownerIds'> | undefined
  rolePermissions?: RolePermissions
}

/** Is this developer responsible for the request? Admins always are. */
export function isResponsibleDeveloper(ctx: TransitionContext): boolean {
  const perms = ctx.rolePermissions ?? DEFAULT_ROLE_PERMISSIONS
  if (!hasPermission(ctx.user, 'request:review', perms)) return false
  if (ctx.user.role === 'admin') return true
  return ctx.request.assigneeId === ctx.user.id || (ctx.project?.ownerIds.includes(ctx.user.id) ?? false)
}

export function isAuthorized(event: LifecycleEvent, ctx: TransitionContext): boolean {
  const rule = TRANSITIONS[event]
  switch (rule.by) {
    case 'requester':
      if (event === 'cancel' && ctx.user.role === 'admin') return true
      return ctx.request.requesterId === ctx.user.id
    case 'developer':
      return isResponsibleDeveloper(ctx)
    case 'ai':
    case 'system':
      return false
  }
}

/** Events this user can trigger right now — use it to decide which buttons to show. */
export function availableEvents(ctx: TransitionContext): UserEvent[] {
  return USER_EVENTS.filter((e) => canTransition(ctx.request.status, e) && isAuthorized(e, ctx))
}

/* ------------------------------------------------------------------ */
/* Applying a transition                                               */
/* ------------------------------------------------------------------ */

type SystemEvent = Exclude<LifecycleEvent, UserEvent>
export type AnyCommand = TransitionCommand | { event: SystemEvent }

export interface ApplyOptions {
  actor: Actor
  now: Date
  /** Generates timeline entry ids. Injected so tests stay deterministic. */
  newId: () => string
}

/**
 * Assumptions the developer still has to confirm before the first AI run.
 * A re-run after a failed check reuses what was confirmed then.
 */
export function uncheckedAssumptions(request: WorkRequest, checked: readonly string[] = []): string[] {
  if (request.status !== 'review') return []
  const done = new Set(checked)
  return (request.report?.assumptions ?? []).map((a) => a.id).filter((id) => !done.has(id))
}

/** Times the requester may still send the scope back to be rewritten. */
export function scopeRevisionsLeft(request: Pick<WorkRequest, 'timeline'>): number {
  const used = request.timeline.filter((e) => e.event === 'reviseScope').length
  return Math.max(0, SCOPE_REVISIONS_MAX - used)
}

/** Scope questions without a valid choice. */
export function unansweredScopeQuestions(
  request: Pick<WorkRequest, 'scope'>,
  choices: ReadonlyArray<{ questionId: string; optionId: string }>,
): string[] {
  const picked = new Map(choices.map((c) => [c.questionId, c.optionId]))
  return (request.scope?.proposal.questions ?? [])
    .filter((q) => !q.options.some((o) => o.id === picked.get(q.id)))
    .map((q) => q.id)
}

/**
 * A request is marked released only on a planned date, so the schedule, the
 * dashboard and the requester's notice all have the day it went out.
 */
export function releaseDateMissing(request: Pick<WorkRequest, 'release'>): boolean {
  return !request.release?.scheduledDate
}

function assertGuards(request: WorkRequest, command: AnyCommand): void {
  if (command.event === 'confirmResult' || command.event === 'reportIssue') {
    const byId = new Map(command.checks.map((c) => [c.criterionId, c.result]))
    const results = request.acceptanceCriteria.map((c) => byId.get(c.id) ?? 'pending')
    if (command.event === 'confirmResult' && results.some((r) => r !== 'passed')) {
      throw new LifecycleError(
        'guard_failed',
        'Every acceptance criterion must pass before confirming.',
        'criteriaAllPassed',
      )
    }
    if (command.event === 'reportIssue' && !results.includes('failed')) {
      throw new LifecycleError(
        'guard_failed',
        'Mark at least one acceptance criterion as failed.',
        'criteriaOneFailed',
      )
    }
  }
  if (command.event === 'approveScope' && unansweredScopeQuestions(request, command.choices).length) {
    throw new LifecycleError('guard_failed', 'Answer every scope question first.', 'scopeUnanswered')
  }
  if (command.event === 'reviseScope' && scopeRevisionsLeft(request) === 0) {
    throw new LifecycleError(
      'guard_failed',
      'The scope has been rewritten as often as allowed; approve it with a note or cancel.',
      'scopeRevisionsUsed',
    )
  }
  if (command.event === 'runWork' && uncheckedAssumptions(request, command.checkedAssumptions).length) {
    throw new LifecycleError(
      'guard_failed',
      'Confirm every assumption in the report before the AI starts work.',
      'assumptionsUnchecked',
    )
  }
  if (command.event === 'markReleased' && releaseDateMissing(request)) {
    throw new LifecycleError(
      'guard_failed',
      'Set the planned release date before marking the request released.',
      'releaseUnscheduled',
    )
  }
}

function slug(id: number): string {
  return `ax/request-${id}`
}

/**
 * Returns a new request with the transition applied. Does not check
 * authorization — call `isAuthorized` first (the mock API does both).
 */
export function applyTransition(request: WorkRequest, command: AnyCommand, opts: ApplyOptions): WorkRequest {
  const rule: TransitionRule = TRANSITIONS[command.event]
  if (!canTransition(request.status, command.event)) {
    throw new LifecycleError(
      'invalid_transition',
      `Cannot ${command.event} a request in status "${request.status}".`,
    )
  }
  assertGuards(request, command)

  const at = opts.now.toISOString()
  const next: WorkRequest = { ...request, status: rule.to, updatedAt: at }
  let note: string | undefined

  switch (command.event) {
    case 'requestInfo':
      next.infoRequest = { questions: command.questions, askedAt: at }
      note = command.questions.join('\n')
      break
    case 'provideInfo':
      if (next.infoRequest) next.infoRequest = { ...next.infoRequest, answer: command.answer }
      note = command.answer
      break
    case 'approveScope':
      if (request.scope) {
        // Keep only answers to questions that were asked, in the order they were asked.
        const picked = new Map(command.choices.map((c) => [c.questionId, c.optionId]))
        const choices = request.scope.proposal.questions.map((q) => ({
          questionId: q.id,
          optionId: picked.get(q.id)!,
        }))
        next.scope = {
          proposal: request.scope.proposal,
          decision: {
            at,
            by: opts.actor.type === 'user' ? opts.actor.userId : opts.actor.type,
            choices,
            ...(command.note ? { note: command.note } : {}),
          },
        }
      }
      note = command.note
      break
    case 'reviseScope':
      note = command.note
      break
    case 'reject':
      next.rejectionReason = command.reason
      note = command.reason
      break
    case 'runWork':
    case 'requestRevision': {
      const instructions = command.event === 'runWork' ? command.instructions : command.note
      // Confirmed on the first run; later runs keep the record.
      const checked =
        command.event === 'runWork' && request.status === 'review'
          ? (request.report?.assumptions ?? []).map((a) => a.id)
          : request.work?.checkedAssumptions
      next.work = {
        attempt: (request.work?.attempt ?? 0) + 1,
        startedAt: at,
        phase: 'queued',
        branch: slug(request.id),
        ...(instructions ? { instructions } : {}),
        ...(checked?.length ? { checkedAssumptions: checked } : {}),
      }
      note = instructions
      break
    }
    case 'approveMerge':
      next.verification = request.acceptanceCriteria.map((c) => ({ criterionId: c.id, result: 'pending' }))
      break
    case 'reportIssue':
      next.verification = normalizeChecks(request, command.checks)
      note = command.note
      break
    case 'confirmResult':
      next.verification = normalizeChecks(request, command.checks)
      next.release = { ...request.release }
      break
    case 'markReleased':
      next.release = { ...request.release, releasedAt: at }
      break
    case 'cancel':
      note = command.reason
      break
    case 'startReport':
    case 'reportReady':
    case 'scopeReady':
    case 'workFinished':
      break
  }

  next.timeline = [
    ...request.timeline,
    {
      id: opts.newId(),
      at,
      actor: opts.actor,
      event: command.event,
      from: request.status,
      to: rule.to,
      ...(note ? { note } : {}),
    },
  ]
  return next
}

function normalizeChecks(request: WorkRequest, input: readonly CriterionCheck[]): CriterionCheck[] {
  const byId = new Map(input.map((c) => [c.criterionId, c]))
  return request.acceptanceCriteria.map(
    (c) => byId.get(c.id) ?? { criterionId: c.id, result: 'pending' as const },
  )
}
