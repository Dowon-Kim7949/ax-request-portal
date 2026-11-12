import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useNotificationSettings, useUpdateNotificationSettings } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { demoDataLanguage } from '@/app/demo'
import { LanguagePicker, ThemePicker } from '@/app/display-controls'
import { Page, PageHeader, PageScroll, PageTop } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SwitchRow } from '@/components/ui/controls'
import { Skeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { appConfig } from '@/config/app.config'
import { notificationRows } from './notification-rows'
import { TimeZoneSection } from './time-zone-section'

// Channels the backend does not send have no switch (`notifications.channels` in src/config/app.config.ts).
const ROWS = notificationRows(appConfig.notifications.channels)

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
      <RefreshFailed {...refreshOf(query)} className="mt-3" />
      {query.isPending ? (
        <Skeleton className="mt-3 h-56" />
      ) : query.isLoadingError || !query.data ? (
        <LoadFailed
          compact
          className="mt-3"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
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
      {appConfig.notifications.channels.length ? (
        <p className="mt-2 text-[13px] text-ink-500">{t('settings.channelNote')}</p>
      ) : null}
    </Card>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  usePageTitle(t('settings.title'))
  return (
    <Page>
      <PageTop>
        <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      </PageTop>
      <PageScroll label={t('common.contentOf', { title: t('settings.title') })}>
        <div className="grid max-w-2xl grid-cols-1 gap-4">
          <DisplaySection />
          <TimeZoneSection />
          <NotificationsSection />
        </div>
      </PageScroll>
    </Page>
  )
}
