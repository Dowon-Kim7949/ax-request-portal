import { describe, expect, it } from 'vitest'
import { deriveWikiTrust, isVerdictBackedByEvidence } from './report'

const doc = (verified: boolean) => ({ verified })

describe('deriveWikiTrust', () => {
  it('is low without evidence', () => {
    expect(deriveWikiTrust([])).toBe('low')
  })
  it('is high only when every document is human-verified', () => {
    expect(deriveWikiTrust([doc(true), doc(true), doc(true)])).toBe('high')
  })
  it('is medium from half verified, low below that', () => {
    expect(deriveWikiTrust([doc(true), doc(false)])).toBe('medium')
    expect(deriveWikiTrust([doc(true), doc(false), doc(false)])).toBe('low')
  })
})

describe('isVerdictBackedByEvidence', () => {
  it('rejects a "feasible" verdict resting on low-trust evidence', () => {
    expect(isVerdictBackedByEvidence({ verdict: 'feasible', wikiTrust: 'low' })).toBe(false)
    expect(isVerdictBackedByEvidence({ verdict: 'conditional', wikiTrust: 'low' })).toBe(true)
    expect(isVerdictBackedByEvidence({ verdict: 'feasible', wikiTrust: 'medium' })).toBe(true)
  })
})
