import { useTranslation } from 'react-i18next'
import { appConfig } from '@/config/app.config'
import { currentLocale } from '@/i18n'
import { isLocale } from '@/i18n/locales'

export interface Brand {
  name: string
  shortName: string
  tagline: string
}

export function brandFor(locale = currentLocale()): Brand {
  const { name, shortName, tagline } = appConfig.brand
  return {
    name: name[locale] ?? name[appConfig.defaultLocale] ?? '',
    shortName,
    tagline: tagline[locale] ?? tagline[appConfig.defaultLocale] ?? '',
  }
}

/** Brand texts in the current language; re-renders on language change. */
export function useBrand(): Brand {
  const { i18n } = useTranslation()
  return brandFor(isLocale(i18n.language) ? i18n.language : appConfig.defaultLocale)
}
