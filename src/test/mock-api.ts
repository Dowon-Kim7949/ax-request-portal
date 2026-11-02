/** Test helpers: a mock API on an in-memory store with a controllable clock. */
import { setupServer } from 'msw/node'
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { createHandlers, tokenFor } from '../mocks/handlers'
import { createMockStore } from '../mocks/store'

export const TEST_TIMING = { reportSeconds: 6, workSeconds: 20 }

export function createTestApi(start = new Date('2026-11-02T01:00:00.000Z')) {
  let current = start.getTime()
  const store = createMockStore({
    ...TEST_TIMING,
    rolePermissions: DEFAULT_ROLE_PERMISSIONS,
    storage: null,
    now: () => new Date(current),
  })
  const server = setupServer(...createHandlers(store, { latency: [0, 0] }))
  return {
    store,
    server,
    advance(seconds: number) {
      current += seconds * 1000
    },
    tokenFor,
  }
}
