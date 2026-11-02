import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Shows a back link (always on phones, where there is no sidebar) */
  back?: { to: string; label?: string }
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}

export function PageHeader({ title, description, back, actions, eyebrow, className }: PageHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className={cn('mb-5 flex flex-col gap-3 sm:mb-6', className)}>
      {back ? (
        <Link
          to={back.to}
          className="-ml-2 inline-flex h-10 w-fit items-center gap-0.5 rounded-lg pr-3 pl-1 text-sm font-semibold text-ink-500 hover:bg-surface hover:text-ink-900"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {back.label ?? t('common.back')}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow ? <div className="text-sm font-semibold text-brand-600">{eyebrow}</div> : null}
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-ink-900 sm:text-[28px]">
            {title}
          </h1>
          {description ? <p className="text-[15px] text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
