/**
 * The mock backend answers in the request's language and can seed demo data
 * in either language — the same contract a real backend has.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiError, call, configureClient } from '../api/client'
import { api } from '../api/contract'
import { Project, User, WorkRequest } from '../domain/model'
import { looksLikeAcceptanceCriterion, precheckDraft } from '../domain/precheck'
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/roles'
import { createTestApi } from '../test/mock-api'
import { errorText, renderNotification, serverLanguage } from './copy'
import { buildSeedState, DEMO_PASSWORD } from './seed'

const HANGUL = /[가-힣]/
const NOW = new Date('2026-11-02T03:00:00.000Z')
const OPTS = { reportSeconds: 6, workSeconds: 20, rolePermissions: DEFAULT_ROLE_PERMISSIONS }

describe('server copy', () => {
  it('parses Accept-Language', () => {
    expect(serverLanguage('en-US,en;q=0.9')).toBe('en')
    expect(serverLanguage('ko-KR')).toBe('ko')
    expect(serverLanguage('fr-FR, en;q=0.5')).toBe('en')
    expect(serverLanguage(null)).toBe('ko')
  })

  it('has every error and notification in both languages', () => {
    expect(errorText('en', 'requestNotFound', { id: 7 })).toBe('Request #7 was not found.')
    expect(errorText('ko', 'requestNotFound', { id: 7 })).toBe('요청 #7을 찾을 수 없습니다.')
    expect(renderNotification('en', 'pleaseCheck', { count: 2 }, 9)).toEqual({
      title: '[#9] Please check the result',
      body: 'Check the 2 acceptance criteria one by one.',
    })
  })
})

describe('English demo data', () => {
  const state = buildSeedState(NOW, OPTS, 'en')

  it('conforms to the API contract', () => {
    for (const u of state.users) expect(User.safeParse(u).error).toBeUndefined()
    for (const p of state.projects) expect(Project.safeParse(p).error).toBeUndefined()
    for (const r of state.requests) expect(WorkRequest.safeParse(r).error, `#${r.id}`).toBeUndefined()
  })

  it('contains no Korean text anywhere', () => {
    const hits = JSON.stringify(state).match(new RegExp(HANGUL.source + '+', 'g')) ?? []
    expect(hits).toEqual([])
  })

  it('has the same shape as the Korean data', () => {
    const ko = buildSeedState(NOW, OPTS, 'ko')
    expect(state.requests.map((r) => [r.id, r.status])).toEqual(ko.requests.map((r) => [r.id, r.status]))
    expect(state.language).toBe('en')
    expect(state.dirty).toBe(false)
  })
})

describe('English submission check', () => {
  const draft = {
    projectId: 'p-portal',
    type: 'change' as const,
    title: 'Search notices',
    targetIds: ['t-notice'],
    currentBehavior: 'There are many notices and they are hard to find',
    desiredBehavior: 'Make search somehow nicer',
    acceptanceCriteria: [
      { text: 'When I type a word, only notices with it in the title are shown' },
      { text: 'Faster' },
    ],
    attachmentIds: [],
  }

  it('flags vague English and checks the "when X, Y" form', () => {
    const issues = precheckDraft(draft, '2026-11-02', 'en')
    expect(issues.map((i) => `${i.field}:${i.severity}`)).toEqual([
      'desiredBehavior:warning',
      'acceptanceCriteria.1:info',
    ])
    expect(issues[0]?.message).toMatch(/^Words like "somehow"/)
    expect(issues.every((i) => !HANGUL.test(i.message))).toBe(true)
  })

  it.each([
    ['When I sign in, the dashboard opens first', true],
    ['If the upload fails, a retry button is shown', true],
    ['Better dashboard', false],
  ])('%s → %s', (text, expected) => {
    expect(looksLikeAcceptanceCriterion(text)).toBe(expected)
  })
})

describe('API in English', () => {
  const t = createTestApi()
  let token: string | null = null
  configureClient({ getToken: () => token, onUnauthorized: () => {}, getLanguage: () => 'en' })
  beforeAll(() => t.server.listen({ onUnhandledFrame: 'error' }))
  afterAll(() => {
    t.server.close()
    configureClient({ getToken: () => null, onUnauthorized: () => {} })
  })

  it('returns English errors and notifications', async () => {
    const err = await call(api.login, { body: { email: 'planner@example.com', password: 'nope' } }).catch(
      (e) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe('The email or password is incorrect.')

    token = (await call(api.login, { body: { email: 'planner@example.com', password: DEMO_PASSWORD } })).token
    const notes = await call(api.listNotifications)
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.every((n) => !HANGUL.test(n.title))).toBe(true)

    const missing = await call(api.getRequest, { params: { id: 99_999 } }).catch((e) => e)
    expect((missing as ApiError).message).toBe('Request #99999 was not found.')
  })
})
