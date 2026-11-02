/** Languages the UI ships with. Add one here, add its dictionary, register it in ./index.ts. */
export const LOCALES = ['ko', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABEL: Record<Locale, string> = { ko: '한국어', en: 'English' }

/** BCP 47 tag for Intl formatting */
export const INTL_LOCALE: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US' }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** First supported language in the browser's preference list, if any. */
export function detectLocale(preferred: readonly string[], allowed: readonly Locale[]): Locale | undefined {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (isLocale(base) && allowed.includes(base)) return base
  }
  return undefined
}
