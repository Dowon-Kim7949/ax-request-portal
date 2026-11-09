/**
 * Where the open draft stands, shown small under the wizard's progress bar,
 * and the notices that need the person: a conflict, a full account.
 */
import { CloudCheck, CloudOff, CloudUpload, Smartphone, Trash2, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import type { DraftSaveState } from '@/features/drafts/hooks'
import { cn } from '@/lib/cn'

/** The saved drafts on the person's requests page (src/features/requests). */
export const DRAFTS_LIST_PATH = '/requests#drafts'

const ICONS = {
  saving: CloudUpload,
  saved: CloudCheck,
  local: CloudOff,
  limited: Smartphone,
  conflict: TriangleAlert,
} as const

/**
 * One line: the save state on the left, "delete draft" on the right once
 * there is something to delete. Screen readers are not told about every save,
 * only when the draft stops reaching the account (no connection, a full
 * account, a conflict).
 */
export function DraftStatusBar({
  state,
  onDiscard,
}: {
  state: DraftSaveState | null
  /** Shown when there is a draft to delete */
  onDiscard?: () => void
}) {
  const { t } = useTranslation()
  // Read out on the way into these states only; every other state empties the region.
  const announcement =
    state === 'local' || state === 'limited' || state === 'conflict' ? t(`wizard.save.${state}`) : ''
  const Icon = state ? ICONS[state] : null
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 pt-1">
      <p
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-xs',
          state === 'conflict' ? 'font-semibold text-warning-fg' : 'text-ink-500',
        )}
      >
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        {state ? <span>{t(`wizard.save.${state}`)}</span> : null}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {onDiscard ? (
        <Button variant="ghost" className="-mr-3 shrink-0 text-sm text-ink-500" onClick={onDiscard}>
          <Trash2 aria-hidden />
          {t('wizard.discardDraft.button')}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * The draft was saved elsewhere (another device or tab) since this screen's
 * version. Nothing is lost while the person decides: what is on screen stays,
 * and nothing is sent until they choose.
 */
export function ConflictNotice({
  busy,
  onKeepMine,
  onLoadSaved,
}: {
  busy: 'keep' | 'load' | null
  onKeepMine: () => void
  onLoadSaved: () => void
}) {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby="draft-conflict-title"
      className="mt-2 flex flex-col gap-3 rounded-2xl bg-warning-50 p-4 text-warning-fg"
    >
      <div className="flex gap-2.5">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          {/* Not a heading: it sits above the step's own h1. */}
          <p id="draft-conflict-title" className="font-bold">
            {t('wizard.conflict.title')}
          </p>
          <p className="text-sm">{t('wizard.conflict.body')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="sm:flex-1" loading={busy === 'keep'} disabled={busy !== null} onClick={onKeepMine}>
          {t('wizard.conflict.keepMine')}
        </Button>
        <Button
          variant="outline"
          className="sm:flex-1"
          loading={busy === 'load'}
          disabled={busy !== null}
          onClick={onLoadSaved}
        >
          {t('wizard.conflict.loadSaved')}
        </Button>
      </div>
    </section>
  )
}

/** The account holds as many drafts as allowed: this one stays on this device until a slot frees up. */
export function LimitNotice() {
  const { t } = useTranslation()
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-muted px-4 py-3 ring-1 ring-line">
      <Smartphone className="size-5 shrink-0 text-ink-500" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-ink-700">
        {t('wizard.limit.body', { max: appConfig.drafts.maxPerAccount })}
      </p>
      <Button asChild variant="secondary">
        <Link to={DRAFTS_LIST_PATH}>{t('wizard.limit.drafts')}</Link>
      </Button>
    </div>
  )
}
