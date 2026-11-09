/**
 * API contract — the one table the client, the mock API and the generated
 * OpenAPI document (docs/openapi.json) are all derived from.
 *
 * A backend implementing every endpoint below can replace the mock by
 * building with VITE_API_MOCK=false and VITE_API_BASE_URL=<backend>.
 */
import * as z from 'zod'
import { AiPricing, AiProvider, AiSettings, ProviderConnection } from '../domain/ai'
import { TransitionCommand } from '../domain/lifecycle'
import {
  AiUsageReport,
  Attachment,
  Budget,
  BUDGET_LIMIT_MAX_KRW,
  BudgetLimits,
  CalendarDate,
  checkBudgetLimits,
  DashboardSummary,
  Notification,
  NotificationSettings,
  PrecheckIssue,
  Project,
  PROJECT_CONSTRAINTS_MAX,
  ProjectConstraint,
  ProjectIcon,
  ProjectTarget,
  RegressionCheck,
  ReleaseScheduleItem,
  RequestDraft,
  RequestStatus,
  RequestType,
  Role,
  Timestamp,
  User,
  VcsProvider,
  WorkRequest,
  WorkRequestSummary,
  YearMonth,
} from '../domain/model'
import { named } from '../domain/registry'
import { WebUrl } from '../domain/url'

/* ------------------------------------------------------------------ */
/* Endpoint definition                                                 */
/* ------------------------------------------------------------------ */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface EndpointSpec {
  method: HttpMethod
  /** OpenAPI-style path, e.g. /requests/{id} */
  path: string
  summary: string
  tag: string
  /** No session required */
  public?: boolean
  /** Path parameters. Values arrive as strings and are coerced by the mock. */
  params?: z.ZodObject
  query?: z.ZodObject
  body?: z.ZodType
  /** multipart/form-data upload with a single `file` field */
  multipart?: boolean
  /** Success status; defaults to 200 */
  status?: 200 | 201
  /** What a 409 answer means here, for endpoints that give one (written into docs/openapi.json) */
  conflict?: string
  /** Registered schema of the success body. `null` = 204 No Content. */
  response: z.ZodType | null
  /**
   * How long the client waits for the whole call, sending and reading the
   * answer, before it fails as `timeout` (ms; see `timeoutOf`). Set it on
   * an endpoint that is slow by nature; 0 = no limit.
   */
  timeoutMs?: number
}

/** Time limit of a call that sets none. */
export const DEFAULT_TIMEOUT_MS = 30_000
/** Uploads (multipart) carry up to 10 MB, possibly over a slow phone connection. */
export const UPLOAD_TIMEOUT_MS = 120_000

/** The time limit of a call to `spec`: its own, or the default for its kind. */
export function timeoutOf(spec: EndpointSpec): number {
  return spec.timeoutMs ?? (spec.multipart ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)
}

function endpoint<const E extends EndpointSpec>(spec: E): E {
  return spec
}

export type BodyOf<E extends EndpointSpec> = E extends { body: infer B extends z.ZodType }
  ? z.input<B>
  : never
export type QueryOf<E extends EndpointSpec> = E extends { query: infer Q extends z.ZodType }
  ? z.input<Q>
  : never
export type ParamsOf<E extends EndpointSpec> = E extends { params: infer P extends z.ZodType }
  ? z.output<P>
  : never
export type ResponseOf<E extends EndpointSpec> = E['response'] extends z.ZodType
  ? z.output<E['response']>
  : void

/* ------------------------------------------------------------------ */
/* Contract-only schemas                                               */
/* ------------------------------------------------------------------ */

export const ApiErrorBody = named(
  'ApiError',
  z.object({
    code: z.enum([
      'bad_request',
      'unauthorized',
      'forbidden',
      'not_found',
      'invalid_transition',
      'guard_failed',
      'conflict',
      'limit_reached',
      'internal',
    ]),
    message: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
  'Error body for every 4xx/5xx response. 409 codes: invalid_transition and guard_failed (request lifecycle), conflict (a saved draft was saved again since it was read), limit_reached (no room for another saved draft).',
)
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

export const LoginBody = named('LoginBody', z.object({ email: z.email(), password: z.string().min(1) }))
export const Session = named(
  'Session',
  z.object({ token: z.string().describe('Bearer token for the Authorization header'), user: User }),
)
export type Session = z.infer<typeof Session>

export const UserList = named('UserList', z.array(User))
export const UserCreate = named(
  'UserCreate',
  z.object({ name: z.string().trim().min(1), email: z.email(), role: Role, team: z.string().optional() }),
)
export const UserPatch = named(
  'UserPatch',
  z.object({ role: Role.optional(), team: z.string().optional(), active: z.boolean().optional() }),
)

export const ProjectList = named('ProjectList', z.array(Project))
export const ProjectInput = named(
  'ProjectInput',
  z.object({
    name: z.string().trim().min(1).max(60),
    description: z.string().max(300),
    icon: ProjectIcon,
    repository: z.object({ provider: VcsProvider, url: WebUrl.describe('Absolute http(s) URL') }),
    wikiPath: z.string().trim().min(1),
    ownerIds: z.array(z.string()).min(1),
    targets: z.array(ProjectTarget.extend({ id: z.string().optional() })),
    constraints: z
      .array(ProjectConstraint.extend({ id: z.string().optional() }))
      .max(PROJECT_CONSTRAINTS_MAX),
    active: z.boolean(),
  }),
)
export type ProjectInput = z.infer<typeof ProjectInput>

export const RequestScope = named(
  'RequestScope',
  z.enum(['mine', 'assigned', 'all']),
  'mine = filed by me; assigned = projects I own or requests assigned to me; all = everything (needs request:read:all)',
)
export type RequestScope = z.infer<typeof RequestScope>

export const RequestSubmission = named(
  'RequestSubmission',
  RequestDraft.safeExtend({
    draftId: z
      .string()
      .optional()
      .describe(
        "The saved draft the request was written in. Once the request is created, that draft is deleted in the same operation if it is the caller's; otherwise it is ignored.",
      ),
  }),
  'Body of createRequest: the RequestDraft, plus the saved draft it came from',
)
export type RequestSubmission = z.infer<typeof RequestSubmission>

export const RequestSummaryList = named('WorkRequestSummaryList', z.array(WorkRequestSummary))
export const PrecheckResult = named('PrecheckResult', z.object({ issues: z.array(PrecheckIssue) }))

export const VerificationDraft = named(
  'VerificationDraft',
  z.object({
    checks: z.array(
      z.object({
        criterionId: z.string(),
        result: z.enum(['pending', 'passed', 'failed']),
        note: z.string().max(1000).optional(),
      }),
    ),
  }),
  'Saves checklist progress without changing status. Submit with confirmResult / reportIssue.',
)

export const PreviewFeedbackInput = named(
  'PreviewFeedbackInput',
  z.discriminatedUnion('verdict', [
    z.object({ verdict: z.literal('looks_good'), note: z.string().trim().max(1000).optional() }),
    z.object({ verdict: z.literal('needs_change'), note: z.string().trim().min(1).max(1000) }),
  ]),
  'A change request needs a note so the developer knows what to change.',
)
export type PreviewFeedbackInput = z.infer<typeof PreviewFeedbackInput>

export const RegressionUpdate = named(
  'RegressionUpdate',
  z.object({ checks: z.array(z.object({ id: z.string(), result: RegressionCheck.shape.result })) }),
)

export const ReleaseInput = named(
  'ReleaseInput',
  z.object({ scheduledDate: CalendarDate.optional(), note: z.string().max(500).optional() }),
)

export const RegressionQueue = named(
  'RegressionQueue',
  z.array(
    z.object({
      requestId: z.int().positive(),
      title: z.string(),
      projectId: z.string(),
      status: RequestStatus,
      checks: z.array(RegressionCheck),
    }),
  ),
)
export type RegressionQueue = z.infer<typeof RegressionQueue>

export const NotificationList = named('NotificationList', z.array(Notification))
export const ReleaseScheduleList = named('ReleaseScheduleList', z.array(ReleaseScheduleItem))
export const BudgetInput = named(
  'BudgetInput',
  BudgetLimits.superRefine(checkBudgetLimits),
  `Whole won up to ${BUDGET_LIMIT_MAX_KRW.toLocaleString('en-US')}; 0 = no limit. A per-request limit may not exceed a set monthly limit.`,
)

export const AiSettingsInput = named(
  'AiSettingsInput',
  AiSettings.pick({ defaults: true, projectOverrides: true }),
)
export type AiSettingsInput = z.infer<typeof AiSettingsInput>

export const ProviderKeyInput = named(
  'ProviderKeyInput',
  z.object({
    apiKey: z.string().trim().min(8).max(500).describe('Write-only: stored by the server, never returned'),
  }),
)

/* ---------- saved drafts ---------- */

/** Last step of the request wizard, counted from 0 (the seven STEPS of src/features/wizard/schema.ts). */
export const DRAFT_STEP_MAX = 6
/** Ceilings that only stop abuse; RequestDraft's own rules apply when the request is submitted. */
export const DRAFT_TEXT_MAX = 10_000
export const DRAFT_LIST_MAX = 50

/**
 * A saved draft's id: opaque to the client, but never starting with "local-",
 * which marks a draft the server has not seen yet (src/stores/draft.ts).
 */
export const DRAFT_ID_PATTERN = /^(?!local-)[A-Za-z0-9_-]{1,100}$/

const DraftText = z.string().max(DRAFT_TEXT_MAX)
const draftList = <T extends z.ZodType>(item: T) => z.array(item).max(DRAFT_LIST_MAX)
const DraftStep = z.int().min(0).max(DRAFT_STEP_MAX)

export const DraftContent = named(
  'DraftContent',
  z
    .object({
      projectId: DraftText,
      type: z.union([RequestType, z.literal('')]),
      targetIds: draftList(DraftText),
      targetOther: DraftText,
      title: DraftText,
      currentBehavior: DraftText,
      desiredBehavior: DraftText,
      acceptanceCriteria: draftList(z.object({ text: DraftText })),
      checklistSource: DraftText,
      checklist: draftList(
        z.object({ ref: DraftText, clause: DraftText, finding: DraftText, expected: DraftText }),
      ),
      outOfScope: DraftText,
      attachmentIds: draftList(DraftText),
      desiredDate: DraftText,
      desiredDateReason: DraftText,
    })
    .partial(),
  `A half-written request as the wizard holds it: the RequestDraft fields, every one optional and empty values allowed. Only abuse ceilings apply (text up to ${DRAFT_TEXT_MAX.toLocaleString('en-US')} characters, lists up to ${DRAFT_LIST_MAX} items).`,
)
export type DraftContent = z.infer<typeof DraftContent>

export const SavedDraftSummary = named(
  'SavedDraftSummary',
  z.object({
    id: z
      .string()
      .regex(DRAFT_ID_PATTERN)
      .describe(
        'Opaque: 1–100 letters, digits, "-" or "_", never starting with "local-" (clients use that prefix for drafts not yet on the server)',
      ),
    title: z.string().describe('content.title without surrounding spaces; empty when there is none'),
    projectId: z.string().optional().describe('content.projectId, once one is picked'),
    type: RequestType.optional().describe('content.type, once one is picked'),
    step: DraftStep.describe(`Wizard step the person was last on (0–${DRAFT_STEP_MAX})`),
    attachmentCount: z.int().nonnegative().describe('How many attachments SavedDraft.attachments holds'),
    version: z
      .int()
      .positive()
      .describe('1 when created, one more on every update; an update sends it back as baseVersion'),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  }),
  "One of the caller's saved drafts, as a list shows it",
)
export type SavedDraftSummary = z.infer<typeof SavedDraftSummary>

export const SavedDraft = named(
  'SavedDraft',
  SavedDraftSummary.extend({
    content: DraftContent,
    attachments: z
      .array(Attachment)
      .describe(
        'The attachments of content.attachmentIds that still exist and were uploaded by the caller, each once, in that order',
      ),
  }),
  'A saved draft with everything needed to continue it, on this device or another',
)
export type SavedDraft = z.infer<typeof SavedDraft>

export const SavedDraftSummaryList = named('SavedDraftSummaryList', z.array(SavedDraftSummary))
const DraftBody = z.object({ step: DraftStep, content: DraftContent })
export const SavedDraftInput = named(
  'SavedDraftInput',
  DraftBody.extend({
    clientId: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "The client's own id for the draft. A create repeated with a clientId that already made one of the caller's drafts (the first answer was lost) makes no new draft: the answer is that draft as it is now, unchanged, and is not refused for the per-account limit.",
      ),
  }),
)
export const SavedDraftUpdate = named(
  'SavedDraftUpdate',
  DraftBody.extend({
    baseVersion: z
      .int()
      .positive()
      .describe('The version the content was based on; 409 conflict when the draft has been saved since'),
  }),
)
export type SavedDraftInput = z.infer<typeof SavedDraftInput>
export type SavedDraftUpdate = z.infer<typeof SavedDraftUpdate>

const ProviderParam = z.object({ provider: AiProvider })

const MonthQuery = z.object({
  month: YearMonth.optional().describe('YYYY-MM (month 01–12), defaults to the current month'),
})
const IdParam = z.object({ id: z.int().positive() })
const StringIdParam = z.object({ id: z.string() })

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export const api = {
  /* auth */
  login: endpoint({
    method: 'POST',
    path: '/auth/login',
    tag: 'auth',
    summary: 'Sign in and receive a bearer token',
    public: true,
    body: LoginBody,
    response: Session,
  }),
  logout: endpoint({
    method: 'POST',
    path: '/auth/logout',
    tag: 'auth',
    summary: 'Sign out',
    response: null,
  }),
  me: endpoint({ method: 'GET', path: '/auth/me', tag: 'auth', summary: 'Current user', response: User }),

  /* users */
  listUsers: endpoint({
    method: 'GET',
    path: '/users',
    tag: 'users',
    summary: 'User directory (names are shown on every request)',
    response: UserList,
  }),
  createUser: endpoint({
    method: 'POST',
    path: '/users',
    tag: 'users',
    summary: 'Invite a user (user:manage)',
    body: UserCreate,
    status: 201,
    response: User,
  }),
  updateUser: endpoint({
    method: 'PATCH',
    path: '/users/{id}',
    tag: 'users',
    summary: 'Change role, team or active flag (user:manage)',
    params: StringIdParam,
    body: UserPatch,
    response: User,
  }),

  /* projects */
  listProjects: endpoint({
    method: 'GET',
    path: '/projects',
    tag: 'projects',
    summary: 'Projects a request can target, with repository, wiki and owners',
    response: ProjectList,
  }),
  createProject: endpoint({
    method: 'POST',
    path: '/projects',
    tag: 'projects',
    summary: 'Register a project (project:manage)',
    body: ProjectInput,
    status: 201,
    response: Project,
  }),
  updateProject: endpoint({
    method: 'PUT',
    path: '/projects/{id}',
    tag: 'projects',
    summary: 'Update a project (project:manage)',
    params: StringIdParam,
    body: ProjectInput,
    response: Project,
  }),

  /* requests */
  listRequests: endpoint({
    method: 'GET',
    path: '/requests',
    tag: 'requests',
    summary: 'List requests visible to the current user',
    query: z.object({
      scope: RequestScope.default('mine'),
      status: z.string().optional().describe('Comma-separated RequestStatus values'),
      projectId: z.string().optional(),
      q: z.string().optional().describe('Matches title or #id'),
    }),
    response: RequestSummaryList,
  }),
  getRequest: endpoint({
    method: 'GET',
    path: '/requests/{id}',
    tag: 'requests',
    summary: 'Full request with report, work run, checklist and timeline',
    params: IdParam,
    response: WorkRequest,
  }),
  precheckRequest: endpoint({
    method: 'POST',
    path: '/requests/precheck',
    tag: 'requests',
    summary: 'One-shot submission check. Issues are advisory and never block submission.',
    body: RequestDraft,
    response: PrecheckResult,
  }),
  createRequest: endpoint({
    method: 'POST',
    path: '/requests',
    tag: 'requests',
    summary:
      "Submit a request. The AI starts the feasibility report immediately. 400 when an attachment is missing or was uploaded by someone else, with one issue per such attachment (path attachmentIds.<index>). With draftId, the caller's saved draft of that id is deleted along with the submission.",
    body: RequestSubmission,
    status: 201,
    response: WorkRequest,
  }),
  transitionRequest: endpoint({
    method: 'POST',
    path: '/requests/{id}/transitions',
    tag: 'requests',
    summary: 'Move a request through its lifecycle (409 when the transition is not allowed)',
    params: IdParam,
    body: TransitionCommand,
    conflict: 'Transition not allowed in this status',
    response: WorkRequest,
  }),
  saveVerification: endpoint({
    method: 'PUT',
    path: '/requests/{id}/verification',
    tag: 'requests',
    summary: 'Save QA checklist progress (requester, while in verification)',
    params: IdParam,
    body: VerificationDraft,
    response: WorkRequest,
  }),
  sendPreviewFeedback: endpoint({
    method: 'PUT',
    path: '/requests/{id}/preview-feedback',
    tag: 'requests',
    summary:
      "The requester's reaction to the preview while the change is in code review (advisory; status unchanged)",
    params: IdParam,
    body: PreviewFeedbackInput,
    response: WorkRequest,
  }),
  updateRegression: endpoint({
    method: 'PUT',
    path: '/requests/{id}/regression',
    tag: 'requests',
    summary:
      'Record regression check results (responsible developer; 409 once the request is done, rejected or cancelled)',
    params: IdParam,
    body: RegressionUpdate,
    response: WorkRequest,
  }),
  updateRelease: endpoint({
    method: 'PUT',
    path: '/requests/{id}/release',
    tag: 'requests',
    summary:
      'Set or change the planned release date (responsible developer; 400 when a new date is before today on the head-office calendar)',
    params: IdParam,
    body: ReleaseInput,
    response: WorkRequest,
  }),
  uploadAttachment: endpoint({
    method: 'POST',
    path: '/attachments',
    tag: 'requests',
    summary: 'Upload a screenshot or file (multipart field "file", max 10 MB)',
    multipart: true,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    status: 201,
    response: Attachment,
  }),
  regressionQueue: endpoint({
    method: 'GET',
    path: '/regression-checks',
    tag: 'requests',
    summary: 'Open regression checks on requests the developer is responsible for',
    response: RegressionQueue,
  }),

  /* saved drafts */
  listDrafts: endpoint({
    method: 'GET',
    path: '/drafts',
    tag: 'drafts',
    summary: "The caller's saved drafts, most recently changed first (request:create)",
    response: SavedDraftSummaryList,
  }),
  getDraft: endpoint({
    method: 'GET',
    path: '/drafts/{id}',
    tag: 'drafts',
    summary:
      "One saved draft with its content and attachments (request:create). 404 for a draft that is not the caller's.",
    params: StringIdParam,
    response: SavedDraft,
  }),
  createDraft: endpoint({
    method: 'POST',
    path: '/drafts',
    tag: 'drafts',
    summary:
      'Save a new draft (request:create). 409 limit_reached when the account already holds as many drafts as allowed (template setting drafts.maxPerAccount). 400 when an attachment is missing or was uploaded by someone else (path content.attachmentIds.<index>). Repeated with the same clientId, answers with the draft the first create made.',
    body: SavedDraftInput,
    status: 201,
    response: SavedDraft,
    conflict: 'limit_reached: the account holds as many saved drafts as allowed',
  }),
  updateDraft: endpoint({
    method: 'PUT',
    path: '/drafts/{id}',
    tag: 'drafts',
    summary:
      "Replace a draft's step and content (request:create); the answer carries the next version. 409 conflict when baseVersion is not the stored version (saved meanwhile, e.g. on another device). 404 for a draft that is not the caller's; attachments as in createDraft.",
    params: StringIdParam,
    body: SavedDraftUpdate,
    response: SavedDraft,
    conflict: 'conflict: the draft was saved since baseVersion',
  }),
  deleteDraft: endpoint({
    method: 'DELETE',
    path: '/drafts/{id}',
    tag: 'drafts',
    summary:
      "Delete a saved draft (request:create). 404 when it is gone or not the caller's, which a client can take as already deleted.",
    params: StringIdParam,
    response: null,
  }),

  /* notifications */
  listNotifications: endpoint({
    method: 'GET',
    path: '/notifications',
    tag: 'notifications',
    summary: 'Notifications for the current user, newest first',
    response: NotificationList,
  }),
  markNotificationRead: endpoint({
    method: 'POST',
    path: '/notifications/{id}/read',
    tag: 'notifications',
    summary: 'Mark one notification as read',
    params: StringIdParam,
    response: Notification,
  }),
  markAllNotificationsRead: endpoint({
    method: 'POST',
    path: '/notifications/read-all',
    tag: 'notifications',
    summary: 'Mark every notification as read',
    response: null,
  }),
  getNotificationSettings: endpoint({
    method: 'GET',
    path: '/me/notification-settings',
    tag: 'notifications',
    summary: 'Notification channels of the current user',
    response: NotificationSettings,
  }),
  updateNotificationSettings: endpoint({
    method: 'PUT',
    path: '/me/notification-settings',
    tag: 'notifications',
    summary: 'Update notification channels',
    body: NotificationSettings,
    response: NotificationSettings,
  }),

  /* dashboard, schedule, budget */
  dashboard: endpoint({
    method: 'GET',
    path: '/dashboard/summary',
    tag: 'insights',
    summary: 'Company-wide numbers for one month (dashboard:view)',
    query: MonthQuery,
    response: DashboardSummary,
  }),
  releases: endpoint({
    method: 'GET',
    path: '/releases',
    tag: 'insights',
    summary: 'Planned and past releases grouped by date and project',
    query: z.object({ from: CalendarDate.optional(), to: CalendarDate.optional() }),
    response: ReleaseScheduleList,
  }),
  getBudget: endpoint({
    method: 'GET',
    path: '/budget',
    tag: 'insights',
    summary: 'AI spend against the monthly limit (budget:manage)',
    response: Budget,
  }),
  updateBudget: endpoint({
    method: 'PUT',
    path: '/budget',
    tag: 'insights',
    summary: 'Change AI cost limits (budget:manage)',
    body: BudgetInput,
    response: Budget,
  }),

  /* AI operations (service operator) */
  getAiSettings: endpoint({
    method: 'GET',
    path: '/ai/settings',
    tag: 'ai',
    summary: 'Provider connections, model per task and per-project overrides (agent:manage)',
    response: AiSettings,
  }),
  updateAiSettings: endpoint({
    method: 'PUT',
    path: '/ai/settings',
    tag: 'ai',
    summary:
      'Choose the model per task and per project (agent:manage). Every selection must be a priced model of a connected provider.',
    body: AiSettingsInput,
    response: AiSettings,
  }),
  setProviderKey: endpoint({
    method: 'PUT',
    path: '/ai/providers/{provider}/key',
    tag: 'ai',
    summary: 'Store or replace a provider API key (agent:manage). The key is write-only.',
    params: ProviderParam,
    body: ProviderKeyInput,
    response: ProviderConnection,
  }),
  removeProviderKey: endpoint({
    method: 'DELETE',
    path: '/ai/providers/{provider}/key',
    tag: 'ai',
    summary: 'Disconnect a provider (agent:manage); refused while a task or project still uses it',
    params: ProviderParam,
    response: null,
  }),
  getAiPricing: endpoint({
    method: 'GET',
    path: '/ai/pricing',
    tag: 'ai',
    summary: 'Price table and exchange rate used to book AI usage (agent:manage or usage:view)',
    response: AiPricing,
  }),
  updateAiPricing: endpoint({
    method: 'PUT',
    path: '/ai/pricing',
    tag: 'ai',
    summary: 'Edit prices and the exchange rate (agent:manage). Applies to usage booked from now on.',
    body: AiPricing,
    response: AiPricing,
  }),
  aiUsage: endpoint({
    method: 'GET',
    path: '/ai/usage',
    tag: 'ai',
    summary: 'AI usage and estimated cost for one month by provider, model, task and request (usage:view)',
    query: MonthQuery,
    response: AiUsageReport,
  }),
} as const satisfies Record<string, EndpointSpec>

export type Api = typeof api
export type EndpointName = keyof Api
