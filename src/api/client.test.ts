import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { ApiError, call, configureClient, DEFAULT_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from './client'
import { api, timeoutOf, type EndpointSpec } from './contract'

const ping = {
  method: 'POST',
  path: '/ping',
  summary: 'Test endpoint',
  tag: 'test',
  public: true,
  body: z.object({ n: z.number() }),
  response: z.object({ ok: z.boolean() }),
} as const satisfies EndpointSpec

const page404 = () =>
  new Response('<!doctype html>', { status: 404, headers: { 'Content-Type': 'text/html' } })
const ok = () => Response.json({ ok: true })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  configureClient({ getToken: () => null, onUnauthorized: () => {} })
})

describe('recover hook (mock mode)', () => {
  it('sends a bypassed request once more, with the same body, after the mock is re-attached', async () => {
    const recover = vi.fn((res: Response) => Promise.resolve(res.status === 404))
    configureClient({ getToken: () => null, onUnauthorized: () => {}, recover })
    fetchMock.mockResolvedValueOnce(page404()).mockResolvedValueOnce(ok())

    await expect(call(ping, { body: { n: 1 } })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ n: 1 }))
    expect(recover).toHaveBeenCalledTimes(1)
  })

  it('retries only once and then reports the failure', async () => {
    configureClient({ getToken: () => null, onUnauthorized: () => {}, recover: () => Promise.resolve(true) })
    fetchMock.mockImplementation(() => Promise.resolve(page404()))

    const err = await call(ping, { body: { n: 1 } }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not repeat a request the hook leaves alone', async () => {
    configureClient({ getToken: () => null, onUnauthorized: () => {}, recover: () => Promise.resolve(false) })
    fetchMock.mockResolvedValueOnce(page404())

    await expect(call(ping, { body: { n: 1 } })).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps one deadline across the re-send', async () => {
    vi.useFakeTimers()
    try {
      configureClient({
        getToken: () => null,
        onUnauthorized: () => {},
        recover: () => Promise.resolve(true),
      })
      fetchMock.mockResolvedValueOnce(page404()).mockImplementationOnce(hang)

      const pending = call(ping, { body: { n: 1 } }).catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS)
      expect(await pending).toMatchObject({ code: 'timeout' })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

/** A server that never answers; the fetch rejects only when its signal aborts, as browsers do. */
function hang(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal
    if (signal?.aborted) return reject(signal.reason as Error)
    signal?.addEventListener('abort', () => reject(signal.reason as Error))
  })
}

const upload = {
  method: 'POST',
  path: '/upload',
  summary: 'Test upload',
  tag: 'test',
  public: true,
  multipart: true,
  response: z.object({ ok: z.boolean() }),
} as const satisfies EndpointSpec

describe('time limit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    configureClient({
      getToken: () => null,
      onUnauthorized: () => {},
      messages: { timeout: () => '응답이 늦어요' },
    })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fails as a timeout, in the configured words, when the server does not answer in time', async () => {
    fetchMock.mockImplementation(hang)
    const pending = call(ping, { body: { n: 1 } }).catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1)
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    const err = await pending
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 0, code: 'timeout', message: '응답이 늦어요' })
  })

  it("takes the endpoint's own time limit, and gives uploads longer by default", async () => {
    fetchMock.mockImplementation(hang)
    const quickPing = { ...ping, timeoutMs: 1_000 } as const satisfies EndpointSpec
    const quick = call(quickPing, { body: { n: 1 } }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(await quick).toMatchObject({ code: 'timeout' })

    let settled = false
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    const slow = call(upload, { file })
      .catch((e: unknown) => e)
      .finally(() => (settled = true))
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS - DEFAULT_TIMEOUT_MS)
    expect(await slow).toMatchObject({ code: 'timeout' })
  })

  it('keeps every time limit in the contract, one per endpoint', () => {
    expect(timeoutOf(api.uploadAttachment)).toBe(UPLOAD_TIMEOUT_MS)
    expect(timeoutOf(api.listRequests)).toBe(DEFAULT_TIMEOUT_MS)
    for (const [name, spec] of Object.entries(api) as Array<[string, EndpointSpec]>) {
      const ms = timeoutOf(spec)
      expect(Number.isFinite(ms) && ms >= 0, name).toBe(true)
    }
  })

  it('also covers reading a body that stops half-way', async () => {
    fetchMock.mockImplementation((_url, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ok":'))
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason))
        },
      })
      return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'application/json' } }))
    })
    const pending = call(ping, { body: { n: 1 } }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS)
    expect(await pending).toMatchObject({ code: 'timeout' })
  })

  it('clears its timer once the answer is in', async () => {
    fetchMock.mockResolvedValueOnce(ok())
    await expect(call(ping, { body: { n: 1 } })).resolves.toEqual({ ok: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves a cancel by the caller an AbortError, not an ApiError', async () => {
    fetchMock.mockImplementation(hang)
    const controller = new AbortController()
    const pending = call(ping, { body: { n: 1 }, signal: controller.signal }).catch((e: unknown) => e)
    controller.abort()

    const err = await pending
    expect(err).not.toBeInstanceOf(ApiError)
    expect(err).toBeInstanceOf(DOMException)
    expect((err as DOMException).name).toBe('AbortError')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('combines the caller’s signal with the time limit without AbortSignal.any', async () => {
    const any = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true, writable: true })
    try {
      fetchMock.mockImplementation(hang)
      const controller = new AbortController()
      const cancelled = call(ping, { body: { n: 1 }, signal: controller.signal }).catch((e: unknown) => e)
      controller.abort()
      expect(((await cancelled) as DOMException).name).toBe('AbortError')

      const timedOut = call(ping, { body: { n: 1 }, signal: new AbortController().signal }).catch(
        (e: unknown) => e,
      )
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS)
      expect(await timedOut).toMatchObject({ code: 'timeout' })
    } finally {
      if (any) Object.defineProperty(AbortSignal, 'any', any)
    }
  })
})

describe('failures become ApiErrors', () => {
  it('reports a network failure as network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(call(ping, { body: { n: 1 } })).rejects.toMatchObject({ status: 0, code: 'network' })
  })

  it('reports a 200 whose body is not JSON as a contract violation, without retrying it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(
      new Response('<!doctype html><title>app</title>', { headers: { 'Content-Type': 'text/html' } }),
    )
    const err = await call(ping, { body: { n: 1 } }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 200, code: 'contract_violation' })
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })

  it('treats a missing path parameter as the bug it is', async () => {
    // No `params` schema, so the type system does not ask for the {id} the path needs.
    const byId = { ...ping, path: '/things/{id}' } as const satisfies EndpointSpec
    const err = await call(byId, { body: { n: 1 } }).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(ApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
