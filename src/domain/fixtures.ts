/** Small builders shared by unit tests. Not used by the app. */
import type { FeasibilityReport, Project, RequestStatus, User, WorkRequest } from './model'

export function user(id: string, role: User['role']): User {
  return { id, name: id, email: `${id}@example.com`, role, active: true }
}

export const people = {
  requester: user('req', 'requester'),
  otherRequester: user('req2', 'requester'),
  executive: user('exec', 'executive'),
  owner: user('dev', 'developer'),
  otherDeveloper: user('dev2', 'developer'),
  admin: user('admin', 'admin'),
}

export const project: Pick<Project, 'ownerIds'> = { ownerIds: [people.owner.id] }

export function request(
  status: RequestStatus = 'submitted',
  overrides: Partial<WorkRequest> = {},
): WorkRequest {
  const at = '2026-10-27T01:00:00.000Z'
  return {
    id: 1024,
    title: '로그인 5회 실패 시 안내 문구 추가',
    projectId: 'p-portal',
    type: 'change',
    targetIds: ['t-login'],
    currentBehavior: '비밀번호를 틀려도 안내가 없다',
    desiredBehavior: '5회 틀리면 10분 후 다시 시도 안내가 보인다',
    acceptanceCriteria: [
      { id: 'c1', text: '비밀번호를 5번 틀리면 10분 후 다시 시도 안내가 보인다' },
      { id: 'c2', text: '로그인하면 첫 화면이 대시보드로 열린다' },
    ],
    attachments: [],
    requesterId: people.requester.id,
    status,
    createdAt: at,
    updatedAt: at,
    precheck: [],
    regression: [],
    verification: [],
    timeline: [],
    ...overrides,
  }
}

export function report(overrides: Partial<FeasibilityReport> = {}): FeasibilityReport {
  return {
    revision: 1,
    generatedAt: '2026-10-27T01:10:00.000Z',
    verdict: 'feasible',
    summary: '바로 작업할 수 있습니다.',
    evidence: { wikiDocs: [], codeFiles: [] },
    impact: { changedScreens: [], recheck: [] },
    plan: [],
    verification: [],
    openQuestions: [],
    assumptions: [],
    constraintChecks: [],
    wikiTrust: 'high',
    size: 'S',
    risks: [],
    ...overrides,
  }
}
