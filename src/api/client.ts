import type * as z from 'zod'
import { apiRoot } from '../config/env'
import { anySignal, timeoutSignal } from '../lib/abort'
import {
  ApiErrorBody,
  type BodyOf,
  type EndpointSpec,
  type ParamsOf,
  type QueryOf,
  type ResponseOf,
} from './contract'

/**
 * The server's own codes, plus three the client raises itself: `network` (no
 * answer at all), `timeout` (no answer in time) and `contract_violation` (an
 * answer that is not what docs/openapi.json promises, e.g. not JSON).
 */
export type ApiErrorCode = ApiErrorBody['code'] | 'network' | 'timeout' | 'contract_violation'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly issues: ApiErrorBody['issues']

  constructor(status: number, code: ApiErrorCode, message: string, issues?: ApiErrorBody['issues']) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.issues = issues
  }
}

export interface ClientMessages {
  network: () => string
  timeout: () => string
  http: (status: number) => string
  contract: () => string
}

export interface ClientHooks {
  getToken: () => string | null
  /**
   * Called on 401 so the app can drop the session and show the login screen.
   * Gets the token the refused request carried (null without one), so a late
   * answer to an earlier session's request cannot end a newer session.
   */
  onUnauthorized: (token: string | null) => void
  /**
   * Mock mode: given a response that did not come from the mock, re-attaches
   * the mock and resolves true, and the request is sent once more. A bypassed
   * request never reached the mock, so repeating it cannot apply a change twice.
   */
  recover?: (response: Response) => Promise<boolean>
  /** Sent as Accept-Language: the server writes notifications, errors and AI text in it */
  getLanguage?: () => string
  /** Messages for errors the client raises itself (no server body to show); English fills any gap */
  messages?: Partial<ClientMessages>
}

const FALLBACK_MESSAGES: ClientMessages = {
  network: () => 'Cannot reach the server.',
  timeout: () => 'The server took too long to answer.',
  http: (status) => `The request could not be completed. (HTTP ${status})`,
  contract: () => 'The server response does not match the API contract.',
}

/**
 * How long one call may take before it fails as `timeout`: sending, the mock's
 * re-send and reading the answer together. A call can set its own (`timeoutMs`),
 * so each endpoint's hook in queries.ts can adjust it.
 */
export const DEFAULT_TIMEOUT_MS = 30_000
/** Uploads (multipart) carry up to 10 MB, possibly over a slow phone connection. */
export const UPLOAD_TIMEOUT_MS = 120_000

let hooks: ClientHooks = { getToken: () => null, onUnauthorized: () => {} }
const message = <K extends keyof ClientMessages>(key: K): ClientMessages[K] =>
  hooks.messages?.[key] ?? FALLBACK_MESSAGES[key]

export function configureClient(next: ClientHooks): void {
  hooks = next
}

type Args<E extends EndpointSpec> = ([ParamsOf<E>] extends [never] ? object : { params: ParamsOf<E> }) &
  ([BodyOf<E>] extends [never] ? object : { body: BodyOf<E> }) &
  ([QueryOf<E>] extends [never] ? object : { query?: QueryOf<E> }) &
  (E extends { multipart: true } ? { file: File } : object) & {
    signal?: AbortSignal
    /** Time limit of this call in ms (default DEFAULT_TIMEOUT_MS, uploads UPLOAD_TIMEOUT_MS; 0 = none) */
    timeoutMs?: number
  }

export function buildUrl(
  path: string,
  params?: Record<string, unknown>,
  query?: Record<string, unknown>,
): string {
  const filled = path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params?.[key]
    if (value === undefined || value === null) throw new Error(`Missing path parameter "${key}" for ${path}`)
    return encodeURIComponent(String(value))
  })
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  }
  const qs = search.toString()
  // Same-origin roots ("/api") are made absolute so non-browser fetch implementations accept them.
  const origin = apiRoot.startsWith('/') ? (globalThis.location?.origin ?? '') : ''
  return `${origin}${apiRoot}${filled}${qs ? `?${qs}` : ''}`
}

/**
 * Calls one contract endpoint and validates the response against its schema,
 * so a backend that drifts from docs/openapi.json fails loudly at the edge.
 *
 * Every failure is an ApiError, except a cancel through the caller's `signal`
 * (an `AbortError`, which is how TanStack Query drops a superseded fetch) and
 * a bug such as a missing path parameter.
 */
export async function call<E extends EndpointSpec>(spec: E, ...rest: [Args<E>] | []): Promise<ResponseOf<E>> {
  const args = (rest[0] ?? {}) as {
    params?: Record<string, unknown>
    query?: Record<string, unknown>
    body?: unknown
    file?: File
    signal?: AbortSignal
    timeoutMs?: number
  }

  const headers = new Headers({ Accept: 'application/json' })
  const token = hooks.getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const language = hooks.getLanguage?.()
  if (language) headers.set('Accept-Language', language)

  let body: BodyInit | undefined
  if (spec.multipart && args.file) {
    const form = new FormData()
    form.set('file', args.file)
    body = form
  } else if (args.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(args.body)
  }

  const url = buildUrl(spec.path, args.params, args.query)
  // One deadline for the whole call, the mock's re-send included (its re-attach waits 3 s at most).
  const deadline = timeoutSignal(args.timeoutMs ?? (spec.multipart ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS))
  const signal = args.signal ? anySignal([args.signal, deadline.signal]) : deadline.signal

  /** What a rejected fetch or body read becomes. */
  const failure = (err: unknown): unknown => {
    if (args.signal?.aborted) {
      return err instanceof DOMException && err.name === 'AbortError'
        ? err
        : new DOMException('The operation was aborted.', 'AbortError')
    }
    if (deadline.signal.aborted) return new ApiError(0, 'timeout', message('timeout')())
    return new ApiError(0, 'network', message('network')())
  }

  try {
    let res: Response
    try {
      const send = () => fetch(url, { method: spec.method, headers, body, signal })
      res = await send()
      if (hooks.recover && (await hooks.recover(res))) res = await send()
    } catch (err) {
      throw failure(err)
    }

    if (!res.ok) {
      const parsed = ApiErrorBody.safeParse(await res.json().catch(() => null))
      if (res.status === 401 && !spec.public) hooks.onUnauthorized(token)
      if (parsed.success)
        throw new ApiError(res.status, parsed.data.code, parsed.data.message, parsed.data.issues)
      throw new ApiError(res.status, 'internal', message('http')(res.status))
    }

    if (spec.response === null || res.status === 204) return undefined as ResponseOf<E>

    let text: string
    try {
      text = await res.text()
    } catch (err) {
      throw failure(err)
    }
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      // Usually an HTML page: a proxy's error page, or the app's own index.html behind a wrong API base URL.
      console.error(`[api] ${spec.method} ${spec.path} answered ${res.status} with a body that is not JSON`)
      throw new ApiError(res.status, 'contract_violation', message('contract')())
    }
    const result = (spec.response as z.ZodType).safeParse(json)
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      console.error(`[api] ${spec.method} ${spec.path} response does not match the contract`, issues)
      throw new ApiError(res.status, 'contract_violation', message('contract')(), issues)
    }
    return result.data as ResponseOf<E>
  } finally {
    deadline.clear()
  }
}
