import type * as z from 'zod'
import { apiRoot } from '../config/env'
import {
  ApiErrorBody,
  type BodyOf,
  type EndpointSpec,
  type ParamsOf,
  type QueryOf,
  type ResponseOf,
} from './contract'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorBody['code'] | 'network' | 'contract_violation'
  readonly issues: ApiErrorBody['issues']

  constructor(status: number, code: ApiError['code'], message: string, issues?: ApiErrorBody['issues']) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.issues = issues
  }
}

interface ClientHooks {
  getToken: () => string | null
  /** Called on 401 so the app can drop the session and show the login screen */
  onUnauthorized: () => void
  /** Sent as Accept-Language: the server writes notifications, errors and AI text in it */
  getLanguage?: () => string
  /** Messages for errors the client raises itself (no server body to show) */
  messages?: { network: () => string; http: (status: number) => string; contract: () => string }
}

const FALLBACK_MESSAGES: NonNullable<ClientHooks['messages']> = {
  network: () => 'Cannot reach the server.',
  http: (status) => `The request could not be completed. (HTTP ${status})`,
  contract: () => 'The server response does not match the API contract.',
}

let hooks: ClientHooks = { getToken: () => null, onUnauthorized: () => {} }
const messages = () => hooks.messages ?? FALLBACK_MESSAGES

export function configureClient(next: ClientHooks): void {
  hooks = next
}

type Args<E extends EndpointSpec> = ([ParamsOf<E>] extends [never] ? object : { params: ParamsOf<E> }) &
  ([BodyOf<E>] extends [never] ? object : { body: BodyOf<E> }) &
  ([QueryOf<E>] extends [never] ? object : { query?: QueryOf<E> }) &
  (E extends { multipart: true } ? { file: File } : object) & { signal?: AbortSignal }

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
 */
export async function call<E extends EndpointSpec>(spec: E, ...rest: [Args<E>] | []): Promise<ResponseOf<E>> {
  const args = (rest[0] ?? {}) as {
    params?: Record<string, unknown>
    query?: Record<string, unknown>
    body?: unknown
    file?: File
    signal?: AbortSignal
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

  let res: Response
  try {
    res = await fetch(buildUrl(spec.path, args.params, args.query), {
      method: spec.method,
      headers,
      body,
      signal: args.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'network', messages().network())
  }

  if (!res.ok) {
    const parsed = ApiErrorBody.safeParse(await res.json().catch(() => null))
    if (res.status === 401 && !spec.public) hooks.onUnauthorized()
    if (parsed.success)
      throw new ApiError(res.status, parsed.data.code, parsed.data.message, parsed.data.issues)
    throw new ApiError(res.status, 'internal', messages().http(res.status))
  }

  if (spec.response === null || res.status === 204) return undefined as ResponseOf<E>

  const json: unknown = await res.json()
  const result = (spec.response as z.ZodType).safeParse(json)
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    console.error(`[api] ${spec.method} ${spec.path} response does not match the contract`, issues)
    throw new ApiError(res.status, 'contract_violation', messages().contract(), issues)
  }
  return result.data as ResponseOf<E>
}
