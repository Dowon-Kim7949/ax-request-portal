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
  /** Sidebar section: the organization's admin and the service's AI operations are separate jobs */
  group: NavGroup
  /** Match the path exactly (for "/") */
  end?: boolean
}

/**
 * Single source for sidebar, tablet rail and phone tabs. An item appears only
 * when the page it links to would open: its permission is the route's
 * (`permissionsFor` in src/app/router.tsx), not declared again here.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'home', to: '/', icon: House, group: 'main', end: true },
  { key: 'newRequest', to: '/requests/new', icon: SquarePen, group: 'main' },
  {
    key: 'myRequests',
    to: '/requests',
    icon: ListChecks,
    group: 'main',
    end: true,
  },
  {
    key: 'assigned',
    to: '/work',
    icon: ClipboardList,
    group: 'main',
    end: true,
  },
  {
    key: 'regression',
    to: '/work/regression',
    icon: ShieldCheck,
    group: 'main',
  },
  { key: 'schedule', to: '/schedule', icon: CalendarDays, group: 'main' },
  { key: 'dashboard', to: '/dashboard', icon: ChartColumn, group: 'main' },
  { key: 'projects', to: '/admin/projects', icon: FolderGit2, group: 'admin' },
  { key: 'users', to: '/admin/users', icon: Users, group: 'admin' },
  { key: 'aiUsage', to: '/ops/usage', icon: ChartPie, group: 'ops' },
  { key: 'aiAgents', to: '/ops/agents', icon: Bot, group: 'ops' },
  { key: 'aiPricing', to: '/ops/pricing', icon: Tags, group: 'ops' },
  { key: 'budget', to: '/ops/budget', icon: Wallet, group: 'ops' },
]

/**
 * Phone tab bar: four tabs plus "more". Whoever can file a request finds "new
 * request" in the middle (third of five), the same place on every account; the
 * other tabs are this user's most useful items, in this order. Everything else
 * lives in the "more" sheet.
 */
const PHONE_PRIMARY: NavKey = 'newRequest'
const PHONE_PRIMARY_SLOT = 2
const PHONE_TAB_COUNT = 4

const PHONE_PRIORITY: NavKey[] = [
  'home',
  'assigned',
  'dashboard',
  'myRequests',
  'schedule',
  'aiUsage',
  'aiAgents',
  'budget',
]

/** The items whose page `can` open; `permissionsFor` names what a path needs (the router's). */
export function visibleNav(
  can: (p: Permission) => boolean,
  permissionsFor: (path: string) => Permission[],
): NavItem[] {
  return NAV_ITEMS.filter((i) => permissionsFor(i.to).every(can))
}

export function phoneTabs(items: NavItem[]): { tabs: NavItem[]; rest: NavItem[] } {
  const byKey = new Map(items.map((i) => [i.key, i]))
  const primary = byKey.get(PHONE_PRIMARY)
  const tabs = PHONE_PRIORITY.map((k) => byKey.get(k))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, primary ? PHONE_TAB_COUNT - 1 : PHONE_TAB_COUNT)
  if (primary) tabs.splice(Math.min(PHONE_PRIMARY_SLOT, tabs.length), 0, primary)
  const tabKeys = new Set(tabs.map((t) => t.key))
  return { tabs, rest: items.filter((i) => !tabKeys.has(i.key)) }
}
