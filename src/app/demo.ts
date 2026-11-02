/** Mock-mode helpers. Imported dynamically so real-backend builds never load the seed. */
import { env } from '@/config/env'
import type { User } from '@/domain/model'

export async function loadDemoAccounts(): Promise<{ accounts: User[]; password: string } | null> {
  if (!env.apiMock) return null
  const { DEMO_ACCOUNTS, DEMO_PASSWORD } = await import('@/mocks/seed')
  return { accounts: DEMO_ACCOUNTS, password: DEMO_PASSWORD }
}

export async function resetDemoData(): Promise<void> {
  if (!env.apiMock) return
  const { resetMockData } = await import('@/mocks/browser')
  resetMockData()
}
