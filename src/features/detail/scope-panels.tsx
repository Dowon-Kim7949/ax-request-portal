/** The AI's reading of the request: the requester confirms it, everyone else sees what was confirmed. */
import { Check, Minus } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorText } from '@/api/error-text'
import { useTransition } from '@/api/queries'
import { useDirectory } from '@/app/hooks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Textarea } from '@/components/ui/field'
import { scopeRevisionsLeft, unansweredScopeQuestions } from '@/domain/lifecycle'
import type { ScopeProposal, WorkRequest } from '@/domain/model'
import { formatDateTime } from '@/lib/format'

/** Summary, what changes and what does not: the part both cards share. */
function ScopeBody({ proposal }: { proposal: ScopeProposal }) {
  const { t } = useTranslation()
  return (
    <>
      <p className="rounded-2xl bg-brand-50 px-4 py-3 text-[15px] text-ink-700">{proposal.summary}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section aria-label={t('detail.scope.changes')} className="rounded-2xl bg-muted p-3.5">
          <h3 className="mb-1.5 text-[13px] font-bold text-ink-600">{t('detail.scope.changes')}</h3>
          <ul className="flex flex-col gap-1 text-[15px] text-ink-900">
            {proposal.changes.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>
        {proposal.unchanged.length ? (
          <section aria-label={t('detail.scope.unchanged')} className="rounded-2xl bg-muted p-3.5">
            <h3 className="mb-1.5 text-[13px] font-bold text-ink-600">{t('detail.scope.unchanged')}</h3>
            <ul className="flex flex-col gap-1 text-[15px] text-ink-900">
              {proposal.unchanged.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <Minus className="mt-1 size-4 shrink-0 text-ink-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  )
}

/** The requester's turn: go ahead, or send it back once or twice with a note. */
export function ScopeCheckCard({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const transition = useTransition(request.id)
  const missingId = useId()
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [revising, setRevising] = useState(false)
  const [revision, setRevision] = useState('')
  const [showMissing, setShowMissing] = useState(false)
  const proposal = request.scope?.proposal
  if (!proposal) return null

  const choices = Object.entries(picked).map(([questionId, optionId]) => ({ questionId, optionId }))
  const missing = unansweredScopeQuestions(request, choices)
  const left = scopeRevisionsLeft(request)
  const fail = (e: unknown) => toast.error(errorText(e, t('errors.generic')))

  const approve = () => {
    if (missing.length) {
      // Say what is missing and take the person there instead of a dead button.
      setShowMissing(true)
      document.querySelector<HTMLInputElement>(`input[name="scope-${missing[0]}"]`)?.focus()
      return
    }
    transition.mutate(
      { event: 'approveScope', choices, ...(note.trim() ? { note: note.trim() } : {}) },
      { onSuccess: () => toast.success(t('detail.scope.approved')), onError: fail },
    )
  }

  return (
    <Card className="ring-2 ring-warning-600/40" aria-labelledby="scope-check-title">
      <CardHeader className="items-start">
        <div>
          <CardTitle id="scope-check-title">{t('detail.scope.title')}</CardTitle>
          <p className="mt-1 text-sm text-ink-500">{t('detail.scope.lead')}</p>
        </div>
      </CardHeader>

      <ScopeBody proposal={proposal} />

      {proposal.questions.map((q) => (
        <fieldset key={q.id} className="mt-4 flex flex-col gap-2">
          <legend className="mb-1.5 text-[15px] font-semibold text-ink-900">{q.text}</legend>
          {q.options.map((o) => (
            <label
              key={o.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] ring-1 ring-field ring-inset has-checked:bg-brand-50 has-checked:ring-2 has-checked:ring-brand-500"
            >
              <input
                type="radio"
                name={`scope-${q.id}`}
                value={o.id}
                className="size-5 shrink-0 accent-brand-600"
                checked={picked[q.id] === o.id}
                aria-describedby={showMissing && missing.includes(q.id) ? missingId : undefined}
                onChange={() => setPicked((cur) => ({ ...cur, [q.id]: o.id }))}
              />
              <span className="flex-1 text-ink-900">{o.label}</span>
              {q.recommended === o.id ? <Badge tone="ai">{t('detail.scope.recommended')}</Badge> : null}
            </label>
          ))}
        </fieldset>
      ))}

      <div className="mt-4">
        <Field label={t('detail.scope.note')} optional optionalLabel={t('common.optional')}>
          {(p) => (
            <Textarea
              {...p}
              className="min-h-20"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('detail.scope.notePlaceholder')}
            />
          )}
        </Field>
      </div>

      {showMissing && missing.length ? (
        <p id={missingId} role="alert" className="mt-3 text-[13px] font-medium text-danger-fg">
          {t('detail.scope.unanswered', { count: missing.length })}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          size="lg"
          className="sm:flex-1"
          loading={transition.isPending && transition.variables?.event === 'approveScope'}
          onClick={approve}
        >
          {t('detail.scope.approve')}
        </Button>
        {left > 0 ? (
          <Button
            size="lg"
            variant="secondary"
            className="sm:flex-1"
            aria-expanded={revising}
            aria-controls="scope-revise"
            onClick={() => setRevising((v) => !v)}
          >
            {t('detail.scope.revise')}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-center text-[13px] text-ink-500">
        {left > 0 ? t('detail.scope.revisionsLeft', { count: left }) : t('detail.scope.revisionsUsed')}
      </p>

      {revising && left > 0 ? (
        <form
          id="scope-revise"
          className="mt-3 flex flex-col gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!revision.trim()) return
            transition.mutate(
              { event: 'reviseScope', note: revision.trim() },
              { onSuccess: () => toast.success(t('detail.scope.revised')), onError: fail },
            )
          }}
        >
          <Field label={t('detail.scope.reviseNote')}>
            {(p) => (
              <Textarea
                {...p}
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder={t('detail.scope.revisePlaceholder')}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            block
            disabled={!revision.trim()}
            loading={transition.isPending && transition.variables?.event === 'reviseScope'}
          >
            {t('detail.scope.reviseSubmit')}
          </Button>
        </form>
      ) : null}
    </Card>
  )
}

/** Read-only: the scope as confirmed (or still waiting), with the choices made. */
export function ScopeSummaryCard({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const scope = request.scope
  if (!scope) return null
  const { proposal, decision } = scope
  const chosen = new Map(decision?.choices.map((c) => [c.questionId, c.optionId]))

  return (
    <Card aria-labelledby="scope-summary-title">
      <CardHeader className="items-start">
        <div>
          <CardTitle id="scope-summary-title">
            {decision ? t('detail.scope.confirmedTitle') : t('detail.scope.pendingTitle')}
          </CardTitle>
          {decision ? (
            <p className="mt-0.5 text-xs text-ink-500">
              {t('detail.scope.confirmedBy', {
                name: dir.userName(decision.by),
                time: formatDateTime(decision.at),
              })}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <ScopeBody proposal={proposal} />
      {proposal.questions.length ? (
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          {proposal.questions.map((q) => {
            const option = q.options.find((o) => o.id === chosen.get(q.id))
            return (
              <div key={q.id} className="rounded-xl px-3.5 py-2.5 ring-1 ring-line">
                <dt className="text-ink-600">{q.text}</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{option?.label ?? '-'}</dd>
              </div>
            )
          })}
        </dl>
      ) : null}
      {decision?.note ? (
        <p className="mt-3 rounded-xl bg-muted px-3.5 py-2.5 text-sm">
          <span className="font-semibold text-ink-600">{t('detail.scope.note')}: </span>
          {decision.note}
        </p>
      ) : null}
    </Card>
  )
}
