import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useLogout } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { flushDraftsBeforeSignOut } from '@/features/drafts/sync'
import { listLocalDrafts } from '@/stores/draft'
import { useCurrentUser } from './hooks'

/**
 * Signing out from the shell. Drafts still on their way are sent first (for a
 * few seconds at most), since signing out deletes this device's copies. When
 * some cannot reach the account (no connection, a full account, a conflict),
 * the person is asked first: render `dialog` next to the button.
 */
export function useSignOut(): { signOut: () => void; busy: boolean; dialog: ReactNode } {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const logout = useLogout()
  const [busy, setBusy] = useState(false)
  /** How many drafts signing out would delete; null while not asking */
  const [unsent, setUnsent] = useState<number | null>(null)

  const signOut = async () => {
    if (busy || logout.isPending) return
    setBusy(true)
    const notice = listLocalDrafts(user.id).length ? toast.loading(t('nav.signOutSaving')) : undefined
    let left = 0
    try {
      left = await flushDraftsBeforeSignOut(user.id)
    } finally {
      if (notice !== undefined) toast.dismiss(notice)
      setBusy(false)
    }
    if (left > 0) setUnsent(left)
    else logout.mutate()
  }

  const dialog = (
    <Sheet
      open={unsent !== null}
      onOpenChange={(open) => {
        if (!open) setUnsent(null)
      }}
      title={t('nav.signOutConfirm.title')}
      description={t('nav.signOutConfirm.body', { count: unsent ?? 0 })}
      footer={
        <>
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => setUnsent(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            loading={logout.isPending}
            onClick={() => logout.mutate()}
          >
            {t('nav.logout')}
          </Button>
        </>
      }
    />
  )

  return { signOut: () => void signOut(), busy, dialog }
}
