import { zodResolver } from '@hookform/resolvers/zod'
import { GitBranch, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { ProjectInput } from '@/api/contract'
import { useSaveProject } from '@/api/queries'
import { useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { ProjectIcon } from '@/components/request/project-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SwitchRow } from '@/components/ui/controls'
import { ListSkeleton } from '@/components/ui/feedback'
import { Field, Input, Label, Textarea } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { ProjectIcon as ProjectIconSchema, type Project } from '@/domain/model'
import { cn } from '@/lib/cn'

type FormValues = ProjectInput

const EMPTY: FormValues = {
  name: '',
  description: '',
  icon: 'box',
  repository: { provider: 'gitlab', url: '' },
  wikiPath: 'docs/llm-wiki',
  ownerIds: [],
  targets: [{ name: '', wikiDoc: '' }],
  active: true,
}

function toForm(p: Project): FormValues {
  return {
    name: p.name,
    description: p.description,
    icon: p.icon,
    repository: { ...p.repository },
    wikiPath: p.wikiPath,
    ownerIds: [...p.ownerIds],
    targets: p.targets.map((t) => ({ id: t.id, name: t.name, wikiDoc: t.wikiDoc ?? '' })),
    active: p.active,
  }
}

function ProjectForm({ project, onDone }: { project: Project | null; onDone: () => void }) {
  const { t } = useTranslation()
  const dir = useDirectory()
  const save = useSaveProject()
  const form = useForm<FormValues>({
    resolver: zodResolver(ProjectInput),
    defaultValues: project ? toForm(project) : EMPTY,
  })
  const targets = useFieldArray({ control: form.control, name: 'targets' })
  const owners = dir.users.filter((u) => (u.role === 'developer' || u.role === 'admin') && u.active)
  const err = form.formState.errors

  const submit = form.handleSubmit((values) => {
    const body: FormValues = {
      ...values,
      targets: values.targets
        .filter((x) => x.name.trim())
        .map((x) => ({
          ...(x.id ? { id: x.id } : {}),
          name: x.name.trim(),
          ...(x.wikiDoc?.trim() ? { wikiDoc: x.wikiDoc.trim() } : {}),
        })),
    }
    save.mutate(
      { id: project?.id, body },
      {
        onSuccess: () => {
          toast.success(t('projects.form.saved'))
          onDone()
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
      },
    )
  })

  return (
    <form id="project-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={t('projects.form.name')} error={err.name ? t('common.requiredField') : undefined}>
        {(p) => <Input {...p} {...form.register('name')} />}
      </Field>
      <Field label={t('projects.form.description')}>
        {(p) => <Textarea rows={2} className="min-h-0" {...p} {...form.register('description')} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('projects.form.icon')}>
          {(p) => (
            <Select {...p} {...form.register('icon')}>
              {ProjectIconSchema.options.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('projects.form.provider')}>
          {(p) => (
            <Select {...p} {...form.register('repository.provider')}>
              <option value="gitlab">GitLab</option>
              <option value="github">GitHub</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t('projects.form.url')} error={err.repository?.url ? 'https://…' : undefined}>
        {(p) => (
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            {...p}
            {...form.register('repository.url')}
          />
        )}
      </Field>
      <Field label={t('projects.form.wikiPath')}>
        {(p) => <Input className="font-mono" {...p} {...form.register('wikiPath')} />}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-700">{t('projects.form.owners')}</legend>
        <Controller
          control={form.control}
          name="ownerIds"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {owners.map((u) => {
                const on = field.value.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      field.onChange(on ? field.value.filter((x) => x !== u.id) : [...field.value, u.id])
                    }
                    className={cn(
                      'h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-inset',
                      on
                        ? 'bg-brand-600 text-white ring-brand-600'
                        : 'bg-surface text-ink-700 ring-line-strong',
                    )}
                  >
                    {u.name}
                  </button>
                )
              })}
            </div>
          )}
        />
        {err.ownerIds ? (
          <p role="alert" className="text-[13px] font-medium text-danger-600">
            {t('common.requiredField')}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-700">{t('projects.form.targets')}</legend>
        {targets.fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <div className="flex flex-col gap-1">
              {i === 0 ? <Label htmlFor={`tn-${i}`}>{t('projects.form.targetName')}</Label> : null}
              <Input
                id={`tn-${i}`}
                aria-label={t('projects.form.targetName')}
                {...form.register(`targets.${i}.name`)}
              />
            </div>
            <div className="flex flex-col gap-1">
              {i === 0 ? <Label htmlFor={`tw-${i}`}>{t('projects.form.targetWiki')}</Label> : null}
              <Input
                id={`tw-${i}`}
                aria-label={t('projects.form.targetWiki')}
                className="font-mono text-sm"
                placeholder="domains/…md"
                {...form.register(`targets.${i}.wikiDoc`)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('projects.form.removeTarget', {
                name: form.getValues(`targets.${i}.name`) || i + 1,
              })}
              onClick={() => targets.remove(i)}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => targets.append({ name: '', wikiDoc: '' })}
        >
          <Plus aria-hidden />
          {t('projects.form.addTarget')}
        </Button>
      </fieldset>

      <Controller
        control={form.control}
        name="active"
        render={({ field }) => (
          <SwitchRow
            checked={field.value}
            onCheckedChange={field.onChange}
            label={t('projects.form.active')}
          />
        )}
      />
      <Button type="submit" size="lg" block loading={save.isPending}>
        {t('common.save')}
      </Button>
    </form>
  )
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  usePageTitle(t('projects.title'))
  const dir = useDirectory()
  const [editing, setEditing] = useState<Project | 'new' | null>(null)

  return (
    <>
      <PageHeader
        title={t('projects.title')}
        description={t('projects.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t('projects.add')}
          </Button>
        }
      />
      {dir.loading ? (
        <ListSkeleton />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {dir.projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line sm:p-5"
            >
              <div className="flex items-start gap-3">
                <ProjectIcon icon={p.icon} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {p.name}
                    {p.active ? null : <Badge>{t('projects.inactive')}</Badge>}
                  </p>
                  <p className="text-[13px] text-ink-500">{p.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('projects.edit')}: ${p.name}`}
                  onClick={() => setEditing(p)}
                >
                  <Pencil aria-hidden />
                </Button>
              </div>
              <dl className="grid grid-cols-1 gap-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-ink-500">{t('projects.repository')}</dt>
                  <dd className="flex min-w-0 items-center gap-1 font-mono text-[13px]">
                    <GitBranch className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                    <span className="truncate">{p.repository.url.replace(/^https?:\/\//, '')}</span>
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-ink-500">{t('projects.owners')}</dt>
                  <dd>{p.ownerIds.map((id) => dir.user(id)?.name ?? id).join(', ')}</dd>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[13px] text-ink-500">
                  <span>
                    {t('projects.wiki', { verified: p.wikiStats.verifiedDocs, total: p.wikiStats.totalDocs })}
                  </span>
                  <span>{t('projects.targets', { count: p.targets.length })}</span>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => (o ? null : setEditing(null))}
        title={editing === 'new' ? t('projects.add') : t('projects.edit')}
        closeLabel={t('common.close')}
      >
        {editing !== null ? (
          <ProjectForm
            key={editing === 'new' ? 'new' : editing.id}
            project={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
    </>
  )
}
