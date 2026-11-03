import { useTranslation } from 'react-i18next'
import { overRequestLimit } from '@/domain/ai'
import type { WorkRequest } from '@/domain/model'
import { formatKrw } from '@/lib/format'

/**
 * Whether the request may start another AI run, and the sentence that says
 * why not. Mirrors the server's guard, so the button is disabled before the
 * developer presses it rather than failing afterwards.
 */
export function useAiRunLimit(request: WorkRequest): { reached: boolean; reason: string } {
  const { t } = useTranslation()
  const usage = request.aiUsage
  const reached = usage ? overRequestLimit(usage.spentKrw, usage.limitKrw) : false
  return {
    reached,
    reason: reached && usage ? t('aiUsage.limitReached', { limit: formatKrw(usage.limitKrw) }) : '',
  }
}
