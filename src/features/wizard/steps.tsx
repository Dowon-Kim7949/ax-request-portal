import { Check, CircleAlert, FileText, ImagePlus, Paperclip, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useUploadAttachment } from '@/api/queries'
import { useDirectory } from '@/app/hooks'
import { useHqCalendarNote } from '@/app/time-zone'
import { ProjectIcon } from '@/components/request/project-icon'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/feedback'
import { Field, Input, Textarea, type Advice } from '@/components/ui/field'
import { appConfig } from '@/config/app.config'
import { ACCEPTANCE_CRITERIA_MAX, CHECKLIST_ITEMS_MAX, type PrecheckIssue } from '@/domain/model'
import { cn } from '@/lib/cn'
import { formatBytes, formatDate } from '@/lib/format'
import { hqToday } from '@/lib/time-zone'
import { EMPTY_ROW, parseChecklist, STEPS, stepOfField, type WizardValues } from './schema'

// The app's own namespace: ReturnType<typeof useTranslation> would widen it to every
// namespace and the dictionary type gets too deep for the compiler as it grows.
type TFn = TFunction<'translation'>

export function StepTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1
        className="text-[24px] leading-snug font-bold tracking-tight outline-none sm:text-[28px]"
        tabIndex={-1}
        data-step-title
      >
        {children}
      </h1>
      {hint ? <p className="text-[15px] text-ink-500">{hint}</p> : null}
    </div>
  )
}

function useErrorText() {
  const { t } = useTranslation()
  const { formState } = useFormContext<WizardValues>()
  return (field: keyof WizardValues) => {
    const err = formState.errors[field] as { message?: string; root?: { message?: string } } | undefined
    const key = err?.message ?? err?.root?.message
    return key ? (t as unknown as (k: string) => string)(key) : undefined
  }
}

function OptionCard({
  selected,
  onSelect,
  children,
  icon,
}: {
  selected: boolean
  onSelect: () => void
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left ring-1 transition',
        selected ? 'bg-brand-50/60 ring-2 ring-brand-500' : 'ring-line hover:ring-field',
      )}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full',
          selected ? 'bg-brand-600 text-white' : 'ring-1 ring-field',
        )}
        aria-hidden
      >
        {selected ? <Check className="size-4" /> : null}
      </span>
    </button>
  )
}

/* 1 ---------------------------------------------------------------- */

export function ProjectStep({ onPicked }: { onPicked: () => void }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const { setValue, control } = useFormContext<WizardValues>()
  const projectId = useWatch({ control, name: 'projectId' })
  const error = useErrorText()('projectId')
  return (
    <>
      <StepTitle hint={t('wizard.project.hint')}>{t('wizard.project.title')}</StepTitle>
      <div role="radiogroup" aria-label={t('wizard.field.projectId')} className="flex flex-col gap-3">
        {dir.loading ? <Spinner label={t('common.loading')} /> : null}
        {dir.projects
          .filter((p) => p.active)
          .map((p) => (
            <OptionCard
              key={p.id}
              selected={projectId === p.id}
              icon={<ProjectIcon icon={p.icon} />}
              onSelect={() => {
                if (projectId !== p.id) setValue('targetIds', [])
                setValue('projectId', p.id, { shouldValidate: true, shouldDirty: true })
                onPicked()
              }}
            >
              <span className="font-bold">{p.name}</span>
              <span className="text-[13px] text-ink-500">{p.description}</span>
            </OptionCard>
          ))}
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-danger-fg">{error}</p> : null}
    </>
  )
}

/* 2 ---------------------------------------------------------------- */

export function TypeStep({ onPicked }: { onPicked: () => void }) {
  const { t } = useTranslation()
  const { setValue, control } = useFormContext<WizardValues>()
  const type = useWatch({ control, name: 'type' })
  const error = useErrorText()('type')
  return (
    <>
      <StepTitle>{t('wizard.type.title')}</StepTitle>
      <div role="radiogroup" aria-label={t('wizard.field.type')} className="flex flex-col gap-3">
        {appConfig.requestTypes.map((rt) => (
          <OptionCard
            key={rt}
            selected={type === rt}
            onSelect={() => {
              setValue('type', rt, { shouldValidate: true, shouldDirty: true })
              onPicked()
            }}
          >
            <span className="font-bold">{t(`requestType.${rt}.label`)}</span>
            <span className="text-[13px] text-ink-500">{t(`requestType.${rt}.hint`)}</span>
          </OptionCard>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-danger-fg">{error}</p> : null}
    </>
  )
}

/* 3 ---------------------------------------------------------------- */

export function TargetsStep({ advice }: { advice: Map<string, PrecheckIssue[]> }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const { control, setValue, register } = useFormContext<WizardValues>()
  const [projectId, type, targetIds] = useWatch({ control, name: ['projectId', 'type', 'targetIds'] })
  const project = dir.project(projectId)
  const toggle = (id: string) =>
    setValue('targetIds', targetIds.includes(id) ? targetIds.filter((x) => x !== id) : [...targetIds, id], {
      shouldDirty: true,
    })

  return (
    <>
      <StepTitle hint={type === 'non_code' ? t('wizard.targets.nonCode') : t('wizard.targets.hint')}>
        {t('wizard.targets.title')}
      </StepTitle>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('wizard.field.targetIds')}>
        {project?.targets.map((target) => {
          const on = targetIds.includes(target.id)
          return (
            <button
              key={target.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(target.id)}
              className={cn(
                'inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold ring-1 transition ring-inset',
                on
                  ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-surface text-ink-700 ring-field hover:bg-muted',
              )}
            >
              {on ? <Check className="size-4" aria-hidden /> : null}
              {target.name}
            </button>
          )
        })}
      </div>
      <AdviceList items={advice.get('targetIds')} />
      <Field
        className="mt-6"
        label={t('wizard.targets.other')}
        optional
        optionalLabel={t('common.optional')}
        advice={advice.get('targetOther')}
      >
        {(p) => (
          <Input placeholder={t('wizard.targets.otherPlaceholder')} {...p} {...register('targetOther')} />
        )}
      </Field>
    </>
  )
}

function AdviceList({ items }: { items: Advice[] | undefined }) {
  if (!items?.length) return null
  return (
    <div className="mt-3 flex flex-col gap-1">
      {items.map((a) => (
        <p
          key={a.message}
          className={cn(
            'flex gap-1.5 text-[13px]',
            a.severity === 'warning' ? 'text-warning-fg' : 'text-ink-500',
          )}
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {a.message}
        </p>
      ))}
    </div>
  )
}

/* 4 ---------------------------------------------------------------- */

export function DescribeStep({ advice }: { advice: Map<string, PrecheckIssue[]> }) {
  const { t } = useTranslation()
  const { register, control } = useFormContext<WizardValues>()
  const type = useWatch({ control, name: 'type' })
  const err = useErrorText()
  const bug = type === 'bug'
  return (
    <>
      <StepTitle>{t('wizard.describe.title')}</StepTitle>
      <div className="flex flex-col gap-5">
        <Field label={t('wizard.describe.titleLabel')} error={err('title')} advice={advice.get('title')}>
          {(p) => <Input placeholder={t('wizard.describe.titlePlaceholder')} {...p} {...register('title')} />}
        </Field>
        <Field
          label={bug ? t('wizard.describe.currentBug') : t('wizard.describe.current')}
          optional={type === 'new_feature'}
          optionalLabel={t('common.optional')}
          advice={advice.get('currentBehavior')}
        >
          {(p) => (
            <Textarea
              placeholder={
                bug ? t('wizard.describe.currentBugPlaceholder') : t('wizard.describe.currentPlaceholder')
              }
              {...p}
              {...register('currentBehavior')}
            />
          )}
        </Field>
        <Field
          label={t('wizard.describe.desired')}
          error={err('desiredBehavior')}
          advice={advice.get('desiredBehavior')}
        >
          {(p) => (
            <Textarea
              placeholder={t('wizard.describe.desiredPlaceholder')}
              {...p}
              {...register('desiredBehavior')}
            />
          )}
        </Field>
      </div>
    </>
  )
}

/* 5 ---------------------------------------------------------------- */

export function CriteriaStep({ advice }: { advice: Map<string, PrecheckIssue[]> }) {
  const { control } = useFormContext<WizardValues>()
  const type = useWatch({ control, name: 'type' })
  return type === 'checklist' ? <ChecklistStep advice={advice} /> : <CriteriaList advice={advice} />
}

/** An audit request: the findings themselves, pasted from a table or typed. */
function ChecklistStep({ advice }: { advice: Map<string, PrecheckIssue[]> }) {
  const { t } = useTranslation()
  const { control, register, getValues, formState } = useFormContext<WizardValues>()
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'checklist' })
  const error = useErrorText()('checklist')
  const [paste, setPaste] = useState('')
  const itemErrors = formState.errors.checklist as Array<{ message?: string } | undefined> | undefined

  const importRows = () => {
    const rows = parseChecklist(paste)
    if (!rows.length) {
      toast.error(t('wizard.checklist.pasteNothing'))
      return
    }
    // Keep what was typed; drop the empty starter rows.
    const kept = getValues('checklist').filter((r) => r.ref.trim() || r.finding.trim())
    const next = [...kept, ...rows].slice(0, CHECKLIST_ITEMS_MAX)
    replace(next)
    setPaste('')
    toast.success(t('wizard.checklist.pasted', { count: next.length - kept.length }))
  }

  return (
    <>
      <StepTitle hint={t('wizard.checklist.hint')}>{t('wizard.checklist.title')}</StepTitle>
      <div className="flex flex-col gap-5">
        <Field label={t('wizard.checklist.source')} optional optionalLabel={t('common.optional')}>
          {(p) => (
            <Input
              placeholder={t('wizard.checklist.sourcePlaceholder')}
              {...p}
              {...register('checklistSource')}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2 rounded-2xl bg-muted p-3.5">
          <Field label={t('wizard.checklist.paste')} hint={t('wizard.checklist.pasteHint')}>
            {(p) => (
              <Textarea
                rows={3}
                className="min-h-0 font-mono text-[13px]"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                {...p}
              />
            )}
          </Field>
          <Button variant="secondary" className="w-fit" disabled={!paste.trim()} onClick={importRows}>
            {t('wizard.checklist.pasteAction')}
          </Button>
        </div>

        <ol className="flex flex-col gap-3">
          {fields.map((f, i) => {
            const rowError = itemErrors?.[i]?.message
            return (
              <li key={f.id} className="rounded-2xl p-3.5 ring-1 ring-line">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink-700">{t('wizard.checklist.item', { n: i + 1 })}</p>
                  {fields.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('wizard.checklist.remove', { n: i + 1 })}
                      onClick={() => remove(i)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('wizard.checklist.ref')} advice={advice.get(`checklist.${i}.ref`)}>
                    {(p) => (
                      <Input
                        placeholder={t('wizard.checklist.refPlaceholder')}
                        {...p}
                        {...register(`checklist.${i}.ref`)}
                      />
                    )}
                  </Field>
                  <Field label={t('wizard.checklist.clause')} optional optionalLabel={t('common.optional')}>
                    {(p) => <Input {...p} {...register(`checklist.${i}.clause`)} />}
                  </Field>
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  <Field label={t('wizard.checklist.finding')}>
                    {(p) => (
                      <Textarea rows={2} className="min-h-0" {...p} {...register(`checklist.${i}.finding`)} />
                    )}
                  </Field>
                  <Field
                    label={t('wizard.checklist.expected')}
                    optional
                    optionalLabel={t('common.optional')}
                    advice={advice.get(`checklist.${i}.expected`)}
                  >
                    {(p) => <Input {...p} {...register(`checklist.${i}.expected`)} />}
                  </Field>
                </div>
                {rowError ? (
                  <p role="alert" className="mt-2 text-sm font-medium text-danger-fg">
                    {(t as unknown as (k: string) => string)(rowError)}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
        {error ? <p className="text-sm font-medium text-danger-fg">{error}</p> : null}
        {fields.length < CHECKLIST_ITEMS_MAX ? (
          <Button variant="secondary" className="w-fit" onClick={() => append(EMPTY_ROW)}>
            <Plus aria-hidden />
            {t('wizard.checklist.add')}
          </Button>
        ) : null}
      </div>
    </>
  )
}

function CriteriaList({ advice }: { advice: Map<string, PrecheckIssue[]> }) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<WizardValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'acceptanceCriteria' })
  const error = useErrorText()('acceptanceCriteria')

  return (
    <>
      <StepTitle hint={t('wizard.criteria.hint')}>{t('wizard.criteria.title')}</StepTitle>
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        <p className="rounded-2xl bg-success-50 px-4 py-3 text-sm text-ink-700">
          <span className="mb-0.5 block text-xs font-bold text-success-fg">{t('wizard.criteria.good')}</span>
          {t('wizard.criteria.goodExample')}
        </p>
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-ink-500 line-through decoration-ink-400/60">
          <span className="mb-0.5 block text-xs font-bold text-ink-500 no-underline">
            {t('wizard.criteria.bad')}
          </span>
          {t('wizard.criteria.badExample')}
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {fields.map((f, i) => (
          <li key={f.id} className="flex items-start gap-2">
            <span className="mt-3 grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <Field
              className="flex-1"
              label={<span className="sr-only">{t('wizard.criteria.label', { n: i + 1 })}</span>}
              advice={advice.get(`acceptanceCriteria.${i}`)}
            >
              {(p) => (
                <Textarea
                  rows={2}
                  className="min-h-0"
                  placeholder={t('wizard.criteria.placeholder')}
                  {...p}
                  {...register(`acceptanceCriteria.${i}.text`)}
                />
              )}
            </Field>
            {fields.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0"
                aria-label={t('wizard.criteria.remove', { n: i + 1 })}
                onClick={() => remove(i)}
              >
                <Trash2 aria-hidden />
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      {error ? <p className="mt-3 text-sm font-medium text-danger-fg">{error}</p> : null}
      {fields.length < ACCEPTANCE_CRITERIA_MAX ? (
        <Button variant="secondary" className="mt-4" onClick={() => append({ text: '' })}>
          <Plus aria-hidden />
          {t('wizard.criteria.add')}
        </Button>
      ) : null}
    </>
  )
}

/* 6 ---------------------------------------------------------------- */

export function ExtraStep({ advice }: { advice: Map<string, PrecheckIssue[]> }) {
  const { t } = useTranslation()
  const { control, register, setValue } = useFormContext<WizardValues>()
  const [attachments, desiredDate] = useWatch({ control, name: ['attachments', 'desiredDate'] })
  const upload = useUploadAttachment()
  const fileInput = useRef<HTMLInputElement>(null)
  const hqDateNote = useHqCalendarNote('today')

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    let list = attachments
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('wizard.error.tooLarge'))
        continue
      }
      try {
        const a = await upload.mutateAsync(file)
        list = [...list, a]
        setValue('attachments', list, { shouldDirty: true })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('errors.generic'))
      }
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <>
      <StepTitle>{t('wizard.extra.title')}</StepTitle>
      <div className="flex flex-col gap-6">
        <Field
          label={t('wizard.extra.outOfScope')}
          optional
          optionalLabel={t('common.optional')}
          advice={advice.get('outOfScope')}
        >
          {(p) => (
            <Textarea
              rows={3}
              placeholder={t('wizard.extra.outOfScopePlaceholder')}
              {...p}
              {...register('outOfScope')}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink-700">
            {t('wizard.extra.attachments')}
            <span className="ml-1.5 text-xs font-medium text-ink-400">{t('common.optional')}</span>
          </p>
          {attachments.length ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl bg-surface p-2 ring-1 ring-line">
                  {a.mimeType.startsWith('image/') ? (
                    <img src={a.url} alt="" className="size-12 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-lg bg-muted text-ink-400">
                      <FileText className="size-5" aria-hidden />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{a.name}</span>
                    <span className="text-xs text-ink-400">{formatBytes(a.size)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('wizard.extra.removeAttachment', { name: a.name })}
                    onClick={() =>
                      setValue(
                        'attachments',
                        attachments.filter((x) => x.id !== a.id),
                        { shouldDirty: true },
                      )
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            id="wizard-files"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <label
            htmlFor="wizard-files"
            className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-field px-4 text-[15px] font-semibold text-ink-600 hover:border-brand-500 hover:text-accent"
          >
            {upload.isPending ? (
              <Spinner label={t('wizard.extra.uploading')} />
            ) : (
              <>
                <ImagePlus className="size-5" aria-hidden />
                {t('wizard.extra.attach')}
              </>
            )}
          </label>
          <p className="text-[13px] text-ink-500">{t('wizard.extra.attachHint')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('wizard.extra.desiredDate')}
            optional
            optionalLabel={t('common.optional')}
            hint={hqDateNote}
            advice={advice.get('desiredDate')}
          >
            {(p) => <Input type="date" min={hqToday()} {...p} {...register('desiredDate')} />}
          </Field>
          {desiredDate ? (
            <Field label={t('wizard.extra.desiredDateReason')} advice={advice.get('desiredDateReason')}>
              {(p) => (
                <Input
                  placeholder={t('wizard.extra.desiredDateReasonPlaceholder')}
                  {...p}
                  {...register('desiredDateReason')}
                />
              )}
            </Field>
          ) : null}
        </div>
      </div>
    </>
  )
}

/* 7 ---------------------------------------------------------------- */

function ReviewRow({
  label,
  children,
  onEdit,
  t,
}: {
  label: string
  children: ReactNode
  onEdit: () => void
  t: TFn
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <dt className="w-24 shrink-0 pt-0.5 text-[13px] font-semibold text-ink-500 sm:w-32">{label}</dt>
      <dd className="min-w-0 flex-1 text-[15px] whitespace-pre-line text-ink-900">{children}</dd>
      <button
        type="button"
        onClick={onEdit}
        className="-my-1.5 h-9 shrink-0 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-brand-50"
      >
        {t('common.edit')}
      </button>
    </div>
  )
}

export function ReviewStep({
  issues,
  checking,
  checkFailed,
  goTo,
}: {
  issues: PrecheckIssue[]
  checking: boolean
  checkFailed: boolean
  goTo: (step: number) => void
}) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const { control } = useFormContext<WizardValues>()
  const v = useWatch({ control }) as WizardValues
  const project = dir.project(v.projectId)
  const targets = project?.targets.filter((x) => v.targetIds.includes(x.id)).map((x) => x.name) ?? []
  if (v.targetOther.trim()) targets.push(v.targetOther.trim())
  const step = (key: (typeof STEPS)[number]['key']) => STEPS.findIndex((s) => s.key === key)
  const none = <span className="text-ink-400">{t('common.none')}</span>

  return (
    <>
      <StepTitle>{t('wizard.review.title')}</StepTitle>

      <div
        className={cn(
          'mb-5 flex gap-3 rounded-2xl px-4 py-3.5',
          checking ? 'bg-ai-50' : issues.length ? 'bg-warning-50' : 'bg-success-50',
        )}
        aria-live="polite"
      >
        <Sparkles
          className={cn(
            'mt-0.5 size-5 shrink-0',
            checking ? 'animate-pulse text-ai-600' : issues.length ? 'text-warning-fg' : 'text-success-fg',
          )}
          aria-hidden
        />
        <div className="flex flex-col gap-1.5 text-sm">
          {checking ? (
            <p className="font-semibold text-ai-700">{t('wizard.review.checking')}</p>
          ) : checkFailed ? (
            <p className="font-semibold text-ink-700">{t('wizard.review.checkFailed')}</p>
          ) : issues.length ? (
            <>
              <p className="font-bold text-warning-fg">
                {t('wizard.review.issues', { count: issues.length })}
              </p>
              <p className="text-ink-600">{t('wizard.review.issuesHint')}</p>
            </>
          ) : (
            <p className="font-semibold text-success-fg">{t('wizard.review.clean')}</p>
          )}
        </div>
      </div>

      {issues.length && !checking ? (
        <ul className="mb-5 flex flex-col gap-2">
          {issues.map((issue) => (
            <li key={`${issue.field}-${issue.message}`}>
              <button
                type="button"
                onClick={() => goTo(stepOfField(issue.field))}
                className="flex w-full items-start gap-2 rounded-xl bg-surface px-3.5 py-3 text-left text-sm ring-1 ring-line hover:ring-warning-600"
              >
                <CircleAlert
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    issue.severity === 'warning' ? 'text-warning-fg' : 'text-ink-400',
                  )}
                  aria-hidden
                />
                <span className="flex-1 text-ink-700">{issue.message}</span>
                <span className="shrink-0 font-semibold text-accent">{t('common.edit')}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="divide-y divide-line rounded-2xl bg-surface px-4 ring-1 ring-line">
        <ReviewRow t={t} label={t('wizard.field.projectId')} onEdit={() => goTo(step('project'))}>
          {project?.name ?? none}
        </ReviewRow>
        <ReviewRow t={t} label={t('wizard.field.type')} onEdit={() => goTo(step('type'))}>
          {v.type ? t(`requestType.${v.type}.label`) : none}
        </ReviewRow>
        <ReviewRow t={t} label={t('wizard.field.targetIds')} onEdit={() => goTo(step('targets'))}>
          {targets.length ? targets.join(', ') : none}
        </ReviewRow>
        <ReviewRow t={t} label={t('wizard.field.title')} onEdit={() => goTo(step('describe'))}>
          {v.title || none}
        </ReviewRow>
        <ReviewRow t={t} label={t('wizard.field.currentBehavior')} onEdit={() => goTo(step('describe'))}>
          {v.currentBehavior.trim() || none}
        </ReviewRow>
        <ReviewRow t={t} label={t('wizard.field.desiredBehavior')} onEdit={() => goTo(step('describe'))}>
          {v.desiredBehavior || none}
        </ReviewRow>
        {v.type === 'checklist' ? (
          <ReviewRow t={t} label={t('wizard.field.checklist')} onEdit={() => goTo(step('criteria'))}>
            {v.checklistSource.trim() ? (
              <p className="mb-1 text-ink-600">{v.checklistSource.trim()}</p>
            ) : null}
            <ol className="flex flex-col gap-1">
              {v.checklist
                .filter((r) => r.ref.trim() || r.finding.trim())
                .map((r, i) => (
                  <li key={i}>
                    <span className="font-semibold">{r.ref}</span> {r.finding}
                  </li>
                ))}
            </ol>
          </ReviewRow>
        ) : (
          <ReviewRow t={t} label={t('wizard.field.acceptanceCriteria')} onEdit={() => goTo(step('criteria'))}>
            <ol className="flex list-decimal flex-col gap-1 pl-4">
              {v.acceptanceCriteria
                .filter((c) => c.text.trim())
                .map((c, i) => (
                  <li key={i}>{c.text}</li>
                ))}
            </ol>
          </ReviewRow>
        )}
        <ReviewRow t={t} label={t('wizard.field.outOfScope')} onEdit={() => goTo(step('extra'))}>
          {v.outOfScope.trim() || none}
        </ReviewRow>
        <ReviewRow t={t} label={t('wizard.field.attachmentIds')} onEdit={() => goTo(step('extra'))}>
          {v.attachments.length ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-4 text-ink-400" aria-hidden />
              {v.attachments.map((a) => a.name).join(', ')}
            </span>
          ) : (
            none
          )}
        </ReviewRow>
        <ReviewRow t={t} label={t('wizard.field.desiredDate')} onEdit={() => goTo(step('extra'))}>
          {v.desiredDate
            ? `${formatDate(v.desiredDate)}${v.desiredDateReason ? ` · ${v.desiredDateReason}` : ''}`
            : none}
        </ReviewRow>
      </dl>
    </>
  )
}
