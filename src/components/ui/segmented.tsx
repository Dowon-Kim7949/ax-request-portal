import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  /**
   * `lang` marks a label written in another language (e.g. "한국어" in the English UI).
   * `icon` (decorative, `aria-hidden`) goes before the label, which stays: it is the radio's name.
   */
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode; count?: number; lang?: string }>
  label: string
  className?: string
}

/** Filter tabs that scroll sideways on narrow screens instead of wrapping. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        '-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={o.lang}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors',
              active
                ? 'bg-inverse text-on-inverse'
                : 'bg-surface text-ink-600 ring-1 ring-line ring-inset hover:bg-muted',
            )}
          >
            {o.icon ? <span className="inline-flex [&>svg]:size-4">{o.icon}</span> : null}
            {o.label}
            {o.count !== undefined ? (
              <span className={cn('text-xs', active ? 'text-on-inverse/70' : 'text-ink-400')}>{o.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
