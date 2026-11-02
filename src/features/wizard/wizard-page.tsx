import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useCreateRequest, usePrecheck } from '@/api/queries'
import { useCurrentUser, useDirectory } from '@/app/hooks'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import type { PrecheckIssue } from '@/domain/model'
import {
  adviceByField,
  clearDraft,
  EMPTY_VALUES,
  firstInvalidStep,
  isEmptyDraft,
  loadDraft,
  saveDraft,
  STEPS,
  toDraft,
  WizardSchema,
  type WizardValues,
} from './schema'
import {
  CriteriaStep,
  DescribeStep,
  ExtraStep,
  ProjectStep,
  ReviewStep,
  TargetsStep,
  TypeStep,
} from './steps'

const LAST = STEPS.length - 1

export default function WizardPage() {
  const { t } = useTranslation()
  usePageTitle(t('wizard.title'))
  const user = useCurrentUser()
  const dir = useDirectory()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const presetProject = params.get('project')

  // Restore a draft once; a ?project= link from the home screen overrides its project.
  const [restored] = useState(() => loadDraft(user.id))
  const initial = useMemo<WizardValues>(() => {
    const base = restored ?? EMPTY_VALUES
    if (presetProject && presetProject !== base.projectId)
      return { ...base, projectId: presetProject, targetIds: [] }
    return base
    // eslint-disable-next-line react-hooks/exhaustive-deps -- computed once on mount
  }, [])

  const form = useForm<WizardValues>({
    resolver: zodResolver(WizardSchema),
    defaultValues: initial,
    mode: 'onTouched',
  })

  const rawStep = params.get('step')
  const requested = rawStep === null ? (presetProject ? 1 : 0) : Number(rawStep)
  const step = Number.isInteger(requested) ? Math.min(Math.max(requested, 0), LAST) : 0
  const current = STEPS[step]!

  const goTo = (next: number, replace = false) => {
    const p = new URLSearchParams(params)
    p.set('step', String(next))
    p.delete('project')
    setParams(p, { replace })
  }

  // Never show a step whose earlier steps are incomplete (deep links, reloads).
  useEffect(() => {
    const max = firstInvalidStep(form.getValues())
    if (step > max) goTo(max, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Unknown project in ?project= (e.g. deactivated) → start from the project list.
  useEffect(() => {
    if (presetProject && !dir.loading && !dir.project(presetProject)) {
      form.setValue('projectId', '')
      goTo(0, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetProject, dir.loading])

  // Persist every keystroke so switching apps on a phone loses nothing.
  useEffect(() => {
    const sub = form.watch((values) => saveDraft(user.id, values as WizardValues))
    return () => sub.unsubscribe()
  }, [form, user.id])

  const discard = () => {
    clearDraft(user.id)
    form.reset(EMPTY_VALUES)
    goTo(0, true)
  }

  useEffect(() => {
    if (restored && !isEmptyDraft(restored)) {
      toast(t('wizard.draftRestored'), { action: { label: t('wizard.discard'), onClick: discard } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move focus to the new question for screen readers and keep the top in view.
  const titleRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    titleRef.current?.querySelector<HTMLElement>('[data-step-title]')?.focus({ preventScroll: true })
  }, [step])

  /* ---- submission check on the review step ---- */
  const precheck = usePrecheck()
  const [issues, setIssues] = useState<PrecheckIssue[]>([])
  useEffect(() => {
    if (current.key !== 'review') return
    precheck.mutate(toDraft(form.getValues()), { onSuccess: (r) => setIssues(r.issues) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.key])
  const advice = useMemo(() => adviceByField(issues), [issues])

  /* ---- navigation ---- */
  const create = useCreateRequest()
  const next = async () => {
    const ok = await form.trigger([...current.fields] as Array<keyof WizardValues>)
    if (!ok) return
    if (step < LAST) goTo(step + 1)
  }
  const submit = () => {
    create.mutate(toDraft(form.getValues()), {
      onSuccess: (req) => {
        clearDraft(user.id)
        toast.success(t('wizard.review.submitted'))
        navigate(`/requests/${req.id}`, { replace: true })
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
    })
  }
  const back = () => {
    if (step === 0) return navigate('/')
    // Use browser history when we pushed the previous step; deep links fall back to step - 1.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else goTo(step - 1, true)
  }

  const body = {
    project: <ProjectStep onPicked={() => goTo(step + 1)} />,
    type: <TypeStep onPicked={() => goTo(step + 1)} />,
    targets: <TargetsStep advice={advice} />,
    describe: <DescribeStep advice={advice} />,
    criteria: <CriteriaStep advice={advice} />,
    extra: <ExtraStep advice={advice} />,
    review: (
      <ReviewStep
        issues={issues}
        checking={precheck.isPending}
        checkFailed={precheck.isError}
        goTo={(s) => goTo(s)}
      />
    ),
  }[current.key]

  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-2xl flex-col">
        {/* progress */}
        <div className="sticky top-14 z-10 -mx-4 flex items-center gap-3 bg-canvas/95 px-2 py-2 backdrop-blur sm:-mx-6 sm:px-4 md:top-16">
          <Button
            variant="ghost"
            size="icon"
            onClick={back}
            aria-label={step === 0 ? t('common.close') : t('common.back')}
          >
            {step === 0 ? <X aria-hidden /> : <ChevronLeft aria-hidden />}
          </Button>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-label={t('wizard.title')}
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-sm text-ink-500">
            {t('wizard.step', { current: step + 1, total: STEPS.length })}
          </span>
        </div>

        <form
          noValidate
          className="pt-4 pb-32 md:pb-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (current.key === 'review') submit()
            else void next()
          }}
        >
          <div ref={titleRef}>{body}</div>

          {/* actions: pinned to the bottom on phones (tab bar is hidden here), inline from md */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto flex max-w-2xl gap-2">
              {current.key === 'review' ? (
                <Button
                  type="submit"
                  size="lg"
                  block
                  loading={create.isPending}
                  disabled={precheck.isPending}
                >
                  {create.isPending ? t('wizard.review.submitting') : t('wizard.review.submit')}
                </Button>
              ) : (
                <Button type="submit" size="lg" block>
                  {t('common.next')}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  )
}
