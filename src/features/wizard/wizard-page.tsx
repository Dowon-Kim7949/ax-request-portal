import { zodResolver } from '@hookform/resolvers/zod'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { ChevronLeft, X } from 'lucide-react'
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Link,
  UNSAFE_DataRouterContext,
  useBlocker,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from 'react-router'
import { toast } from 'sonner'
import { ApiError, call } from '@/api/client'
import { api, type SavedDraft } from '@/api/contract'
import { errorText } from '@/api/error-text'
import { CREATE_REQUEST_KEY, keys, useCreateRequest, usePrecheck } from '@/api/queries'
import { useCurrentUser, useDirectory } from '@/app/hooks'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { ErrorState, Spinner } from '@/components/ui/feedback'
import { LoadFailed } from '@/components/ui/load-failed'
import { Sheet } from '@/components/ui/sheet'
import type { PrecheckIssue } from '@/domain/model'
import { DraftsNotice } from '@/features/drafts/drafts-section'
import { useDiscardDraft, useDraftSaveState, useLocalDraft } from '@/features/drafts/hooks'
import { DRAFT_SETTLE_TIMEOUT_MS, draftSync } from '@/features/drafts/sync'
import { unlinked } from '@/features/drafts/sync-core'
import { debounce } from '@/lib/debounce'
import {
  getLocalDraft,
  isLocalId,
  newLocalId,
  putLocalDraft,
  resolveDraftId,
  updateLocalDraft,
  type LocalDraft,
  type LocalSaveResult,
} from '@/stores/draft'
import { useSession } from '@/stores/session'
import {
  baselineOf,
  baselineOfContent,
  openDraft,
  startLocal,
  startNew,
  startServer,
  wordsOf,
  type FormStart,
  type ServerCopy,
} from './draft-opening'
import {
  CONFLICT_NOTICE_TEXT,
  ConflictNotice,
  DRAFTS_LIST_PATH,
  DraftStatusBar,
  LIMIT_NOTICE_TEXT,
  LimitNotice,
} from './draft-status'
import {
  adviceByField,
  DRAFT_SAVE_DELAY_MS,
  EMPTY_VALUES,
  firstInvalidStep,
  hasWrittenContent,
  missingAttachmentIds,
  readDraftValues,
  savedDraftValues,
  STEPS,
  toDraft,
  WizardSchema,
  type WizardValues,
} from './schema'
import { StepNotice } from './step-notice'
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
const EXTRA = STEPS.findIndex((s) => s.key === 'extra')

/** ?draft= set to `id`, everything else kept. */
const withDraft = (id: string) => (params: URLSearchParams) => {
  const next = new URLSearchParams(params)
  next.set('draft', id)
  return next
}
/** The form's own moves of ?draft= do not add history or scroll. */
const OWN_MOVE = { replace: true, preventScrollReset: true } as const

/**
 * The search params as the router holds them now. A render can be behind:
 * the router commits navigations as transitions, so a render for anything
 * else (a save that just finished) may still show the previous step, and a
 * URL built from it would undo the step the person just moved to.
 */
function useLiveSearch(): () => URLSearchParams {
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  const [params] = useSearchParams()
  return useCallback(
    () => new URLSearchParams(dataRouter ? dataRouter.router.state.location.search : params),
    [dataRouter, params],
  )
}

/**
 * The new-request wizard. A request submitted from an earlier visit may still
 * be on its way (the wizard was left while it was sent): its draft is deleted
 * once it arrives, so the form waits until then instead of opening that draft
 * again, which could submit the same request twice.
 */
export default function WizardPage() {
  const { t } = useTranslation()
  usePageTitle(t('wizard.title'))
  const sending = useIsMutating({ mutationKey: CREATE_REQUEST_KEY }) > 0
  // Only a submission already on its way when the page opened: this page's own keeps the form.
  const [waiting, setWaiting] = useState(sending)
  if (waiting && !sending) setWaiting(false)
  if (waiting) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 py-16 text-center">
        <Spinner label={t('wizard.sendingEarlier.title')} />
        <p className="text-sm text-ink-500">{t('wizard.sendingEarlier.body')}</p>
      </div>
    )
  }
  return <WizardSession />
}

/**
 * Which draft the form is for (?draft=). The form moves ?draft= itself (a
 * local id once something is written, the server id once saved) and stays;
 * going back through its own steps stays too. Any other draft, or a new
 * request opened from a link, starts a fresh form.
 */
function WizardSession() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const draftParam = params.get('draft')
  const [session, setSession] = useState(() => ({
    n: 0,
    owned: new Set<string>(draftParam ? [draftParam] : []),
    location: location.key,
  }))
  const moved = location.key !== session.location
  const foreign = draftParam
    ? !session.owned.has(draftParam)
    : moved && session.owned.size > 0 && navigationType !== 'POP'
  if (foreign) {
    setSession({ n: session.n + 1, owned: new Set(draftParam ? [draftParam] : []), location: location.key })
    return null
  }
  if (moved) setSession({ ...session, location: location.key })
  return <WizardOpener key={session.n} draftParam={draftParam} owned={session.owned} />
}

/** Reads the draft to continue (from this device and the account), then shows the form. */
function WizardOpener({ draftParam, owned }: { draftParam: string | null; owned: Set<string> }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const presetProject = params.get('project')
  const [opening] = useState(() => openDraft(user.id, draftParam))
  const serverKey = opening.kind === 'server' ? opening.key : undefined
  const read = useQuery({
    queryKey: keys.draft(serverKey ?? ''),
    queryFn: ({ signal }) => call(api.getDraft, { params: { id: serverKey! }, signal }),
    enabled: Boolean(serverKey),
    // Another device may have saved it since this tab last read it.
    refetchOnMount: 'always',
    // With a copy on this device there is something to show at once when the account cannot be reached.
    ...(opening.kind === 'server' && opening.entry ? { retry: false } : {}),
  })
  const [start, setStart] = useState<FormStart | 'notFound' | 'failed' | null>(() => {
    switch (opening.kind) {
      case 'new':
        // A ?project= link from the home screen picks the project.
        return startNew(presetProject ? { ...EMPTY_VALUES, projectId: presetProject } : EMPTY_VALUES)
      case 'missing':
        return 'notFound'
      case 'local':
        return startLocal(opening.entry) ?? 'notFound'
      case 'server':
        return null
    }
  })

  // A local id the server has since saved: show its server id.
  useEffect(() => {
    if ((opening.kind === 'local' || opening.kind === 'server') && opening.key !== draftParam) {
      owned.add(opening.key)
      setParams(withDraft(opening.key), OWN_MOVE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the draft opened
  }, [])

  useEffect(() => {
    if (start !== null || !serverKey || read.isFetching || !read.isFetchedAfterMount) return
    const entry = opening.kind === 'server' ? opening.entry : undefined
    setStart(
      startServer(user.id, serverKey, entry, read.isError ? { error: read.error } : { data: read.data! }),
    )
  }, [
    start,
    serverKey,
    read.isFetching,
    read.isFetchedAfterMount,
    read.isError,
    read.error,
    read.data,
    opening,
    user.id,
  ])

  if (start === null) {
    return (
      <div className="mx-auto flex max-w-2xl justify-center py-16">
        <Spinner label={t('wizard.loadingDraft')} />
      </div>
    )
  }
  if (start === 'failed') {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <LoadFailed
          error={read.error}
          retrying={read.isFetching}
          onRetry={() => {
            setStart(null)
            void read.refetch()
          }}
        />
      </div>
    )
  }
  if (start === 'notFound') {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <ErrorState
          title={t('wizard.notFound.title')}
          body={t('wizard.notFound.body')}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link to={DRAFTS_LIST_PATH}>{t('wizard.notFound.drafts')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/requests/new">{t('wizard.notFound.newRequest')}</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }
  return <WizardForm start={start} owned={owned} />
}

function WizardForm({ start, owned }: { start: FormStart; owned: Set<string> }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const dir = useDirectory()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetProject = start.key ? null : params.get('project')

  // The form holds what the person signed in at opening wrote: it is theirs, wherever it is kept.
  const author = useRef(user.id)
  const userId = author.current
  const engine = draftSync(userId)

  const form = useForm<WizardValues>({
    resolver: zodResolver(WizardSchema),
    defaultValues: start.values,
    mode: 'onTouched',
  })

  const rawStep = params.get('step')
  const requested = rawStep === null ? (presetProject ? 1 : 0) : Number(rawStep)
  const step = Number.isInteger(requested) ? Math.min(Math.max(requested, 0), LAST) : 0
  const current = STEPS[step]!
  const stepRef = useRef(step)
  /** Where the draft is kept on this device; null until something worth keeping is written */
  const [draftKey, setDraftKey] = useState(start.key)
  const keyRef = useRef(start.key)

  const liveSearch = useLiveSearch()
  const goTo = (next: number, replace = false) => {
    const p = liveSearch()
    p.set('step', String(next))
    p.delete('project')
    if (keyRef.current) p.set('draft', keyRef.current)
    void navigate(`?${p}`, { replace })
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

  /* ---- the draft: kept on this device as you type, then saved to the account ---- */
  /** What the account holds of it, as far as this screen knows */
  const serverRef = useRef<ServerCopy | null>(start.server)
  const [onServer, setOnServer] = useState(Boolean(start.server))
  const draftSaveState = useDraftSaveState(userId, draftKey, onServer)
  /** Set once the request is created or the draft deleted: from then on nothing may write the draft back. */
  const finished = useRef(false)
  /** How the last write on this device went (a full storage keeps the words only, or nothing) */
  const lastSave = useRef<LocalSaveResult>('saved')
  const warned = useRef(new Set<LocalSaveResult>())
  /**
   * The words this screen last wrote to this device or took from it, and when
   * that copy was written. Another tab open on the same draft writes the same
   * entry: this screen follows its words when it has none of its own, and asks
   * when both have written (`tabConflict`), rather than writing over them.
   */
  const seen = useRef({
    at: start.key ? getLocalDraft(userId, start.key)?.updatedAt : undefined,
    words: wordsOf(start.values),
  })
  const [tabConflict, setTabConflict] = useState(false)
  const tabConflictRef = useRef(tabConflict)
  tabConflictRef.current = tabConflict

  /** The draft lives as `next` now: the page keeps this form for it, and the URL follows (below). */
  const moveTo = (next: string) => {
    keyRef.current = next
    owned.add(next)
    setDraftKey(next)
  }
  // ?draft= names where the draft lives, also after going back to a step from before it moved. Set
  // here rather than in `moveTo`: a write made while leaving must not bring the person back.
  useEffect(() => {
    const p = liveSearch()
    if (!draftKey || p.get('draft') === draftKey) return
    p.set('draft', draftKey)
    void navigate(`?${p}`, OWN_MOVE)
  }, [draftKey, params, liveSearch, navigate])

  /** Shows the words another tab wrote on this device for this draft, in place of this screen's. */
  const take = (entry: LocalDraft) => {
    const restored = readDraftValues(entry.content)
    if (!restored) return
    draftSaver.cancel()
    seen.current = { at: entry.updatedAt, words: wordsOf(restored.values) }
    form.reset(restored.values)
    setTabConflict(false)
  }

  /** Writes the form to this device. `force`: over words another tab wrote meanwhile (the person chose). */
  const writeLocal = (force = false) => {
    if (finished.current) return
    // Signed out on purpose (here or in another tab): the drafts went with the session, and the
    // write still pending when the wizard closes must not bring them back.
    if (useSession.getState().ended?.reason === 'signedOut') return
    const values = form.getValues()
    const stepNow = stepRef.current
    let key = keyRef.current
    if (!key) {
      // Picking the service or type alone is not worth a draft: each takes one tap to redo.
      if (!hasWrittenContent(values)) return
      key = newLocalId()
      moveTo(key)
    } else {
      // Another tab saved this draft under its server id meanwhile.
      const resolved = resolveDraftId(userId, key)
      if (resolved.id !== key) {
        if (resolved.version !== undefined && !getLocalDraft(userId, resolved.id)) {
          serverRef.current = { id: resolved.id, version: resolved.version, baseline: '' }
          setOnServer(true)
        }
        key = resolved.id
        moveTo(key)
      }
    }
    const existing = getLocalDraft(userId, key)
    const server = serverRef.current
    const mine = wordsOf(values)
    if (existing && existing.updatedAt !== seen.current.at && !force) {
      const theirs = wordsOf(existing.content)
      // Another tab wrote other words for this draft since this screen last wrote or read them.
      if (theirs !== seen.current.words) {
        // Nothing new here: follow that tab.
        if (mine === seen.current.words) return take(existing)
        // Both wrote: the person chooses; nothing is written over meanwhile.
        if (mine !== theirs) return setTabConflict(true)
      }
    }
    // This device already holds exactly this, as this screen wrote it.
    if (
      existing &&
      existing.updatedAt === seen.current.at &&
      existing.step === stepNow &&
      mine === seen.current.words &&
      lastSave.current === 'saved'
    ) {
      return
    }
    // Nothing the account does not already have.
    if (!existing && server?.id === key && server.baseline === baselineOf(stepNow, values)) return
    // Which server version it was written over is the sync's to keep; a fresh copy starts from what this screen knows.
    const link = existing
      ? {
          draftId: existing.draftId,
          baseVersion: existing.baseVersion,
          conflict: existing.conflict,
          limited: existing.limited,
        }
      : server?.id === key
        ? { draftId: server.id, baseVersion: server.version }
        : {}
    const updatedAt = new Date().toISOString()
    const result = putLocalDraft(userId, {
      localId: key,
      ...link,
      step: stepNow,
      content: values,
      updatedAt,
      dirty: true,
    })
    seen.current = { at: updatedAt, words: mine }
    setTabConflict(false)
    lastSave.current = result
    // Storage full: say so once per kind, without stopping the person.
    if (result !== 'saved' && !warned.current.has(result)) {
      warned.current.add(result)
      toast.warning(result === 'failed' ? t('wizard.draftNotSaved') : t('wizard.draftWithoutAttachments'))
    }
    engine.schedule(key)
  }
  const writeRef = useRef(writeLocal)
  writeRef.current = writeLocal
  const draftSaver = useMemo(() => debounce(() => writeRef.current(), DRAFT_SAVE_DELAY_MS), [])

  /** Sends what is waiting now (the person moved on, left, or the page was hidden). */
  const sendNow = (trigger: 'step' | 'leave' | 'hidden') => {
    draftSaver.flush()
    if (keyRef.current) void engine.sync(trigger, keyRef.current)
  }
  const sendNowRef = useRef(sendNow)
  sendNowRef.current = sendNow

  // Another tab wrote this draft: follow its words, or ask when this screen has its own too.
  const stored = useLocalDraft(userId, draftKey)
  useEffect(() => {
    if (!stored || finished.current || stored.updatedAt === seen.current.at) return
    const theirs = wordsOf(stored.content)
    if (theirs === seen.current.words) {
      seen.current = { ...seen.current, at: stored.updatedAt }
      return
    }
    const mine = wordsOf(form.getValues())
    if (mine === seen.current.words) take(stored)
    else if (mine !== theirs) setTabConflict(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `take` reads refs and the form
  }, [stored, form])

  useEffect(() => {
    const sub = form.watch(() => draftSaver.schedule())
    // A phone may discard a hidden tab without warning: write what is pending and send it. Sent from
    // here, after the write: the app's own send on hiding may run first, without the last words.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') sendNowRef.current('hidden')
    }
    const onPageHide = () => sendNowRef.current('hidden')
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      sub.unsubscribe()
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
      // Leaving the wizard: write what is pending and send it on its way.
      sendNowRef.current('leave')
    }
  }, [form, draftSaver])

  // A step changed: remember where the person is, and send.
  const firstStep = useRef(true)
  useEffect(() => {
    stepRef.current = step
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    draftSaver.cancel()
    writeLocal()
    sendNow('step')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // What the sync learns about this draft.
  useEffect(
    () =>
      engine.subscribe((event) => {
        if (event.type === 'saved' && event.localId === keyRef.current) {
          serverRef.current = {
            id: event.draft.id,
            version: event.draft.version,
            // Nothing left on this device: the account has exactly what was sent.
            baseline: event.next ? '' : baselineOfContent(event.sent.step, event.sent.content),
          }
          setOnServer(true)
          if (event.draft.id !== keyRef.current) moveTo(event.draft.id)
        } else if (event.type === 'gone' && event.localId === keyRef.current) {
          serverRef.current = null
          setOnServer(false)
          toast.info(t('wizard.draftGone'))
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` and `moveTo` are read when an event comes
    [engine, form],
  )

  // Opened: say what could not come back, and send a copy the account does not have yet.
  useEffect(() => {
    if (start.gone) toast.info(t('wizard.draftGone'))
    if (start.droppedAttachments.length) {
      toast.warning(t('wizard.draftAttachmentsDropped', { names: start.droppedAttachments.join(', ') }))
    }
    if (start.missingAttachments) {
      toast.warning(t('wizard.draftAttachmentsMissing', { count: start.missingAttachments }))
    }
    if (start.key && getLocalDraft(userId, start.key)) void engine.sync('manual', start.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- a conflict: the person chooses which version to keep ---- */
  const saveState = tabConflict ? 'conflict' : draftSaveState
  const [resolving, setResolving] = useState<'keep' | 'load' | null>(null)
  /** The account's latest copy of the open draft; null when it is gone. */
  const readLatest = async (key: string): Promise<SavedDraft | null> => {
    const id = getLocalDraft(userId, key)?.draftId ?? serverRef.current?.id ?? key
    try {
      return await call(api.getDraft, { params: { id } })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  }
  /** The account's draft is gone: what is on screen goes on as a new draft. */
  const goOnAsNew = (key: string) => {
    updateLocalDraft(userId, key, unlinked)
    serverRef.current = null
    setOnServer(false)
    toast.info(t('wizard.draftGone'))
    void engine.sync('manual', key)
    focusTitle()
  }
  /**
   * Chosen: the notice and the button that was pressed go, so focus moves to
   * the step's heading (not the page), and what happened is said.
   */
  const resolved = (kept: 'keep' | 'load') => {
    focusTitle()
    toast.success(t(kept === 'keep' ? 'wizard.conflict.keptMine' : 'wizard.conflict.loaded'))
  }
  /**
   * The form holds other words now: go to the step they were saved on, but no
   * further than they are complete, and check them again on the review step.
   */
  const followWords = (values: WizardValues, savedStep: number) => {
    const target = Math.min(savedStep, firstInvalidStep(values))
    if (target !== stepRef.current) goTo(target, true)
    else if (STEPS[target]?.key === 'review') runPrecheck()
  }
  const keepMine = async () => {
    if (tabConflict) {
      // This screen's words go over the other tab's.
      draftSaver.cancel()
      writeLocal(true)
      const key = keyRef.current
      if (key && !getLocalDraft(userId, key)?.conflict) {
        void engine.sync('manual', key)
        return resolved('keep')
      }
    }
    const key = keyRef.current
    if (!key) return
    setResolving('keep')
    try {
      draftSaver.flush()
      const latest = await readLatest(key)
      if (!latest) return goOnAsNew(key)
      // Written over the latest version now: the next save replaces it.
      updateLocalDraft(userId, key, (entry) => {
        const { conflict: _conflict, ...rest } = entry
        return { ...rest, draftId: latest.id, baseVersion: latest.version }
      })
      serverRef.current = { id: latest.id, version: latest.version, baseline: '' }
      void engine.sync('manual', key)
      resolved('keep')
    } catch (error) {
      toast.error(errorText(error, t('errors.generic')))
    } finally {
      setResolving(null)
    }
  }
  const loadSaved = async () => {
    if (tabConflict) {
      // The other tab's words, while this device still holds them; once sent, the account's.
      const entry = keyRef.current ? getLocalDraft(userId, keyRef.current) : undefined
      if (entry) take(entry)
      if (entry && !entry.conflict) {
        followWords(form.getValues(), entry.step)
        return resolved('load')
      }
      setTabConflict(false)
    }
    const key = keyRef.current
    if (!key) return
    setResolving('load')
    try {
      draftSaver.flush()
      const latest = await readLatest(key)
      if (!latest) return goOnAsNew(key)
      const restored = savedDraftValues(latest)
      draftSaver.cancel()
      engine.forget(key)
      serverRef.current = {
        id: latest.id,
        version: latest.version,
        baseline: baselineOf(latest.step, restored.values),
      }
      setOnServer(true)
      form.reset(restored.values)
      followWords(restored.values, latest.step)
      resolved('load')
      if (restored.missingAttachments) {
        toast.warning(t('wizard.draftAttachmentsMissing', { count: restored.missingAttachments }))
      }
    } catch (error) {
      toast.error(errorText(error, t('errors.generic')))
    } finally {
      setResolving(null)
    }
  }

  /* ---- deleting the draft ---- */
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  /** Whether the account has a copy to delete too, as the sheet was opened (it says where the draft goes from) */
  const [discardsAccountCopy, setDiscardsAccountCopy] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const discardDraft = useDiscardDraft()
  /** The account's copy of the open draft, as far as this screen knows; none for a draft never saved there. */
  const accountCopy = () => {
    const key = keyRef.current
    const entry = key ? getLocalDraft(userId, key) : undefined
    return entry ? entry.draftId : serverRef.current?.id
  }
  const askDiscard = () => {
    setDiscardsAccountCopy(Boolean(accountCopy()))
    setConfirmDiscard(true)
  }
  const discard = async () => {
    setDiscarding(true)
    finished.current = true
    draftSaver.cancel()
    const key = keyRef.current
    const draftId = accountCopy()
    try {
      await discardDraft({ localId: key, draftId })
      toast.success(t('wizard.discardDraft.done'))
    } catch {
      toast.error(t('wizard.discardDraft.failed'))
    }
    setConfirmDiscard(false)
    // A fresh form for a new request (WizardSession starts one).
    void navigate('/requests/new', { replace: true })
  }

  // Move focus to the new question for screen readers and keep the top in view.
  // A layout effect, so focus moves before the step is painted: a passive effect
  // could run after the user (or a test) has already started typing into the
  // first field, and pull focus away mid-input, dropping what was typed.
  const titleRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 })
    titleRef.current?.querySelector<HTMLElement>('[data-step-title]')?.focus({ preventScroll: true })
  }, [step])
  function focusTitle() {
    titleRef.current?.querySelector<HTMLElement>('[data-step-title]')?.focus()
  }

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
  /** Attachments the server could not find at the last submission (marked until removed). */
  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set())
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  /** The draft being submitted, as kept on this device */
  const submittingKey = useRef<string | null>(null)
  /** Waiting for the draft's save already on its way, before sending the request */
  const [preparing, setPreparing] = useState(false)
  // Handled by the hook, so the draft is deleted and the outcome told even when
  // the person has left the wizard while the request was on its way.
  const create = useCreateRequest({
    onCreated: (_req, body) => {
      finished.current = true
      draftSaver.cancel()
      // The server deleted its copy with the submission; this device's goes too, and so does a copy
      // the account got while the request was on its way. A save still on its way that creates the
      // draft again is deleted when it arrives (see settle in sync-core).
      if (submittingKey.current) engine.submitted(submittingKey.current, body.draftId)
      toast.success(t('wizard.review.submitted'))
    },
    onFailed: (e, body) => {
      if (submittingKey.current) engine.release(submittingKey.current)
      const gone = missingAttachmentIds(e instanceof ApiError ? e.issues : undefined, body.attachmentIds)
      if (!gone.length || !mounted.current) {
        toast.error(errorText(e, t('errors.generic')))
        return
      }
      // Say which ones, mark them on the attachment step and offer the way there.
      setMissing(new Set(gone))
      const names = form
        .getValues('attachments')
        .filter((a) => gone.includes(a.id))
        .map((a) => a.name)
      toast.error(t('wizard.missingAttachments.toast', { names: names.join(', ') }), {
        action: { label: t('wizard.missingAttachments.fix'), onClick: () => goTo(EXTRA) },
      })
    },
  })
  const submitting = preparing || create.isPending
  const submit = async () => {
    if (submitting) return
    // Words loaded from elsewhere may leave an earlier step incomplete: finish that first.
    const incomplete = firstInvalidStep(form.getValues())
    if (incomplete < LAST) {
      goTo(incomplete)
      void form.trigger([...STEPS[incomplete]!.fields] as Array<keyof WizardValues>)
      return
    }
    setPreparing(true)
    draftSaver.flush()
    let key = keyRef.current
    // A save already on its way finishes first (briefly), so the request names the account's draft
    // and the server deletes it with the submission. Nothing new is sent for it meanwhile.
    if (key) key = await engine.pause(key, DRAFT_SETTLE_TIMEOUT_MS)
    submittingKey.current = key
    const entry = key ? getLocalDraft(userId, key) : undefined
    // Nothing left on this device under a server id: the account has all of it.
    const draftId = entry
      ? entry.draftId
      : (serverRef.current?.id ?? (key && !isLocalId(key) ? key : undefined))
    setPreparing(false)
    create.mutate(
      { ...toDraft(form.getValues()), ...(draftId ? { draftId } : {}) },
      { onSuccess: (req) => navigate(`/requests/${req.id}`, { replace: true }) },
    )
  }

  /* ---- leaving: free once the draft is kept somewhere; asked only when it is kept nowhere ---- */
  /** Nothing would be lost: written on this device, or the account has it. */
  const keptSomewhere = () => {
    // Held back from this device while another tab's words are there.
    if (tabConflictRef.current) return false
    if (lastSave.current !== 'failed') return true
    const key = keyRef.current
    return Boolean(key && !getLocalDraft(userId, key) && serverRef.current)
  }
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false
    // Another tab signed in as someone else: this tab moves on without asking (the new person must
    // not continue someone else's request).
    if (useSession.getState().user?.id !== author.current) return false
    // Leaving while it is sent is fine: the hook finishes the job.
    if (finished.current || submitting) return false
    draftSaver.flush()
    return hasWrittenContent(form.getValues()) && !keptSomewhere()
  })
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      draftSaver.flush()
      // A reload would also cut off a submission on its way.
      if (finished.current) return
      if (submitting || (hasWrittenContent(form.getValues()) && !keptSomewhere())) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keptSomewhere` reads refs
  }, [form, draftSaver, submitting])

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
    extra: <ExtraStep advice={advice} missing={missing} />,
    review: (
      <ReviewStep
        issues={issues}
        checking={precheck.isPending}
        checkFailed={precheck.isError}
        onRecheck={runPrecheck}
        goTo={(s) => goTo(s)}
        missing={missing}
      />
    ),
  }[current.key]

  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-2xl flex-col">
        {/* progress */}
        {/* Pinned under the header: its height plus the notch inset it sits below (AppShell). */}
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 flex items-center gap-3 bg-canvas/95 px-2 py-2 backdrop-blur sm:-mx-6 sm:px-4 md:top-[calc(4rem+env(safe-area-inset-top))]">
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

        <DraftStatusBar
          state={saveState}
          onDiscard={draftKey || onServer ? askDiscard : undefined}
          // A new request: the drafts there are to continue instead, until this one is saved.
          idle={start.key === null ? <DraftsNotice exclude={[draftKey]} /> : undefined}
        />
        {saveState === 'conflict' ? (
          <ConflictNotice
            busy={resolving}
            onKeepMine={() => void keepMine()}
            onLoadSaved={() => void loadSaved()}
          />
        ) : saveState === 'limited' ? (
          <LimitNotice />
        ) : null}

        <form
          noValidate
          className="pt-2 pb-32 md:pb-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (current.key === 'review') void submit()
            else void next()
          }}
        >
          <StepNotice.Provider
            value={
              saveState === 'conflict'
                ? CONFLICT_NOTICE_TEXT
                : saveState === 'limited'
                  ? LIMIT_NOTICE_TEXT
                  : undefined
            }
          >
            <div ref={titleRef}>{body}</div>
          </StepNotice.Provider>

          {/* actions: pinned to the bottom on phones (tab bar is hidden here), inline from md */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto flex max-w-2xl gap-2">
              {current.key === 'review' ? (
                <Button type="submit" size="lg" block loading={submitting} disabled={precheck.isPending}>
                  {submitting ? t('wizard.review.submitting') : t('wizard.review.submit')}
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
        description={t('wizard.leave.unsaved')}
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

      <Sheet
        open={confirmDiscard}
        onOpenChange={(open) => {
          if (!open && !discarding) setConfirmDiscard(false)
        }}
        title={t('drafts.deleteConfirm.title')}
        description={
          discardsAccountCopy ? t('drafts.deleteConfirm.body') : t('drafts.deleteConfirm.bodyLocal')
        }
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              disabled={discarding}
              onClick={() => setConfirmDiscard(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              loading={discarding}
              onClick={() => void discard()}
            >
              {t('drafts.deleteConfirm.confirm')}
            </Button>
          </>
        }
      />
    </FormProvider>
  )
}
