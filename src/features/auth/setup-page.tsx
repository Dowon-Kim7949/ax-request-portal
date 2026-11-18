import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import * as z from 'zod'
import { ApiError } from '@/api/client'
import { SETUP_PASSWORD_MAX, SETUP_PASSWORD_MIN } from '@/api/contract'
import { useCompleteSetup } from '@/api/queries'
import { useBrand } from '@/app/brand'
import { QuickDisplayToggles } from '@/app/display-controls'
import { LOGIN_PATH } from '@/app/guards'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { resolvePostLoginPath } from './post-login'
import { tokenFromHash } from './setup-url'

const SetupForm = z
  .object({
    password: z.string().min(SETUP_PASSWORD_MIN).max(SETUP_PASSWORD_MAX),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'] })
type SetupForm = z.infer<typeof SetupForm>

/**
 * Where a setup link opens (`/setup#token=…`): the person sets a password and
 * is signed in. Public, like the login screen. Someone already signed in in
 * this browser is replaced by the person the link belongs to.
 */
export default function SetupPage() {
  const { t } = useTranslation()
  usePageTitle(t('setup.title'))
  const brand = useBrand()
  const location = useLocation()
  const navigate = useNavigate()
  // Read once, then taken out of the address bar so it stays out of the history and off the screen.
  const [token] = useState(() => tokenFromHash(location.hash))
  const hasHash = location.hash !== ''
  useEffect(() => {
    if (hasHash) void navigate({ pathname: location.pathname, search: location.search }, { replace: true })
  }, [hasHash, location.pathname, location.search, navigate])

  const setup = useCompleteSetup()
  const form = useForm<SetupForm>({
    resolver: zodResolver(SetupForm),
    defaultValues: { password: '', confirm: '' },
  })
  const err = form.formState.errors
  const passwordError =
    err.password?.type === 'too_big'
      ? t('setup.tooLong', { max: SETUP_PASSWORD_MAX })
      : err.password
        ? t('setup.tooShort', { min: SETUP_PASSWORD_MIN })
        : undefined

  const submit = (values: SetupForm) =>
    setup.mutate(
      { token, password: values.password },
      { onSuccess: (session) => navigate(resolvePostLoginPath(null, session.user), { replace: true }) },
    )
  const errorMessage =
    setup.error instanceof ApiError ? setup.error.message : setup.error ? t('errors.generic') : undefined

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 pt-[calc(4rem+env(safe-area-inset-top))] pb-16">
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
        <QuickDisplayToggles />
      </div>
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-inverse text-base font-black text-on-inverse">
            {brand.shortName}
          </span>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{t('setup.title')}</h1>
          <p className="text-[15px] text-ink-500">{t('setup.subtitle', { brand: brand.name })}</p>
        </div>

        {token ? (
          <form
            noValidate
            onSubmit={form.handleSubmit(submit)}
            className="flex flex-col gap-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-line"
          >
            <Field
              label={t('setup.password')}
              hint={t('setup.passwordHint', { min: SETUP_PASSWORD_MIN })}
              error={passwordError}
            >
              {(p) => (
                <Input type="password" autoComplete="new-password" {...p} {...form.register('password')} />
              )}
            </Field>
            <Field label={t('setup.confirm')} error={err.confirm ? t('setup.mismatch') : undefined}>
              {(p) => (
                <Input type="password" autoComplete="new-password" {...p} {...form.register('confirm')} />
              )}
            </Field>
            {errorMessage ? (
              <p role="alert" className="text-sm font-medium text-danger-fg">
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" size="lg" block loading={setup.isPending}>
              {setup.isPending ? t('setup.submitting') : t('setup.submit')}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-line">
            <p role="alert" className="text-sm font-medium text-danger-fg">
              {t('setup.noToken')}
            </p>
            <Link
              to={LOGIN_PATH}
              replace
              className="text-sm font-bold text-accent underline-offset-4 hover:underline"
            >
              {t('setup.toLogin')}
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
