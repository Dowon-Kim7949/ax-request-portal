/** Provider color and model display names, shared by every AI-related screen. */
import { useCallback } from 'react'
import { useAiPricing } from '@/api/queries'
import { useCan } from '@/app/hooks'
import { DEFAULT_AI_PRICING } from '@/config/ai'
import type { AiProvider, AiSelection } from '@/domain/ai'

/** Series fill of each provider. Fixed per provider, so a filter never repaints one. */
export const PROVIDER_FILL: Record<AiProvider, string> = {
  anthropic: 'bg-provider-anthropic',
  openai: 'bg-provider-openai',
}

function findLabel(models: readonly { provider: string; model: string; label: string }[], sel: AiSelection) {
  return models.find((m) => m.provider === sel.provider && m.model === sel.model)?.label
}

/**
 * Display name of a model. People who may read the price table get the
 * operator's labels; everyone else gets the template's defaults, then the id.
 */
export function useModelLabel(): (sel: AiSelection) => string {
  const can = useCan()
  const pricing = useAiPricing({ enabled: can('agent:manage') || can('usage:view') })
  const models = pricing.data?.models
  return useCallback(
    (sel: AiSelection) =>
      (models && findLabel(models, sel)) ?? findLabel(DEFAULT_AI_PRICING.models, sel) ?? sel.model,
    [models],
  )
}
