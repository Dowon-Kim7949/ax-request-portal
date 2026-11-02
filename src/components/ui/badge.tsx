import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-ink-600 ring-1 ring-line ring-inset',
        brand: 'bg-brand-50 text-accent-strong',
        ai: 'bg-ai-50 text-ai-700',
        action: 'bg-brand-600 text-white',
        warning: 'bg-warning-50 text-warning-fg',
        success: 'bg-success-50 text-success-fg',
        danger: 'bg-danger-50 text-danger-fg',
        strong: 'bg-inverse text-on-inverse',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
