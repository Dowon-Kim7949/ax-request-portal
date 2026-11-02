import { ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Native select: the platform picker is the best one on phones. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <span className={cn('relative block', className)}>
      <select
        className="h-12 w-full appearance-none rounded-xl bg-surface pr-10 pl-3.5 text-[15px] text-ink-900 ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-muted"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-400"
        aria-hidden
      />
    </span>
  )
}

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
}

/** A full-width row with a switch: the whole row is the touch target. */
export function SwitchRow({ checked, onCheckedChange, label, hint, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-center gap-4 py-3.5 text-left disabled:opacity-50"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-ink-900">{label}</span>
        {hint ? <span className="text-[13px] text-ink-500">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}

/**
 * Meter: the fill carries severity (brand → warning → danger) and the track is
 * a lighter step of the same ramp, so the state reads across the whole bar.
 */
export function Meter({ value, warnAt, label }: { value: number; warnAt: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const level = value >= 100 ? 'danger' : value >= warnAt ? 'warning' : 'ok'
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn(
        'h-2.5 w-full overflow-hidden rounded-full',
        level === 'danger' ? 'bg-danger-50' : level === 'warning' ? 'bg-warning-50' : 'bg-brand-100',
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          level === 'danger' ? 'bg-danger-600' : level === 'warning' ? 'bg-warning-600' : 'bg-brand-600',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
