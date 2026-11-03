import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Stat tile: label · value · one supporting line, and optionally a meter below. */
export function StatTile({
  label,
  value,
  note,
  noteTone = 'muted',
  children,
}: {
  label: string
  value: string
  note?: ReactNode
  noteTone?: 'muted' | 'warning'
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink-500">{label}</p>
        {note ? (
          <p
            className={cn(
              'flex items-center gap-1 text-right text-xs font-semibold',
              noteTone === 'warning' ? 'text-warning-fg' : 'text-ink-500',
            )}
          >
            {noteTone === 'warning' ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> : null}
            {note}
          </p>
        ) : null}
      </div>
      <p className="text-[28px] leading-tight font-bold tracking-tight text-ink-900">{value}</p>
      {children}
    </div>
  )
}
