/** Test helpers for rendering screens against the mock API as a signed-in person. */
import { QueryClient } from '@tanstack/react-query'
import { call, configureClient } from '../api/client'
import { api } from '../api/contract'
import type { User } from '../domain/model'
import { tokenFor } from '../mocks/handlers'
import { useSession } from '../stores/session'

/** Signs `userId` in through the API (as the login screen would) and returns the user. */
export async function signInAs(userId: string): Promise<User> {
  configureClient({ getToken: () => useSession.getState().token, onUnauthorized: () => {} })
  const token = tokenFor(userId)
  useSession.setState({ token, user: null, ended: null })
  const user = await call(api.me)
  useSession.setState({ token, user })
  return user
}

/** No retries and no background refetches: a test sees exactly what it set up. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}
