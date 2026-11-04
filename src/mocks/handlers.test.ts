import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildUrl } from '../api/client'
import { api } from '../api/contract'
import { createTestApi } from '../test/mock-api'
import { MOCK_RESPONSE_HEADER } from './handlers'

const t = createTestApi()

beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => t.server.close())

it('marks every mock response, errors included, as coming from the mock', async () => {
  // The browser client tells a bypassed request (restarted service worker) by the missing mark.
  const res = await fetch(buildUrl(api.me.path))
  expect(res.status).toBe(401)
  expect(res.headers.get(MOCK_RESPONSE_HEADER)).toBe('1')
})
