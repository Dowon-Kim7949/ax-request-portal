import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { ApiError, call, configureClient } from './client'
import type { EndpointSpec } from './contract'

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
})
