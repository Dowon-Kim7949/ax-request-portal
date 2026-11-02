import type { FeasibilityReport, WikiTrust } from './model'

/**
 * Wiki trust comes from the review state of the evidence documents, not from
 * the model's own confidence ("weak evidence is reported as weak"):
 *   - no evidence at all            → low
 *   - every document human-verified → high
 *   - at least half verified        → medium
 *   - otherwise                     → low
 */
export function deriveWikiTrust(docs: ReadonlyArray<{ verified: boolean }>): WikiTrust {
  if (docs.length === 0) return 'low'
  const verified = docs.filter((d) => d.verified).length
  if (verified === docs.length) return 'high'
  if (verified * 2 >= docs.length) return 'medium'
  return 'low'
}

/** A report with weak evidence must not claim more than "undetermined" or "conditional". */
export function isVerdictBackedByEvidence(report: Pick<FeasibilityReport, 'verdict' | 'wikiTrust'>): boolean {
  if (report.verdict === 'feasible') return report.wikiTrust !== 'low'
  return true
}
