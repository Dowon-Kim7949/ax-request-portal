import * as z from 'zod'
import { AiProvider, AiRuntime, AiSelection, AiTask, AiUsageEntry, TokenUsage } from './ai'
import { named } from './registry'

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const Timestamp = z.iso.datetime()
export const CalendarDate = z.iso.date()

/* ------------------------------------------------------------------ */
/* Users and roles                                                     */
/* ------------------------------------------------------------------ */

export const Role = named(
  'Role',
  z.enum(['requester', 'executive', 'developer', 'admin', 'operator']),
  'requester = planning/sales staff who file requests; executive = requester + company-wide dashboard; developer = reviews reports, runs AI work, approves merges; admin = manages projects and users; operator = runs the service itself: AI providers and models, prices, AI budget and usage. Operator accounts are provisioned by the service, not by an admin.',
)
export type Role = z.infer<typeof Role>

export const User = named(
  'User',
  z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    role: Role,
    team: z.string().optional(),
    active: z.boolean(),
  }),
)
export type User = z.infer<typeof User>

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export const VcsProvider = named('VcsProvider', z.enum(['gitlab', 'github']))
export type VcsProvider = z.infer<typeof VcsProvider>

export const ProjectTarget = named(
  'ProjectTarget',
  z.object({
    id: z.string(),
    name: z.string(),
    /** Wiki document that describes this screen/feature, when one exists. */
    wikiDoc: z.string().optional(),
  }),
  'A screen or feature a requester can pick. Normally extracted from the project wiki.',
)
export type ProjectTarget = z.infer<typeof ProjectTarget>

export const ProjectIcon = named(
  'ProjectIcon',
  z.enum(['globe', 'smartphone', 'layout-dashboard', 'server', 'box']),
)
export type ProjectIcon = z.infer<typeof ProjectIcon>

export const PROJECT_CONSTRAINTS_MAX = 20

export const ProjectConstraint = named(
  'ProjectConstraint',
  z.object({
    id: z.string(),
    text: z.string().trim().min(1).max(300).describe('A rule every change must keep, in plain words'),
    reference: z
      .string()
      .trim()
      .max(60)
      .optional()
      .describe('Where the rule comes from, e.g. "Security policy 3.2"'),
  }),
  'A project rule the AI must respect when it plans and makes a change (security, data, operations). Kept by the project, so requesters never have to repeat it.',
)
export type ProjectConstraint = z.infer<typeof ProjectConstraint>

export const Project = named(
  'Project',
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    icon: ProjectIcon,
    repository: z.object({ provider: VcsProvider, url: z.url() }),
    /** Path of the project wiki inside the repository, e.g. docs/llm-wiki */
    wikiPath: z.string(),
    wikiStats: z.object({
      verifiedDocs: z.int().nonnegative(),
      totalDocs: z.int().nonnegative(),
      lastSyncedAt: Timestamp.optional(),
    }),
    ownerIds: z.array(z.string()).describe('Developers responsible for this project'),
    targets: z.array(ProjectTarget),
    constraints: z.array(ProjectConstraint).max(PROJECT_CONSTRAINTS_MAX),
    active: z.boolean(),
  }),
)
export type Project = z.infer<typeof Project>

/* ------------------------------------------------------------------ */
/* Request form                                                        */
/* ------------------------------------------------------------------ */

export const RequestType = named(
  'RequestType',
  z.enum(['new_feature', 'change', 'bug', 'copy_design', 'non_code', 'checklist']),
  'checklist = findings from an outside review (audit, inspection, certification) handled item by item',
)
export type RequestType = z.infer<typeof RequestType>

export const AcceptanceCriterion = named(
  'AcceptanceCriterion',
  z.object({
    id: z.string(),
    text: z.string().min(1).max(300).describe('Phrased as "when X, then Y"'),
  }),
)
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterion>

export const Attachment = named(
  'Attachment',
  z.object({
    id: z.string(),
    name: z.string(),
    size: z.int().nonnegative(),
    mimeType: z.string(),
    url: z.string(),
  }),
)
export type Attachment = z.infer<typeof Attachment>

export const ACCEPTANCE_CRITERIA_MIN = 1
export const ACCEPTANCE_CRITERIA_MAX = 5
export const CHECKLIST_ITEMS_MAX = 30

export const ChecklistItemInput = named(
  'ChecklistItemInput',
  z.object({
    ref: z.string().trim().min(1).max(60).describe('The finding\'s own number, e.g. "Finding 24"'),
    clause: z.string().trim().max(60).optional().describe('Clause of the standard, e.g. "2.3.1"'),
    finding: z.string().trim().min(1).max(500).describe('What the reviewer found, in their words'),
    expected: z.string().trim().max(300).optional().describe('What counts as fixed'),
  }),
)
export type ChecklistItemInput = z.infer<typeof ChecklistItemInput>

export const ChecklistItem = named(
  'ChecklistItem',
  ChecklistItemInput.extend({
    id: z.string(),
    criterionId: z.string().describe('The acceptance criterion made from this item'),
  }),
)
export type ChecklistItem = z.infer<typeof ChecklistItem>

/** Fields the requester fills in. Field names are fixed so they reach the AI verbatim. */
export const RequestDraft = named(
  'RequestDraft',
  z
    .object({
      projectId: z.string().min(1),
      type: RequestType,
      title: z.string().trim().min(2).max(120),
      targetIds: z.array(z.string()),
      targetOther: z.string().max(200).optional(),
      currentBehavior: z.string().trim().max(2000),
      desiredBehavior: z.string().trim().min(1).max(2000),
      acceptanceCriteria: z
        .array(z.object({ text: z.string().trim().min(1).max(300) }))
        .max(ACCEPTANCE_CRITERIA_MAX)
        .describe(`${ACCEPTANCE_CRITERIA_MIN}–${ACCEPTANCE_CRITERIA_MAX}; ignored for checklist requests`),
      checklistSource: z
        .string()
        .trim()
        .max(100)
        .optional()
        .describe('Who raised the findings, e.g. "Security audit, on-site review"'),
      checklist: z
        .array(ChecklistItemInput)
        .max(CHECKLIST_ITEMS_MAX)
        .optional()
        .describe('Checklist requests only: each item becomes an acceptance criterion'),
      outOfScope: z.string().max(1000).optional(),
      attachmentIds: z.array(z.string()),
      desiredDate: CalendarDate.optional(),
      desiredDateReason: z.string().max(300).optional(),
    })
    .superRefine((d, ctx) => {
      if (d.type === 'checklist') {
        if (!d.checklist?.length) {
          ctx.addIssue({ code: 'custom', path: ['checklist'], message: 'At least one checklist item' })
        }
      } else {
        if (d.acceptanceCriteria.length < ACCEPTANCE_CRITERIA_MIN) {
          ctx.addIssue({ code: 'custom', path: ['acceptanceCriteria'], message: 'At least one criterion' })
        }
        if (d.checklist?.length) {
          ctx.addIssue({ code: 'custom', path: ['checklist'], message: 'Only for checklist requests' })
        }
      }
    }),
)
export type RequestDraft = z.infer<typeof RequestDraft>

export const PrecheckIssue = named(
  'PrecheckIssue',
  z.object({
    field: z.string().describe('RequestDraft field name, e.g. "acceptanceCriteria.0"'),
    severity: z.enum(['info', 'warning']),
    message: z.string(),
  }),
  'Shown next to the field. Never blocks submission.',
)
export type PrecheckIssue = z.infer<typeof PrecheckIssue>

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

export const RequestStatus = named(
  'RequestStatus',
  z.enum([
    'submitted',
    'reporting',
    'scope_check',
    'review',
    'info_needed',
    'rejected',
    'in_progress',
    'code_review',
    'verification',
    'changes_requested',
    'release_scheduled',
    'done',
    'cancelled',
  ]),
  'See src/domain/lifecycle.ts for the transition table.',
)
export type RequestStatus = z.infer<typeof RequestStatus>

/* ------------------------------------------------------------------ */
/* Feasibility report (written by AI before any work starts)           */
/* ------------------------------------------------------------------ */

export const ReportVerdict = named(
  'ReportVerdict',
  z.enum(['feasible', 'conditional', 'out_of_scope', 'undetermined']),
)
export type ReportVerdict = z.infer<typeof ReportVerdict>

export const WikiTrust = named(
  'WikiTrust',
  z.enum(['high', 'medium', 'low']),
  'Derived from wiki review state of the evidence documents, never from model judgement.',
)
export type WikiTrust = z.infer<typeof WikiTrust>

export const WorkSize = named('WorkSize', z.enum(['S', 'M', 'L']))
export type WorkSize = z.infer<typeof WorkSize>

export const ReportAssumption = named(
  'ReportAssumption',
  z.object({ id: z.string(), text: z.string() }),
  'A fact the plan relies on that neither the code nor a reviewed wiki confirmed. The developer checks each one before the AI starts work.',
)
export type ReportAssumption = z.infer<typeof ReportAssumption>

export const ConstraintCheck = named(
  'ConstraintCheck',
  z.object({
    constraintId: z.string(),
    text: z.string().describe('Copy of the project constraint when the report was written'),
    reference: z.string().optional(),
    conflict: z.boolean().describe('The plan, or the code it touches, breaks this constraint'),
    note: z.string(),
  }),
)
export type ConstraintCheck = z.infer<typeof ConstraintCheck>
export const FeasibilityReport = named(
  'FeasibilityReport',
  z.object({
    revision: z.int().positive(),
    generatedAt: Timestamp,
    verdict: ReportVerdict,
    summary: z.string(),
    evidence: z.object({
      wikiDocs: z.array(z.object({ path: z.string(), title: z.string(), verified: z.boolean() })),
      codeFiles: z.array(z.string()),
    }),
    impact: z.object({
      changedScreens: z.array(z.string()),
      recheck: z.array(z.string()).describe('Existing features to re-check (regression candidates)'),
    }),
    plan: z.array(z.string()),
    verification: z.array(
      z.object({ criterionId: z.string(), automatable: z.boolean(), method: z.string() }),
    ),
    openQuestions: z.array(z.string()),
    assumptions: z.array(ReportAssumption),
    constraintChecks: z
      .array(ConstraintCheck)
      .describe(
        'Every project constraint and how the plan keeps it; a conflict makes the verdict conditional',
      ),
    wikiTrust: WikiTrust,
    size: WorkSize,
    risks: z.array(z.string()),
    generatedBy: AiSelection.optional().describe('Provider and model that wrote this revision'),
  }),
)
export type FeasibilityReport = z.infer<typeof FeasibilityReport>

/* ------------------------------------------------------------------ */
/* Scope check: the requester confirms the AI's reading of the request */
/* ------------------------------------------------------------------ */

/** How many times a requester may send the scope back to be rewritten. */
export const SCOPE_REVISIONS_MAX = 2

export const ScopeQuestion = named(
  'ScopeQuestion',
  z.object({
    id: z.string(),
    text: z.string(),
    options: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .min(2)
      .max(4),
    recommended: z.string().optional().describe('Option id the AI would pick; never preselected'),
  }),
  'A choice the requester makes where the request can be read more than one way.',
)
export type ScopeQuestion = z.infer<typeof ScopeQuestion>

export const ScopeProposal = named(
  'ScopeProposal',
  z.object({
    revision: z.int().positive().describe('Report revision this was written with'),
    summary: z.string().describe('Two or three plain sentences, no technical terms'),
    changes: z.array(z.string()).max(5).describe('What will change'),
    unchanged: z.array(z.string()).max(5).describe('What this request will not change'),
    questions: z.array(ScopeQuestion).max(3),
  }),
  "The AI's reading of the request in the requester's words, written with the feasibility report.",
)
export type ScopeProposal = z.infer<typeof ScopeProposal>

export const ScopeDecision = named(
  'ScopeDecision',
  z.object({
    at: Timestamp,
    by: z.string().describe('User id of the requester'),
    choices: z.array(z.object({ questionId: z.string(), optionId: z.string() })),
    note: z.string().optional(),
  }),
)
export type ScopeDecision = z.infer<typeof ScopeDecision>

/* ------------------------------------------------------------------ */
/* AI work run (branch -> tests -> merge request)                      */
/* ------------------------------------------------------------------ */

export const WorkPhase = named(
  'WorkPhase',
  z.enum(['queued', 'editing', 'testing', 'opening_mr', 'finished']),
)
export type WorkPhase = z.infer<typeof WorkPhase>

export const WorkPreview = named(
  'WorkPreview',
  z.object({
    url: z.url().optional().describe('A running build of the change, e.g. a preview deployment'),
    screenshots: z
      .array(
        z.object({
          id: z.string(),
          url: z.string().describe('Image URL (data: URLs allowed)'),
          alt: z.string(),
          caption: z.string().optional(),
        }),
      )
      .max(6),
    expiresAt: Timestamp.optional(),
  }),
  'What the requester can look at before the merge. Filled by CI or the coding agent; costs no AI.',
)
export type WorkPreview = z.infer<typeof WorkPreview>

export const PreviewVerdict = named('PreviewVerdict', z.enum(['looks_good', 'needs_change']))
export type PreviewVerdict = z.infer<typeof PreviewVerdict>

export const PreviewFeedback = named(
  'PreviewFeedback',
  z.object({
    at: Timestamp,
    by: z.string(),
    verdict: PreviewVerdict,
    note: z.string().optional(),
  }),
  "The requester's reaction to the preview. Advisory: the developer still decides on the merge.",
)
export type PreviewFeedback = z.infer<typeof PreviewFeedback>

export const WorkRun = named(
  'WorkRun',
  z.object({
    attempt: z.int().positive(),
    startedAt: Timestamp,
    finishedAt: Timestamp.optional(),
    phase: WorkPhase,
    outcome: z.enum(['success', 'tests_failed', 'error']).optional(),
    instructions: z.string().optional().describe('Developer memo or revision note passed to the AI'),
    checkedAssumptions: z
      .array(z.string())
      .optional()
      .describe('Report assumption ids the developer confirmed before this run started'),
    branch: z.string(),
    mergeRequest: z
      .object({
        number: z.int().positive(),
        url: z.url(),
        filesChanged: z.int().nonnegative(),
        additions: z.int().nonnegative(),
        deletions: z.int().nonnegative(),
      })
      .optional(),
    tests: z
      .object({
        existingPassed: z.int().nonnegative(),
        existingTotal: z.int().nonnegative(),
        criteriaPassed: z.int().nonnegative(),
        criteriaTotal: z.int().nonnegative(),
      })
      .optional(),
    wikiChanges: z
      .object({ docs: z.array(z.string()), pendingReview: z.boolean() })
      .optional()
      .describe('Wiki docs edited in the same merge request; always pending human review'),
    summary: z.string().optional(),
    preview: WorkPreview.optional(),
    previewFeedback: PreviewFeedback.optional().describe('Reset with every new run'),
    costKrw: z.number().nonnegative().optional(),
    agent: z
      .object({ provider: AiProvider, model: z.string(), runtime: AiRuntime })
      .optional()
      .describe('Coding agent and model that made this run'),
  }),
)
export type WorkRun = z.infer<typeof WorkRun>

export const RegressionCheck = named(
  'RegressionCheck',
  z.object({
    id: z.string(),
    label: z.string(),
    source: z.string().describe('Wiki doc linked to the changed code'),
    result: z.enum(['pending', 'passed', 'failed']),
  }),
)
export type RegressionCheck = z.infer<typeof RegressionCheck>

/* ------------------------------------------------------------------ */
/* Verification (QA checklist) and release                             */
/* ------------------------------------------------------------------ */

export const CriterionCheck = named(
  'CriterionCheck',
  z.object({
    criterionId: z.string(),
    result: z.enum(['pending', 'passed', 'failed']),
    note: z.string().max(1000).optional(),
  }),
)
export type CriterionCheck = z.infer<typeof CriterionCheck>

export const Release = named(
  'Release',
  z.object({
    scheduledDate: CalendarDate.optional(),
    releasedAt: Timestamp.optional(),
    note: z.string().max(500).optional(),
  }),
)
export type Release = z.infer<typeof Release>

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export const Actor = named(
  'Actor',
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('user'), userId: z.string() }),
    z.object({ type: z.literal('ai') }),
    z.object({ type: z.literal('system') }),
  ]),
)
export type Actor = z.infer<typeof Actor>

export const TimelineEntry = named(
  'TimelineEntry',
  z.object({
    id: z.string(),
    at: Timestamp,
    actor: Actor,
    event: z.string().describe('Lifecycle event name or "created" / "comment" / "release_updated"'),
    from: RequestStatus.optional(),
    to: RequestStatus.optional(),
    note: z.string().optional(),
  }),
)
export type TimelineEntry = z.infer<typeof TimelineEntry>

/* ------------------------------------------------------------------ */
/* Work request                                                        */
/* ------------------------------------------------------------------ */

export const RequestAiUsage = named(
  'RequestAiUsage',
  z.object({
    spentKrw: z.number().nonnegative().describe('Estimated AI cost booked against this request so far'),
    limitKrw: z.number().nonnegative().describe('Per-request limit; 0 = no limit'),
    entries: z.array(AiUsageEntry),
  }),
)
export type RequestAiUsage = z.infer<typeof RequestAiUsage>

export const WorkRequest = named(
  'WorkRequest',
  z.object({
    id: z.int().positive(),
    title: z.string(),
    projectId: z.string(),
    type: RequestType,
    targetIds: z.array(z.string()),
    targetOther: z.string().optional(),
    currentBehavior: z.string(),
    desiredBehavior: z.string(),
    acceptanceCriteria: z.array(AcceptanceCriterion),
    checklistSource: z.string().optional(),
    checklist: z.array(ChecklistItem).optional(),
    outOfScope: z.string().optional(),
    attachments: z.array(Attachment),
    desiredDate: CalendarDate.optional(),
    desiredDateReason: z.string().optional(),
    requesterId: z.string(),
    assigneeId: z.string().optional(),
    status: RequestStatus,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    precheck: z.array(PrecheckIssue),
    infoRequest: z
      .object({ questions: z.array(z.string()), answer: z.string().optional(), askedAt: Timestamp })
      .optional(),
    rejectionReason: z.string().optional(),
    report: FeasibilityReport.optional(),
    scope: z
      .object({ proposal: ScopeProposal, decision: ScopeDecision.optional() })
      .optional()
      .describe('Scope the requester confirmed (or is asked to); the developer and the AI work from it'),
    work: WorkRun.optional(),
    regression: z.array(RegressionCheck),
    verification: z.array(CriterionCheck),
    release: Release.optional(),
    timeline: z.array(TimelineEntry),
    aiUsage: RequestAiUsage.optional().describe('Returned only to users with report:read'),
  }),
)
export type WorkRequest = z.infer<typeof WorkRequest>

export const WorkRequestSummary = named(
  'WorkRequestSummary',
  WorkRequest.pick({
    id: true,
    title: true,
    projectId: true,
    type: true,
    status: true,
    requesterId: true,
    assigneeId: true,
    createdAt: true,
    updatedAt: true,
    desiredDate: true,
  }).extend({
    verdict: ReportVerdict.optional(),
    workPhase: WorkPhase.optional(),
    scheduledDate: CalendarDate.optional(),
  }),
)
export type WorkRequestSummary = z.infer<typeof WorkRequestSummary>

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const Notification = named(
  'Notification',
  z.object({
    id: z.string(),
    requestId: z.int().positive().optional(),
    title: z.string(),
    body: z.string(),
    createdAt: Timestamp,
    readAt: Timestamp.optional(),
  }),
)
export type Notification = z.infer<typeof Notification>

export const NotificationSettings = named(
  'NotificationSettings',
  z.object({
    inApp: z.boolean(),
    email: z.boolean(),
    messenger: z.boolean(),
    onlyActionRequired: z.boolean().describe('Only notify when it is my turn to act'),
  }),
)
export type NotificationSettings = z.infer<typeof NotificationSettings>

/* ------------------------------------------------------------------ */
/* Budget, dashboard, schedule                                         */
/* ------------------------------------------------------------------ */

export const Budget = named(
  'Budget',
  z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    monthlyLimitKrw: z.number().nonnegative(),
    perRequestLimitKrw: z.number().nonnegative(),
    alertThresholdPct: z.int().min(1).max(100),
    spentKrw: z.number().nonnegative(),
    byModel: z.array(
      z.object({ provider: AiProvider, model: z.string(), spentKrw: z.number().nonnegative() }),
    ),
  }),
)
export type Budget = z.infer<typeof Budget>

export const DashboardSummary = named(
  'DashboardSummary',
  z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    received: z.int().nonnegative(),
    receivedPrevMonth: z
      .int()
      .nonnegative()
      .describe(
        'Received in the previous month over the same span of days (month-to-date while `month` is in progress)',
      ),
    inProgress: z.int().nonnegative().describe('Open right now, regardless of `month`'),
    delayed: z.int().nonnegative().describe('Open right now and past the desired or scheduled date'),
    done: z.int().nonnegative().describe('Released during `month`'),
    avgLeadTimeDays: z
      .number()
      .nonnegative()
      .optional()
      .describe('Average days from submission to release, for requests released during `month`'),
    aiCostKrw: z.number().nonnegative(),
    aiBudgetKrw: z.number().nonnegative(),
    aiAlertThresholdPct: z
      .int()
      .min(1)
      .max(100)
      .describe("Share of `aiBudgetKrw` at which spending is flagged; the budget's `alertThresholdPct`"),
    byProject: z.array(
      z.object({ projectId: z.string(), done: z.int().nonnegative(), inProgress: z.int().nonnegative() }),
    ),
    upcomingReleases: z.array(
      z.object({ date: CalendarDate, projectId: z.string(), requestIds: z.array(z.int().positive()) }),
    ),
    attention: z.object({
      infoNeeded: z.int().nonnegative(),
      delayedRequestIds: z.array(z.int().positive()),
    }),
  }),
)
export type DashboardSummary = z.infer<typeof DashboardSummary>

const Krw = z.number().nonnegative()
const Calls = z.int().nonnegative()

export const AiUsageReport = named(
  'AiUsageReport',
  z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    totalKrw: Krw,
    totalUsd: z.number().nonnegative(),
    calls: Calls.describe('Model API calls and coding-agent runs booked in `month`'),
    monthlyLimitKrw: Krw,
    alertThresholdPct: z.int().min(1).max(100),
    usdKrw: z
      .number()
      .positive()
      .describe('Exchange rate in the price table now; entries keep the rate they were booked at'),
    pricingAsOf: CalendarDate,
    byProvider: z.array(z.object({ provider: AiProvider, calls: Calls, costKrw: Krw, tokens: TokenUsage })),
    byModel: z.array(
      z.object({ provider: AiProvider, model: z.string(), calls: Calls, costKrw: Krw, tokens: TokenUsage }),
    ),
    byTask: z.array(z.object({ task: AiTask, calls: Calls, costKrw: Krw })),
    daily: z
      .array(z.object({ date: CalendarDate, provider: AiProvider, costKrw: Krw }))
      .describe('One row per day and provider with spending; days without spending are omitted'),
    topRequests: z
      .array(z.object({ requestId: z.int().positive(), projectId: z.string(), costKrw: Krw, calls: Calls }))
      .describe('Most expensive requests in `month`, at most ten'),
  }),
)
export type AiUsageReport = z.infer<typeof AiUsageReport>

export const ReleaseScheduleItem = named(
  'ReleaseScheduleItem',
  z.object({
    date: CalendarDate,
    projectId: z.string(),
    requests: z.array(z.object({ id: z.int().positive(), title: z.string(), status: RequestStatus })),
  }),
)
export type ReleaseScheduleItem = z.infer<typeof ReleaseScheduleItem>
