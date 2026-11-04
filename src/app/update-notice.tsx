import { useEffect } from 'react'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { watchForUpdates } from './update-check'

const TOAST_ID = 'app-update'

/**
 * Announces a newer deployment in the app's toaster and offers a reload. It
 * never reloads by itself: someone may be in the middle of typing.
 */
export function UpdateNotice() {
  useEffect(
    () =>
      watchForUpdates(() => {
        toast.info(i18n.t('update.title'), {
          id: TOAST_ID,
          description: i18n.t('update.body'),
          duration: Infinity,
          action: { label: i18n.t('update.reload'), onClick: () => window.location.reload() },
          // Sonner's 24 px button is below the app's 44 px touch target; its styles are unlayered, hence `!`.
          classNames: { actionButton: '!h-11 !rounded-lg !px-4 !text-sm' },
        })
      }),
    [],
  )
  return null
}
