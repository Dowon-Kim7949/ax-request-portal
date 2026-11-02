import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { ApiError } from '@/api/client'
import { useRequest } from '@/api/queries'
import { useCan, useCurrentUser, useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { NotFoundPage } from '@/app/pages'
import { StatusBadge, Stepper } from '@/components/request/status'
import { Timeline } from '@/components/request/timeline'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { appConfig } from '@/config/app.config'
import { availableEvents } from '@/domain/lifecycle'
import { formatDate } from '@/lib/format'
import { ReleaseCard, RequestContent } from './request-content'
import { CancelRequest, InfoAnswerCard, StatusExplainer, VerificationCard } from './requester-panels'

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
    </div>
  )
}

export default function RequestDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const id = Number(params.id)
  const query = useRequest(Number.isInteger(id) && id > 0 ? id : undefined)
  const user = useCurrentUser()
  const can = useCan()
  const dir = useDirectory()
  const request = query.data
  usePageTitle(request ? `#${request.id} ${request.title}` : undefined)

  if (!Number.isInteger(id) || id <= 0) return <NotFoundPage />
  if (query.isPending) return <DetailSkeleton />
  if (query.isError || !request) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />
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

  const project = dir.project(request.projectId)
  const requester = dir.user(request.requesterId)
  const isRequester = request.requesterId === user.id
  const events = availableEvents({ user, request, project, rolePermissions: appConfig.rolePermissions })
  const back = isRequester
    ? { to: '/requests', label: t('nav.myRequests') }
    : can('request:review')
      ? { to: '/work', label: t('nav.assigned') }
      : { to: '/', label: t('nav.home') }

  return (
    <>
      <PageHeader
        back={back}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <span className="text-ink-400">#{request.id}</span>
          </span>
        }
        title={request.title}
        description={
          <span className="flex flex-wrap gap-x-2 text-sm">
            <span>{project?.name}</span>
            <span aria-hidden>·</span>
            <span>{t(`requestType.${request.type}.label`)}</span>
            <span aria-hidden>·</span>
            <span>{t('detail.requestedBy', { name: requester?.name ?? '' })}</span>
            <span aria-hidden>·</span>
            <span>
              {t('detail.filedOn', { date: formatDate(request.createdAt.slice(0, 10), { weekday: false }) })}
            </span>
          </span>
        }
      />

      <Card className="mb-4">
        <Stepper status={request.status} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <StatusExplainer request={request} />

          {events.includes('provideInfo') ? <InfoAnswerCard request={request} /> : null}
          {events.includes('confirmResult') ? <VerificationCard request={request} /> : null}

          {request.infoRequest?.answer && !events.includes('provideInfo') ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.info.title')}</CardTitle>
              </CardHeader>
              <ul className="mb-3 flex list-disc flex-col gap-1 pl-5 text-[15px]">
                {request.infoRequest.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm">
                <span className="font-semibold">{t('detail.info.yourAnswer')}: </span>
                {request.infoRequest.answer}
              </p>
            </Card>
          ) : null}

          <RequestContent request={request} />

          {events.includes('cancel') ? (
            <div className="flex justify-center">
              <CancelRequest request={request} />
            </div>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <ReleaseCard request={request} />
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.timeline')}</CardTitle>
            </CardHeader>
            <Timeline entries={request.timeline} />
          </Card>
        </aside>
      </div>
    </>
  )
}
