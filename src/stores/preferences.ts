import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Locale } from '../i18n/locales'

export type ThemePreference = 'system' | 'light' | 'dark'
/** 'auto' follows the device's time zone; otherwise an IANA name such as "America/Los_Angeles" */
export type TimeZonePreference = 'auto' | (string & {})

interface PreferencesState {
  theme: ThemePreference
  /** null until the person picks one; until then the browser language decides */
  language: Locale | null
  /** Time zone timestamps are shown in */
  timeZone: TimeZonePreference
  /** Add head-office time next to timestamps when the time zone differs */
  showHqTime: boolean
  setTheme: (theme: ThemePreference) => void
  setLanguage: (language: Locale) => void
  setTimeZone: (timeZone: TimeZonePreference) => void
  setShowHqTime: (show: boolean) => void
}

/**
 * Per-device display preferences. The storage key is read before React starts
 * by the inline script in index.html, so keep the shape `{ state: { theme } }`.
 */
export const PREFERENCES_KEY = 'ax-request-portal:preferences'

type Persisted = Pick<PreferencesState, 'theme' | 'language' | 'timeZone' | 'showHqTime'>

/** Saved data from an older version (or edited by hand) keeps the defaults for what it lacks. */
function restore(saved: unknown, current: PreferencesState): PreferencesState {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof Persisted, unknown>>
  return {
    ...current,
    ...(s.theme === 'system' || s.theme === 'light' || s.theme === 'dark' ? { theme: s.theme } : {}),
    ...(typeof s.language === 'string' ? { language: s.language as Locale } : {}),
    ...(typeof s.timeZone === 'string' && s.timeZone ? { timeZone: s.timeZone } : {}),
    ...(typeof s.showHqTime === 'boolean' ? { showHqTime: s.showHqTime } : {}),
  }
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: null,
      timeZone: 'auto',
      showHqTime: true,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setTimeZone: (timeZone) => set({ timeZone }),
      setShowHqTime: (showHqTime) => set({ showHqTime }),
    }),
    {
      name: PREFERENCES_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, language, timeZone, showHqTime }): Persisted => ({
        theme,
        language,
        timeZone,
        showHqTime,
      }),
      merge: restore,
    },
  ),
)
