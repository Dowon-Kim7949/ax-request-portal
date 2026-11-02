/** Mock-mode helpers. Imported dynamically so real-backend builds never load the seed. */
import { env } from '@/config/env'
import type { User } from '@/domain/model'
import type { Locale } from '@/i18n/locales'

export async function loadDemoAccounts(): Promise<{ accounts: User[]; password: string } | null> {
  if (!env.apiMock) return null
  const [{ demoAccounts }, { DEMO_PASSWORD }] = await Promise.all([
    import('@/mocks/browser'),
    import('@/mocks/seed'),
  ])
  return { accounts: demoAccounts(), password: DEMO_PASSWORD }
}

export async function resetDemoData(lang: Locale): Promise<void> {
  if (!env.apiMock) return
  const { resetMockData } = await import('@/mocks/browser')
  resetMockData(lang)
}

/** Rebuild untouched demo data in the new language. True when it was rebuilt. */
export async function demoFollowLanguage(lang: Locale): Promise<boolean> {
  if (!env.apiMock) return false
  const { followLanguage } = await import('@/mocks/browser')
  return followLanguage(lang)
}

/** Language the demo data was written in (mock mode only). */
export async function demoDataLanguage(): Promise<Locale | undefined> {
  if (!env.apiMock) return undefined
  const mod = await import('@/mocks/browser')
  return mod.demoDataLanguage()
}
