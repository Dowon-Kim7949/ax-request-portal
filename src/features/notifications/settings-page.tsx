import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useNotificationSettings, useUpdateNotificationSettings } from '@/api/queries'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SwitchRow } from '@/components/ui/controls'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import type { NotificationSettings } from '@/domain/model'

const ROWS: Array<{ key: keyof NotificationSettings; label: string; hint: string }> = [
  { key: 'inApp', label: 'settings.inApp', hint: 'settings.inAppHint' },
  { key: 'email', label: 'settings.email', hint: 'settings.emailHint' },
  { key: 'messenger', label: 'settings.messenger', hint: 'settings.messengerHint' },
  { key: 'onlyActionRequired', label: 'settings.onlyAction', hint: 'settings.onlyActionHint' },
]

export default function NotificationSettingsPage() {
  const { t } = useTranslation()
  usePageTitle(t('settings.title'))
  const query = useNotificationSettings()
  const update = useUpdateNotificationSettings()
  const tt = t as unknown as (key: string) => string

  if (query.isPending) return <Skeleton className="h-72" />
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={t('common.errorTitle')}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  }
  const settings = query.data

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <Card className="max-w-2xl py-1 sm:py-1">
        <div className="divide-y divide-line">
          {ROWS.map((row) => (
            <SwitchRow
              key={row.key}
              checked={settings[row.key]}
              disabled={update.isPending}
              label={tt(row.label)}
              hint={tt(row.hint)}
              onCheckedChange={(checked) =>
                update.mutate(
                  { ...settings, [row.key]: checked },
                  {
                    onSuccess: () => toast.success(t('settings.saved')),
                    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
                  },
                )
              }
            />
          ))}
        </div>
      </Card>
      <p className="mt-3 max-w-2xl text-[13px] text-ink-500">{t('settings.channelNote')}</p>
    </>
  )
}
