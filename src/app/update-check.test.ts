import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUpdateCheck, fetchDeployedBuildId } from './update-check'

afterEach(() => {
  vi.unstubAllGlobals()
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
