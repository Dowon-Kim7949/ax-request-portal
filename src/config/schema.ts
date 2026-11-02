import * as z from 'zod'
import { RequestType, Role } from '../domain/model'
import { PERMISSIONS } from '../domain/roles'

export const AppConfigSchema = z
  .object({
    brand: z.object({
      /** Shown in the header, page titles and notifications */
      name: z.string().min(1),
      /** 1–4 characters for the compact logo mark on phones */
      shortName: z.string().min(1).max(4),
      tagline: z.string(),
    }),
    locale: z.enum(['ko']),
    /**
     * Roles available in this installation. Drop 'executive' if management
     * should not be a separate role, then grant `dashboard:view` elsewhere.
     */
    enabledRoles: z.array(Role).min(1),
    rolePermissions: z.record(Role, z.array(z.enum(PERMISSIONS))),
    /** Request types offered in the wizard, in display order */
    requestTypes: z.array(RequestType).min(1),
    mock: z.object({
      /** Seconds the simulated AI takes to write a feasibility report */
      reportSeconds: z.number().positive(),
      /** Seconds the simulated AI takes from "run work" to an open merge request */
      workSeconds: z.number().positive(),
    }),
  })
  .superRefine((cfg, ctx) => {
    if (!cfg.enabledRoles.includes('admin')) {
      ctx.addIssue({ code: 'custom', path: ['enabledRoles'], message: 'admin must stay enabled' })
    }
    const canManageUsers = cfg.enabledRoles.some((r) => cfg.rolePermissions[r].includes('user:manage'))
    if (!canManageUsers) {
      ctx.addIssue({
        code: 'custom',
        path: ['rolePermissions'],
        message: 'at least one enabled role needs user:manage',
      })
    }
  })

export type AppConfig = z.infer<typeof AppConfigSchema>
