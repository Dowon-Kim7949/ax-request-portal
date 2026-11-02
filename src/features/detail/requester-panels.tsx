/** Panels a requester acts on: answer questions, check the result, withdraw. */
import { Bot, Check, CircleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useSaveVerification, useTransition } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Textarea } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { requesterStatusOf, turnOf } from '@/domain/lifecycle'
import type { CriterionCheck, WorkRequest } from '@/domain/model'
import { cn } from '@/lib/cn'

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

/** What is happening now, in one plain sentence, with a live indicator while the AI works. */
export function StatusExplainer({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const plain = requesterStatusOf(request.status)
  const aiNow = turnOf(request.status) === 'ai'
  const text = plain === 'reviewing' && aiNow ? t('explain.reviewing_ai') : t(`explain.${plain}`)
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl px-4 py-3.5',
        aiNow
          ? 'bg-ai-50 text-ai-700'
          : request.status === 'rejected'
            ? 'bg-danger-50 text-danger-600'
            : 'bg-brand-50 text-brand-700',
      )}
      aria-live="polite"
    >
      {aiNow ? (
        <Bot className="mt-0.5 size-5 shrink-0 animate-pulse" aria-hidden />
      ) : (
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      )}
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold">{text}</p>
        {request.status === 'rejected' && request.rejectionReason ? (
          <p className="text-sm text-ink-700">
            <span className="font-semibold">{t('detail.rejectionReason')}: </span>
            {request.rejectionReason}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function InfoAnswerCard({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState('')
  const transition = useTransition(request.id)
  const questions = request.infoRequest?.questions ?? []

  return (
    <Card className="ring-2 ring-warning-600/40">
      <CardHeader>
        <CardTitle>{t('detail.info.title')}</CardTitle>
      </CardHeader>
      <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-5 text-[15px]">
        {questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!answer.trim()) return
          transition.mutate(
            { event: 'provideInfo', answer: answer.trim() },
            {
              onSuccess: () => toast.success(t('detail.info.sent')),
              onError: (err) => toast.error(errorText(err, t('errors.generic'))),
            },
          )
        }}
      >
        <Field label={t('detail.info.answer')}>
          {(p) => (
            <Textarea
              {...p}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t('detail.info.answerPlaceholder')}
            />
          )}
        </Field>
        <Button type="submit" size="lg" block loading={transition.isPending} disabled={!answer.trim()}>
          {t('detail.info.submit')}
        </Button>
      </form>
    </Card>
  )
}

type Result = CriterionCheck['result']

/** QA checklist: one row per acceptance criterion. Progress is saved as you go. */
export function VerificationCard({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const save = useSaveVerification(request.id)
  const transition = useTransition(request.id)
  const [checks, setChecks] = useState<CriterionCheck[]>(() =>
    request.acceptanceCriteria.map(
      (c) =>
        request.verification.find((v) => v.criterionId === c.id) ?? { criterionId: c.id, result: 'pending' },
    ),
  )
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueNote, setIssueNote] = useState('')

  const persist = (next: CriterionCheck[]) => {
    setChecks(next)
    save.mutate({ checks: next }, { onError: (e) => toast.error(errorText(e, t('errors.generic'))) })
  }
  const setResult = (id: string, result: Result) =>
    persist(
      checks.map((c) =>
        c.criterionId === id ? { ...c, result, ...(result === 'passed' ? { note: undefined } : {}) } : c,
      ),
    )
  const setNote = (id: string, note: string) =>
    setChecks(checks.map((c) => (c.criterionId === id ? { ...c, note } : c)))

  const done = checks.filter((c) => c.result !== 'pending').length
  const allPassed = checks.every((c) => c.result === 'passed')
  const anyFailed = checks.some((c) => c.result === 'failed')

  return (
    <Card className="ring-2 ring-brand-500/40">
      <CardHeader className="items-start">
        <div>
          <CardTitle>{t('detail.verify.title')}</CardTitle>
          <p className="mt-1 text-sm text-ink-500">{t('detail.verify.hint')}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-ink-600">
          {t('detail.verify.progress', { done, total: checks.length })}
        </span>
      </CardHeader>

      <ol className="flex flex-col gap-3">
        {request.acceptanceCriteria.map((criterion, i) => {
          const check = checks.find((c) => c.criterionId === criterion.id)!
          return (
            <li key={criterion.id} className="rounded-2xl bg-muted/60 p-3.5 ring-1 ring-line">
              <p className="mb-3 flex gap-2 text-[15px] font-medium">
                <span className="text-ink-400">{i + 1}.</span>
                {criterion.text}
              </p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={criterion.text}>
                <button
                  type="button"
                  aria-pressed={check.result === 'passed'}
                  onClick={() => setResult(criterion.id, check.result === 'passed' ? 'pending' : 'passed')}
                  className={cn(
                    'flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-bold ring-1 transition ring-inset',
                    check.result === 'passed'
                      ? 'bg-success-600 text-white ring-success-600'
                      : 'bg-surface text-ink-600 ring-line-strong hover:bg-success-50',
                  )}
                >
                  <Check className="size-4.5" aria-hidden />
                  {t('detail.verify.pass')}
                </button>
                <button
                  type="button"
                  aria-pressed={check.result === 'failed'}
                  onClick={() => setResult(criterion.id, check.result === 'failed' ? 'pending' : 'failed')}
                  className={cn(
                    'flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-bold ring-1 transition ring-inset',
                    check.result === 'failed'
                      ? 'bg-danger-600 text-white ring-danger-600'
                      : 'bg-surface text-ink-600 ring-line-strong hover:bg-danger-50',
                  )}
                >
                  <X className="size-4.5" aria-hidden />
                  {t('detail.verify.fail')}
                </button>
              </div>
              {check.result === 'failed' ? (
                <Textarea
                  className="mt-2 min-h-20"
                  aria-label={t('detail.verify.failNote')}
                  placeholder={t('detail.verify.failNote')}
                  value={check.note ?? ''}
                  onChange={(e) => setNote(criterion.id, e.target.value)}
                  onBlur={() => persist(checks)}
                />
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          size="lg"
          className="sm:flex-1"
          disabled={!allPassed}
          loading={transition.isPending && transition.variables?.event === 'confirmResult'}
          onClick={() =>
            transition.mutate(
              { event: 'confirmResult', checks },
              {
                onSuccess: () => toast.success(t('detail.verify.confirmed')),
                onError: (e) => toast.error(errorText(e, t('errors.generic'))),
              },
            )
          }
        >
          {t('detail.verify.confirm')}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="sm:flex-1"
          disabled={!anyFailed}
          onClick={() => setIssueOpen(true)}
        >
          {t('detail.verify.report')}
        </Button>
      </div>
      {!allPassed && !anyFailed ? (
        <p className="mt-2 text-center text-[13px] text-ink-500">{t('detail.verify.needAllPassed')}</p>
      ) : null}

      <Sheet
        open={issueOpen}
        onOpenChange={setIssueOpen}
        title={t('detail.verify.report')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setIssueOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              loading={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { event: 'reportIssue', checks, ...(issueNote.trim() ? { note: issueNote.trim() } : {}) },
                  {
                    onSuccess: () => {
                      setIssueOpen(false)
                      toast.success(t('detail.verify.reported'))
                    },
                    onError: (e) => toast.error(errorText(e, t('errors.generic'))),
                  },
                )
              }
            >
              {t('common.submit')}
            </Button>
          </>
        }
      >
        <ul className="mb-4 flex flex-col gap-2">
          {checks
            .filter((c) => c.result === 'failed')
            .map((c) => (
              <li key={c.criterionId} className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm">
                <p className="font-semibold text-danger-600">
                  {request.acceptanceCriteria.find((a) => a.id === c.criterionId)?.text}
                </p>
                {c.note ? <p className="mt-1 text-ink-700">{c.note}</p> : null}
              </li>
            ))}
        </ul>
        <Field label={t('detail.verify.reportNote')} optional optionalLabel={t('common.optional')}>
          {(p) => <Textarea {...p} value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />}
        </Field>
      </Sheet>
    </Card>
  )
}

export function CancelRequest({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const transition = useTransition(request.id)
  return (
    <>
      <Button variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={() => setOpen(true)}>
        {t('detail.cancel')}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('detail.cancelTitle')}
        description={t('detail.cancelBody')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setOpen(false)}>
              {t('common.close')}
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              loading={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { event: 'cancel', ...(reason.trim() ? { reason: reason.trim() } : {}) },
                  {
                    onSuccess: () => {
                      setOpen(false)
                      toast.success(t('detail.cancelled'))
                    },
                    onError: (e) => toast.error(errorText(e, t('errors.generic'))),
                  },
                )
              }
            >
              {t('detail.cancel')}
            </Button>
          </>
        }
      >
        <Field label={t('detail.cancelReason')}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </Sheet>
    </>
  )
}
