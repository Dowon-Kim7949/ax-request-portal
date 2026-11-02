import { afterAll, describe, expect, it } from 'vitest'
import { addDays, formatDate, formatKrw, formatMonth, formatRelative } from '../lib/format'
import en from './en'
import i18n from './index'
import ko from './ko'
import { detectLocale } from './locales'

const HANGUL = /[가-힣]/

function flatten(obj: object, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else Object.assign(out, flatten(v as object, key))
  }
  return out
}

const KO = flatten(ko)
const EN = flatten(en)

describe('dictionaries', () => {
  it('have exactly the same keys', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(KO).sort())
  })

  it('have no empty strings', () => {
    expect(Object.entries(EN).filter(([, v]) => !v.trim())).toEqual([])
    expect(Object.entries(KO).filter(([, v]) => !v.trim())).toEqual([])
  })

  it('keep the same interpolation variables in every key', () => {
    const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
    const mismatched = Object.keys(KO).filter((k) => vars(KO[k]!).join() !== vars(EN[k]!).join())
    expect(mismatched).toEqual([])
  })

  it('English contains no Korean text', () => {
    expect(Object.entries(EN).filter(([, v]) => HANGUL.test(v))).toEqual([])
  })
})

describe('language detection', () => {
  it('takes the first supported browser language', () => {
    expect(detectLocale(['en-US', 'ko'], ['ko', 'en'])).toBe('en')
    expect(detectLocale(['fr-FR', 'ko-KR'], ['ko', 'en'])).toBe('ko')
    expect(detectLocale(['fr-FR'], ['ko', 'en'])).toBeUndefined()
    expect(detectLocale(['en-GB'], ['ko'])).toBeUndefined()
  })
})

describe('formatting follows the UI language', () => {
  afterAll(() => i18n.changeLanguage('ko'))

  it('formats in Korean', async () => {
    await i18n.changeLanguage('ko')
    expect(formatKrw(184_000)).toBe('18.4만 원')
    expect(formatKrw(9_800)).toBe('9,800원')
    expect(formatMonth('2026-10')).toBe('2026년 10월')
    expect(formatDate('2026-11-06')).toMatch(/11월 6일/)
    expect(formatRelative(new Date().toISOString())).toBe('방금 전')
  })

  it('formats in English', async () => {
    await i18n.changeLanguage('en')
    expect(formatKrw(184_000)).toBe('₩184K')
    expect(formatKrw(9_800)).toBe('₩9,800')
    expect(formatMonth('2026-10')).toBe('October 2026')
    expect(formatDate('2026-11-06')).toBe('Fri, Nov 6')
    expect(formatRelative(new Date().toISOString())).toBe('just now')
    expect(formatRelative(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe('3 hours ago')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
