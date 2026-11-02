import { Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Segmented } from '@/components/ui/segmented'
import { appConfig } from '@/config/app.config'
import { isLocale, LOCALE_LABEL, type Locale } from '@/i18n/locales'
import { cn } from '@/lib/cn'
import { usePreferences, type ThemePreference } from '@/stores/preferences'
import { useSetLanguage } from './preferences'

function useCurrentLocale(): Locale {
  const { i18n } = useTranslation()
  return isLocale(i18n.language) ? i18n.language : appConfig.defaultLocale
}

/** Whether <html> is currently dark (follows "system" changes too). */
function useIsDark(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

export function LanguagePicker() {
  const { t } = useTranslation()
  const current = useCurrentLocale()
  const setLanguage = useSetLanguage()
  if (appConfig.locales.length < 2) return null
  return (
    <Segmented
      label={t('settings.language')}
      value={current}
      onChange={(lang) => void setLanguage(lang)}
      options={appConfig.locales.map((l) => ({ value: l, label: LOCALE_LABEL[l], lang: l }))}
    />
  )
}

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const

export function ThemePicker() {
  const { t } = useTranslation()
  const theme = usePreferences((s) => s.theme)
  const setTheme = usePreferences((s) => s.setTheme)
  return (
    <div role="radiogroup" aria-label={t('settings.theme')} className="grid grid-cols-3 gap-2">
      {(['system', 'light', 'dark'] as const satisfies readonly ThemePreference[]).map((option) => {
        const Icon = THEME_ICON[option]
        const active = theme === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option)}
            className={cn(
              'flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold ring-1 transition ring-inset',
              active
                ? 'bg-brand-50 text-accent-strong ring-2 ring-brand-500'
                : 'bg-surface text-ink-600 ring-field',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {t(`settings.themeOption.${option}`)}
          </button>
        )
      })}
    </div>
  )
}

/** Compact language + light/dark switches for screens without the settings page (login). */
export function QuickDisplayToggles() {
  const { t } = useTranslation()
  const current = useCurrentLocale()
  const setLanguage = useSetLanguage()
  const setTheme = usePreferences((s) => s.setTheme)
  const dark = useIsDark()
  const next = appConfig.locales.find((l) => l !== current)
  const button =
    'inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-600 ring-1 ring-line ring-inset hover:bg-surface'
  return (
    <div className="flex items-center gap-2">
      {next ? (
        <button
          type="button"
          className={button}
          onClick={() => void setLanguage(next)}
          lang={next}
          aria-label={`${t('auth.language')}: ${LOCALE_LABEL[next]}`}
        >
          <Languages className="size-4" aria-hidden />
          {LOCALE_LABEL[next]}
        </button>
      ) : null}
      <button
        type="button"
        className={cn(button, 'w-11 justify-center px-0')}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label={dark ? t('auth.toLight') : t('auth.toDark')}
      >
        {dark ? <Sun className="size-4.5" aria-hidden /> : <Moon className="size-4.5" aria-hidden />}
      </button>
    </div>
  )
}
