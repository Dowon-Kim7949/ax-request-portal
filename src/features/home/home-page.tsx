import {
  Bot,
  ChartColumn,
  ChartPie,
  ChevronRight,
  CircleAlert,
  FolderGit2,
  Tags,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAiUsage, useRequests } from '@/api/queries'
import { refreshOf } from '@/api/refresh'
import { useCan, useCurrentUser, useDirectory } from '@/app/hooks'
import { usePageTitle } from '@/app/title'
import { ProjectIcon } from '@/components/request/project-icon'
import { RequestCard } from '@/components/request/request-card'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Meter } from '@/components/ui/controls'
import { EmptyState, ListSkeleton, Skeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { isTerminal, turnOf } from '@/domain/lifecycle'
import { formatKrw, formatMonth } from '@/lib/format'

function RequesterSection() {
  const { t } = useTranslation()
  const dir = useDirectory()
  const mine = useRequests({ scope: 'mine' })
  const open = mine.data?.filter((r) => !isTerminal(r.status)) ?? []
  const myTurn = open.filter((r) => turnOf(r.status) === 'requester')
  const projects = dir.projects.filter((p) => p.active)
  // Nothing loaded: say so. (A failed refresh keeps showing what was loaded before, and says that.)
  const failed = mine.isError && !mine.data
  const mineRefresh = refreshOf(mine)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <RefreshFailed
        failed={mineRefresh.failed || dir.projectsStale}
        retrying={mineRefresh.retrying || (dir.projectsStale && dir.retrying)}
        onRetry={() => {
          mineRefresh.onRetry()
          if (dir.projectsStale) dir.retry()
        }}
        className="lg:col-span-2"
      />
      <div className="flex flex-col gap-4">
        <Link
          to="/requests"
          className="flex items-center justify-between rounded-2xl bg-surface px-4 py-4 ring-1 ring-line hover:ring-field"
        >
          <span className="font-bold text-ink-900">
            {mine.isPending ? (
              <Skeleton className="h-5 w-32" />
            ) : failed ? (
              // A failed load is not "0 in progress": just link to the list.
              t('nav.myRequests')
            ) : (
              t('home.inProgress', { count: open.length })
            )}
          </span>
          <span className="flex items-center text-sm font-semibold text-accent">
            {t('home.view')}
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </Link>

        <section aria-labelledby="my-turn" className="flex flex-col gap-3">
          <h2 id="my-turn" className="font-bold text-ink-900">
            {t('home.myTurnTitle')}
          </h2>
          {mine.isPending ? (
            <ListSkeleton rows={2} />
          ) : failed ? (
            <LoadFailed
              compact
              error={mine.error}
              onRetry={() => void mine.refetch()}
              retrying={mine.isFetching}
            />
          ) : myTurn.length ? (
            myTurn.map((r) => <RequestCard key={r.id} request={r} myTurn />)
          ) : (
            <p className="rounded-2xl bg-surface px-4 py-5 text-sm text-ink-500 ring-1 ring-line">
              {t('home.myTurnEmpty')}
            </p>
          )}
        </section>
      </div>

      <Card aria-labelledby="pick-service">
        <CardHeader>
          <CardTitle id="pick-service">{t('home.pickService')}</CardTitle>
        </CardHeader>
        {dir.loading ? (
          <ListSkeleton rows={3} />
        ) : dir.projectsError ? (
          <LoadFailed compact error={dir.projectsError} onRetry={dir.retry} retrying={dir.retrying} />
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/requests/new?project=${encodeURIComponent(p.id)}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 ring-1 ring-line hover:bg-muted hover:ring-field"
                >
                  <ProjectIcon icon={p.icon} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold text-ink-900">{p.name}</span>
                    <span className="truncate text-[13px] text-ink-500">{p.description}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button asChild block size="lg" className="mt-4">
          <Link to="/requests/new">{t('home.newRequestCta')}</Link>
        </Button>
      </Card>
    </div>
  )
}

function DeveloperSection() {
  const { t } = useTranslation()
  const assigned = useRequests({ scope: 'assigned' })
  const queue = (assigned.data ?? []).filter((r) => turnOf(r.status) === 'developer')

  return (
    <section aria-labelledby="dev-queue" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="dev-queue" className="font-bold text-ink-900">
          {t('home.devTitle')} {assigned.data ? <span className="text-accent">{queue.length}</span> : null}
        </h2>
        <Link to="/work" className="text-sm font-semibold text-accent">
          {t('common.seeAll')}
        </Link>
      </div>
      <RefreshFailed {...refreshOf(assigned)} />
      {assigned.isPending ? (
        <ListSkeleton rows={3} />
      ) : assigned.isError && !assigned.data ? (
        <LoadFailed
          compact
          error={assigned.error}
          onRetry={() => void assigned.refetch()}
          retrying={assigned.isFetching}
        />
      ) : queue.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {queue.slice(0, 6).map((r) => (
            <RequestCard key={r.id} request={r} myTurn showRequester />
          ))}
        </div>
      ) : (
        <EmptyState title={t('home.devEmpty')} />
      )}
    </section>
  )
}

interface HomeLink {
  to: string
  label: string
  icon: typeof Users
}

function LinkGrid({ links }: { links: HomeLink[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="flex items-center gap-3 rounded-2xl bg-surface p-4 font-bold ring-1 ring-line hover:ring-field"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-muted text-ink-600">
            <l.icon className="size-5" aria-hidden />
          </span>
          {l.label}
        </Link>
      ))}
    </div>
  )
}

function AdminSection() {
  const { t } = useTranslation()
  const can = useCan()
  const links = [
    { to: '/admin/projects', label: t('nav.projects'), icon: FolderGit2, ok: can('project:manage') },
    { to: '/admin/users', label: t('nav.users'), icon: Users, ok: can('user:manage') },
  ].filter((l) => l.ok)
  return (
    <section aria-labelledby="admin-links" className="flex flex-col gap-3">
      <h2 id="admin-links" className="font-bold text-ink-900">
        {t('home.adminTitle')}
      </h2>
      <LinkGrid links={links} />
    </section>
  )
}

/** This month's AI spending against the monthly limit, linking to the usage dashboard. */
function AiSpendSummary() {
  const { t } = useTranslation()
  const usage = useAiUsage()
  const u = usage.data
  const pct = u && u.monthlyLimitKrw ? (u.totalKrw / u.monthlyLimitKrw) * 100 : 0
  return (
    <>
      <RefreshFailed {...refreshOf(usage)} />
      <Link
        to="/ops/usage"
        className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-4 ring-1 ring-line hover:ring-field"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink-500">
            {u ? t('home.opsSpend', { month: formatMonth(u.month) }) : t('nav.aiUsage')}
          </span>
          <span className="flex items-center text-sm font-semibold text-accent">
            {t('home.view')}
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </span>
        {u ? (
          <>
            <span className="text-[28px] leading-tight font-bold tracking-tight text-ink-900">
              {formatKrw(u.totalKrw)}
            </span>
            {u.monthlyLimitKrw ? (
              <>
                <span className="text-sm text-ink-500">
                  {t('budget.of', { limit: formatKrw(u.monthlyLimitKrw) })} · {Math.round(pct)}%
                </span>
                <Meter value={pct} warnAt={u.alertThresholdPct} label={t('nav.aiUsage')} />
              </>
            ) : null}
          </>
        ) : usage.isError ? (
          // No retry button inside the link: the usage screen offers one.
          <span className="flex items-center gap-2 text-sm text-ink-500">
            <CircleAlert className="size-4 shrink-0 text-danger-fg" aria-hidden />
            {t('loadError.title')}
          </span>
        ) : (
          <Skeleton className="h-16" />
        )}
      </Link>
    </>
  )
}

function OpsSection() {
  const { t } = useTranslation()
  const can = useCan()
  const links = [
    { to: '/ops/usage', label: t('nav.aiUsage'), icon: ChartPie, ok: can('usage:view') },
    { to: '/ops/agents', label: t('nav.aiAgents'), icon: Bot, ok: can('agent:manage') },
    { to: '/ops/pricing', label: t('nav.aiPricing'), icon: Tags, ok: can('agent:manage') },
    { to: '/ops/budget', label: t('nav.budget'), icon: Wallet, ok: can('budget:manage') },
  ].filter((l) => l.ok)
  return (
    <section aria-labelledby="ops-links" className="flex flex-col gap-3">
      <h2 id="ops-links" className="font-bold text-ink-900">
        {t('home.opsTitle')}
      </h2>
      {can('usage:view') ? <AiSpendSummary /> : null}
      <LinkGrid links={links} />
    </section>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  usePageTitle(t('nav.home'))
  const user = useCurrentUser()
  const can = useCan()
  const reviewer = can('request:review')
  const admin = can('project:manage') || can('user:manage')
  const ops = can('usage:view') || can('agent:manage') || can('budget:manage')

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-[15px] text-ink-500">{t('home.greeting', { name: user.name })}</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">
          {t('home.question')}
        </h1>
      </header>

      {can('dashboard:view') ? (
        <Link
          to="/dashboard"
          className="flex items-center gap-3 rounded-2xl bg-inverse px-4 py-4 text-on-inverse hover:opacity-90"
        >
          <ChartColumn className="size-5" aria-hidden />
          <span className="flex-1 font-bold">{t('home.dashboardCta')}</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}

      {reviewer ? <DeveloperSection /> : null}
      {can('request:create') && !reviewer ? <RequesterSection /> : null}
      {admin ? <AdminSection /> : null}
      {ops ? <OpsSection /> : null}
    </div>
  )
}
