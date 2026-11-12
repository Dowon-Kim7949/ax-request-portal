import { describe, expect, it } from 'vitest'
import { notificationRows } from './notification-rows'

describe('notification switches', () => {
  it('offers a channel only when the backend sends it', () => {
    const keys = (channels: Parameters<typeof notificationRows>[0]) =>
      notificationRows(channels).map((r) => r.key)
    expect(keys(['email', 'messenger'])).toEqual(['inApp', 'email', 'messenger', 'onlyActionRequired'])
    expect(keys(['messenger'])).toEqual(['inApp', 'messenger', 'onlyActionRequired'])
    expect(keys([])).toEqual(['inApp', 'onlyActionRequired'])
  })
})
