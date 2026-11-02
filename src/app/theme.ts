import { usePreferences, type ThemePreference } from '@/stores/preferences'

/** Browser chrome color per theme (matches --color-canvas). */
const THEME_COLOR = { light: '#f3f5f8', dark: '#0d121d' } as const

const media = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return media()?.matches ? 'dark' : 'light'
  return pref
}

export function applyTheme(pref: ThemePreference): void {
  const theme = resolveTheme(pref)
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  root.style.backgroundColor = ''
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

/**
 * Keeps <html class="dark"> in sync with the stored preference and, for
 * "system", with the OS setting as it changes. Call once at startup.
 */
export function startThemeSync(): () => void {
  applyTheme(usePreferences.getState().theme)
  const unsubscribe = usePreferences.subscribe((s, prev) => {
    if (s.theme !== prev.theme) applyTheme(s.theme)
  })
  const mq = media()
  const onChange = () => {
    if (usePreferences.getState().theme === 'system') applyTheme('system')
  }
  mq?.addEventListener('change', onChange)
  return () => {
    unsubscribe()
    mq?.removeEventListener('change', onChange)
  }
}
