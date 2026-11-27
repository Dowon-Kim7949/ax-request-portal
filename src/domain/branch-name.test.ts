import { describe, expect, it } from 'vitest'
import { BRANCH_NAME_MAX, BranchName } from './model'

describe('a project branch name', () => {
  it('takes the names teams use', () => {
    for (const name of [
      'main',
      'develop',
      'csap-docker',
      'release/2026.11',
      'feature/notice_search',
      'v1.2',
      'a',
    ]) {
      expect(BranchName.safeParse(name).success, name).toBe(true)
    }
  })

  it('trims the edges and keeps what is left', () => {
    expect(BranchName.parse('  develop ')).toBe('develop')
  })

  it('refuses what git refuses, and what could read as a command option', () => {
    const refused = [
      '',
      ' ',
      '-delete',
      '/main',
      'main/',
      '.hidden',
      'feature/.hidden',
      'main.',
      'a..b',
      'a//b',
      'a@{1}',
      '@',
      'main.lock',
      'main.lock/x',
      'with space',
      'tab\there',
      'a~1',
      'a^',
      'a:b',
      'a?',
      'a*',
      'a[b',
      'a\\b',
      'x'.repeat(BRANCH_NAME_MAX + 1),
    ]
    for (const name of refused) expect(BranchName.safeParse(name).success, JSON.stringify(name)).toBe(false)
  })
})
