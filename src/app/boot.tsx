/**
 * Screens shown before the app is ready. They avoid React context (no router,
 * no query client) and read texts straight from the i18n instance, which is
 * initialised synchronously before anything renders.
 */
import { appConfig } from '@/config/app.config'
import i18n from '@/i18n'

export function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label={i18n.t('boot.loading')}>
      <span className="size-8 animate-spin rounded-full border-[3px] border-line border-t-brand-600" />
    </div>
  )
}

export function BootError({ detail }: { detail?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-inverse font-black text-on-inverse">
          {appConfig.brand.shortName}
        </span>
        <h1 className="text-lg font-bold">{i18n.t('boot.title')}</h1>
        <p className="text-sm text-ink-500">{i18n.t('boot.body')}</p>
        {detail ? <p className="font-mono text-xs break-all text-ink-400">{detail}</p> : null}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 h-11 rounded-xl bg-brand-600 px-5 font-semibold text-white"
        >
          {i18n.t('boot.retry')}
        </button>
      </div>
    </main>
  )
}
