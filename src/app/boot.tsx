/**
 * Screens shown before the app (and i18n) is ready. Kept dependency-free on
 * purpose: they must render even when everything else failed to load.
 */
import { appConfig } from '@/config/app.config'

export function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="loading">
      <span className="size-8 animate-spin rounded-full border-[3px] border-line border-t-brand-600" />
    </div>
  )
}

export function BootError({ detail }: { detail?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-ink-900 font-black text-white">
          {appConfig.brand.shortName}
        </span>
        <h1 className="text-lg font-bold">화면을 준비하지 못했어요</h1>
        <p className="text-sm text-ink-500">네트워크가 잠깐 끊겼을 수 있어요. 다시 시도해 주세요.</p>
        {detail ? <p className="font-mono text-xs break-all text-ink-400">{detail}</p> : null}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 h-11 rounded-xl bg-brand-600 px-5 font-semibold text-white"
        >
          다시 시도
        </button>
      </div>
    </main>
  )
}
