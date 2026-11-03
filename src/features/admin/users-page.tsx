import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { UserCreate } from '@/api/contract'
import { useCreateUser, useUpdateUser } from '@/api/queries'
import { useCurrentUser, useDirectory } from '@/app/hooks'
import { PageHeader } from '@/app/page'
import { usePageTitle } from '@/app/title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/controls'
import { ListSkeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { appConfig } from '@/config/app.config'
import type { Role, User } from '@/domain/model'

/** Operator accounts belong to the service, not the organization: an admin cannot assign the role. */
const ASSIGNABLE_ROLES = appConfig.enabledRoles.filter((r) => r !== 'operator')
import type * as z from 'zod'

type InviteValues = z.input<typeof UserCreate>

function InviteForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateUser()
  const form = useForm<InviteValues>({
    resolver: zodResolver(UserCreate),
    defaultValues: { name: '', email: '', role: 'requester', team: '' },
  })
  const err = form.formState.errors
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) =>
        create.mutate(
          { ...values, ...(values.team?.trim() ? { team: values.team.trim() } : { team: undefined }) },
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
          {(p) => <Input {...p} {...form.register('team')} />}
        </Field>
      </div>
      <Button type="submit" size="lg" block loading={create.isPending}>
        {t('users.invite')}
      </Button>
    </form>
  )
}

function UserRow({ user, isMe }: { user: User; isMe: boolean }) {
  const { t } = useTranslation()
  const update = useUpdateUser()
  const operator = user.role === 'operator'
  const locked = isMe || operator
  const lockedReason = isMe ? t('users.selfLocked') : operator ? t('users.operatorLocked') : undefined
  const patch = (body: { role?: Role; active?: boolean }) =>
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
            {user.team ? ` · ${user.team}` : ''}
          </p>
          {operator ? <p className="text-[13px] text-ink-500">{t('users.operatorLocked')}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:w-72">
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
  const [inviting, setInviting] = useState(false)

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.subtitle')}
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus aria-hidden />
            {t('users.invite')}
          </Button>
        }
      />
      {dir.loading ? (
        <ListSkeleton />
      ) : (
        <ul className="flex flex-col gap-2">
          {dir.users.map((u) => (
            <UserRow key={u.id} user={u} isMe={u.id === me.id} />
          ))}
        </ul>
      )}
      <Sheet
        open={inviting}
        onOpenChange={setInviting}
        title={t('users.inviteTitle')}
        closeLabel={t('common.close')}
      >
        {inviting ? <InviteForm onDone={() => setInviting(false)} /> : null}
      </Sheet>
    </>
  )
}
