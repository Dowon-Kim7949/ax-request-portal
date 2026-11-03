import {
  Bot,
  CalendarDays,
  ChartColumn,
  ChartPie,
  ClipboardList,
  FolderGit2,
  House,
  ListChecks,
  ShieldCheck,
  SquarePen,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/domain/roles'

export type NavKey =
  | 'home'
  | 'newRequest'
  | 'myRequests'
  | 'assigned'
  | 'regression'
  | 'schedule'
  | 'dashboard'
  | 'projects'
  | 'users'
  | 'aiUsage'
  | 'aiAgents'
  | 'aiPricing'
  | 'budget'

export type NavGroup = 'main' | 'admin' | 'ops'

export interface NavItem {
  key: NavKey
  to: string
  icon: LucideIcon
  permission?: Permission
  /** Sidebar section: the organization's admin and the service's AI operations are separate jobs */
  group: NavGroup
  /** Match the path exactly (for "/") */
  end?: boolean
}

/** Single source for sidebar, tablet rail and phone tabs. Items appear only with the permission. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'home', to: '/', icon: House, group: 'main', end: true },
  { key: 'newRequest', to: '/requests/new', icon: SquarePen, permission: 'request:create', group: 'main' },
  {
    key: 'myRequests',
    to: '/requests',
    icon: ListChecks,
    permission: 'request:read:own',
    group: 'main',
    end: true,
  },
  {
    key: 'assigned',
    to: '/work',
    icon: ClipboardList,
    permission: 'request:review',
    group: 'main',
    end: true,
  },
  {
    key: 'regression',
    to: '/work/regression',
    icon: ShieldCheck,
    permission: 'regression:view',
    group: 'main',
  },
  { key: 'schedule', to: '/schedule', icon: CalendarDays, permission: 'schedule:view', group: 'main' },
  { key: 'dashboard', to: '/dashboard', icon: ChartColumn, permission: 'dashboard:view', group: 'main' },
  { key: 'projects', to: '/admin/projects', icon: FolderGit2, permission: 'project:manage', group: 'admin' },
  { key: 'users', to: '/admin/users', icon: Users, permission: 'user:manage', group: 'admin' },
  { key: 'aiUsage', to: '/ops/usage', icon: ChartPie, permission: 'usage:view', group: 'ops' },
  { key: 'aiAgents', to: '/ops/agents', icon: Bot, permission: 'agent:manage', group: 'ops' },
  { key: 'aiPricing', to: '/ops/pricing', icon: Tags, permission: 'agent:manage', group: 'ops' },
  { key: 'budget', to: '/ops/budget', icon: Wallet, permission: 'budget:manage', group: 'ops' },
]

/**
 * Phone tab bar: the four most useful items for this user, in this order.
 * Everything else lives in the "more" sheet.
 */
const PHONE_PRIORITY: NavKey[] = [
  'home',
  'assigned',
  'dashboard',
  'newRequest',
  'myRequests',
  'schedule',
  'aiUsage',
  'aiAgents',
  'budget',
]

export function visibleNav(can: (p: Permission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.permission || can(i.permission))
}

export function phoneTabs(items: NavItem[]): { tabs: NavItem[]; rest: NavItem[] } {
  const byKey = new Map(items.map((i) => [i.key, i]))
  const tabs = PHONE_PRIORITY.map((k) => byKey.get(k))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 4)
  const tabKeys = new Set(tabs.map((t) => t.key))
  return { tabs, rest: items.filter((i) => !tabKeys.has(i.key)) }
}
