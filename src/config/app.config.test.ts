import { describe, expect, it } from 'vitest'
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { appConfig } from './app.config'
import { AppConfigSchema } from './schema'

describe('appConfig', () => {
  it('is valid', () => {
    expect(AppConfigSchema.safeParse(appConfig).success).toBe(true)
  })

  it('refuses a configuration without a user manager or without admin', () => {
    const noAdmin = { ...appConfig, enabledRoles: ['requester', 'developer'] }
    expect(AppConfigSchema.safeParse(noAdmin).success).toBe(false)

    const nobodyManagesUsers = {
      ...appConfig,
      rolePermissions: { ...DEFAULT_ROLE_PERMISSIONS, admin: ['request:read:all'] },
    }
    expect(AppConfigSchema.safeParse(nobodyManagesUsers).success).toBe(false)
  })

  it('refuses a configuration where nobody runs AI operations', () => {
    const noOperator = { ...appConfig, enabledRoles: ['requester', 'executive', 'developer', 'admin'] }
    expect(AppConfigSchema.safeParse(noOperator).success).toBe(false)

    // Without the operator role, an admin can take the operator's permissions.
    const adminRunsAi = {
      ...noOperator,
      rolePermissions: {
        ...DEFAULT_ROLE_PERMISSIONS,
        admin: [...DEFAULT_ROLE_PERMISSIONS.admin, ...DEFAULT_ROLE_PERMISSIONS.operator],
      },
    }
    expect(AppConfigSchema.safeParse(adminRunsAi).success).toBe(true)
  })
})
