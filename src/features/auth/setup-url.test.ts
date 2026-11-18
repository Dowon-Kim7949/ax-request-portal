import { describe, expect, it } from 'vitest'
import { setupUrl, tokenFromHash } from './setup-url'

describe('setup links', () => {
  it('put the token in the fragment of /setup, under the app base', () => {
    expect(setupUrl('abc', 'https://portal.example', '/')).toBe('https://portal.example/setup#token=abc')
    expect(setupUrl('abc', 'https://portal.example', '/ax/')).toBe(
      'https://portal.example/ax/setup#token=abc',
    )
    expect(setupUrl('a+b/c=', 'https://portal.example', '/')).toBe(
      'https://portal.example/setup#token=a%2Bb%2Fc%3D',
    )
  })

  it('read the token back from the fragment', () => {
    expect(tokenFromHash('#token=abc')).toBe('abc')
    expect(tokenFromHash('#token=a%2Bb%2Fc%3D')).toBe('a+b/c=')
    expect(tokenFromHash(new URL(setupUrl('x y', 'https://portal.example', '/')).hash)).toBe('x y')
    expect(tokenFromHash('')).toBe('')
    expect(tokenFromHash('#other=1')).toBe('')
  })
})
