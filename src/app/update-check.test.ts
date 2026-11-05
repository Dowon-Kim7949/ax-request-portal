import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUpdateCheck, FETCH_TIMEOUT_MS, fetchDeployedBuildId, isChunkLoadError } from './update-check'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** A version.json request that never answers until its signal aborts. */
const hangingFetch = (_url: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error))
  })

describe('a check that gets no answer', () => {
  it('gives up after FETCH_TIMEOUT_MS, so the next check can run', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(hangingFetch)
      .mockResolvedValueOnce(Response.json({ buildId: 'build-b' }))
    vi.stubGlobal('fetch', fetchMock)
    const onUpdate = vi.fn()
    const check = createUpdateCheck('build-a', onUpdate)

    const first = check()
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS)
    await first
    expect(onUpdate).not.toHaveBeenCalled()

    await check()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onUpdate).toHaveBeenCalledWith('build-b')
  })
})

describe('isChunkLoadError', () => {
  it('recognises a page chunk that is gone, in each browser’s words', () => {
    // Chrome / Edge
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a-1.js')),
    ).toBe(true)
    // Firefox
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(
      true,
    )
    // Safari
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    // Vite's CSS preload
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/a-1.css'))).toBe(true)
  })

  it('leaves other errors alone', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('createUpdateCheck', () => {
  it('announces each newer build once', async () => {
    const deployed = vi.fn<() => Promise<string | null>>()
    const onUpdate = vi.fn()
    const check = createUpdateCheck('build-a', onUpdate, deployed)

    deployed.mockResolvedValue('build-a')
    await check()
    expect(onUpdate).not.toHaveBeenCalled()

    deployed.mockResolvedValue('build-b')
    await check()
    await check()
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenLastCalledWith('build-b')

    deployed.mockResolvedValue('build-c')
    await check()
    expect(onUpdate).toHaveBeenCalledTimes(2)
  })

  it('stays quiet when the deployed build cannot be read', async () => {
    const onUpdate = vi.fn()
    await createUpdateCheck('build-a', onUpdate, () => Promise.resolve(null))()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shares one request between checks made at the same time', async () => {
    const deployed = vi.fn(() => Promise.resolve('build-b'))
    const check = createUpdateCheck('build-a', () => {}, deployed)
    await Promise.all([check(), check(), check()])
    expect(deployed).toHaveBeenCalledTimes(1)
  })
})

describe('fetchDeployedBuildId', () => {
  it('reads version.json past every cache', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ buildId: 'build-b' })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchDeployedBuildId('/ax/')).resolves.toBe('build-b')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toMatch(/^\/ax\/version\.json\?t=\d+$/)
    expect(init?.cache).toBe('no-store')
  })

  it('returns null for a missing file, a bad body or a network error', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('<!doctype html>', { status: 404 })))
    await expect(fetchDeployedBuildId('/')).resolves.toBeNull()
    vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ version: 1 })))
    await expect(fetchDeployedBuildId('/')).resolves.toBeNull()
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))
    await expect(fetchDeployedBuildId('/')).resolves.toBeNull()
  })
})
