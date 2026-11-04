import { delay, http, HttpResponse, type HttpHandler } from 'msw'
import type * as z from 'zod'
import { api, type ApiErrorBody, type EndpointSpec } from '../api/contract'
import type { User } from '../domain/model'
import { errorText, serverLanguage, type ErrorKey, type ServerLanguage } from './copy'
import { HttpError, localDate } from './engine'
import { DEMO_PASSWORD } from './seed'
import type { MockStore } from './store'

const TOKEN_PREFIX = 'mock-token.'
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const INLINE_UPLOAD_BYTES = 512 * 1024

export interface HandlerOptions {
  /** Simulated network latency in ms; [min, max] */
  latency?: [number, number]
}

interface Ctx<E extends EndpointSpec> {
  store: MockStore
  me: User
  now: Date
  /** Language of this request (Accept-Language) */
  lang: ServerLanguage
  params: E extends { params: infer P extends z.ZodType } ? z.output<P> : Record<string, never>
  query: E extends { query: infer Q extends z.ZodType } ? z.output<Q> : Record<string, never>
  body: E extends { body: infer B extends z.ZodType } ? z.output<B> : undefined
  request: Request
}

type Resolver<E extends EndpointSpec> = (ctx: Ctx<E>) => unknown | Promise<unknown>

interface RouteOptions {
  /** Persist the state afterwards */
  mutates?: boolean
  /** A change a person made: from now on the demo data keeps its language */
  edits?: boolean
}

function errorResponse(
  lang: ServerLanguage,
  status: number,
  code: ApiErrorBody['code'],
  key: ErrorKey,
  params: Record<string, string | number> = {},
  issues?: ApiErrorBody['issues'],
) {
  const body: ApiErrorBody = { code, message: errorText(lang, key, params), ...(issues ? { issues } : {}) }
  return HttpResponse.json(body, { status })
}

function zodIssues(error: z.ZodError): ApiErrorBody['issues'] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
}

/** Path params arrive as strings; numeric-looking ones are coerced before validation. */
function coerce(raw: Record<string, string | readonly string[] | undefined>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v
    out[k] = typeof s === 'string' && /^\d+$/.test(s) ? Number(s) : s
  }
  return out
}

export function tokenFor(userId: string): string {
  return `${TOKEN_PREFIX}${userId}`
}

/**
 * Builds the mock handlers. Each one is bound to its contract endpoint, so
 * path, method, body validation and auth come from src/api/contract.ts.
 * Texts follow the request's Accept-Language, as a real backend's should.
 */
export function createHandlers(store: MockStore, options: HandlerOptions = {}): HttpHandler[] {
  const [minLatency, maxLatency] = options.latency ?? [120, 380]

  function route<E extends EndpointSpec>(spec: E, resolver: Resolver<E>, opts: RouteOptions = {}) {
    const method = spec.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'
    const path = `*/api${spec.path.replace(/\{(\w+)\}/g, ':$1')}`

    return http[method](path, async ({ request, params }) => {
      if (maxLatency > 0) await delay(minLatency + Math.random() * (maxLatency - minLatency))
      const now = store.now()
      const engine = store.engine
      const lang = serverLanguage(request.headers.get('Accept-Language'))

      try {
        let me: User | undefined
        const header = request.headers.get('Authorization') ?? ''
        if (header.startsWith(`Bearer ${TOKEN_PREFIX}`)) {
          const user = engine.user(header.slice(`Bearer ${TOKEN_PREFIX}`.length))
          if (user?.active) me = user
        }
        if (!me && !spec.public) return errorResponse(lang, 401, 'unauthorized', 'signInAgain')

        const parsedParams = spec.params?.safeParse(coerce(params))
        if (parsedParams && !parsedParams.success) {
          return errorResponse(lang, 404, 'not_found', 'notFound', {}, zodIssues(parsedParams.error))
        }
        const url = new URL(request.url)
        const parsedQuery = spec.query?.safeParse(Object.fromEntries(url.searchParams))
        if (parsedQuery && !parsedQuery.success) {
          return errorResponse(lang, 400, 'bad_request', 'badQuery', {}, zodIssues(parsedQuery.error))
        }
        let body: unknown
        if (spec.body) {
          const json = await request.json().catch(() => undefined)
          const parsed = spec.body.safeParse(json)
          if (!parsed.success) {
            return errorResponse(lang, 400, 'bad_request', 'checkInput', {}, zodIssues(parsed.error))
          }
          body = parsed.data
        }

        // AI jobs advance on every call, so a reload shows the same progress as polling.
        const advanced = engine.tick(now, lang)

        const result = await resolver({
          store,
          me: me as User,
          now,
          lang,
          params: (parsedParams?.data ?? {}) as Ctx<E>['params'],
          query: (parsedQuery?.data ?? {}) as Ctx<E>['query'],
          body: body as Ctx<E>['body'],
          request,
        })
        if (opts.edits) store.engine.state.dirty = true
        if (advanced || opts.mutates || opts.edits) store.save()

        if (spec.response === null) return new HttpResponse(null, { status: 204 })
        return HttpResponse.json(result as never, { status: spec.status ?? 200 })
      } catch (err) {
        if (err instanceof HttpError) return errorResponse(lang, err.status, err.code, err.key, err.params)
        console.error('[mock api]', err)
        return errorResponse(lang, 500, 'internal', 'unknown')
      }
    })
  }

  /** A change a person makes to the demo data */
  const edit: RouteOptions = { edits: true }
  /** State changes that are not edits (reading notifications, form checks) */
  const touch: RouteOptions = { mutates: true }

  return [
    /* auth */
    route(api.login, ({ store, body }) => {
      const user = store.engine.state.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase())
      if (!user || !user.active || body.password !== DEMO_PASSWORD) {
        throw new HttpError(401, 'unauthorized', 'wrongCredentials')
      }
      return { token: tokenFor(user.id), user }
    }),
    route(api.logout, () => undefined),
    route(api.me, ({ me }) => me),

    /* users */
    route(api.listUsers, ({ store }) => store.engine.state.users),
    route(api.createUser, ({ store, me, body }) => store.engine.createUser(me, body), edit),
    route(
      api.updateUser,
      ({ store, me, params, body }) => store.engine.updateUser(me, params.id, body),
      edit,
    ),

    /* projects */
    route(api.listProjects, ({ store }) => store.engine.state.projects),
    route(api.createProject, ({ store, me, body }) => store.engine.saveProject(me, body), edit),
    route(
      api.updateProject,
      ({ store, me, params, body }) => store.engine.saveProject(me, body, params.id),
      edit,
    ),

    /* requests — note: /requests/precheck must be registered before /requests/:id */
    route(
      api.precheckRequest,
      ({ store, me, body, now, lang }) => ({ issues: store.engine.precheck(me, body, now, lang) }),
      touch,
    ),
    route(api.listRequests, ({ store, me, query }) => store.engine.listRequests(me, query)),
    route(
      api.createRequest,
      ({ store, me, body, now, lang }) =>
        store.engine.present(me, store.engine.createRequest(me, body, now, lang)),
      edit,
    ),
    route(api.getRequest, ({ store, me, params }) =>
      store.engine.present(me, store.engine.getRequest(me, params.id)),
    ),
    route(
      api.transitionRequest,
      ({ store, me, params, body, now, lang }) =>
        store.engine.present(me, store.engine.transition(me, params.id, body, now, lang)),
      edit,
    ),
    route(
      api.saveVerification,
      ({ store, me, params, body, now }) =>
        store.engine.present(me, store.engine.saveVerification(me, params.id, body.checks, now)),
      edit,
    ),
    route(
      api.sendPreviewFeedback,
      ({ store, me, params, body, now }) =>
        store.engine.present(me, store.engine.previewFeedback(me, params.id, body, now)),
      edit,
    ),
    route(
      api.updateRegression,
      ({ store, me, params, body, now }) =>
        store.engine.present(me, store.engine.updateRegression(me, params.id, body.checks, now)),
      edit,
    ),
    route(
      api.updateRelease,
      ({ store, me, params, body, now }) =>
        store.engine.present(me, store.engine.updateRelease(me, params.id, body, now)),
      edit,
    ),
    route(
      api.uploadAttachment,
      async ({ store, me, request }) => {
        const form = await request.formData().catch(() => null)
        const file = form?.get('file')
        if (!(file instanceof File)) throw new HttpError(400, 'bad_request', 'pickFile')
        if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, 'bad_request', 'fileTooLarge')
        // Small files are inlined so they survive a reload; large ones live for this session only.
        const url =
          file.size <= INLINE_UPLOAD_BYTES
            ? `data:${file.type || 'application/octet-stream'};base64,${toBase64(await file.arrayBuffer())}`
            : URL.createObjectURL(file)
        return store.engine.addAttachment(me, { name: file.name, size: file.size, type: file.type, url })
      },
      touch,
    ),
    route(api.regressionQueue, ({ store, me }) => store.engine.regressionQueue(me)),

    /* notifications */
    route(api.listNotifications, ({ store, me, lang }) => store.engine.notificationsFor(me, lang)),
    route(
      api.markAllNotificationsRead,
      ({ store, me, now, lang }) => void store.engine.markRead(me, 'all', now, lang),
      touch,
    ),
    route(
      api.markNotificationRead,
      ({ store, me, params, now, lang }) => store.engine.markRead(me, params.id, now, lang),
      touch,
    ),
    route(api.getNotificationSettings, ({ store, me }) => store.engine.state.notificationSettings[me.id]),
    route(
      api.updateNotificationSettings,
      ({ store, me, body }) => {
        store.engine.state.notificationSettings[me.id] = body
        return body
      },
      edit,
    ),

    /* insights */
    route(api.dashboard, ({ store, me, query, now }) =>
      store.engine.dashboard(me, query.month ?? localDate(now).slice(0, 7), now),
    ),
    route(api.releases, ({ store, me, query }) => store.engine.releases(me, query.from, query.to)),
    route(api.getBudget, ({ store, me, now }) => {
      store.engine.require(me, 'budget:manage')
      return store.engine.budget(localDate(now).slice(0, 7))
    }),
    route(
      api.updateBudget,
      ({ store, me, body, now }) => {
        store.engine.require(me, 'budget:manage')
        store.engine.state.budget = body
        return store.engine.budget(localDate(now).slice(0, 7))
      },
      edit,
    ),

    /* AI operations */
    route(api.getAiSettings, ({ store, me }) => store.engine.aiSettings(me)),
    route(api.updateAiSettings, ({ store, me, body }) => store.engine.updateAiSettings(me, body), edit),
    route(
      api.setProviderKey,
      ({ store, me, params, body, now }) =>
        store.engine.setProviderKey(me, params.provider, body.apiKey, now),
      edit,
    ),
    route(
      api.removeProviderKey,
      ({ store, me, params }) => store.engine.removeProviderKey(me, params.provider),
      edit,
    ),
    route(api.getAiPricing, ({ store, me }) => store.engine.aiPricing(me)),
    route(api.updateAiPricing, ({ store, me, body }) => store.engine.updateAiPricing(me, body), edit),
    route(api.aiUsage, ({ store, me, query, now }) =>
      store.engine.aiUsageReport(me, query.month ?? localDate(now).slice(0, 7)),
    ),
  ]
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
