import { CircleAlert, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-ink-500', className)}>
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">loading</span>}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-line/70', className)} aria-hidden />
}

/** Placeholder list while a page loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  action,
  icon,
}: {
  title: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-(--radius-card) bg-surface px-6 py-12 text-center ring-1 ring-line">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-ink-400">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </span>
      <p className="text-[15px] text-ink-600">{title}</p>
      {action}
    </div>
  )
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-(--radius-card) bg-surface px-6 py-12 text-center ring-1 ring-line"
    >
      <span className="grid size-12 place-items-center rounded-full bg-danger-50 text-danger-fg">
        <CircleAlert className="size-6" aria-hidden />
      </span>
      <p className="font-bold text-ink-900">{title}</p>
      {body ? <p className="max-w-sm text-sm text-ink-500">{body}</p> : null}
      {action}
    </div>
  )
}
