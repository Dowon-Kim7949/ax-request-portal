import * as z from 'zod'
import { RequestType, Role } from '../domain/model'
import { PERMISSIONS } from '../domain/roles'
import { LOCALES } from '../i18n/locales'

const Locale = z.enum(LOCALES)
/** One string per shipped language */
const Localized = z.record(Locale, z.string().min(1))

/** An IANA time zone name the runtime knows, e.g. "Asia/Seoul" or "America/Los_Angeles" */
const TimeZone = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
      return true
    } catch {
      return false
    }
  },
  { message: 'unknown IANA time zone' },
)

export const AppConfigSchema = z
  .object({
    brand: z.object({
      /** Shown in the header, page titles and on the login screen */
      name: Localized,
      /** 1–4 characters for the compact logo mark */
      shortName: z.string().min(1).max(4),
      tagline: Localized,
    }),
    organization: z.object({
      /**
       * Time zone of the head office. It is the business calendar: "today" for
       * desired and release dates, delays, and daily/monthly totals follow it, in
       * the UI and in the API alike. Timestamps are shown in the viewer's own
       * time zone, with head-office time added when the two differ.
       */
      timeZone: TimeZone,
      /** Short place name put before head-office times: "Korea Nov 5, 11:00 AM" */
      timeZoneLabel: Localized,
    }),
    /** Languages offered in the language switcher, in display order */
    locales: z.array(Locale).min(1),
    /** Used when neither a saved choice nor the browser language matches `locales` */
    defaultLocale: Locale,
    /**
     * Roles available in this installation. Drop 'executive' if management
     * should not be a separate role, then grant `dashboard:view` elsewhere.
     */
    enabledRoles: z.array(Role).min(1),
    rolePermissions: z.record(Role, z.array(z.enum(PERMISSIONS))),
    /** Request types offered in the wizard, in display order */
    requestTypes: z.array(RequestType).min(1),
    workflow: z.object({
      /**
       * After the feasibility report, ask the requester to confirm the AI's reading
       * (what changes, what does not, choices where the request is ambiguous) before
       * a developer reviews it. The mock API follows this; a real backend should
       * read the same setting.
       */
      scopeCheck: z.boolean(),
    }),
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
    for (const permission of ['agent:manage', 'budget:manage'] as const) {
      if (!cfg.enabledRoles.some((r) => cfg.rolePermissions[r].includes(permission))) {
        ctx.addIssue({
          code: 'custom',
          path: ['rolePermissions'],
          message: `at least one enabled role needs ${permission}`,
        })
      }
    }
    if (!cfg.locales.includes(cfg.defaultLocale)) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message: 'defaultLocale must be one of locales',
      })
    }
  })

export type AppConfig = z.infer<typeof AppConfigSchema>
