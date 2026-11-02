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
})
