/**
 * Fictional demo data in Korean and English. Every name, project, repository
 * and e-mail here is made up. The structure (ids, who does what, when) is
 * shared; only the words differ per language. Requests are produced by
 * running the real lifecycle through the engine, so the seed can never
 * contain a state the rules would not allow.
 */
import type { TransitionCommand } from '../domain/lifecycle'
import type { NotificationSettings, Project, RequestDraft, User, WorkRequest } from '../domain/model'
import { DEFAULT_AI_PRICING, DEFAULT_AI_SELECTIONS } from '../config/ai'
import type { ServerLanguage } from './copy'
import {
  addDays,
  DEFAULT_NOTIFICATION_SETTINGS,
  MockEngine,
  STATE_VERSION,
  type EngineOptions,
  type MockState,
} from './engine'

export const DEMO_PASSWORD = 'demo'

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

const USERS: Array<Pick<User, 'id' | 'email' | 'role'>> = [
  { id: 'u-kim', email: 'planner@example.com', role: 'requester' },
  { id: 'u-lee', email: 'sales@example.com', role: 'requester' },
  { id: 'u-park', email: 'ceo@example.com', role: 'executive' },
  { id: 'u-choi', email: 'dev1@example.com', role: 'developer' },
  { id: 'u-jung', email: 'dev2@example.com', role: 'developer' },
  { id: 'u-han', email: 'admin@example.com', role: 'admin' },
  { id: 'u-yoon', email: 'operator@example.com', role: 'operator' },
]

const USER_COPY: Record<ServerLanguage, Record<string, { name: string; team: string }>> = {
  ko: {
    'u-kim': { name: '김기획', team: '기획팀' },
    'u-lee': { name: '이영업', team: '영업팀' },
    'u-park': { name: '박대표', team: '경영' },
    'u-choi': { name: '최개발', team: '개발팀' },
    'u-jung': { name: '정개발', team: '개발팀' },
    'u-han': { name: '한운영', team: '운영팀' },
    'u-yoon': { name: '윤시스템', team: '플랫폼팀' },
  },
  en: {
    'u-kim': { name: 'Mina Kim', team: 'Planning' },
    'u-lee': { name: 'Leo Lee', team: 'Sales' },
    'u-park': { name: 'Daniel Park', team: 'Management' },
    'u-choi': { name: 'Chris Choi', team: 'Engineering' },
    'u-jung': { name: 'Sam Jung', team: 'Engineering' },
    'u-han': { name: 'Hana Han', team: 'Operations' },
    'u-yoon': { name: 'Yuna Yoon', team: 'Platform' },
  },
}

/** One demo account per role, shown on the login screen in mock mode. */
export const DEMO_ACCOUNT_IDS = ['u-kim', 'u-park', 'u-choi', 'u-han', 'u-yoon'] as const

export function seedUsers(lang: ServerLanguage): User[] {
  return USERS.map((u) => ({ ...u, ...USER_COPY[lang][u.id]!, active: true }))
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

type ProjectBase = Omit<Project, 'name' | 'description' | 'targets' | 'constraints'> & {
  targets: Array<{ id: string; wikiDoc?: string }>
  /** Ids of the project rules; the words are in CONSTRAINT_COPY */
  constraints: string[]
}

const PROJECTS: ProjectBase[] = [
  {
    id: 'p-portal',
    constraints: ['pc-storage', 'pc-masking'],
    icon: 'globe',
    repository: { provider: 'gitlab', url: 'https://gitlab.example.com/acme/customer-portal' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 18, totalDocs: 20, lastSyncedAt: '2026-10-30T09:00:00.000Z' },
    ownerIds: ['u-choi'],
    active: true,
    targets: [
      { id: 't-login', wikiDoc: 'domains/auth/login.md' },
      { id: 't-password-reset', wikiDoc: 'domains/auth/password-reset.md' },
      { id: 't-auto-login', wikiDoc: 'domains/auth/auto-login.md' },
      { id: 't-signup', wikiDoc: 'domains/auth/signup.md' },
      { id: 't-mypage', wikiDoc: 'domains/account/mypage.md' },
      { id: 't-notice', wikiDoc: 'domains/board/notice.md' },
      { id: 't-payments', wikiDoc: 'domains/billing/payments.md' },
    ],
  },
  {
    id: 'p-field',
    constraints: ['pc-offline'],
    icon: 'smartphone',
    repository: { provider: 'github', url: 'https://github.com/acme/field-worker-app' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 9, totalDocs: 14, lastSyncedAt: '2026-10-28T09:00:00.000Z' },
    ownerIds: ['u-jung'],
    active: true,
    targets: [
      { id: 't-task-list', wikiDoc: 'domains/tasks/list.md' },
      { id: 't-task-detail', wikiDoc: 'domains/tasks/detail.md' },
      { id: 't-photo', wikiDoc: 'domains/media/photo-upload.md' },
      { id: 't-offline', wikiDoc: 'domains/sync/offline.md' },
      { id: 't-push' },
    ],
  },
  {
    id: 'p-admin',
    constraints: ['pc-audit'],
    icon: 'layout-dashboard',
    repository: { provider: 'gitlab', url: 'https://gitlab.example.com/acme/admin-console' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 12, totalDocs: 12, lastSyncedAt: '2026-10-31T09:00:00.000Z' },
    ownerIds: ['u-choi', 'u-jung'],
    active: true,
    targets: [
      { id: 't-users', wikiDoc: 'domains/users.md' },
      { id: 't-stats', wikiDoc: 'domains/stats.md' },
      { id: 't-roles', wikiDoc: 'domains/roles.md' },
      { id: 't-announce', wikiDoc: 'domains/announce.md' },
    ],
  },
  {
    id: 'p-data',
    constraints: [],
    icon: 'server',
    repository: { provider: 'github', url: 'https://github.com/acme/analytics-server' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 3, totalDocs: 10, lastSyncedAt: '2026-10-20T09:00:00.000Z' },
    ownerIds: ['u-jung'],
    active: true,
    targets: [
      { id: 't-report-api', wikiDoc: 'domains/report-api.md' },
      { id: 't-batch', wikiDoc: 'domains/batch.md' },
      { id: 't-export', wikiDoc: 'domains/export.md' },
    ],
  },
]

const PROJECT_COPY: Record<
  ServerLanguage,
  Record<string, { name: string; description: string; targets: Record<string, string> }>
> = {
  ko: {
    'p-portal': {
      name: '고객 포털 웹',
      description: '고객이 로그인해 계약·결제·공지를 확인하는 웹 서비스',
      targets: {
        't-login': '로그인',
        't-password-reset': '비밀번호 재설정',
        't-auto-login': '자동 로그인',
        't-signup': '회원가입',
        't-mypage': '마이페이지',
        't-notice': '공지사항',
        't-payments': '결제 내역',
      },
    },
    'p-field': {
      name: '현장 작업자 앱',
      description: '현장 작업자가 작업 지시를 받고 사진으로 결과를 올리는 모바일 앱',
      targets: {
        't-task-list': '작업 목록',
        't-task-detail': '작업 상세',
        't-photo': '사진 업로드',
        't-offline': '오프라인 동기화',
        't-push': '푸시 알림',
      },
    },
    'p-admin': {
      name: '관리자 대시보드',
      description: '운영팀이 사용자·권한·통계를 관리하는 내부 화면',
      targets: {
        't-users': '사용자 관리',
        't-stats': '통계',
        't-roles': '권한 설정',
        't-announce': '공지 작성',
      },
    },
    'p-data': {
      name: '데이터 분석 서버',
      description: '리포트 API와 야간 배치를 제공하는 백엔드',
      targets: { 't-report-api': '리포트 API', 't-batch': '배치 작업', 't-export': '데이터 내보내기' },
    },
  },
  en: {
    'p-portal': {
      name: 'Customer Portal',
      description: 'Web service where customers sign in to see contracts, payments and notices',
      targets: {
        't-login': 'Sign-in',
        't-password-reset': 'Password reset',
        't-auto-login': 'Auto sign-in',
        't-signup': 'Sign-up',
        't-mypage': 'My page',
        't-notice': 'Notices',
        't-payments': 'Payment history',
      },
    },
    'p-field': {
      name: 'Field Worker App',
      description: 'Mobile app where field workers receive jobs and report results with photos',
      targets: {
        't-task-list': 'Job list',
        't-task-detail': 'Job detail',
        't-photo': 'Photo upload',
        't-offline': 'Offline sync',
        't-push': 'Push notifications',
      },
    },
    'p-admin': {
      name: 'Admin Console',
      description: 'Internal screens where operations manage users, permissions and statistics',
      targets: {
        't-users': 'User management',
        't-stats': 'Statistics',
        't-roles': 'Permissions',
        't-announce': 'Announcements',
      },
    },
    'p-data': {
      name: 'Analytics Server',
      description: 'Backend serving the report API and nightly batches',
      targets: { 't-report-api': 'Report API', 't-batch': 'Batch jobs', 't-export': 'Data export' },
    },
  },
}

const CONSTRAINT_COPY: Record<ServerLanguage, Record<string, { text: string; reference: string }>> = {
  ko: {
    'pc-storage': {
      text: '인증 정보와 개인정보는 브라우저 저장소(localStorage·sessionStorage)에 두지 않는다',
      reference: '보안 정책 3.2',
    },
    'pc-masking': {
      text: '고객 이름과 연락처는 화면에 가려서(마스킹) 보여 준다',
      reference: '개인정보 처리 지침 5조',
    },
    'pc-offline': {
      text: '통신이 끊겨도 작업 완료를 기록할 수 있어야 한다',
      reference: '현장 운영 요건',
    },
    'pc-audit': {
      text: '사용자나 권한을 바꾸는 동작은 모두 감사 로그를 남긴다',
      reference: '내부 통제 기준 2.1',
    },
  },
  en: {
    'pc-storage': {
      text: 'Never keep credentials or personal data in browser storage (localStorage, sessionStorage)',
      reference: 'Security policy 3.2',
    },
    'pc-masking': {
      text: 'Show customer names and phone numbers masked on screen',
      reference: 'Privacy guideline art. 5',
    },
    'pc-offline': {
      text: 'Workers must be able to record a finished job without a connection',
      reference: 'Field operations requirement',
    },
    'pc-audit': {
      text: 'Every change to users or permissions writes an audit log entry',
      reference: 'Internal control 2.1',
    },
  },
}

function seedProjects(lang: ServerLanguage): Project[] {
  return PROJECTS.map((p) => {
    const c = PROJECT_COPY[lang][p.id]!
    return {
      ...structuredClone(p),
      name: c.name,
      description: c.description,
      targets: p.targets.map((t) => ({ ...t, name: c.targets[t.id]! })),
      constraints: p.constraints.map((id) => ({ id, ...CONSTRAINT_COPY[lang][id]! })),
    }
  })
}

/* ------------------------------------------------------------------ */
/* Scenarios: structure shared, words per language                     */
/* ------------------------------------------------------------------ */

type Step =
  /** Let the running AI job (report or work) finish at this time */
  | { h: number; ai: true }
  | { h: number; by: string; command: TransitionCommand }
  | { h: number; by: string; release: string | number }

interface ScenarioCopy {
  title: string
  current: string
  desired: string
  criteria: string[]
  targetOther?: string
  outOfScope?: string
  dateReason?: string
  checklistSource?: string
  checklist?: RequestDraft['checklist']
  questions?: string[]
  answer?: string
  reason?: string
  memo?: string
  issueNote?: string
}

interface Scenario {
  by: string
  /** Hours before seeding when the request was filed */
  h: number
  projectId: string
  type: RequestDraft['type']
  targetIds: string[]
  /** Days relative to today, e.g. -3 or 10 */
  desiredInDays?: number
  steps?: (c: ScenarioCopy) => Step[]
  /** Final touch-ups to match a showcase screen exactly */
  patch?: (r: WorkRequest, lang: ServerLanguage) => WorkRequest
}

const passAll = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ criterionId: `c${i + 1}`, result: 'passed' as const }))

/** The requester confirms the AI's reading (choices left out are filled in by `withDefaults`). */
const approve = (requester: string, h: number): Step => ({
  h,
  by: requester,
  command: { event: 'approveScope', choices: [] },
})

/** report → scope confirmed → run work → AI done → approve → requester confirms → released */
function shipped(
  dev: string,
  requester: string,
  start: number,
  criteria: number,
  releasedAfterDays = 3,
): Step[] {
  const t = (offset: number) => start - offset
  return [
    { h: t(1), ai: true },
    approve(requester, t(4)),
    { h: t(16), by: dev, command: { event: 'runWork' } },
    { h: t(17), ai: true },
    { h: t(20), by: dev, command: { event: 'approveMerge' } },
    { h: t(30), by: requester, command: { event: 'confirmResult', checks: passAll(criteria) } },
    // release date = the day it actually shipped, as an offset from today
    { h: t(31), by: dev, release: -Math.floor((start - releasedAfterDays * 24) / 24) },
    { h: t(releasedAfterDays * 24), by: dev, command: { event: 'markReleased' } },
  ]
}

/** Same order as SCENARIO_COPY. Ids are assigned from 1012 in this order. */
const SCENARIOS: Scenario[] = [
  /* 1012 */ {
    by: 'u-kim',
    h: 24 * 30,
    projectId: 'p-portal',
    type: 'new_feature',
    targetIds: ['t-notice'],
    steps: () => shipped('u-choi', 'u-kim', 24 * 30, 2, 9),
  },
  /* 1013 */ {
    by: 'u-lee',
    h: 24 * 25,
    projectId: 'p-field',
    type: 'change',
    targetIds: ['t-photo'],
    steps: () => shipped('u-jung', 'u-lee', 24 * 25, 1, 12),
  },
  /* 1014 */ {
    by: 'u-kim',
    h: 24 * 18,
    projectId: 'p-admin',
    type: 'change',
    targetIds: ['t-stats'],
    steps: () => shipped('u-choi', 'u-kim', 24 * 18, 1, 11),
  },
  /* 1015 */ {
    by: 'u-lee',
    h: 24 * 14,
    projectId: 'p-portal',
    type: 'new_feature',
    targetIds: ['t-payments'],
    steps: () => shipped('u-choi', 'u-lee', 24 * 14, 1, 12),
  },
  /* 1016 */ {
    by: 'u-lee',
    h: 24 * 12,
    projectId: 'p-portal',
    type: 'non_code',
    targetIds: [],
    steps: (c) => [
      { h: 24 * 12 - 1, ai: true },
      { h: 24 * 11, by: 'u-choi', command: { event: 'reject', reason: c.reason! } },
    ],
  },
  /* 1017 */ {
    by: 'u-kim',
    h: 24 * 10,
    projectId: 'p-admin',
    type: 'new_feature',
    targetIds: ['t-stats'],
    desiredInDays: -3,
    steps: () => [
      { h: 24 * 10 - 1, ai: true },
      approve('u-kim', 24 * 10 - 3),
      { h: 24 * 9, by: 'u-choi', command: { event: 'runWork' } },
      { h: 24 * 9 - 1, ai: true },
      { h: 24 * 8, by: 'u-choi', command: { event: 'approveMerge' } },
    ],
  },
  /* 1018 */ {
    by: 'u-lee',
    h: 24 * 9,
    projectId: 'p-data',
    type: 'bug',
    targetIds: ['t-export'],
    steps: (c) => [
      { h: 24 * 9 - 1, ai: true },
      { h: 24 * 8, by: 'u-lee', command: { event: 'cancel', reason: c.reason! } },
    ],
  },
  /* 1019 */ {
    by: 'u-kim',
    h: 24 * 8,
    projectId: 'p-portal',
    type: 'change',
    targetIds: ['t-payments'],
    steps: () => [
      { h: 24 * 8 - 1, ai: true },
      approve('u-kim', 24 * 8 - 3),
      { h: 24 * 7, by: 'u-choi', command: { event: 'runWork' } },
      { h: 24 * 7 - 1, ai: true },
      { h: 24 * 6, by: 'u-choi', command: { event: 'approveMerge' } },
      { h: 24 * 4, by: 'u-kim', command: { event: 'confirmResult', checks: passAll(1) } },
      { h: 24 * 3, by: 'u-choi', release: 1 },
    ],
  },
  /* 1020 */ {
    by: 'u-lee',
    h: 24 * 7,
    projectId: 'p-field',
    type: 'bug',
    targetIds: ['t-offline'],
    steps: () => [
      { h: 24 * 7 - 1, ai: true },
      approve('u-lee', 24 * 7 - 3),
      { h: 24 * 6, by: 'u-jung', command: { event: 'runWork' } },
      { h: 24 * 6 - 1, ai: true },
      { h: 24 * 5, by: 'u-jung', command: { event: 'approveMerge' } },
      { h: 24 * 3, by: 'u-lee', command: { event: 'confirmResult', checks: passAll(1) } },
      { h: 24 * 2, by: 'u-jung', release: 3 },
    ],
  },
  /* 1021 */ {
    by: 'u-kim',
    h: 24 * 5,
    projectId: 'p-portal',
    type: 'copy_design',
    targetIds: ['t-mypage'],
    steps: () => [
      { h: 24 * 5 - 1, ai: true },
      approve('u-kim', 24 * 5 - 3),
      { h: 24 * 4, by: 'u-choi', command: { event: 'runWork' } },
      { h: 24 * 4 - 1, ai: true },
      { h: 24 * 2, by: 'u-choi', command: { event: 'approveMerge' } },
    ],
  },
  /* 1022 */ {
    by: 'u-lee',
    h: 24 * 4,
    projectId: 'p-data',
    type: 'change',
    targetIds: ['t-report-api'],
    steps: (c) => [
      { h: 24 * 4 - 1, ai: true },
      approve('u-lee', 24 * 4 - 3),
      { h: 24 * 3, by: 'u-jung', command: { event: 'requestInfo', questions: c.questions! } },
    ],
  },
  /* 1023 */ {
    by: 'u-lee',
    h: 24 * 4 - 2,
    projectId: 'p-field',
    type: 'new_feature',
    targetIds: ['t-task-list'],
    steps: (c) => [
      { h: 24 * 4 - 3, ai: true },
      approve('u-lee', 24 * 4 - 5),
      { h: 24 * 3, by: 'u-jung', command: { event: 'runWork' } },
      { h: 24 * 3 - 1, ai: true },
      { h: 24 * 2, by: 'u-jung', command: { event: 'approveMerge' } },
      {
        h: 24,
        by: 'u-lee',
        command: {
          event: 'reportIssue',
          checks: [
            { criterionId: 'c1', result: 'passed' },
            { criterionId: 'c2', result: 'failed', note: c.issueNote! },
          ],
        },
      },
    ],
  },
  /* 1024: the showcase work-detail screen (MR !57, 128 tests) */ {
    by: 'u-kim',
    h: 24 * 3,
    projectId: 'p-portal',
    type: 'change',
    targetIds: ['t-login', 't-password-reset'],
    desiredInDays: 10,
    steps: (c) => [
      { h: 24 * 3 - 1, ai: true },
      approve('u-kim', 24 * 3 - 2),
      { h: 24 * 2 + 6, by: 'u-choi', command: { event: 'requestInfo', questions: c.questions! } },
      { h: 24 * 2, by: 'u-kim', command: { event: 'provideInfo', answer: c.answer! } },
      { h: 24 * 2 - 1, ai: true },
      approve('u-kim', 24 * 2 - 2),
      { h: 24, by: 'u-choi', command: { event: 'runWork', instructions: c.memo! } },
      { h: 23, ai: true },
    ],
    patch: (r, lang) => showcase1024(r, lang),
  },
  /* 1025: AI work running when the demo opens */ {
    by: 'u-kim',
    h: 26,
    projectId: 'p-admin',
    type: 'new_feature',
    targetIds: ['t-roles'],
    steps: () => [
      { h: 25, ai: true },
      approve('u-kim', 24),
      { h: 8 / 3600, by: 'u-choi', command: { event: 'runWork' } },
    ],
  },
  /* 1026: report with an assumption and a constraint conflict */ {
    by: 'u-lee',
    h: 20,
    projectId: 'p-portal',
    type: 'change',
    targetIds: ['t-signup'],
    steps: () => [{ h: 19, ai: true }, approve('u-lee', 18)],
    patch: (r, lang) => showcase1026(r, lang),
  },
  /* 1027: report being written when the demo opens */ {
    by: 'u-kim',
    h: 3 / 3600,
    projectId: 'p-field',
    type: 'new_feature',
    targetIds: ['t-push', 't-task-detail'],
  },
  /* 1028: the AI's reading waits for the requester, with two choices to make */ {
    by: 'u-kim',
    h: 5,
    projectId: 'p-admin',
    type: 'new_feature',
    targetIds: ['t-announce'],
    steps: () => [{ h: 4.9, ai: true }],
  },
  /* 1029: audit findings, checked item by item */ {
    by: 'u-kim',
    h: 30,
    projectId: 'p-portal',
    type: 'checklist',
    targetIds: ['t-login', 't-mypage'],
    desiredInDays: 5,
    steps: () => [
      { h: 29.9, ai: true },
      approve('u-kim', 29),
      { h: 28, by: 'u-choi', command: { event: 'runWork' } },
      { h: 27.9, ai: true },
      { h: 26, by: 'u-choi', command: { event: 'approveMerge' } },
    ],
  },
]

const SCENARIO_COPY: Record<ServerLanguage, ScenarioCopy[]> = {
  ko: [
    {
      title: '공지사항 첨부파일 미리보기',
      current: '첨부파일을 내려받아야만 내용을 볼 수 있다',
      desired: 'PDF와 이미지 첨부는 공지 화면에서 바로 미리 본다',
      criteria: ['PDF 첨부를 누르면 새 창 없이 미리보기가 열린다', '이미지 첨부를 누르면 확대 화면이 열린다'],
    },
    {
      title: '사진 업로드 시 자동 압축',
      current: '고화질 사진은 업로드가 30초 이상 걸린다',
      desired: '올리기 전에 사진 크기를 줄여서 빨리 올라가게 한다',
      criteria: ['10MB 사진을 올리면 2MB 이하로 줄어서 저장된다'],
    },
    {
      title: '통계 화면 날짜 범위 선택',
      current: '통계는 최근 7일만 볼 수 있다',
      desired: '시작일과 종료일을 골라서 본다',
      criteria: ['시작일과 종료일을 고르면 그 기간의 통계가 표시된다'],
    },
    {
      title: '결제 내역 영수증 다운로드',
      current: '영수증이 필요하면 고객센터에 요청해야 한다',
      desired: '결제 내역에서 영수증 PDF를 바로 받는다',
      criteria: ['결제 건의 영수증 버튼을 누르면 PDF가 내려받아진다'],
    },
    {
      title: '영업 제안서용 화면 캡처 요청',
      current: '',
      desired: '제안서에 넣을 주요 화면 캡처 10장이 필요합니다',
      criteria: ['주요 화면 캡처 10장을 받으면 끝난다'],
      reason: '코드 변경이 필요 없는 요청이라 디자인팀에 직접 전달했습니다.',
    },
    {
      title: '통계 화면 엑셀 내보내기',
      current: '통계 수치를 손으로 옮겨 적는다',
      desired: '보고 있는 통계를 엑셀 파일로 내려받는다',
      criteria: ['엑셀 버튼을 누르면 화면과 같은 수치의 xlsx 파일이 내려받아진다'],
      dateReason: '월간 경영 보고',
    },
    {
      title: '데이터 내보내기 CSV 한글 깨짐',
      current: '1. 데이터 내보내기에서 CSV 선택\n2. 엑셀로 열면 한글이 깨진다',
      desired: '엑셀에서 열어도 한글이 정상으로 보인다',
      criteria: ['내보낸 CSV를 엑셀로 열면 한글이 깨지지 않는다'],
      reason: '엑셀 가져오기 기능으로 해결했습니다.',
    },
    {
      title: '결제 내역 날짜 필터',
      current: '결제 내역이 전부 한 목록에 나온다',
      desired: '기간을 골라 결제 내역을 본다',
      criteria: ['기간을 고르면 그 기간의 결제만 목록에 나온다'],
    },
    {
      title: '오프라인 동기화 실패 시 재시도 버튼',
      current: '1. 비행기 모드에서 작업 완료\n2. 온라인이 되어도 동기화 실패 표시만 남는다',
      desired: '실패한 동기화를 다시 시도할 수 있다',
      criteria: ['동기화 실패 표시에서 다시 시도를 누르면 업로드가 다시 진행된다'],
    },
    {
      title: '마이페이지 안내 문구 수정',
      current: '“정보 변경은 고객센터로 문의”라고만 나온다',
      desired: '직접 바꿀 수 있는 항목과 문의가 필요한 항목을 나눠 안내한다',
      criteria: [
        '마이페이지를 열면 직접 바꿀 수 있는 항목 안내가 보인다',
        '문의가 필요한 항목 옆에 고객센터 연결 버튼이 보인다',
      ],
    },
    {
      title: '리포트 API 응답 속도 개선',
      current: '월간 리포트를 열 때 오래 기다린다',
      desired: '좀 빠르게 열렸으면 합니다',
      criteria: ['월간 리포트가 빠르게 열린다'],
      questions: ['어느 리포트가 느린가요? (예: 월간 매출 리포트)', '몇 초 안에 열리면 충분할까요?'],
    },
    {
      title: '작업 목록 정렬 옵션 추가',
      current: '작업 목록이 등록 순서로만 보인다',
      desired: '마감일 순, 거리 순으로 정렬한다',
      criteria: [
        '정렬에서 마감일 순을 고르면 마감이 빠른 작업이 위에 온다',
        '정렬에서 거리 순을 고르면 가까운 작업이 위에 온다',
      ],
      issueNote: '위치 권한을 끄면 거리 순이 아무 반응이 없습니다',
    },
    {
      title: '로그인 5회 실패 시 안내 문구 추가',
      current: '비밀번호를 여러 번 틀려도 아무 안내가 없다',
      desired: '5번 틀리면 잠시 후 다시 시도하라는 안내가 보인다',
      criteria: [
        '비밀번호를 5번 틀리면 ‘10분 후 다시 시도’ 안내가 보인다',
        '로그인하면 첫 화면이 대시보드로 열린다',
      ],
      outOfScope: '비밀번호 정책(길이, 조합) 변경',
      dateReason: '고객사 보안 점검 일정',
      questions: ['잠긴 계정을 관리자가 풀 수 있어야 하나요?'],
      answer: '네, 관리자 화면에서 풀 수 있어야 합니다.',
      memo: '기존 잠금 정책과 겹치지 않게 해 주세요.',
    },
    {
      title: "권한 설정에 '읽기 전용' 역할 추가",
      current: '역할이 관리자와 일반 사용자 두 가지뿐이다',
      desired: '조회만 가능한 읽기 전용 역할을 만들 수 있다',
      criteria: ['읽기 전용 역할로 로그인하면 저장·삭제 버튼이 보이지 않는다'],
    },
    {
      title: '회원가입 약관 동의 화면 개선',
      current: '약관 5개를 하나씩 눌러 동의해야 한다',
      desired: '전체 동의 체크박스로 한 번에 동의할 수 있다',
      criteria: [
        '전체 동의를 누르면 필수와 선택 약관이 모두 체크된다',
        '필수 약관을 하나라도 풀면 가입 버튼이 비활성화된다',
      ],
      targetOther: '약관 전문 팝업',
    },
    {
      title: '푸시 알림 받을 항목 고르기',
      current: '모든 알림이 한꺼번에 온다',
      desired: '작업 배정, 마감 임박, 공지 중 받을 알림을 고른다',
      criteria: ['설정에서 마감 임박을 끄면 마감 임박 알림이 오지 않는다'],
    },
    {
      title: '공지 예약 게시',
      current: '공지는 저장하는 즉시 게시된다',
      desired: '날짜와 시간을 정해 두면 그때 자동으로 게시된다',
      criteria: [
        '게시 시간을 정해 저장하면 그 시간에 공지가 게시된다',
        '예약된 공지는 목록에 예약 표시와 함께 보인다',
      ],
      targetOther: '메인 배너',
    },
    {
      title: '보안 점검 지적 3건 조치',
      current: '',
      desired: '현장평가에서 받은 화면 관련 지적 3건을 기준에 맞게 고친다',
      criteria: [],
      dateReason: '재점검 일정',
      checklistSource: '보안 점검 현장평가',
      checklist: [
        {
          ref: '지적 24',
          clause: '2.3.1',
          finding: '로그인 화면에 개인정보 처리방침 링크가 없다',
          expected: '로그인 화면 아래에 처리방침 링크가 항상 보인다',
        },
        {
          ref: '지적 25',
          clause: '2.5.4',
          finding: '로그인 오류 문구가 아이디가 있는지 없는지를 알려 준다',
          expected: '아이디와 비밀번호 중 무엇이 틀렸는지 구분하지 않는다',
        },
        {
          ref: '지적 27',
          clause: '2.9.2',
          finding: '마이페이지에서 연락처가 그대로 보인다',
          expected: '연락처 가운데 네 자리가 가려져 보인다',
        },
      ],
    },
  ],
  en: [
    {
      title: 'Preview attachments on notices',
      current: 'Attachments have to be downloaded before you can see them',
      desired: 'PDF and image attachments can be previewed right on the notice',
      criteria: [
        'When I tap a PDF attachment, a preview opens without a new window',
        'When I tap an image attachment, a zoomed view opens',
      ],
    },
    {
      title: 'Compress photos before upload',
      current: 'High-resolution photos take more than 30 seconds to upload',
      desired: 'Shrink photos before upload so they go up quickly',
      criteria: ['When I upload a 10 MB photo, it is saved at 2 MB or less'],
    },
    {
      title: 'Date range on the statistics screen',
      current: 'Statistics only show the last 7 days',
      desired: 'Pick a start and end date',
      criteria: ['When I pick a start and end date, statistics for that range are shown'],
    },
    {
      title: 'Download receipts from payment history',
      current: 'Customers have to ask support for a receipt',
      desired: 'Download a PDF receipt straight from payment history',
      criteria: ['When I tap the receipt button on a payment, a PDF downloads'],
    },
    {
      title: 'Screenshots for a sales proposal',
      current: '',
      desired: 'We need 10 screenshots of the main screens for a proposal',
      criteria: ['When I receive 10 screenshots of the main screens, this is done'],
      reason: 'No code change is needed, so this went straight to the design team.',
    },
    {
      title: 'Export statistics to Excel',
      current: 'People copy the numbers by hand',
      desired: 'Download the statistics on screen as an Excel file',
      criteria: ['When I click Excel, an xlsx with the same numbers as the screen downloads'],
      dateReason: 'Monthly management report',
    },
    {
      title: 'Broken Korean text in CSV export',
      current: '1. Choose CSV in data export\n2. Open it in Excel and the Korean text is garbled',
      desired: 'Korean text looks right when opened in Excel',
      criteria: ['When I open the exported CSV in Excel, the Korean text is readable'],
      reason: 'Solved with the Excel import feature instead.',
    },
    {
      title: 'Date filter on payment history',
      current: 'All payments are shown in one list',
      desired: 'Filter payment history by date range',
      criteria: ['When I pick a range, only payments in that range are listed'],
    },
    {
      title: 'Retry button when offline sync fails',
      current: '1. Finish a job in airplane mode\n2. Back online, only a "sync failed" label remains',
      desired: 'Failed syncs can be retried',
      criteria: ['When I tap Retry on a failed sync, the upload runs again'],
    },
    {
      title: 'Clearer guidance on My page',
      current: 'It only says "Contact support to change your details"',
      desired: 'Separate what people can change themselves from what needs support',
      criteria: [
        'When I open My page, the items I can change myself are explained',
        'When an item needs support, a button to contact support is shown next to it',
      ],
    },
    {
      title: 'Faster report API',
      current: 'Monthly reports take a long time to open',
      desired: 'It would be nice if it opened somehow faster',
      criteria: ['Monthly report opens fast'],
      questions: ['Which report is slow? (e.g. monthly sales)', 'How many seconds would be fast enough?'],
    },
    {
      title: 'Sort options for the job list',
      current: 'Jobs are listed in the order they were created',
      desired: 'Sort by due date or by distance',
      criteria: [
        'When I sort by due date, the jobs due soonest are on top',
        'When I sort by distance, the closest jobs are on top',
      ],
      issueNote: 'With location permission off, sorting by distance does nothing',
    },
    {
      title: 'Show a message after 5 failed sign-ins',
      current: 'Nothing tells you anything after several wrong passwords',
      desired: 'After 5 failures, a message says to try again later',
      criteria: [
        'When the password is wrong 5 times, "Try again in 10 minutes" is shown',
        'When I sign in, the dashboard opens first',
      ],
      outOfScope: 'Password rules (length, characters)',
      dateReason: 'Customer security audit',
      questions: ['Should admins be able to unlock locked accounts?'],
      answer: 'Yes, from the admin screen.',
      memo: 'Do not overlap with the existing lockout policy.',
    },
    {
      title: 'Add a read-only role to permissions',
      current: 'There are only two roles: admin and regular user',
      desired: 'Create a read-only role that can only view',
      criteria: ['When I sign in with the read-only role, Save and Delete buttons are not shown'],
    },
    {
      title: 'Simpler terms consent on sign-up',
      current: 'People have to tick 5 terms one by one',
      desired: 'Agree to everything with one "agree to all" checkbox',
      criteria: [
        'When I tick "agree to all", every required and optional term is ticked',
        'When any required term is unticked, the sign-up button is disabled',
      ],
      targetOther: 'Full terms pop-up',
    },
    {
      title: 'Choose which push notifications to get',
      current: 'Every notification arrives, all at once',
      desired: 'Pick between job assigned, due soon and announcements',
      criteria: ['When I turn off "due soon" in settings, due-soon notifications stop'],
    },
    {
      title: 'Schedule announcements',
      current: 'An announcement goes live as soon as it is saved',
      desired: 'Set a date and time, and it goes live then by itself',
      criteria: [
        'When I save an announcement with a publish time, it goes live at that time',
        'Scheduled announcements show in the list with a scheduled mark',
      ],
      targetOther: 'Home banner',
    },
    {
      title: 'Fix three security audit findings',
      current: '',
      desired: 'Fix the three screen findings from the on-site review so they meet the standard',
      criteria: [],
      dateReason: 'Re-inspection date',
      checklistSource: 'Security audit, on-site review',
      checklist: [
        {
          ref: 'Finding 24',
          clause: '2.3.1',
          finding: 'The sign-in screen has no link to the privacy policy',
          expected: 'A privacy policy link is always visible under the sign-in form',
        },
        {
          ref: 'Finding 25',
          clause: '2.5.4',
          finding: 'The sign-in error tells whether the user name exists',
          expected: 'The error does not say whether the user name or the password was wrong',
        },
        {
          ref: 'Finding 27',
          clause: '2.9.2',
          finding: 'My page shows the full phone number',
          expected: 'The middle four digits of the phone number are masked',
        },
      ],
    },
  ],
}

const SHOWCASE_COPY: Record<
  ServerLanguage,
  { autoLogin: string; changed: string[]; recheck: string[]; plan: string[]; risk: string; summary: string }
> = {
  ko: {
    autoLogin: '자동 로그인',
    changed: ['로그인', '비밀번호 안내'],
    recheck: ['자동 로그인', '비밀번호 재설정', '관리자 잠금 해제'],
    plan: ['실패 횟수 저장', '안내 문구 표시', '테스트 추가'],
    risk: '기존 잠금 정책과 겹칠 수 있음',
    summary:
      '실패 횟수를 저장하고 5회째에 안내 문구를 보여 주도록 바꿨습니다. 잠금 해제 버튼은 관리자 화면에 추가했습니다.',
  },
  en: {
    autoLogin: 'Auto sign-in',
    changed: ['Sign-in', 'Password message'],
    recheck: ['Auto sign-in', 'Password reset', 'Admin unlock'],
    plan: ['Store the failure count', 'Show the message', 'Add tests'],
    risk: 'May overlap with the existing lockout policy',
    summary:
      'Failed attempts are now counted and the message appears on the fifth. An unlock button was added to the admin screen.',
  },
}

function showcase1024(r: WorkRequest, lang: ServerLanguage): WorkRequest {
  const c = SHOWCASE_COPY[lang]
  const docs = ['domains/auth/auto-login.md', 'domains/auth/password-reset.md', 'domains/auth/login.md']
  return {
    ...r,
    report: r.report && {
      ...r.report,
      evidence: {
        ...r.report.evidence,
        wikiDocs: [
          ...r.report.evidence.wikiDocs,
          { path: 'docs/llm-wiki/domains/auth/auto-login.md', title: c.autoLogin, verified: true },
        ],
      },
      impact: { changedScreens: c.changed, recheck: c.recheck },
      plan: c.plan,
      risks: [c.risk],
    },
    work: r.work && {
      ...r.work,
      summary: c.summary,
      mergeRequest: r.work.mergeRequest && {
        ...r.work.mergeRequest,
        number: 57,
        url: 'https://gitlab.example.com/acme/customer-portal/-/merge_requests/57',
        filesChanged: 4,
        additions: 86,
        deletions: 12,
      },
      tests: { existingPassed: 128, existingTotal: 128, criteriaPassed: 2, criteriaTotal: 2 },
    },
    regression: c.recheck.map((label, i) => ({
      id: `rg-1024-${i + 1}`,
      label,
      source: `docs/llm-wiki/${docs[i]}`,
      result: 'pending' as const,
    })),
  }
}

const SHOWCASE_1026: Record<ServerLanguage, { assumption: string; conflict: string }> = {
  ko: {
    assumption:
      '약관 문구는 서버에서 받아 오므로, 문구만 바꾸면 앱을 다시 배포하지 않아도 된다고 가정했습니다.',
    conflict:
      '가입 단계 사이에 약관 동의 상태를 sessionStorage에 두는 지금 방식이 이 제약과 부딪힙니다. 동의 상태를 서버 임시 저장으로 옮겨야 합니다.',
  },
  en: {
    assumption: 'Terms texts come from the server, so changing them needs no new app release.',
    conflict:
      'Sign-up keeps the consent state in sessionStorage between steps, which breaks this rule. The consent state should move to a server-side draft.',
  },
}

/** The developer's queue shows what the report could not confirm and which rule the plan breaks. */
function showcase1026(r: WorkRequest, lang: ServerLanguage): WorkRequest {
  const c = SHOWCASE_1026[lang]
  return {
    ...r,
    report: r.report && {
      ...r.report,
      verdict: 'conditional',
      assumptions: [
        ...r.report.assumptions,
        { id: `a${r.report.assumptions.length + 1}`, text: c.assumption },
      ],
      constraintChecks: r.report.constraintChecks.map((k) =>
        k.constraintId === 'pc-storage' ? { ...k, conflict: true, note: c.conflict } : k,
      ),
    },
  }
}

/** Older finished requests so the dashboard has a believable history. */
const BACKGROUND: Array<[string, RequestDraft['type'], string]> = [
  ['p-portal', 'bug', 't-notice'],
  ['p-field', 'change', 't-task-detail'],
  ['p-admin', 'copy_design', 't-users'],
  ['p-portal', 'change', 't-mypage'],
  ['p-data', 'bug', 't-batch'],
  ['p-field', 'new_feature', 't-photo'],
  ['p-portal', 'copy_design', 't-login'],
  ['p-admin', 'change', 't-announce'],
  ['p-portal', 'bug', 't-payments'],
  ['p-field', 'change', 't-task-list'],
  ['p-admin', 'bug', 't-stats'],
  ['p-data', 'change', 't-report-api'],
  ['p-portal', 'new_feature', 't-signup'],
  ['p-field', 'bug', 't-offline'],
]

const BACKGROUND_COPY: Record<
  ServerLanguage,
  { titles: string[]; current: string; desired: string; criterion: string }
> = {
  ko: {
    titles: [
      '공지사항 목록 페이지 번호 오류',
      '작업 상세 지도 확대 단계 조정',
      '사용자 관리 버튼 문구 통일',
      '마이페이지 연락처 형식 검사',
      '야간 배치 실패 알림 누락',
      '작업 완료 사진 여러 장 선택',
      '로그인 화면 오류 문구 정리',
      '공지 작성 미리보기 추가',
      '결제 내역 금액 쉼표 누락',
      '작업 목록 새로고침 당겨서 하기',
      '통계 그래프 범례 겹침',
      '리포트 API 페이지 크기 조정',
      '회원가입 이메일 인증 재발송',
      '오프라인 작업 시간 표시 오류',
    ],
    current: '현재 동작에 대한 설명',
    desired: '원하는 동작에 대한 설명',
    criterion: '화면을 열면 바뀐 동작이 보인다',
  },
  en: {
    titles: [
      'Wrong page numbers on the notice list',
      'Adjust map zoom on job detail',
      'Consistent button labels in user management',
      'Validate the phone format on My page',
      'Missing alert when the nightly batch fails',
      'Select several photos when finishing a job',
      'Tidy up error messages on the sign-in screen',
      'Preview when writing an announcement',
      'Missing thousands separator in payment amounts',
      'Pull to refresh on the job list',
      'Overlapping legend on the statistics chart',
      'Adjust the page size of the report API',
      'Resend the sign-up verification email',
      'Wrong times shown for offline jobs',
    ],
    current: 'What happens now',
    desired: 'What should happen',
    criterion: 'When I open the screen, the new behaviour is shown',
  },
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

function emptyState(now: Date, lang: ServerLanguage): MockState {
  const users = seedUsers(lang)
  const settings: Record<string, NotificationSettings> = {}
  for (const u of users) settings[u.id] = { ...DEFAULT_NOTIFICATION_SETTINGS }
  return {
    version: STATE_VERSION,
    revision: 0,
    seededAt: now.toISOString(),
    language: lang,
    dirty: false,
    seq: 0,
    nextRequestId: 990,
    users,
    projects: seedProjects(lang),
    requests: [],
    notifications: [],
    notificationSettings: settings,
    budget: { monthlyLimitKrw: 500_000, perRequestLimitKrw: 20_000, alertThresholdPct: 80 },
    ai: {
      selections: DEFAULT_AI_SELECTIONS,
      // The data team runs on OpenAI, so the demo shows both providers.
      overrides: [
        { projectId: 'p-data', task: 'precheck', selection: { provider: 'openai', model: 'gpt-6-luna' } },
        { projectId: 'p-data', task: 'report', selection: { provider: 'openai', model: 'gpt-6.1-sol' } },
        { projectId: 'p-data', task: 'work', selection: { provider: 'openai', model: 'gpt-6.1-sol' } },
      ],
      // Fictional key hints; the mock never holds a key.
      providers: {
        anthropic: { keyHint: 'Xq7d', updatedAt: new Date(now.getTime() - 60 * 86_400_000).toISOString() },
        openai: { keyHint: 'm2Lp', updatedAt: new Date(now.getTime() - 21 * 86_400_000).toISOString() },
      },
      pricing: DEFAULT_AI_PRICING,
    },
    aiUsage: [],
    attachments: [],
    drafts: [],
  }
}

export function buildSeedState(now: Date, opts: EngineOptions, lang: ServerLanguage = 'ko'): MockState {
  const state = emptyState(now, lang)
  const engine = new MockEngine(state, opts)
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000)
  const today = engine.today(now)
  const user = (id: string) => {
    const u = state.users.find((x) => x.id === id)
    if (!u) throw new Error(`seed: unknown user ${id}`)
    return u
  }
  /**
   * Let the running AI job finish. The engine stamps it at start + configured
   * duration, so `t` only has to be later than that.
   */
  const finishAi = (id: number, t: Date) => {
    engine.advanceRequest(id, new Date(t.getTime() + 7 * 86_400_000), lang)
  }

  const runStep = (id: number, step: Step): void => {
    const t = at(step.h)
    if ('ai' in step) return finishAi(id, t)
    if ('release' in step) {
      const date = typeof step.release === 'number' ? addDays(today, step.release) : step.release
      engine.updateRelease(user(step.by), id, { scheduledDate: date }, t)
      return
    }
    // Without a scope check (configuration, or nothing to confirm) the step does not apply.
    const status = state.requests.find((r) => r.id === id)!.status
    if (step.command.event === 'approveScope' && status !== 'scope_check') return
    engine.transition(user(step.by), id, withDefaults(id, step.command), t, lang)
  }

  /**
   * Scenarios leave out what a person would pick on screen: every assumption is
   * confirmed and every scope question gets the AI's suggestion (or the first option).
   */
  const withDefaults = (id: number, command: TransitionCommand): TransitionCommand => {
    const req = state.requests.find((r) => r.id === id)!
    if (command.event === 'runWork' && !command.checkedAssumptions) {
      return { ...command, checkedAssumptions: (req.report?.assumptions ?? []).map((a) => a.id) }
    }
    if (command.event === 'approveScope' && !command.choices.length) {
      const questions = req.scope?.proposal.questions ?? []
      return {
        ...command,
        choices: questions.map((q) => ({ questionId: q.id, optionId: q.recommended ?? q.options[0]!.id })),
      }
    }
    return command
  }

  // Background history first (ids 990–1003), two to fifty days old.
  const bg = BACKGROUND_COPY[lang]
  BACKGROUND.forEach(([projectId, type, target], i) => {
    const filed = 24 * (6 + i * 3.2)
    const req = engine.createRequest(
      user(i % 2 ? 'u-lee' : 'u-kim'),
      {
        projectId,
        type,
        title: bg.titles[i]!,
        targetIds: [target],
        currentBehavior: bg.current,
        desiredBehavior: bg.desired,
        acceptanceCriteria: [{ text: bg.criterion }],
        attachmentIds: [],
      },
      at(filed),
      lang,
    )
    const dev = state.projects.find((p) => p.id === projectId)!.ownerIds[0]!
    for (const step of shipped(dev, req.requesterId, filed, 1, 2 + (i % 4))) runStep(req.id, step)
  })

  state.nextRequestId = 1012
  SCENARIOS.forEach((s, i) => {
    const c = SCENARIO_COPY[lang][i]!
    const draft: RequestDraft = {
      projectId: s.projectId,
      type: s.type,
      title: c.title,
      targetIds: s.targetIds,
      ...(c.targetOther ? { targetOther: c.targetOther } : {}),
      currentBehavior: c.current,
      desiredBehavior: c.desired,
      acceptanceCriteria: c.criteria.map((text) => ({ text })),
      ...(c.checklist ? { checklist: c.checklist } : {}),
      ...(c.checklistSource ? { checklistSource: c.checklistSource } : {}),
      ...(c.outOfScope ? { outOfScope: c.outOfScope } : {}),
      attachmentIds: [],
      ...(s.desiredInDays !== undefined ? { desiredDate: addDays(today, s.desiredInDays) } : {}),
      ...(c.dateReason ? { desiredDateReason: c.dateReason } : {}),
    }
    const req = engine.createRequest(user(s.by), draft, at(s.h), lang)
    for (const step of s.steps?.(c) ?? []) runStep(req.id, step)
    if (s.patch) {
      const idx = state.requests.findIndex((r) => r.id === req.id)
      state.requests[idx] = s.patch(state.requests[idx]!, lang)
    }
  })

  // Older usage, so the budget and usage screens have history on any day of the month:
  // three jobs a day over 45 days, booked against the background requests, about a third
  // of them on OpenAI. Booked through the engine, so prices come from the table. The
  // request's requester checks and gets the reading; its project's developer runs the work.
  for (let d = 1; d <= 45; d++) {
    for (let k = 0; k < 3; k++) {
      const n = d * 3 + k
      const requestId = 990 + (n % 14)
      const req = state.requests.find((r) => r.id === requestId)!
      const dev = state.projects.find((p) => p.id === req.projectId)!.ownerIds[0]!
      const openai = n % 3 === 0
      const shape = { seed: n, criteria: 1 + (n % 3), targets: 1 + (n % 2), attempt: n % 5 === 0 ? 2 : 1 }
      const pick = (task: 'precheck' | 'report' | 'work') =>
        openai
          ? { provider: 'openai' as const, model: task === 'precheck' ? 'gpt-6-luna' : 'gpt-6.1-sol' }
          : {
              provider: 'anthropic' as const,
              model: task === 'precheck' ? 'claude-haiku-5-5' : 'claude-opus-5-5',
            }
      const hour = 24 * d + 3 + k * 4
      engine.bookAi('precheck', pick('precheck'), shape, at(hour + 1).toISOString(), req.requesterId)
      engine.bookAi('report', pick('report'), shape, at(hour + 0.5).toISOString(), req.requesterId, requestId)
      if (n % 2) engine.bookAi('work', pick('work'), shape, at(hour).toISOString(), dev, requestId)
    }
  }

  // Seed notifications are history: mark everything older than two days as read.
  for (const n of state.notifications) {
    if (Date.parse(n.createdAt) < now.getTime() - 48 * 3_600_000) n.readAt = n.createdAt
  }
  return state
}
