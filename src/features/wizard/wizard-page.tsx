import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useBlocker, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { errorText } from '@/api/error-text'
import { useCreateRequest, usePrecheck } from '@/api/queries'
import { useCurrentUser, useDirectory } from '@/app/hooks'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import type { PrecheckIssue } from '@/domain/model'
import { debounce } from '@/lib/debounce'
import {
  adviceByField,
  clearDraft,
  DRAFT_SAVE_DELAY_MS,
  EMPTY_VALUES,
  firstInvalidStep,
  hasWrittenContent,
  isEmptyDraft,
  loadDraft,
  saveDraft,
  STEPS,
  toDraft,
  WizardSchema,
  type DraftSaveResult,
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
  // Not when the list failed to load: then nothing is known about the project yet.
  useEffect(() => {
    if (presetProject && !dir.loading && !dir.projectsError && !dir.project(presetProject)) {
      form.setValue('projectId', '')
      goTo(0, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetProject, dir.loading, dir.projectsError])

  /* ---- draft: saved as you type, so switching apps on a phone loses nothing ---- */
  /** Set once the request is created: from then on nothing may write the draft back. */
  const submitted = useRef(false)
  const [lastSave, setLastSave] = useState<DraftSaveResult>('saved')
  const warned = useRef(new Set<DraftSaveResult>())
  const draftSaver = useMemo(
    () =>
      debounce(() => {
        if (submitted.current) return
        const result = saveDraft(user.id, form.getValues())
        setLastSave(result)
        // Storage full: say so once per kind, without stopping the person.
        if (result !== 'saved' && !warned.current.has(result)) {
          warned.current.add(result)
          toast.warning(result === 'failed' ? t('wizard.draftNotSaved') : t('wizard.draftWithoutAttachments'))
        }
      }, DRAFT_SAVE_DELAY_MS),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is read when the save runs
    [form, user.id],
  )
  useEffect(() => {
    const sub = form.watch(() => draftSaver.schedule())
    // A phone may discard a hidden tab without warning: write what is pending first.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') draftSaver.flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', draftSaver.flush)
    return () => {
      sub.unsubscribe()
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', draftSaver.flush)
      draftSaver.flush()
    }
  }, [form, draftSaver])

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
  // A layout effect, so focus moves before the step is painted: a passive effect
  // could run after the user (or a test) has already started typing into the
  // first field, and pull focus away mid-input, dropping what was typed.
  const titleRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 })
    titleRef.current?.querySelector<HTMLElement>('[data-step-title]')?.focus({ preventScroll: true })
  }, [step])

  /* ---- submission check on the review step ---- */
  const precheck = usePrecheck()
  const [issues, setIssues] = useState<PrecheckIssue[]>([])
  // Advice from an earlier check must not outlive a new one, failed or not.
  const runPrecheck = () => {
    setIssues([])
    precheck.mutate(toDraft(form.getValues()), { onSuccess: (r) => setIssues(r.issues) })
  }
  useEffect(() => {
    if (current.key === 'review') runPrecheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.key])
  const advice = useMemo(() => adviceByField(issues), [issues])

  /* ---- submission ---- */
  // Handled by the hook, so the draft is deleted and the outcome told even when
  // the person has left the wizard while the request was on its way.
  const create = useCreateRequest({
    onCreated: () => {
      submitted.current = true
      draftSaver.cancel()
      clearDraft(user.id)
      toast.success(t('wizard.review.submitted'))
    },
    onFailed: (e) => toast.error(errorText(e, t('errors.generic'))),
  })
  const submit = () => {
    create.mutate(toDraft(form.getValues()), {
      onSuccess: (req) => navigate(`/requests/${req.id}`, { replace: true }),
    })
  }

  /* ---- leaving with something written: confirm (the draft is kept either way) ---- */
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      !submitted.current &&
      // Leaving while it is sent is fine: the hook finishes the job.
      !create.isPending &&
      hasWrittenContent(form.getValues()),
  )
  useEffect(() => {
    if (blocker.state === 'blocked') draftSaver.flush()
  }, [blocker.state, draftSaver])
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      draftSaver.flush()
      // A reload would also cut off a submission on its way.
      if (submitted.current || (!create.isPending && !hasWrittenContent(form.getValues()))) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [form, draftSaver, create.isPending])

  /* ---- navigation ---- */
  const next = async () => {
    const ok = await form.trigger([...current.fields] as Array<keyof WizardValues>)
    if (!ok) return
    if (step < LAST) goTo(step + 1)
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
        onRecheck={runPrecheck}
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

      <Sheet
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset()
        }}
        title={t('wizard.leave.title')}
        description={lastSave === 'failed' ? t('wizard.leave.unsaved') : t('wizard.leave.saved')}
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => blocker.state === 'blocked' && blocker.proceed()}
            >
              {t('wizard.leave.go')}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => blocker.state === 'blocked' && blocker.reset()}
            >
              {t('wizard.leave.stay')}
            </Button>
          </>
        }
      />
    </FormProvider>
  )
}
