import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Locale } from '../i18n/locales'

export type ThemePreference = 'system' | 'light' | 'dark'

interface PreferencesState {
  theme: ThemePreference
  /** null until the person picks one; until then the browser language decides */
  language: Locale | null
  setTheme: (theme: ThemePreference) => void
  setLanguage: (language: Locale) => void
}

/**
 * Per-device display preferences. The storage key is read before React starts
 * by the inline script in index.html, so keep the shape `{ state: { theme } }`.
 */
export const PREFERENCES_KEY = 'ax-request-portal:preferences'

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: null,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: PREFERENCES_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, language }) => ({ theme, language }),
    },
  ),
)
