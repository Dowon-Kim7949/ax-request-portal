import { afterEach, describe, expect, it } from 'vitest'
import { appConfig } from '@/config/app.config'
import type { Role } from '@/domain/model'
import { parseInAppPath, resolvePostLoginPath } from './post-login'

const as = (role: Role) => ({ role })
const configured = appConfig.rolePermissions

afterEach(() => {
  appConfig.rolePermissions = configured
})

describe('parseInAppPath', () => {
  it('accepts a path on this site only', () => {
    expect(parseInAppPath('/requests?status=open#top')?.pathname).toBe('/requests')
    expect(parseInAppPath('//evil.example')).toBeNull()
    expect(parseInAppPath('https://evil.example/requests')).toBeNull()
  })
})

describe('resolvePostLoginPath', () => {
  it('keeps an in-app page the new user may open, with its query and hash', () => {
    expect(resolvePostLoginPath('/requests?status=open#top', as('requester'))).toBe(
      '/requests?status=open#top',
    )
    expect(resolvePostLoginPath('/requests/1017', as('requester'))).toBe('/requests/1017')
    expect(resolvePostLoginPath('/admin/users', as('admin'))).toBe('/admin/users')
    expect(resolvePostLoginPath('/ops/budget', as('operator'))).toBe('/ops/budget')
    expect(resolvePostLoginPath('/', as('operator'))).toBe('/')
  })

  it.each([
    ['missing', null],
    ['empty', ''],
    ['relative', 'requests'],
    ['another site', 'https://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['backslash after the slash', '/\\evil.example'],
    ['backslash inside', '/requests\\..\\admin'],
    ['line feed', '/requests\n'],
    ['tab', '/req\tuests'],
    ['NUL', '/\u0000'],
    ['DEL', '/\u007f'],
    ['the login screen', '/login'],
    ['the login screen with a query', '/login?next=/requests'],
    ['the login screen, other spelling', '/LOGIN/'],
    ['the login screen, percent-encoded', '/%6Cogin'],
    ['a page that does not exist', '/no-such-page'],
    ['a page below an existing one', '/requests/1017/extra'],
  ])('sends home for %s', (_, next) => {
    expect(resolvePostLoginPath(next, as('admin'))).toBe('/')
  })

  it('sends home when the new user may not open the page', () => {
    expect(resolvePostLoginPath('/admin/users', as('requester'))).toBe('/')
    expect(resolvePostLoginPath('/requests', as('operator'))).toBe('/')
    expect(resolvePostLoginPath('/ops/budget', as('admin'))).toBe('/')
    // Checked on the normalized path, which is where the browser would go.
    expect(resolvePostLoginPath('/requests/../admin/users', as('requester'))).toBe('/')
    expect(resolvePostLoginPath('/admin/users', null)).toBe('/')
  })

  it('follows an old address to where it moved, with that page’s permission', () => {
    expect(resolvePostLoginPath('/admin/budget', as('operator'))).toBe('/ops/budget')
    expect(resolvePostLoginPath('/admin/budget', as('admin'))).toBe('/')
    expect(resolvePostLoginPath('/settings/notifications', as('requester'))).toBe('/settings')
  })

  it('reads the permissions configured in app.config, like useCan', () => {
    expect(resolvePostLoginPath('/dashboard', as('requester'))).toBe('/')
    appConfig.rolePermissions = { ...configured, requester: [...configured.requester, 'dashboard:view'] }
    expect(resolvePostLoginPath('/dashboard', as('requester'))).toBe('/dashboard')
    appConfig.rolePermissions = { ...configured, executive: ['request:read:own'] }
    expect(resolvePostLoginPath('/dashboard', as('executive'))).toBe('/')
  })
})
