import { describe, expect, it } from 'vitest'
import type { Role } from '@/domain/model'
import { DEFAULT_ROLE_PERMISSIONS } from '@/domain/roles'
import { phoneTabs, visibleNav } from './nav'

const tabsOf = (role: Role) =>
  phoneTabs(visibleNav((p) => DEFAULT_ROLE_PERMISSIONS[role].includes(p))).tabs.map((t) => t.key)

describe('the phone tab bar', () => {
  it('keeps "new request" in the middle for everyone who can file one', () => {
    expect(tabsOf('requester')).toEqual(['home', 'myRequests', 'newRequest', 'schedule'])
    expect(tabsOf('developer')).toEqual(['home', 'assigned', 'newRequest', 'myRequests'])
    expect(tabsOf('executive')).toEqual(['home', 'dashboard', 'newRequest', 'myRequests'])
    expect(tabsOf('admin')).toEqual(['home', 'assigned', 'newRequest', 'dashboard'])
  })

  it('fills four tabs by priority when there is no "new request"', () => {
    expect(tabsOf('operator')).toEqual(['home', 'aiUsage', 'aiAgents', 'budget'])
  })

  it('puts everything else in "more"', () => {
    const items = visibleNav((p) => DEFAULT_ROLE_PERMISSIONS.admin.includes(p))
    const { tabs, rest } = phoneTabs(items)
    expect([...tabs, ...rest]).toHaveLength(items.length)
    expect(rest.map((i) => i.key)).not.toContain('newRequest')
  })
})
