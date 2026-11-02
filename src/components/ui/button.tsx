import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

// Disabled buttons keep pointer events so the not-allowed cursor (index.css) and
// any title tooltip still show; hover/active styles apply only when not disabled.
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors select-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-600 text-white not-disabled:hover:bg-brand-hover not-disabled:active:bg-brand-hover',
        secondary: 'bg-muted text-ink-900 ring-1 ring-line ring-inset not-disabled:hover:bg-line/60',
        outline: 'bg-surface text-ink-900 ring-1 ring-field ring-inset not-disabled:hover:bg-muted',
        ghost: 'text-ink-700 not-disabled:hover:bg-muted',
        danger: 'bg-danger-50 text-danger-fg not-disabled:hover:bg-danger-600 not-disabled:hover:text-white',
        link: 'h-auto px-0 text-accent underline-offset-4 not-disabled:hover:underline',
      },
      size: {
        // 44px minimum touch target on every interactive size except "sm" used inside dense desktop rows
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-[15px]',
        lg: 'h-13 px-5 text-base',
        icon: 'size-11',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

export function Button({
  className,
  variant,
  size,
  block,
  asChild,
  loading,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, block }), className)
  // Slot needs exactly one child element, so asChild renders the child as-is (no spinner slot).
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    )
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}
