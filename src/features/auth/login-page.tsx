import { zodResolver } from '@hookform/resolvers/zod'
import { Bot, ChartColumn, ChevronRight, Code, Settings, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import * as z from 'zod'
import { ApiError } from '@/api/client'
import type { Session } from '@/api/contract'
import { useLogin } from '@/api/queries'
import { useBrand } from '@/app/brand'
import { loadDemoAccounts } from '@/app/demo'
import { QuickDisplayToggles } from '@/app/display-controls'
import { usePageTitle } from '@/app/title'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import type { Role, User } from '@/domain/model'
import { useSession } from '@/stores/session'
import { resolvePostLoginPath } from './post-login'

const LoginForm = z.object({ email: z.email(), password: z.string().min(1) })
type LoginForm = z.infer<typeof LoginForm>

const ROLE_ICON: Record<Role, typeof Send> = {
  requester: Send,
  executive: ChartColumn,
  developer: Code,
  admin: Settings,
  operator: Bot,
}

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  usePageTitle(t('auth.title'))
  const brand = useBrand()
  const token = useSession((s) => s.token)
  const user = useSession((s) => s.user)
  // How the previous session in this tab ended. Read once: signing in resets it in the store, and the
  // redirect that follows must still see it.
  const [ended] = useState(() => useSession.getState().ended)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const login = useLogin()
  const [demo, setDemo] = useState<{ accounts: User[]; password: string } | null>(null)

  // Reload on language change: untouched demo data is rebuilt in the new language.
  useEffect(() => {
    void loadDemoAccounts().then(setDemo)
  }, [i18n.language])

  const form = useForm<LoginForm>({
    resolver: zodResolver(LoginForm),
    defaultValues: { email: '', password: '' },
  })

  // Every way out of this screen goes through resolvePostLoginPath: `next` only if the new user may open
  // it. After a session ended in this tab, `next` is the page that person had open: only they return to it.
  const destination = (signedIn: User | null) =>
    resolvePostLoginPath(ended?.userId && ended.userId !== signedIn?.id ? null : next, signedIn)
  const goOn = (session: Session) => navigate(destination(session.user), { replace: true })
  const submit = (values: LoginForm) => login.mutate(values, { onSuccess: goOn })

  if (token && !login.isPending) return <Navigate to={destination(user)} replace />

  const errorMessage =
    login.error instanceof ApiError ? login.error.message : login.error ? t('errors.generic') : undefined

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-16 pt-safe">
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
        <QuickDisplayToggles />
      </div>
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-inverse text-base font-black text-on-inverse">
            {brand.shortName}
          </span>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{brand.name}</h1>
          <p className="text-[15px] text-ink-500">{brand.tagline}</p>
        </div>

        {ended?.reason === 'expired' ? (
          <p
            role="status"
            className="rounded-(--radius-card) bg-warning-50 px-4 py-3 text-sm font-medium text-warning-fg"
          >
            {t('auth.sessionExpired')}
          </p>
        ) : null}

        <form
          noValidate
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-line"
        >
          <Field
            label={t('auth.email')}
            error={form.formState.errors.email ? t('auth.emailInvalid') : undefined}
          >
            {(p) => (
              <Input
                type="email"
                autoComplete="username"
                inputMode="email"
                {...p}
                {...form.register('email')}
              />
            )}
          </Field>
          <Field label={t('auth.password')}>
            {(p) => (
              <Input type="password" autoComplete="current-password" {...p} {...form.register('password')} />
            )}
          </Field>
          {errorMessage ? (
            <p role="alert" className="text-sm font-medium text-danger-fg">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" size="lg" block loading={login.isPending}>
            {login.isPending ? t('auth.submitting') : t('auth.submit')}
          </Button>
        </form>

        {demo ? (
          <section className="flex flex-col gap-3" aria-labelledby="demo-title">
            <div>
              <h2 id="demo-title" className="font-bold">
                {t('auth.demoTitle')}
              </h2>
              <p className="text-sm text-ink-500">{t('auth.demoHint', { password: demo.password })}</p>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {demo.accounts.map((u) => {
                const Icon = ROLE_ICON[u.role]
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={login.isPending}
                      onClick={() =>
                        login.mutate({ email: u.email, password: demo.password }, { onSuccess: goOn })
                      }
                      className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3.5 text-left ring-1 ring-line transition hover:ring-brand-500 disabled:opacity-50"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-accent">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] font-bold">
                          {t('auth.demoAs', { role: t(`role.${u.role}`) })}
                        </span>
                        <span className="truncate text-xs text-ink-500">
                          {u.name} · {u.team}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-ink-400" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  )
}
