import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, UserPlus, Users } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { UserCreate } from '@/api/contract'
import { useCreateUser, useSaveTeam, useUpdateUser } from '@/api/queries'
import { useCurrentUser, useDirectory, useTeamDirectory } from '@/app/hooks'
import { Page, PageHeader, PageScroll, PageTop } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/controls'
import { ListSkeleton } from '@/components/ui/feedback'
import { LoadFailed, RefreshFailed } from '@/components/ui/load-failed'
import { Field, Input } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { appConfig } from '@/config/app.config'
import { TEAM_NAME_MAX, type Role, type Team, type User } from '@/domain/model'

/** Operator accounts belong to the service, not the organization: an admin cannot assign the role. */
const ASSIGNABLE_ROLES = appConfig.enabledRoles.filter((r) => r !== 'operator')
import type * as z from 'zod'

type InviteValues = z.input<typeof UserCreate>

type TeamDirectory = ReturnType<typeof useTeamDirectory>

/** Team picker: "no team" first, then the teams by name. */
function TeamOptions({ teams }: { teams: Team[] }) {
  const { t } = useTranslation()
  return (
    <>
      <option value="">{t('users.noTeam')}</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </>
  )
}

function InviteForm({ teams, onDone }: { teams: Team[]; onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateUser()
  const form = useForm<InviteValues>({
    resolver: zodResolver(UserCreate),
    defaultValues: { name: '', email: '', role: 'requester', teamId: '' },
  })
  const err = form.formState.errors
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        create.mutate(
          { ...values, teamId: values.teamId || undefined },
          {
            onSuccess: () => {
              toast.success(t('users.invited'))
              onDone()
            },
            onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
          },
        ),
      )}
    >
      <Field label={t('users.name')} error={err.name ? t('common.requiredField') : undefined}>
        {(p) => <Input autoComplete="off" {...p} {...form.register('name')} />}
      </Field>
      <Field label={t('users.email')} error={err.email ? t('auth.emailInvalid') : undefined}>
        {(p) => (
          <Input type="email" inputMode="email" autoComplete="off" {...p} {...form.register('email')} />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('users.role')}>
          {(p) => (
            <Select {...p} {...form.register('role')}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('users.team')} optional optionalLabel={t('common.optional')}>
          {(p) => (
            <Select {...p} {...form.register('teamId')}>
              <TeamOptions teams={teams} />
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" size="lg" block loading={create.isPending}>
        {t('users.invite')}
      </Button>
    </form>
  )
}

function teamNameError(name: string, t: TFunction) {
  const trimmed = name.trim()
  if (!trimmed) return t('common.requiredField')
  if (trimmed.length > TEAM_NAME_MAX) return t('users.teamNameTooLong', { max: TEAM_NAME_MAX })
  return undefined
}

/** A team name box; its label is read by screen readers only, the row says what it is. */
function TeamNameInput({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
}) {
  return (
    <Input
      aria-label={label}
      aria-invalid={error ? true : undefined}
      placeholder={placeholder}
      maxLength={TEAM_NAME_MAX + 10}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TeamNameError({ error, id }: { error?: string; id?: string }) {
  return error ? (
    <p id={id} className="col-span-2 text-[13px] font-medium text-danger-fg" role="alert">
      {error}
    </p>
  ) : null
}

/** One team: its name, editable in place. */
function TeamRow({ team }: { team: Team }) {
  const { t } = useTranslation()
  const save = useSaveTeam()
  const [name, setName] = useState(team.name)
  const trimmed = name.trim()
  const error = teamNameError(name, t)
  const changed = trimmed !== team.name
  const errorId = `${useId()}-error`
  return (
    <li>
      <form
        noValidate
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (error || !changed) return
          save.mutate(
            { id: team.id, body: { name: trimmed } },
            {
              onSuccess: () => toast.success(t('users.teamRenamed')),
              onError: (err) => toast.error(err instanceof ApiError ? err.message : t('errors.generic')),
            },
          )
        }}
      >
        <TeamNameInput
          label={`${t('users.teamName')}: ${team.name}`}
          value={name}
          onChange={setName}
          error={changed ? error : undefined}
        />
        <Button
          type="submit"
          variant="secondary"
          className="h-12"
          disabled={!changed || !!error}
          loading={save.isPending}
          aria-label={`${team.name} ${t('users.rename')}`}
        >
          {t('users.rename')}
        </Button>
        <TeamNameError id={errorId} error={changed ? error : undefined} />
      </form>
    </li>
  )
}

function TeamsPanel({ dir }: { dir: TeamDirectory }) {
  const { t } = useTranslation()
  const save = useSaveTeam()
  const [name, setName] = useState('')
  const [tried, setTried] = useState(false)
  const error = teamNameError(name, t)
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-ink-600">{t('users.teamsHint')}</p>
      <form
        noValidate
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (error) return
          save.mutate(
            { body: { name: name.trim() } },
            {
              onSuccess: () => {
                toast.success(t('users.teamAdded'))
                setName('')
                setTried(false)
              },
              onError: (err) => toast.error(err instanceof ApiError ? err.message : t('errors.generic')),
            },
          )
        }}
      >
        <TeamNameInput
          label={t('users.newTeam')}
          placeholder={t('users.newTeam')}
          value={name}
          onChange={setName}
          error={tried ? error : undefined}
        />
        <Button type="submit" className="h-12" loading={save.isPending}>
          <Plus aria-hidden />
          {t('users.addTeam')}
        </Button>
        <TeamNameError error={tried ? error : undefined} />
      </form>
      {dir.loading ? (
        <ListSkeleton />
      ) : dir.error ? (
        <LoadFailed error={dir.error} onRetry={dir.retry} retrying={dir.retrying} />
      ) : dir.teams.length ? (
        <ul className="flex flex-col gap-2" aria-label={t('users.teamsTitle')}>
          {dir.teams.map((team) => (
            <TeamRow key={`${team.id}:${team.name}`} team={team} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">{t('users.noTeams')}</p>
      )}
    </div>
  )
}

function UserRow({ user, isMe, teams }: { user: User; isMe: boolean; teams: TeamDirectory }) {
  const { t } = useTranslation()
  const update = useUpdateUser()
  const operator = user.role === 'operator'
  const locked = isMe || operator
  const lockedReason = isMe ? t('users.selfLocked') : operator ? t('users.operatorLocked') : undefined
  const patch = (body: { role?: Role; teamId?: string | null; active?: boolean }) =>
    update.mutate(
      { id: user.id, body },
      {
        onSuccess: () => toast.success(t('users.saved')),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : t('errors.generic')),
      },
    )
  return (
    <li className="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-line sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 font-bold text-accent-strong">
          {user.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-bold">
            {user.name}
            {isMe ? <Badge tone="brand">{t('users.you')}</Badge> : null}
            {user.active ? null : <Badge>{t('users.inactive')}</Badge>}
          </p>
          <p className="truncate text-[13px] text-ink-500">
            {user.email}
            {user.teamId ? ` · ${teams.teamName(user.teamId)}` : ''}
          </p>
          {operator ? <p className="text-[13px] text-ink-500">{t('users.operatorLocked')}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:w-[28rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Select
          aria-label={`${user.name} ${t('users.team')}`}
          value={user.teamId ?? ''}
          disabled={operator || update.isPending}
          title={operator ? lockedReason : undefined}
          onChange={(e) => patch({ teamId: e.target.value || null })}
        >
          <TeamOptions teams={teams.teams} />
          {user.teamId && !teams.teams.some((x) => x.id === user.teamId) ? (
            <option value={user.teamId}>{teams.teamName(user.teamId)}</option>
          ) : null}
        </Select>
        <Select
          aria-label={`${user.name} ${t('users.role')}`}
          value={user.role}
          disabled={locked || update.isPending}
          title={lockedReason}
          onChange={(e) => patch({ role: e.target.value as Role })}
        >
          {(operator ? appConfig.enabledRoles : ASSIGNABLE_ROLES).map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          className="col-span-2 sm:col-span-1"
          disabled={locked || update.isPending}
          title={lockedReason}
          onClick={() => patch({ active: !user.active })}
          aria-label={`${user.name} ${user.active ? t('users.inactive') : t('users.active')}`}
        >
          {user.active ? t('users.inactive') : t('users.active')}
        </Button>
      </div>
    </li>
  )
}

export default function UsersPage() {
  const { t } = useTranslation()
  usePageTitle(t('users.title'))
  const me = useCurrentUser()
  const dir = useDirectory()
  const teams = useTeamDirectory()
  const [inviting, setInviting] = useState(false)
  const [managingTeams, setManagingTeams] = useState(false)

  return (
    <Page>
      <PageTop>
        <PageHeader
          title={t('users.title')}
          description={t('users.subtitle')}
          actions={
            <>
              <Button variant="secondary" onClick={() => setManagingTeams(true)}>
                <Users aria-hidden />
                {t('users.teams')}
              </Button>
              <Button onClick={() => setInviting(true)}>
                <UserPlus aria-hidden />
                {t('users.invite')}
              </Button>
            </>
          }
        />
        <RefreshFailed failed={dir.usersStale} onRetry={dir.retry} retrying={dir.retrying} className="mb-3" />
      </PageTop>
      <PageScroll label={t('common.listOf', { title: t('users.title') })}>
        {dir.loading ? (
          <ListSkeleton />
        ) : dir.usersError ? (
          <LoadFailed error={dir.usersError} onRetry={dir.retry} retrying={dir.retrying} />
        ) : (
          <ul className="flex flex-col gap-2">
            {dir.users.map((u) => (
              <UserRow key={u.id} user={u} isMe={u.id === me.id} teams={teams} />
            ))}
          </ul>
        )}
      </PageScroll>
      <Sheet
        open={inviting}
        onOpenChange={setInviting}
        title={t('users.inviteTitle')}
        closeLabel={t('common.close')}
      >
        {inviting ? <InviteForm teams={teams.teams} onDone={() => setInviting(false)} /> : null}
      </Sheet>
      <Sheet
        open={managingTeams}
        onOpenChange={setManagingTeams}
        title={t('users.teamsTitle')}
        closeLabel={t('common.close')}
      >
        {managingTeams ? <TeamsPanel dir={teams} /> : null}
      </Sheet>
    </Page>
  )
}
