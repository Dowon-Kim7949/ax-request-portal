/** Panels for the responsible developer: report, decision, AI work, regression, release. */
import {
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileCode2,
  FlaskConical,
  GitPullRequestArrow,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useTransition, useUpdateRegression, useUpdateRelease } from '@/api/queries'
import { useHqCalendarNote } from '@/app/time-zone'
import { ModelName } from '@/components/ai/ai'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { DateTimeText } from '@/components/ui/date-time'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import type {
  Project,
  RegressionCheck,
  ReportVerdict,
  WikiTrust,
  WorkPhase,
  WorkRequest,
} from '@/domain/model'
import { cn } from '@/lib/cn'
import { formatKrw } from '@/lib/format'
import { hqToday } from '@/lib/time-zone'
import { uncheckedAssumptions } from '@/domain/lifecycle'
import { useAiRunLimit } from './ai-limit'
import { FeedbackBadge, PreviewImages } from './preview-panels'
import { AiRunLimitReason } from './ai-usage-card'

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

function reviewTerm(project: Project | undefined): 'MR' | 'PR' {
  return project?.repository.provider === 'github' ? 'PR' : 'MR'
}

const VERDICT_TONE: Record<ReportVerdict, BadgeTone> = {
  feasible: 'success',
  conditional: 'action',
  out_of_scope: 'neutral',
  undetermined: 'warning',
}
const TRUST_TONE: Record<WikiTrust, string> = {
  high: 'text-success-fg',
  medium: 'text-warning-fg',
  low: 'text-danger-fg',
}

function Tile({ title, children, tone }: { title: ReactNode; children: ReactNode; tone?: 'warn' }) {
  return (
    <div className={cn('rounded-2xl p-3.5', tone === 'warn' ? 'bg-ai-50' : 'bg-muted')}>
      <p className="mb-1.5 text-[13px] font-bold text-ink-600">{title}</p>
      <div className="text-[15px] text-ink-900">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

export function ReportPanel({
  request,
  onAsk,
}: {
  request: WorkRequest
  /** Opens the "ask the requester" sheet prefilled with the report's questions */
  onAsk?: (questions: string[]) => void
}) {
  const { t } = useTranslation()
  const [showEvidence, setShowEvidence] = useState(false)
  const report = request.report

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('report.title')}</CardTitle>
        </CardHeader>
        <p className="flex items-center gap-2 text-[15px] text-ai-700">
          <Bot className="size-5 animate-pulse" aria-hidden />
          {t('report.writing')}
        </p>
      </Card>
    )
  }

  const verified = report.evidence.wikiDocs.filter((d) => d.verified).length
  const total = report.evidence.wikiDocs.length

  return (
    <Card aria-labelledby="report-title">
      <CardHeader className="items-start">
        <div>
          <CardTitle id="report-title">{t('report.title')}</CardTitle>
          <p className="mt-0.5 text-xs text-ink-400">
            {t('report.revision', { n: report.revision })} ·{' '}
            <DateTimeText
              iso={report.generatedAt}
              variant="full"
              sentence={(time) => t('report.generatedAt', { time })}
            />
          </p>
          {report.generatedBy ? (
            <p className="mt-1 flex text-xs text-ink-600">
              <ModelName selection={report.generatedBy} />
            </p>
          ) : null}
        </div>
      </CardHeader>

      <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
        <Badge tone={VERDICT_TONE[report.verdict]} className="w-fit text-[13px]">
          {t(`verdict.${report.verdict}`)}
        </Badge>
        <p className="text-[15px] text-ink-900">{report.summary}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tile title={t('report.impact')}>
          <p>{report.impact.changedScreens.join(', ') || '-'}</p>
          {report.impact.recheck.length ? (
            <p className="mt-1 text-sm text-ink-500">
              {t('report.recheck')}: {report.impact.recheck.join(', ')}
            </p>
          ) : null}
        </Tile>
        <Tile title={t('report.plan')}>
          {report.plan.length ? (
            <ol className="flex list-decimal flex-col gap-0.5 pl-4">
              {report.plan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            '-'
          )}
        </Tile>
        <Tile title={`${t('report.trust')} · ${t(`report.trustLevel.${report.wikiTrust}`)}`}>
          <p className={cn('flex items-center gap-1.5 text-sm font-semibold', TRUST_TONE[report.wikiTrust])}>
            {report.wikiTrust === 'low' ? (
              <ShieldAlert className="size-4" aria-hidden />
            ) : (
              <ShieldCheck className="size-4" aria-hidden />
            )}
            {total ? t('report.trustDetail', { total, verified }) : t('report.trustNone')}
          </p>
        </Tile>
        <Tile
          title={`${t('report.size', { size: report.size })} · ${t('report.risks', { count: report.risks.length })}`}
        >
          {report.risks.length ? (
            <ul className="flex flex-col gap-0.5 text-sm">
              {report.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">{t('report.noRisk')}</p>
          )}
        </Tile>
      </div>

      {report.openQuestions.length ? (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-ai-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex-1 text-[15px]">
            <span className="font-bold text-ai-700">{t('report.openQuestions')}</span>
            <ul className="mt-1 flex flex-col gap-0.5 text-ink-900">
              {report.openQuestions.map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          </div>
          {onAsk ? (
            <Button variant="ghost" className="w-fit text-ai-700" onClick={() => onAsk(report.openQuestions)}>
              {t('report.askRequester')} ›
            </Button>
          ) : null}
        </div>
      ) : null}

      {report.assumptions.length ? (
        <section aria-labelledby="report-assumptions" className="mt-3 rounded-2xl bg-warning-50 px-4 py-3">
          <h3
            id="report-assumptions"
            className="flex items-center gap-1.5 text-[15px] font-bold text-warning-fg"
          >
            <CircleHelp className="size-4" aria-hidden />
            {t('report.assumptions')}
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-700">{t('report.assumptionsHint')}</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-[15px] text-ink-700">
            {report.assumptions.map((a) => (
              <li key={a.id}>· {a.text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.constraintChecks.length ? (
        <section aria-labelledby="report-constraints" className="mt-3">
          <h3 id="report-constraints" className="mb-1.5 text-[13px] font-bold text-ink-600">
            {t('report.constraints')}
          </h3>
          <ul className="flex flex-col gap-2">
            {report.constraintChecks.map((k) => (
              <li
                key={k.constraintId}
                className={cn(
                  'flex flex-col gap-1 rounded-2xl px-3.5 py-2.5 sm:flex-row sm:items-start sm:gap-3',
                  k.conflict ? 'bg-danger-50' : 'ring-1 ring-line',
                )}
              >
                <Badge tone={k.conflict ? 'danger' : 'success'} className="w-fit shrink-0">
                  {k.conflict ? t('report.constraintConflict') : t('report.constraintKept')}
                </Badge>
                <div className="min-w-0 flex-1 text-sm">
                  <p className={k.conflict ? 'font-semibold text-ink-700' : 'font-semibold text-ink-900'}>
                    {k.text}
                    {k.reference ? (
                      <span className={cn('font-normal', k.conflict ? 'text-ink-700' : 'text-ink-500')}>
                        {' '}
                        · {k.reference}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-ink-700">{k.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setShowEvidence((v) => !v)}
        aria-expanded={showEvidence}
        className="mt-3 flex h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold text-ink-600 hover:text-ink-900"
      >
        {t('report.evidence')} · {t('report.verification')}
        <ChevronDown
          className={cn('size-4 transition-transform', showEvidence && 'rotate-180')}
          aria-hidden
        />
      </button>
      {showEvidence ? (
        <div className="flex flex-col gap-4 border-t border-line pt-3 text-sm">
          <div>
            <p className="mb-1.5 font-semibold text-ink-600">{t('report.wikiDocs')}</p>
            <ul className="flex flex-col gap-1">
              {report.evidence.wikiDocs.map((d) => (
                <li key={d.path} className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[13px] break-all text-ink-700">{d.path}</code>
                  {d.verified ? null : <Badge tone="warning">{t('report.unverified')}</Badge>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-ink-600">{t('report.codeFiles')}</p>
            <ul className="flex flex-col gap-1">
              {report.evidence.codeFiles.map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <FileCode2 className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                  <code className="font-mono text-[13px] break-all text-ink-700">{f}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-ink-600">{t('report.verification')}</p>
            <ul className="flex flex-col gap-1.5">
              {report.verification.map((v) => {
                const criterion = request.acceptanceCriteria.find((c) => c.id === v.criterionId)
                return (
                  <li key={v.criterionId} className="flex flex-col gap-0.5">
                    <span className="text-ink-900">{criterion?.text}</span>
                    <span className="text-ink-500">
                      {v.automatable ? t('report.automatable') : t('report.manual')} · {v.method}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-ink-400">{t('report.advisory')}</p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Decision: run work / ask / reject                                   */
/* ------------------------------------------------------------------ */

type DecisionSheet = 'run' | 'ask' | 'reject' | null

export function DecisionCard({
  request,
  canAsk,
  canReject,
  askPrefill,
  sheet,
  setSheet,
}: {
  request: WorkRequest
  canAsk: boolean
  canReject: boolean
  askPrefill: string[]
  sheet: DecisionSheet
  setSheet: (s: DecisionSheet) => void
}) {
  const { t } = useTranslation()
  const transition = useTransition(request.id)
  const limit = useAiRunLimit(request)
  const limitId = useId()
  const rerun = request.status === 'changes_requested'
  const failed = request.verification.filter((c) => c.result === 'failed')
  const [memo, setMemo] = useState(() =>
    rerun
      ? failed
          .map((c) => {
            const text = request.acceptanceCriteria.find((a) => a.id === c.criterionId)?.text
            return `- ${text}${c.note ? `: ${c.note}` : ''}`
          })
          .join('\n')
      : '',
  )
  // null until edited: the sheet then shows the report's open questions (or one empty row).
  const [edited, setQuestions] = useState<string[] | null>(null)
  const questions = edited ?? (askPrefill.length ? askPrefill : [''])
  const [reason, setReason] = useState('')
  // Assumptions are confirmed once, before the first run.
  const assumptions = request.status === 'review' ? (request.report?.assumptions ?? []) : []
  const [checked, setChecked] = useState<string[]>([])
  const left = uncheckedAssumptions(request, checked).length
  const leftId = useId()
  const toggle = (id: string) =>
    setChecked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const openAsk = () => setSheet('ask')

  const done = (message: string) => () => {
    setSheet(null)
    toast.success(message)
  }
  const fail = (e: unknown) => toast.error(errorText(e, t('errors.generic')))

  return (
    <Card className="ring-2 ring-brand-500/40">
      <CardHeader>
        <CardTitle>{t('decide.title')}</CardTitle>
      </CardHeader>

      {rerun && failed.length ? (
        <div className="mb-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm">
          <p className="mb-1 font-bold text-danger-fg">{t('decide.failedChecks')}</p>
          <ul className="flex flex-col gap-1 text-ink-700">
            {failed.map((c) => (
              <li key={c.criterionId}>
                · {request.acceptanceCriteria.find((a) => a.id === c.criterionId)?.text}
                {c.note ? <span className="text-ink-500"> — {c.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          block
          disabled={limit.reached}
          aria-describedby={limit.reached ? limitId : undefined}
          onClick={() => setSheet('run')}
        >
          {rerun ? t('decide.rerun') : t('decide.run')}
        </Button>
        {limit.reached ? <AiRunLimitReason id={limitId} reason={limit.reason} /> : null}
        {canAsk || canReject ? (
          <div className="grid grid-cols-2 gap-2">
            {canAsk ? (
              <Button variant="secondary" size="lg" onClick={openAsk}>
                {t('decide.askInfo')}
              </Button>
            ) : null}
            {canReject ? (
              <Button variant="secondary" size="lg" onClick={() => setSheet('reject')}>
                {t('decide.reject')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Run work */}
      <Sheet
        open={sheet === 'run'}
        onOpenChange={(o) => setSheet(o ? 'run' : null)}
        title={t('decide.runTitle')}
        description={t('decide.runBody')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setSheet(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              loading={transition.isPending}
              disabled={left > 0}
              aria-describedby={left > 0 ? leftId : undefined}
              onClick={() =>
                transition.mutate(
                  {
                    event: 'runWork',
                    ...(memo.trim() ? { instructions: memo.trim() } : {}),
                    ...(assumptions.length ? { checkedAssumptions: checked } : {}),
                  },
                  { onSuccess: done(t('decide.started')), onError: fail },
                )
              }
            >
              {rerun ? t('decide.rerun') : t('decide.run')}
            </Button>
          </>
        }
      >
        {assumptions.length ? (
          <fieldset className="mb-4 flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ink-700">
              {t('decide.checkAssumptions')}
            </legend>
            <p className="-mt-0.5 text-[13px] text-ink-500">{t('decide.checkAssumptionsHint')}</p>
            {assumptions.map((a) => (
              <label
                key={a.id}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-[15px] ring-1 ring-line has-checked:bg-muted"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-brand-600"
                  checked={checked.includes(a.id)}
                  onChange={() => toggle(a.id)}
                />
                <span>{a.text}</span>
              </label>
            ))}
            {left > 0 ? (
              <p id={leftId} className="text-[13px] font-medium text-warning-fg" aria-live="polite">
                {t('decide.assumptionsLeft', { count: left })}
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <Field label={t('decide.memo')} optional optionalLabel={t('common.optional')}>
          {(p) => (
            <Textarea
              {...p}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={t('decide.memoPlaceholder')}
            />
          )}
        </Field>
      </Sheet>

      {/* Ask the requester */}
      <Sheet
        open={sheet === 'ask'}
        onOpenChange={(o) => (o ? openAsk() : setSheet(null))}
        title={t('decide.askTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setSheet(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              loading={transition.isPending}
              disabled={!questions.some((q) => q.trim())}
              onClick={() =>
                transition.mutate(
                  { event: 'requestInfo', questions: questions.map((q) => q.trim()).filter(Boolean) },
                  { onSuccess: done(t('decide.asked')), onError: fail },
                )
              }
            >
              {t('common.submit')}
            </Button>
          </>
        }
      >
        <ol className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                aria-label={t('decide.question', { n: i + 1 })}
                value={q}
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {questions.length > 1 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('decide.question', { n: i + 1 })} ${t('common.cancel')}`}
                  onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
        {questions.length < 5 ? (
          <Button variant="secondary" className="mt-3" onClick={() => setQuestions([...questions, ''])}>
            <Plus aria-hidden />
            {t('decide.addQuestion')}
          </Button>
        ) : null}
      </Sheet>

      {/* Reject */}
      <Sheet
        open={sheet === 'reject'}
        onOpenChange={(o) => setSheet(o ? 'reject' : null)}
        title={t('decide.rejectTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setSheet(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              loading={transition.isPending}
              disabled={!reason.trim()}
              onClick={() =>
                transition.mutate(
                  { event: 'reject', reason: reason.trim() },
                  { onSuccess: done(t('decide.rejected')), onError: fail },
                )
              }
            >
              {t('decide.reject')}
            </Button>
          </>
        }
      >
        <Field label={t('decide.rejectReason')}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </Sheet>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* AI work run + code review                                           */
/* ------------------------------------------------------------------ */

const PHASES: WorkPhase[] = ['queued', 'editing', 'testing', 'opening_mr', 'finished']

export function WorkPanel({
  request,
  project,
  canReview,
}: {
  request: WorkRequest
  project: Project | undefined
  canReview: boolean
}) {
  const { t } = useTranslation()
  const transition = useTransition(request.id)
  const limit = useAiRunLimit(request)
  const limitId = useId()
  const [reviseOpen, setReviseOpen] = useState(false)
  const [approveAnyway, setApproveAnyway] = useState(false)
  const [note, setNote] = useState('')
  const work = request.work
  if (!work) return null
  const feedback = work.previewFeedback
  const changeAsked = feedback?.verdict === 'needs_change'

  const approve = () =>
    transition.mutate(
      { event: 'approveMerge' },
      {
        onSuccess: () => {
          setApproveAnyway(false)
          toast.success(t('workRun.approved'))
        },
        onError: (e) => toast.error(errorText(e, t('errors.generic'))),
      },
    )
  const openRevise = () => {
    // Start from what the requester asked for in the preview.
    if (!note && changeAsked && feedback.note) setNote(t('workRun.fromRequester', { note: feedback.note }))
    setApproveAnyway(false)
    setReviseOpen(true)
  }

  const term = reviewTerm(project)
  const live = request.status === 'in_progress'
  const phaseIndex = PHASES.indexOf(work.phase)
  const fail = (e: unknown) => toast.error(errorText(e, t('errors.generic')))

  return (
    <Card aria-labelledby="work-title">
      <CardHeader className="items-start">
        <div>
          <CardTitle id="work-title">{t('workRun.title')}</CardTitle>
          <p className="mt-0.5 text-xs text-ink-400">
            {t('workRun.attempt', { n: work.attempt })}
            {work.costKrw ? ` · ${t('workRun.cost', { cost: formatKrw(work.costKrw) })}` : ''}
          </p>
          {work.agent ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-600">
              <span className="font-semibold">{t(`ai.runtime.${work.agent.runtime}`)}</span>
              <span aria-hidden>·</span>
              <ModelName selection={work.agent} />
            </p>
          ) : null}
        </div>
        {work.outcome ? (
          <Badge tone={work.outcome === 'success' ? 'success' : 'danger'}>
            {t(`workRun.outcome.${work.outcome}`)}
          </Badge>
        ) : null}
      </CardHeader>

      {/* phase track */}
      <ol className="mb-4 flex flex-wrap gap-x-4 gap-y-2" aria-label={t('workRun.title')}>
        {PHASES.map((p, i) => {
          const done = i < phaseIndex || work.phase === 'finished'
          const current = i === phaseIndex && live
          return (
            <li
              key={p}
              className={cn(
                'flex items-center gap-1.5 text-sm',
                done ? 'text-ink-700' : current ? 'font-bold text-ai-700' : 'text-ink-400',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {done ? (
                <Check className="size-4 text-accent" aria-hidden />
              ) : current ? (
                <Bot className="size-4 animate-pulse" aria-hidden />
              ) : (
                <span className="size-4 rounded-full ring-1 ring-field" aria-hidden />
              )}
              {t(`phase.${p}`, { term })}
            </li>
          )
        })}
      </ol>

      {work.instructions ? (
        <p className="mb-3 rounded-xl bg-muted px-3.5 py-2.5 text-sm whitespace-pre-line">
          <span className="font-semibold text-ink-600">{t('workRun.instructions')}: </span>
          {work.instructions}
        </p>
      ) : null}
      {work.checkedAssumptions?.length ? (
        <div className="mb-3 rounded-xl bg-muted px-3.5 py-2.5 text-sm">
          <p className="font-semibold text-ink-600">{t('workRun.checkedAssumptions')}</p>
          <ul className="mt-0.5 flex flex-col gap-0.5 text-ink-700">
            {work.checkedAssumptions.map((id) => (
              <li key={id} className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                {request.report?.assumptions.find((a) => a.id === id)?.text ?? id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {live ? (
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ai-700" aria-live="polite">
          <Bot className="size-5 animate-pulse" aria-hidden />
          {t('workRun.live')} · {t(`phase.${work.phase}`, { term })}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {work.tests ? (
              <Tile title={t('workRun.tests')}>
                <p className="flex items-center gap-1.5">
                  <FlaskConical className="size-4 text-ink-400" aria-hidden />
                  {t('workRun.existing', {
                    passed: work.tests.existingPassed,
                    total: work.tests.existingTotal,
                  })}
                </p>
                <p className="mt-0.5 pl-5.5 text-sm text-ink-600">
                  {t('workRun.criteria', {
                    passed: work.tests.criteriaPassed,
                    total: work.tests.criteriaTotal,
                  })}
                </p>
              </Tile>
            ) : null}
            {work.mergeRequest ? (
              <Tile title={t('workRun.changes')}>
                <p className="flex items-center gap-1.5">
                  <GitPullRequestArrow className="size-4 text-ink-400" aria-hidden />
                  {t('workRun.mr', { term, n: work.mergeRequest.number })} ·{' '}
                  {t('workRun.files', { n: work.mergeRequest.filesChanged })}
                  <span className="text-success-fg">+{work.mergeRequest.additions}</span>
                  <span className="text-danger-fg">−{work.mergeRequest.deletions}</span>
                </p>
                {work.wikiChanges?.docs.length ? (
                  <p className="mt-0.5 pl-5.5 text-sm text-ink-600">
                    {t('workRun.wiki', { n: work.wikiChanges.docs.length })}
                  </p>
                ) : null}
              </Tile>
            ) : null}
          </div>
          {work.summary ? (
            <div className="mt-3 rounded-2xl p-3.5 ring-1 ring-line">
              <p className="mb-1 text-[13px] font-bold text-ink-600">{t('workRun.summary')}</p>
              <p className="text-[15px]">{work.summary}</p>
            </div>
          ) : null}
          {work.wikiChanges?.pendingReview ? (
            <p className="mt-2 text-xs text-ink-400">{t('workRun.wikiNote')}</p>
          ) : null}
          {work.preview ? (
            <div className="mt-3 rounded-2xl p-3.5 ring-1 ring-line">
              <p className="mb-2 text-[13px] font-bold text-ink-600">{t('workRun.preview')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <PreviewImages preview={work.preview} compact />
                <div className="flex min-w-0 flex-col gap-2 text-sm">
                  {work.preview.url ? (
                    <a
                      href={work.preview.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent hover:underline"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      {t('workRun.openPreview')}
                    </a>
                  ) : null}
                  <div aria-live="polite">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-700">
                      {t('workRun.requesterFeedback')}
                      {feedback ? <FeedbackBadge feedback={feedback} /> : null}
                    </p>
                    <p className="mt-0.5 text-ink-600">
                      {feedback ? (feedback.note ?? '') : t('workRun.feedbackWaiting')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {canReview && request.status === 'code_review' ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            size="lg"
            className="sm:flex-1"
            loading={transition.isPending && transition.variables?.event === 'approveMerge'}
            onClick={() => (changeAsked ? setApproveAnyway(true) : approve())}
          >
            {t('workRun.approve')}
          </Button>
          {work.mergeRequest ? (
            <Button asChild variant="secondary" size="lg" className="sm:flex-1">
              <a href={work.mergeRequest.url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                {t('workRun.openMr', { term })}
              </a>
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="lg"
            className="sm:flex-1"
            disabled={limit.reached}
            aria-describedby={limit.reached ? limitId : undefined}
            onClick={openRevise}
          >
            {t('workRun.revise')}
          </Button>
        </div>
      ) : null}

      <Sheet
        open={approveAnyway}
        onOpenChange={setApproveAnyway}
        title={t('workRun.approveAnywayTitle')}
        description={t('workRun.approveAnywayBody')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={openRevise}>
              {t('workRun.revise')}
            </Button>
            <Button size="lg" className="flex-1" loading={transition.isPending} onClick={approve}>
              {t('workRun.approveAnyway')}
            </Button>
          </>
        }
      >
        {feedback?.note ? (
          <p className="rounded-xl bg-warning-50 px-3.5 py-2.5 text-[15px] text-ink-700">{feedback.note}</p>
        ) : null}
      </Sheet>
      {canReview && request.status === 'code_review' && limit.reached ? (
        <div className="mt-2">
          <AiRunLimitReason id={limitId} reason={limit.reason} />
        </div>
      ) : null}

      <Sheet
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        title={t('workRun.reviseTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setReviseOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={!note.trim()}
              loading={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { event: 'requestRevision', note: note.trim() },
                  {
                    onSuccess: () => {
                      setReviseOpen(false)
                      setNote('')
                      toast.success(t('workRun.revised'))
                    },
                    onError: fail,
                  },
                )
              }
            >
              {t('workRun.revise')}
            </Button>
          </>
        }
      >
        <Field label={t('workRun.reviseNote')}>
          {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </Sheet>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Regression checks (also used on the regression page)                */
/* ------------------------------------------------------------------ */

export function RegressionChecks({
  requestId,
  checks,
  editable,
}: {
  requestId: number
  checks: RegressionCheck[]
  editable: boolean
}) {
  const { t } = useTranslation()
  const update = useUpdateRegression(requestId)
  const set = (id: string, result: RegressionCheck['result']) =>
    update.mutate(
      { checks: [{ id, result }] },
      { onError: (e) => toast.error(errorText(e, t('errors.generic'))) },
    )
  const done = checks.filter((c) => c.result !== 'pending').length

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-ink-500">
        {t('regression.progress', { done, total: checks.length })}
      </p>
      <ul className="flex flex-col gap-2">
        {checks.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-3 ring-1 ring-line sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{c.label}</p>
              <p className="truncate font-mono text-xs text-ink-400">
                {t('regression.source', { source: c.source })}
              </p>
            </div>
            {editable ? (
              <div className="grid grid-cols-2 gap-2 sm:w-52" role="group" aria-label={c.label}>
                {(['passed', 'failed'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={c.result === r}
                    disabled={update.isPending}
                    onClick={() => set(c.id, c.result === r ? 'pending' : r)}
                    className={cn(
                      'flex h-11 items-center justify-center gap-1 rounded-xl text-sm font-bold ring-1 ring-inset',
                      c.result === r
                        ? r === 'passed'
                          ? 'bg-success-600 text-white ring-success-600'
                          : 'bg-danger-600 text-white ring-danger-600'
                        : 'bg-surface text-ink-600 ring-field',
                    )}
                  >
                    {r === 'passed' ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <X className="size-4" aria-hidden />
                    )}
                    {t(r === 'passed' ? 'regression.pass' : 'regression.fail')}
                  </button>
                ))}
              </div>
            ) : (
              <Badge tone={c.result === 'passed' ? 'success' : c.result === 'failed' ? 'danger' : 'neutral'}>
                {t(
                  c.result === 'passed'
                    ? 'regression.pass'
                    : c.result === 'failed'
                      ? 'regression.fail'
                      : 'regression.pending',
                )}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Release                                                             */
/* ------------------------------------------------------------------ */

export function ReleasePanel({ request, canRelease }: { request: WorkRequest; canRelease: boolean }) {
  const { t } = useTranslation()
  const update = useUpdateRelease(request.id)
  const transition = useTransition(request.id)
  const [date, setDate] = useState(request.release?.scheduledDate ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fail = (e: unknown) => toast.error(errorText(e, t('errors.generic')))
  // Release dates are head-office calendar days; the API refuses one before its today.
  const hqDateNote = useHqCalendarNote('today')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('release.title')}</CardTitle>
      </CardHeader>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!date) return
          update.mutate(
            { scheduledDate: date },
            { onSuccess: () => toast.success(t('release.saved')), onError: fail },
          )
        }}
      >
        <Field label={t('release.date')} hint={hqDateNote}>
          {(p) => (
            <Input
              type="date"
              min={hqToday()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="secondary"
          block
          loading={update.isPending}
          disabled={!date || date === request.release?.scheduledDate}
        >
          {t('release.save')}
        </Button>
      </form>
      {canRelease ? (
        <Button size="lg" block className="mt-2" onClick={() => setConfirmOpen(true)}>
          {t('release.markReleased')}
        </Button>
      ) : null}
      <Sheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('release.releasedTitle')}
        description={t('release.releasedBody')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              loading={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { event: 'markReleased' },
                  {
                    onSuccess: () => {
                      setConfirmOpen(false)
                      toast.success(t('release.released'))
                    },
                    onError: fail,
                  },
                )
              }
            >
              {t('release.markReleased')}
            </Button>
          </>
        }
      />
    </Card>
  )
}
