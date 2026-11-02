import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom reports an English browser; pin the UI to Korean (the configured default)
// so assertions on Korean copy hold. English is covered by dedicated tests.
localStorage.setItem(
  'ax-request-portal:preferences',
  JSON.stringify({ state: { theme: 'light', language: 'ko' }, version: 0 }),
)

afterEach(() => {
  cleanup()
})
