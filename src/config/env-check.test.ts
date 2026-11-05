import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkEnv, isApiMock } from './env-check'

const real = (VITE_API_BASE_URL?: string) => checkEnv({ VITE_API_MOCK: 'false', VITE_API_BASE_URL })

describe('isApiMock', () => {
  it('is on unless VITE_API_MOCK is exactly "false"', () => {
    expect(isApiMock(undefined)).toBe(true)
    expect(isApiMock('')).toBe(true)
    expect(isApiMock('true')).toBe(true)
    expect(isApiMock('false')).toBe(false)
  })
})

describe('checkEnv: VITE_API_MOCK', () => {
  it('accepts unset, empty, "true" and "false"', () => {
    for (const value of [undefined, '', 'true']) {
      expect(checkEnv({ VITE_API_MOCK: value })).toEqual({ apiMock: true, errors: [], warnings: [] })
    }
    expect(checkEnv({ VITE_API_MOCK: 'false', VITE_API_BASE_URL: '/api' })).toEqual({
      apiMock: false,
      errors: [],
      warnings: [],
    })
  })

  it('rejects anything else, quoting the value', () => {
    for (const value of ['TRUE', 'False', 'yes', '0', 'off', 'flase', 'false ']) {
      const report = checkEnv({ VITE_API_MOCK: value, VITE_API_BASE_URL: '/api' })
      expect(report.errors, value).toHaveLength(1)
      expect(report.errors[0]).toContain('VITE_API_MOCK')
      expect(report.errors[0]).toContain(JSON.stringify(value))
    }
  })

  it('ignores the base URL in mock mode', () => {
    expect(checkEnv({ VITE_API_MOCK: 'true', VITE_API_BASE_URL: 'not a url' }).errors).toEqual([])
  })
})

describe('checkEnv: VITE_API_BASE_URL with VITE_API_MOCK=false', () => {
  it('requires it', () => {
    for (const value of [undefined, '', '   ']) {
      const { errors } = real(value)
      expect(errors, String(value)).toHaveLength(1)
      expect(errors[0]).toContain('needs VITE_API_BASE_URL')
    }
  })

  it('accepts a same-origin path without warnings', () => {
    expect(real('/api')).toEqual({ apiMock: false, errors: [], warnings: [] })
    expect(real('/ax/api/')).toEqual({ apiMock: false, errors: [], warnings: [] })
  })

  it('accepts an https URL, reminding that another origin needs CSP and CORS', () => {
    const { errors, warnings } = real('https://api.acme.co.kr/v1')
    expect(errors).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('https://api.acme.co.kr')
    expect(warnings[0]).toContain('connect-src')
  })

  it('warns about plain http outside the local machine', () => {
    expect(real('http://10.0.0.5:8080').warnings.some((w) => w.includes('plain http'))).toBe(true)
    expect(real('http://localhost:8080').warnings.some((w) => w.includes('plain http'))).toBe(false)
    expect(real('http://127.0.0.1:8080').warnings.some((w) => w.includes('plain http'))).toBe(false)
  })

  it.each([
    ['no scheme', 'api.acme.co.kr', 'is not a URL'],
    ['protocol-relative', '//api.acme.co.kr', 'is not a URL'],
    ['another scheme', 'ftp://api.acme.co.kr', 'http(s) URL'],
    ['a scheme-like host', 'localhost:8080', 'http(s) URL'],
    ['a query string', 'https://api.acme.co.kr/?v=1', 'query string'],
    ['a fragment', 'https://api.acme.co.kr/#x', 'query string'],
    ['a query on a path', '/api?v=1', '"?" or "#"'],
    ['surrounding spaces', ' /api', 'spaces'],
    ['the .env.example placeholder', 'https://api.example.internal', 'placeholder'],
    ['a reserved example domain', 'https://example.com/api', 'placeholder'],
    ['an .invalid host', 'https://backend.invalid', 'placeholder'],
  ])('rejects %s', (_, value, message) => {
    const { errors } = real(value)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(message)
  })

  it('rejects credentials without echoing them', () => {
    const { errors } = real('https://svc:fake-secret@api.acme.co.kr')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('user name or password')
    expect(errors[0]).not.toContain('fake-secret')
  })

  it('never quotes what may be a secret in any message', () => {
    for (const value of [
      'svc:fake-secret@api.acme.co.kr',
      'ftp://svc:fake-secret@api',
      '/api?key=fake-secret',
      ' /api#fake-secret',
    ]) {
      const { errors } = real(value)
      expect(errors, value).toHaveLength(1)
      expect(errors[0]).not.toContain('fake-secret')
    }
    expect(real('/api?key=fake-secret').errors[0]).toContain('"/api?…"')
  })
})

describe('.env.example', () => {
  it('builds as it is (mock mode)', () => {
    const text = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8')
    const values = Object.fromEntries(
      text
        .split('\n')
        .map((line) => /^(VITE_\w+)=(.*)$/.exec(line.trim()))
        .filter((m) => m !== null)
        .map((m) => [m[1]!, m[2]!] as const),
    )
    expect(values.VITE_API_MOCK).toBe('true')
    expect(checkEnv(values).errors).toEqual([])
  })
})
