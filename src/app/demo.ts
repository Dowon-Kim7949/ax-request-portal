/**
 * Mock-mode helpers. The mock is imported dynamically, behind `__API_MOCK__`
 * (a literal in the bundle), so a real-backend build drops these imports and
 * ships neither the mock nor the seed.
 */
import type { User } from '@/domain/model'
import type { Locale } from '@/i18n/locales'

export async function loadDemoAccounts(): Promise<{ accounts: User[]; password: string } | null> {
  if (__API_MOCK__) {
    const [{ demoAccounts }, { DEMO_PASSWORD }] = await Promise.all([
      import('@/mocks/browser'),
      import('@/mocks/seed'),
    ])
    return { accounts: demoAccounts(), password: DEMO_PASSWORD }
  }
  return null
}

export async function resetDemoData(lang: Locale): Promise<void> {
  if (__API_MOCK__) {
    const { resetMockData } = await import('@/mocks/browser')
    resetMockData(lang)
  }
}

/** Rebuild untouched demo data in the new language. True when it was rebuilt. */
export async function demoFollowLanguage(lang: Locale): Promise<boolean> {
  if (__API_MOCK__) {
    const { followLanguage } = await import('@/mocks/browser')
    return followLanguage(lang)
  }
  return false
}

/** Language the demo data was written in (mock mode only). */
export async function demoDataLanguage(): Promise<Locale | undefined> {
  if (__API_MOCK__) {
    const mod = await import('@/mocks/browser')
    return mod.demoDataLanguage()
  }
  return undefined
}
