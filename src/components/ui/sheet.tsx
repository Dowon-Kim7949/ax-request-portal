import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /**
   * bottom: slides up on phones and becomes a centred dialog from `sm`.
   * left: navigation drawer.
   */
  side?: 'bottom' | 'left'
  closeLabel?: string
}

/** Bottom sheet on phones, dialog on larger screens. Focus-trapped and escape-closable (Radix). */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'bottom',
  closeLabel,
}: SheetProps) {
  const { t } = useTranslation()
  closeLabel ??= t('common.close')
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/50" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-xl focus:outline-none',
            side === 'bottom' &&
              'inset-x-0 bottom-0 max-h-[88dvh] animate-slide-up rounded-t-3xl pb-safe sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-fade-in sm:rounded-3xl sm:pb-0',
            side === 'left' && 'inset-y-0 left-0 w-[min(20rem,85vw)] animate-slide-left pt-safe pb-safe',
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          {side === 'bottom' ? (
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-field sm:hidden" aria-hidden />
          ) : null}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-lg font-bold text-ink-900">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-ink-500">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-muted"
              aria-label={closeLabel}
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer ? <div className="flex gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
