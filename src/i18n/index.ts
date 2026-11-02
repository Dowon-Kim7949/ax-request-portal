import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { appConfig } from '../config/app.config'
import { usePreferences } from '../stores/preferences'
import en from './en'
import ko from './ko'
import { detectLocale, isLocale, type Locale } from './locales'

export const resources = { ko: { translation: ko }, en: { translation: en } } as const

/** Saved choice → browser language → configured default. */
export function initialLocale(): Locale {
  const saved = usePreferences.getState().language
  if (saved && appConfig.locales.includes(saved)) return saved
  const browser = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  return detectLocale(browser, appConfig.locales) ?? appConfig.defaultLocale
}

export function currentLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : appConfig.defaultLocale
}

const syncDocument = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale(),
  fallbackLng: appConfig.defaultLocale,
  supportedLngs: appConfig.locales,
  interpolation: { escapeValue: false },
  returnNull: false,
})
syncDocument(i18n.language)
i18n.on('languageChanged', syncDocument)

export default i18n
