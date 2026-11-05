import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useNotificationSettings, useUpdateNotificationSettings } from '@/api/queries'
import { demoDataLanguage } from '@/app/demo'
import { LanguagePicker, ThemePicker } from '@/app/display-controls'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SwitchRow } from '@/components/ui/controls'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import type { NotificationSettings } from '@/domain/model'
import { TimeZoneSection } from './time-zone-section'

const ROWS = [
  { key: 'inApp', label: 'settings.inApp', hint: 'settings.inAppHint' },
  { key: 'email', label: 'settings.email', hint: 'settings.emailHint' },
  { key: 'messenger', label: 'settings.messenger', hint: 'settings.messengerHint' },
  { key: 'onlyActionRequired', label: 'settings.onlyAction', hint: 'settings.onlyActionHint' },
] as const satisfies ReadonlyArray<{ key: keyof NotificationSettings; label: string; hint: string }>

function DisplaySection() {
  const { t, i18n } = useTranslation()
  const [dataLanguage, setDataLanguage] = useState<string>()
  useEffect(() => {
    void demoDataLanguage().then(setDataLanguage)
  }, [i18n.language])

  return (
    <Card aria-labelledby="display-title">
      <CardHeader>
        <CardTitle id="display-title">{t('settings.display')}</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink-700">{t('settings.language')}</p>
          <LanguagePicker />
          {dataLanguage && dataLanguage !== i18n.language ? (
            <p className="text-[13px] text-ink-500">{t('settings.demoDataNote')}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink-700">{t('settings.theme')}</p>
          <ThemePicker />
          <p className="text-[13px] text-ink-500">{t('settings.themeHint')}</p>
        </div>
      </div>
    </Card>
  )
}

function NotificationsSection() {
  const { t } = useTranslation()
  const query = useNotificationSettings()
  const update = useUpdateNotificationSettings()

  return (
    <Card aria-labelledby="notifications-title">
      <CardHeader className="mb-0 flex-col items-start gap-1">
        <CardTitle id="notifications-title">{t('settings.notifications')}</CardTitle>
        <p className="text-sm text-ink-500">{t('settings.notificationsHint')}</p>
      </CardHeader>
      {query.isPending ? (
        <Skeleton className="mt-3 h-56" />
      ) : query.isError || !query.data ? (
        <ErrorState
          title={t('common.errorTitle')}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-line">
          {ROWS.map((row) => (
            <SwitchRow
              key={row.key}
              checked={query.data[row.key]}
              disabled={update.isPending}
              label={t(row.label)}
              hint={t(row.hint)}
              onCheckedChange={(checked) =>
                update.mutate(
                  { ...query.data, [row.key]: checked },
                  {
                    onSuccess: () => toast.success(t('settings.notificationsSaved')),
                    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
                  },
                )
              }
            />
          ))}
        </div>
      )}
      <p className="mt-2 text-[13px] text-ink-500">{t('settings.channelNote')}</p>
    </Card>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  usePageTitle(t('settings.title'))
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <div className="grid max-w-2xl grid-cols-1 gap-4">
        <DisplaySection />
        <TimeZoneSection />
        <NotificationsSection />
      </div>
    </>
  )
}
