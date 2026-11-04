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
  CalendarDate,
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
  Role,
  User,
  VcsProvider,
  WorkRequest,
  WorkRequestSummary,
} from '../domain/model'
import { named } from '../domain/registry'

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
  /** Registered schema of the success body. `null` = 204 No Content. */
  response: z.ZodType | null
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
      'internal',
    ]),
    message: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
  'Error body for every 4xx/5xx response',
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
    repository: z.object({ provider: VcsProvider, url: z.url() }),
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
  Budget.pick({ monthlyLimitKrw: true, perRequestLimitKrw: true, alertThresholdPct: true }),
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

const ProviderParam = z.object({ provider: AiProvider })

const MonthQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .describe('YYYY-MM, defaults to the current month'),
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
    summary: 'Submit a request. The AI starts the feasibility report immediately.',
    body: RequestDraft,
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
    summary: 'Record regression check results (responsible developer)',
    params: IdParam,
    body: RegressionUpdate,
    response: WorkRequest,
  }),
  updateRelease: endpoint({
    method: 'PUT',
    path: '/requests/{id}/release',
    tag: 'requests',
    summary: 'Set or change the planned release date (responsible developer)',
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
