import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PREFERENCES_KEY, usePreferences } from './preferences'

const saved = () =>
  JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') as { state: Record<string, unknown> }
const original = localStorage.getItem(PREFERENCES_KEY)

beforeEach(() => {
  usePreferences.setState({ theme: 'system', language: null, timeZone: 'auto', showHqTime: true })
})
afterEach(() => {
  if (original) localStorage.setItem(PREFERENCES_KEY, original)
  else localStorage.removeItem(PREFERENCES_KEY)
})

describe('preferences', () => {
  it('keeps the defaults for what data saved by an older version lacks', async () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ state: { theme: 'dark', language: 'en' }, version: 0 }),
    )
    await usePreferences.persist.rehydrate()
    const s = usePreferences.getState()
    expect(s.theme).toBe('dark')
    expect(s.language).toBe('en')
    expect(s.timeZone).toBe('auto')
    expect(s.showHqTime).toBe(true)
  })

  it('ignores values of the wrong type', async () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ state: { theme: 'neon', timeZone: 7, showHqTime: 'yes' }, version: 0 }),
    )
    await usePreferences.persist.rehydrate()
    const s = usePreferences.getState()
    expect(s.theme).toBe('system')
    expect(s.timeZone).toBe('auto')
    expect(s.showHqTime).toBe(true)
  })

  it('saves the time zone choices next to the theme, in the shape index.html reads', () => {
    usePreferences.getState().setTheme('dark')
    usePreferences.getState().setTimeZone('America/Los_Angeles')
    usePreferences.getState().setShowHqTime(false)
    expect(saved().state).toEqual({
      theme: 'dark',
      language: null,
      timeZone: 'America/Los_Angeles',
      showHqTime: false,
    })
  })
})
