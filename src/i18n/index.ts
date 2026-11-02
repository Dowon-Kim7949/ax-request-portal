import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { appConfig } from '../config/app.config'
import ko from './ko'

export const resources = { ko: { translation: ko } } as const

void i18n.use(initReactI18next).init({
  resources,
  lng: appConfig.locale,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
