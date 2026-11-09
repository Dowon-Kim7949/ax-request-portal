/**
 * The person's saved drafts: the account's, with the ones only this device
 * has, most recently written first. In full on the requests page (the
 * section DRAFTS_LIST_PATH leads to), the latest few on the home screen, and
 * a one-line pointer on a new, empty request.
 */
import { ChevronDown, ChevronRight, FileClock, Smartphone, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { errorText } from '@/api/error-text'
import { refreshOf } from '@/api/refresh'
import { useCan, useCurrentUser, useDirectory } from '@/app/hooks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateTimeText } from '@/components/ui/date-time'
import { Skeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { Sheet } from '@/components/ui/sheet'
import { appConfig } from '@/config/app.config'
import { DRAFTS_LIST_PATH, DRAFTS_SECTION_ID as SECTION_ID } from '@/features/wizard/draft-status'
import { STEPS } from '@/features/wizard/schema'
import { cn } from '@/lib/cn'
import { lastDraftCount, rememberDraftCount } from '@/stores/draft'
import { useDiscardDraft, useDraftRows } from './hooks'
import { continuePath, DRAFTS_SHOWN, type DraftRow } from './rows'

interface DraftsSectionProps {
  /** `page`: the requests page, every draft on request; `home`: the latest few and a link to the rest */
  variant: 'page' | 'home'
  className?: string
}

/**
 * The "saved drafts" section, for people who may file requests. Shown only
 * when there is a draft (or the account's could not be read, which is not
 * "none"); while the account's are read, only this device's show, or, when
 * there are none, room for as many as the list held last time.
 */
export function DraftsSection(props: DraftsSectionProps) {
  const can = useCan()
  return can('request:create') ? <Drafts {...props} /> : null
}

function Drafts({ variant, className }: DraftsSectionProps) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { rows, query, saved } = useDraftRows()
  const headingId = useId()
  const listId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [expanded, setExpanded] = useState(false)
  const failed = query.isError && !query.data
  // Read once: what the list held last time, for the room it takes while the account is read.
  const [expected] = useState(() => lastDraftCount(user.id))
  const holding = query.isPending && !rows.length && expected > 0
  useEffect(() => {
    if (query.data) rememberDraftCount(user.id, rows.length)
  }, [query.data, rows.length, user.id])
  const shown = rows.length > 0 || failed || holding
  const visible = variant === 'page' && expanded ? rows : rows.slice(0, DRAFTS_SHOWN)
  const more = variant === 'page' && rows.length > DRAFTS_SHOWN

  // Opened at #drafts: the section shows once the drafts are read, after the router's own scroll.
  const location = useLocation()
  const scrolledFor = useRef<string | null>(null)
  useLayoutEffect(() => {
    const section = sectionRef.current
    if (variant !== 'page' || !section || location.hash !== `#${SECTION_ID}`) return
    if (scrolledFor.current === location.key) return
    scrolledFor.current = location.key
    // Not in jsdom.
    if (typeof section.scrollIntoView === 'function') section.scrollIntoView({ block: 'start' })
  }, [variant, shown, location.hash, location.key])

  /* ---- deleting ---- */
  const [pending, setPending] = useState<{ row: DraftRow; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** The sheet closes after a delete: its row is gone, so focus goes to the section (or the page). */
  const deleted = useRef(false)
  const discard = useDiscardDraft()
  const remove = async () => {
    if (!pending || deleting) return
    setDeleting(true)
    try {
      await discard({ localId: pending.row.localId, draftId: pending.row.draftId })
      deleted.current = true
      setPending(null)
      toast.success(t('drafts.deleted'))
    } catch (error) {
      // This device's copy is gone by now; the account's stays listed, to try again.
      toast.error(errorText(error, t('drafts.deleteFailed')))
    } finally {
      setDeleting(false)
    }
  }

  const max = appConfig.drafts.maxPerAccount
  return (
    <>
      {shown ? (
        <section
          ref={sectionRef}
          id={variant === 'page' ? SECTION_ID : undefined}
          aria-labelledby={headingId}
          className={cn('flex scroll-mt-20 flex-col gap-3 md:scroll-mt-24', className)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <h2 ref={headingRef} id={headingId} tabIndex={-1} className="font-bold text-ink-900">
                {t('drafts.title')}
              </h2>
              {saved !== undefined ? (
                <p className="text-sm font-semibold text-ink-500">
                  <span aria-hidden>{t('drafts.count', { count: saved, max })}</span>
                  <span className="sr-only">{t('drafts.countLabel', { count: saved, max })}</span>
                </p>
              ) : null}
            </div>
            {variant === 'home' ? (
              <Link
                to={DRAFTS_LIST_PATH}
                className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-muted"
              >
                {t('drafts.seeAll')}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
          <RefreshFailed {...refreshOf(query)} />
          {failed ? (
            <LoadFailed
              compact
              error={query.error}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : null}
          {holding ? (
            <DraftsPlaceholder
              rows={Math.min(expected, DRAFTS_SHOWN)}
              more={variant === 'page' && expected > DRAFTS_SHOWN}
            />
          ) : null}
          {rows.length ? (
            <div className="overflow-hidden rounded-(--radius-card) bg-surface ring-1 ring-line">
              <ul id={listId} className="divide-y divide-line">
                {visible.map((row) => (
                  <DraftItem key={row.id} row={row} onDelete={(title) => setPending({ row, title })} />
                ))}
              </ul>
              {more ? (
                <Button
                  variant="ghost"
                  block
                  className="rounded-none border-t border-line text-sm text-accent"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  onClick={() => setExpanded((open) => !open)}
                >
                  {expanded ? t('drafts.showLess') : t('drafts.showAll', { count: rows.length })}
                  <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Outside the section: deleting the last draft removes the section, not the sheet closing. */}
      <Sheet
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPending(null)
        }}
        onCloseAutoFocus={(event) => {
          if (!deleted.current) return
          deleted.current = false
          event.preventDefault()
          ;(headingRef.current ?? document.getElementById('main'))?.focus()
        }}
        title={t('drafts.deleteConfirm.title')}
        description={
          pending ? (
            <>
              <span className="mb-1 block font-semibold text-ink-700">{pending.title}</span>
              {pending.row.draftId ? t('drafts.deleteConfirm.body') : t('drafts.deleteConfirm.bodyLocal')}
            </>
          ) : null
        }
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              disabled={deleting}
              onClick={() => setPending(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              loading={deleting}
              onClick={() => void remove()}
            >
              {t('drafts.deleteConfirm.confirm')}
            </Button>
          </>
        }
      />
    </>
  )
}

/** The list's room while the account's drafts are read: rows shaped like DraftItem's, and the "show all" bar. */
function DraftsPlaceholder({ rows, more }: { rows: number; more: boolean }) {
  return (
    <div
      className="overflow-hidden rounded-(--radius-card) bg-surface ring-1 ring-line"
      data-testid="drafts-placeholder"
      aria-hidden
    >
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
            <Skeleton className="h-11 w-full sm:w-36" />
          </div>
        ))}
      </div>
      {more ? <div className="h-11 border-t border-line" /> : null}
    </div>
  )
}

/** One draft: what it is and where it stands, then "continue" and "delete". */
function DraftItem({ row, onDelete }: { row: DraftRow; onDelete: (title: string) => void }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const title = row.title || t('drafts.untitled')
  const project = dir.project(row.projectId)
  const step = STEPS[row.step] ?? STEPS[0]
  // A checklist request's criteria step asks for the audit findings, and is named so on screen.
  const stepName =
    step.key === 'criteria' && row.type === 'checklist'
      ? t('wizard.checklist.name')
      : t(`wizard.${step.key}.name`)
  /** When it was last written; shown in one of two places, by screen width (the other is display:none). */
  const saved = (className: string) => (
    <DateTimeText
      iso={row.updatedAt}
      sentence={(time) => t('drafts.savedAt', { time })}
      className={className}
    />
  )
  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {row.state === 'local' ? (
          <Badge className="w-fit">
            <Smartphone aria-hidden />
            {t('drafts.localOnly')}
          </Badge>
        ) : row.state === 'conflict' ? (
          <Badge tone="warning" className="w-fit">
            <TriangleAlert aria-hidden />
            {t('drafts.conflict')}
          </Badge>
        ) : null}
        <p
          className={cn(
            'line-clamp-2 text-[15px] leading-snug font-bold',
            row.title ? 'text-ink-900' : 'text-ink-500',
          )}
        >
          {title}
        </p>
        <p className="flex flex-wrap gap-x-2 text-[13px] text-ink-500">
          <span>
            <span aria-hidden>{t('wizard.step', { current: row.step + 1, total: STEPS.length })}</span>
            <span className="sr-only">
              {t('drafts.stepLabel', { current: row.step + 1, total: STEPS.length })}
            </span>
          </span>
          <span aria-hidden>·</span>
          <span>{stepName}</span>
          {project ? (
            <>
              <span aria-hidden>·</span>
              <span>{project.name}</span>
            </>
          ) : null}
          <span aria-hidden className="hidden sm:inline">
            ·
          </span>
          {saved('hidden sm:inline')}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        {/* On a phone the time sits beside the actions, in the room they leave. */}
        {saved('min-w-0 text-[13px] text-ink-500 sm:hidden')}
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="secondary">
            <Link to={continuePath(row)}>
              {t('drafts.continue')}
              <span className="sr-only">: {title}</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 text-ink-500 not-disabled:hover:text-danger-fg"
            aria-label={t('drafts.delete', { title })}
            onClick={() => onDelete(title)}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  )
}

/**
 * On a new, empty request: how many drafts there are to continue, linking to
 * them; nothing when there are none. `exclude`: the draft open on screen.
 */
export function DraftsNotice({ exclude = [] }: { exclude?: ReadonlyArray<string | null | undefined> }) {
  const { t } = useTranslation()
  const { rows } = useDraftRows()
  const count = rows.filter((row) => !exclude.includes(row.id)).length
  if (!count) return null
  return (
    <Link
      to={DRAFTS_LIST_PATH}
      className="-ml-2 flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-600 hover:bg-muted"
    >
      <FileClock className="size-4 shrink-0 text-ink-500" aria-hidden />
      <span className="min-w-0">
        {t('drafts.notice', { count })} <span aria-hidden>·</span>{' '}
        <span className="font-semibold text-accent">{t('drafts.noticeAction')}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-accent" aria-hidden />
    </Link>
  )
}
