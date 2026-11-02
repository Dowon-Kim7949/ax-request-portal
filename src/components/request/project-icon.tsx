import { Box, Globe, LayoutDashboard, Server, Smartphone, type LucideIcon } from 'lucide-react'
import type { ProjectIcon as ProjectIconName } from '@/domain/model'
import { cn } from '@/lib/cn'

const ICONS: Record<ProjectIconName, LucideIcon> = {
  globe: Globe,
  smartphone: Smartphone,
  'layout-dashboard': LayoutDashboard,
  server: Server,
  box: Box,
}

export function ProjectIcon({ icon, className }: { icon: ProjectIconName | undefined; className?: string }) {
  const Icon = ICONS[icon ?? 'box']
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600',
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  )
}
