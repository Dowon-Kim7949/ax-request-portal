import { afterEach, describe, expect, it, vi } from 'vitest'
import { anySignal, timeoutSignal } from './abort'
import { debounce } from './debounce'

afterEach(() => {
  vi.useRealTimers()
})

describe('timeoutSignal', () => {
  it('aborts with a TimeoutError after the time, unless cleared first', () => {
    vi.useFakeTimers()
    const late = timeoutSignal(1_000)
    vi.advanceTimersByTime(999)
    expect(late.signal.aborted).toBe(false)
    vi.advanceTimersByTime(1)
    expect((late.signal.reason as DOMException).name).toBe('TimeoutError')

    const done = timeoutSignal(1_000)
    done.clear()
    vi.advanceTimersByTime(5_000)
    expect(done.signal.aborted).toBe(false)
    expect(timeoutSignal(0).signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe.each([
  ['AbortSignal.any', false],
  ['the fallback', true],
])('anySignal with %s', (_name, withoutAny) => {
  const restore: Array<() => void> = []
  afterEach(() => restore.splice(0).forEach((undo) => undo()))
  const prepare = () => {
    if (!withoutAny) return
    const any = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true, writable: true })
    restore.push(() => {
      if (any) Object.defineProperty(AbortSignal, 'any', any)
    })
  }

  it('aborts when any source does, with its reason', () => {
    prepare()
    const a = new AbortController()
    const b = new AbortController()
    const combined = anySignal([a.signal, b.signal])
    expect(combined.aborted).toBe(false)
    b.abort('second')
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe('second')
    a.abort('first')
    expect(combined.reason).toBe('second')
  })

  it('starts aborted when a source already is', () => {
    prepare()
    const a = new AbortController()
    a.abort('early')
    const combined = anySignal([new AbortController().signal, a.signal])
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe('early')
  })
})

describe('debounce', () => {
  it('runs once after the pause, early on flush, never after cancel', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 300)
    d.schedule()
    d.schedule()
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)

    d.schedule()
    d.flush()
    expect(fn).toHaveBeenCalledTimes(2)
    d.flush() // nothing waiting
    expect(fn).toHaveBeenCalledTimes(2)

    d.schedule()
    d.cancel()
    vi.advanceTimersByTime(1_000)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
