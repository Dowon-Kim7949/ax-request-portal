import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import i18n from '@/i18n'
import type { Locale } from '@/i18n/locales'
import { usePreferences } from '@/stores/preferences'
import { demoFollowLanguage } from './demo'

/**
 * Switches the UI language: remembers the choice, swaps the dictionary, lets
 * untouched demo data follow, and refetches so server-written text (errors,
 * notifications) comes back in the new language.
 */
export function useSetLanguage(): (lang: Locale) => Promise<void> {
  const qc = useQueryClient()
  const remember = usePreferences((s) => s.setLanguage)
  return useCallback(
    async (lang: Locale) => {
      remember(lang)
      // Rebuild demo data first, so screens that re-render on the language change read the new data.
      await demoFollowLanguage(lang)
      await i18n.changeLanguage(lang)
      await qc.invalidateQueries()
    },
    [qc, remember],
  )
}
