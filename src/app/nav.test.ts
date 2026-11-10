import { matchRoutes } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Role } from '@/domain/model'
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from '@/domain/roles'
import { NAV_ITEMS, phoneTabs, visibleNav } from './nav'
import { permissionsFor, routes } from './router'

const tabsOf = (role: Role) =>
  phoneTabs(visibleNav((p) => DEFAULT_ROLE_PERMISSIONS[role].includes(p), permissionsFor)).tabs.map(
    (t) => t.key,
  )

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
    const items = visibleNav((p) => DEFAULT_ROLE_PERMISSIONS.admin.includes(p), permissionsFor)
    const { tabs, rest } = phoneTabs(items)
    expect([...tabs, ...rest]).toHaveLength(items.length)
    expect(rest.map((i) => i.key)).not.toContain('newRequest')
  })
})

describe('the menus', () => {
  it('link only to pages of their own, never to the not-found page', () => {
    for (const item of NAV_ITEMS) {
      const leaf = matchRoutes(routes, item.to)?.at(-1)?.route
      expect(leaf?.path, item.key).not.toBe('*')
    }
  })

  it("show an item exactly when its page would open, with the route's permission", () => {
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[]) {
      const can = (p: Permission) => DEFAULT_ROLE_PERMISSIONS[role].includes(p)
      const shown = new Set(visibleNav(can, permissionsFor).map((i) => i.key))
      for (const item of NAV_ITEMS) {
        expect(shown.has(item.key), `${role}: ${item.key}`).toBe(permissionsFor(item.to).every(can))
      }
    }
    // The route is the source: an operator does not file requests, so the menu leaves the wizard out.
    expect(permissionsFor('/requests/new')).toEqual(['request:create'])
    expect(
      visibleNav((p) => DEFAULT_ROLE_PERMISSIONS.operator.includes(p), permissionsFor).map((i) => i.key),
    ).not.toContain('newRequest')
  })
})
