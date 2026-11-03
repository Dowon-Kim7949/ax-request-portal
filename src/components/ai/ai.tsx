/** Small pieces every AI-related screen shares: provider color, model name, token counts. */
import { useTranslation } from 'react-i18next'
import type { AiProvider, AiSelection, TokenUsage } from '@/domain/ai'
import { cn } from '@/lib/cn'
import { formatTokens } from '@/lib/format'
import { PROVIDER_FILL, useModelLabel } from './provider'

/** The colored key that sits beside a provider's name; never the only cue. */
export function ProviderSwatch({ provider, className }: { provider: AiProvider; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-[3px]', PROVIDER_FILL[provider], className)}
    />
  )
}

/** "■ Claude Opus 5.5" */
export function ModelName({ selection, className }: { selection: AiSelection; className?: string }) {
  const label = useModelLabel()
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <ProviderSwatch provider={selection.provider} />
      <span className="truncate">{label(selection)}</span>
    </span>
  )
}

/** "입력 1.2K · 캐시 읽기 26K · 캐시 쓰기 0 · 출력 3.1K (추론 1K 포함)" */
export function TokenLine({ tokens, className }: { tokens: TokenUsage; className?: string }) {
  const { t } = useTranslation()
  const parts = [
    `${t('ai.tokens.input')} ${formatTokens(tokens.input)}`,
    `${t('ai.tokens.cacheRead')} ${formatTokens(tokens.cacheRead)}`,
    `${t('ai.tokens.cacheWrite')} ${formatTokens(tokens.cacheWrite)}`,
    `${t('ai.tokens.output')} ${formatTokens(tokens.output)}` +
      (tokens.reasoning ? ` (${t('ai.tokens.reasoning', { n: formatTokens(tokens.reasoning) })})` : ''),
  ]
  return <p className={cn('tabular-nums', className)}>{parts.join(' · ')}</p>
}
