import { CircleAlert, Info } from 'lucide-react'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-xl bg-surface px-3.5 text-[15px] text-ink-900 ring-1 ring-field ring-inset placeholder:text-ink-500 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-muted aria-invalid:ring-danger-600'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-12', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-28 resize-y py-3 leading-relaxed', className)} {...props} />
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-sm font-semibold text-ink-700', className)} {...props} />
}

export interface Advice {
  severity: 'info' | 'warning'
  message: string
}

/** Advisory hint from the submission check: shown next to the field, never blocking. */
export function AdviceText({ advice, id }: { advice: Advice; id?: string }) {
  const Icon = advice.severity === 'warning' ? CircleAlert : Info
  return (
    <p
      id={id}
      className={cn(
        'flex gap-1.5 text-[13px] leading-snug',
        advice.severity === 'warning' ? 'text-warning-fg' : 'text-ink-500',
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {advice.message}
    </p>
  )
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string
  advice?: Advice[]
  optional?: boolean
  optionalLabel?: string
  className?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  hint,
  error,
  advice,
  optional,
  optionalLabel,
  className,
  children,
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const describedBy = hint || error || advice?.length ? hintId : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="ml-1.5 text-xs font-medium text-ink-400">{optionalLabel}</span> : null}
      </Label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      <div id={hintId} className="flex flex-col gap-1 empty:hidden">
        {error ? (
          <p className="text-[13px] font-medium text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}
        {advice?.map((a) => (
          <AdviceText key={a.message} advice={a} />
        ))}
        {hint && !error ? <p className="text-[13px] text-ink-500">{hint}</p> : null}
      </div>
    </div>
  )
}
