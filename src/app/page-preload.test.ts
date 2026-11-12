import { afterEach, describe, expect, it, vi } from 'vitest'
import { preloadPage, preloadWhenIdle, setPreloadRoutes } from './page-preload'

afterEach(() => {
  setPreloadRoutes([])
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function routesWith(preload: () => Promise<unknown>) {
  return [{ path: '/', children: [{ path: 'schedule', handle: { preload } }, { path: 'settings' }] }]
}

describe('page preloading', () => {
  it('loads the code of the page a path opens, and ignores a failure', async () => {
    const preload = vi.fn(() => Promise.reject(new Error('chunk gone')))
    setPreloadRoutes(routesWith(preload))
    preloadPage('/schedule')
    preloadPage('/settings') // no loader: nothing to do
    preloadPage('/nowhere')
    expect(preload).toHaveBeenCalledTimes(1)
    await Promise.resolve() // the rejection is handled, not thrown
  })

  it('waits for the browser to be idle, and can be cancelled', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const preload = vi.fn(() => Promise.resolve())
    setPreloadRoutes(routesWith(preload))

    const cancel = preloadWhenIdle(['/schedule'])
    expect(preload).not.toHaveBeenCalled()
    cancel()
    vi.runAllTimers()
    expect(preload).not.toHaveBeenCalled()

    preloadWhenIdle(['/schedule'])
    vi.runAllTimers()
    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('preloads nothing for a viewer who saves data', () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } })
    const preload = vi.fn(() => Promise.resolve())
    setPreloadRoutes(routesWith(preload))
    preloadWhenIdle(['/schedule'])
    vi.runAllTimers()
    expect(preload).not.toHaveBeenCalled()
  })
})
