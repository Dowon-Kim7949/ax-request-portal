/**
 * Fictional demo data. Every name, project, repository and e-mail here is
 * made up. Requests are produced by running the real lifecycle through the
 * engine, so the seed can never contain a state the rules would not allow.
 */
import type { TransitionCommand } from '../domain/lifecycle'
import type { NotificationSettings, Project, RequestDraft, User } from '../domain/model'
import {
  addDays,
  DEFAULT_NOTIFICATION_SETTINGS,
  localDate,
  MockEngine,
  STATE_VERSION,
  type EngineOptions,
  type MockState,
} from './engine'

export const DEMO_PASSWORD = 'demo'

export const SEED_USERS: User[] = [
  {
    id: 'u-kim',
    name: '김기획',
    email: 'planner@example.com',
    role: 'requester',
    team: '기획팀',
    active: true,
  },
  {
    id: 'u-lee',
    name: '이영업',
    email: 'sales@example.com',
    role: 'requester',
    team: '영업팀',
    active: true,
  },
  { id: 'u-park', name: '박대표', email: 'ceo@example.com', role: 'executive', team: '경영', active: true },
  {
    id: 'u-choi',
    name: '최개발',
    email: 'dev1@example.com',
    role: 'developer',
    team: '개발팀',
    active: true,
  },
  {
    id: 'u-jung',
    name: '정개발',
    email: 'dev2@example.com',
    role: 'developer',
    team: '개발팀',
    active: true,
  },
  { id: 'u-han', name: '한운영', email: 'admin@example.com', role: 'admin', team: '운영팀', active: true },
]

/** One demo account per role, shown on the login screen in mock mode. */
export const DEMO_ACCOUNTS = SEED_USERS.filter((u) => ['u-kim', 'u-park', 'u-choi', 'u-han'].includes(u.id))

const SEED_PROJECTS: Project[] = [
  {
    id: 'p-portal',
    name: '고객 포털 웹',
    description: '고객이 로그인해 계약·결제·공지를 확인하는 웹 서비스',
    icon: 'globe',
    repository: { provider: 'gitlab', url: 'https://gitlab.example.com/acme/customer-portal' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 18, totalDocs: 20, lastSyncedAt: '2026-10-30T09:00:00.000Z' },
    ownerIds: ['u-choi'],
    active: true,
    targets: [
      { id: 't-login', name: '로그인', wikiDoc: 'domains/auth/login.md' },
      { id: 't-password-reset', name: '비밀번호 재설정', wikiDoc: 'domains/auth/password-reset.md' },
      { id: 't-auto-login', name: '자동 로그인', wikiDoc: 'domains/auth/auto-login.md' },
      { id: 't-signup', name: '회원가입', wikiDoc: 'domains/auth/signup.md' },
      { id: 't-mypage', name: '마이페이지', wikiDoc: 'domains/account/mypage.md' },
      { id: 't-notice', name: '공지사항', wikiDoc: 'domains/board/notice.md' },
      { id: 't-payments', name: '결제 내역', wikiDoc: 'domains/billing/payments.md' },
    ],
  },
  {
    id: 'p-field',
    name: '현장 작업자 앱',
    description: '현장 작업자가 작업 지시를 받고 사진으로 결과를 올리는 모바일 앱',
    icon: 'smartphone',
    repository: { provider: 'github', url: 'https://github.com/acme/field-worker-app' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 9, totalDocs: 14, lastSyncedAt: '2026-10-28T09:00:00.000Z' },
    ownerIds: ['u-jung'],
    active: true,
    targets: [
      { id: 't-task-list', name: '작업 목록', wikiDoc: 'domains/tasks/list.md' },
      { id: 't-task-detail', name: '작업 상세', wikiDoc: 'domains/tasks/detail.md' },
      { id: 't-photo', name: '사진 업로드', wikiDoc: 'domains/media/photo-upload.md' },
      { id: 't-offline', name: '오프라인 동기화', wikiDoc: 'domains/sync/offline.md' },
      { id: 't-push', name: '푸시 알림' },
    ],
  },
  {
    id: 'p-admin',
    name: '관리자 대시보드',
    description: '운영팀이 사용자·권한·통계를 관리하는 내부 화면',
    icon: 'layout-dashboard',
    repository: { provider: 'gitlab', url: 'https://gitlab.example.com/acme/admin-console' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 12, totalDocs: 12, lastSyncedAt: '2026-10-31T09:00:00.000Z' },
    ownerIds: ['u-choi', 'u-jung'],
    active: true,
    targets: [
      { id: 't-users', name: '사용자 관리', wikiDoc: 'domains/users.md' },
      { id: 't-stats', name: '통계', wikiDoc: 'domains/stats.md' },
      { id: 't-roles', name: '권한 설정', wikiDoc: 'domains/roles.md' },
      { id: 't-announce', name: '공지 작성', wikiDoc: 'domains/announce.md' },
    ],
  },
  {
    id: 'p-data',
    name: '데이터 분석 서버',
    description: '리포트 API와 야간 배치를 제공하는 백엔드',
    icon: 'server',
    repository: { provider: 'github', url: 'https://github.com/acme/analytics-server' },
    wikiPath: 'docs/llm-wiki',
    wikiStats: { verifiedDocs: 3, totalDocs: 10, lastSyncedAt: '2026-10-20T09:00:00.000Z' },
    ownerIds: ['u-jung'],
    active: true,
    targets: [
      { id: 't-report-api', name: '리포트 API', wikiDoc: 'domains/report-api.md' },
      { id: 't-batch', name: '배치 작업', wikiDoc: 'domains/batch.md' },
      { id: 't-export', name: '데이터 내보내기', wikiDoc: 'domains/export.md' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Scenario DSL                                                        */
/* ------------------------------------------------------------------ */

type Step =
  /** Let the running AI job (report or work) finish at this time */
  | { h: number; ai: true }
  | { h: number; by: string; command: TransitionCommand }
  | { h: number; by: string; release: string | number }

interface Scenario {
  by: string
  /** Hours before seeding when the request was filed */
  h: number
  draft: Omit<RequestDraft, 'attachmentIds' | 'acceptanceCriteria'> & { criteria: string[] }
  steps?: Step[]
  /** Final touch-ups to match a showcase screen exactly */
  patch?: (req: MockState['requests'][number]) => MockState['requests'][number]
}

const passAll = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ criterionId: `c${i + 1}`, result: 'passed' as const }))

/** report → run work → AI done → approve → requester confirms → released */
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
    { h: t(16), by: dev, command: { event: 'runWork' } },
    { h: t(17), ai: true },
    { h: t(20), by: dev, command: { event: 'approveMerge' } },
    { h: t(30), by: requester, command: { event: 'confirmResult', checks: passAll(criteria) } },
    // release date = the day it actually shipped, as an offset from today
    { h: t(31), by: dev, release: -Math.floor((start - releasedAfterDays * 24) / 24) },
    { h: t(releasedAfterDays * 24), by: dev, command: { event: 'markReleased' } },
  ]
}

const SCENARIOS: Scenario[] = [
  {
    by: 'u-kim',
    h: 24 * 30,
    draft: {
      projectId: 'p-portal',
      type: 'new_feature',
      title: '공지사항 첨부파일 미리보기',
      targetIds: ['t-notice'],
      currentBehavior: '첨부파일을 내려받아야만 내용을 볼 수 있다',
      desiredBehavior: 'PDF와 이미지 첨부는 공지 화면에서 바로 미리 본다',
      criteria: ['PDF 첨부를 누르면 새 창 없이 미리보기가 열린다', '이미지 첨부를 누르면 확대 화면이 열린다'],
    },
    steps: shipped('u-choi', 'u-kim', 24 * 30, 2, 9),
  },
  {
    by: 'u-lee',
    h: 24 * 25,
    draft: {
      projectId: 'p-field',
      type: 'change',
      title: '사진 업로드 시 자동 압축',
      targetIds: ['t-photo'],
      currentBehavior: '고화질 사진은 업로드가 30초 이상 걸린다',
      desiredBehavior: '올리기 전에 사진 크기를 줄여서 빨리 올라가게 한다',
      criteria: ['10MB 사진을 올리면 2MB 이하로 줄어서 저장된다'],
    },
    steps: shipped('u-jung', 'u-lee', 24 * 25, 1, 12),
  },
  {
    by: 'u-kim',
    h: 24 * 18,
    draft: {
      projectId: 'p-admin',
      type: 'change',
      title: '통계 화면 날짜 범위 선택',
      targetIds: ['t-stats'],
      currentBehavior: '통계는 최근 7일만 볼 수 있다',
      desiredBehavior: '시작일과 종료일을 골라서 본다',
      criteria: ['시작일과 종료일을 고르면 그 기간의 통계가 표시된다'],
    },
    steps: shipped('u-choi', 'u-kim', 24 * 18, 1, 11),
  },
  {
    by: 'u-lee',
    h: 24 * 14,
    draft: {
      projectId: 'p-portal',
      type: 'new_feature',
      title: '결제 내역 영수증 다운로드',
      targetIds: ['t-payments'],
      currentBehavior: '영수증이 필요하면 고객센터에 요청해야 한다',
      desiredBehavior: '결제 내역에서 영수증 PDF를 바로 받는다',
      criteria: ['결제 건의 영수증 버튼을 누르면 PDF가 내려받아진다'],
      desiredDate: undefined,
    },
    steps: shipped('u-choi', 'u-lee', 24 * 14, 1, 12),
  },
  {
    by: 'u-lee',
    h: 24 * 12,
    draft: {
      projectId: 'p-portal',
      type: 'non_code',
      title: '영업 제안서용 화면 캡처 요청',
      targetIds: [],
      currentBehavior: '',
      desiredBehavior: '제안서에 넣을 주요 화면 캡처 10장이 필요합니다',
      criteria: ['주요 화면 캡처 10장을 받으면 끝난다'],
    },
    steps: [
      { h: 24 * 12 - 1, ai: true },
      {
        h: 24 * 11,
        by: 'u-choi',
        command: { event: 'reject', reason: '코드 변경이 필요 없는 요청이라 디자인팀에 직접 전달했습니다.' },
      },
    ],
  },
  {
    by: 'u-kim',
    h: 24 * 10,
    draft: {
      projectId: 'p-admin',
      type: 'new_feature',
      title: '통계 화면 엑셀 내보내기',
      targetIds: ['t-stats'],
      currentBehavior: '통계 수치를 손으로 옮겨 적는다',
      desiredBehavior: '보고 있는 통계를 엑셀 파일로 내려받는다',
      criteria: ['엑셀 버튼을 누르면 화면과 같은 수치의 xlsx 파일이 내려받아진다'],
      desiredDate: '__DAYS_AGO_3__',
      desiredDateReason: '월간 경영 보고',
    },
    steps: [
      { h: 24 * 10 - 1, ai: true },
      { h: 24 * 9, by: 'u-choi', command: { event: 'runWork' } },
      { h: 24 * 9 - 1, ai: true },
      { h: 24 * 8, by: 'u-choi', command: { event: 'approveMerge' } },
    ],
  },
  {
    by: 'u-lee',
    h: 24 * 9,
    draft: {
      projectId: 'p-data',
      type: 'bug',
      title: '데이터 내보내기 CSV 한글 깨짐',
      targetIds: ['t-export'],
      currentBehavior: '1. 데이터 내보내기에서 CSV 선택\n2. 엑셀로 열면 한글이 깨진다',
      desiredBehavior: '엑셀에서 열어도 한글이 정상으로 보인다',
      criteria: ['내보낸 CSV를 엑셀로 열면 한글이 깨지지 않는다'],
    },
    steps: [
      { h: 24 * 9 - 1, ai: true },
      {
        h: 24 * 8,
        by: 'u-lee',
        command: { event: 'cancel', reason: '엑셀 가져오기 기능으로 해결했습니다.' },
      },
    ],
  },
  {
    by: 'u-kim',
    h: 24 * 8,
    draft: {
      projectId: 'p-portal',
      type: 'change',
      title: '결제 내역 날짜 필터',
      targetIds: ['t-payments'],
      currentBehavior: '결제 내역이 전부 한 목록에 나온다',
      desiredBehavior: '기간을 골라 결제 내역을 본다',
      criteria: ['기간을 고르면 그 기간의 결제만 목록에 나온다'],
    },
    steps: [
      { h: 24 * 8 - 1, ai: true },
      { h: 24 * 7, by: 'u-choi', command: { event: 'runWork' } },
      { h: 24 * 7 - 1, ai: true },
      { h: 24 * 6, by: 'u-choi', command: { event: 'approveMerge' } },
      { h: 24 * 4, by: 'u-kim', command: { event: 'confirmResult', checks: passAll(1) } },
      { h: 24 * 3, by: 'u-choi', release: 1 },
    ],
  },
  {
    by: 'u-lee',
    h: 24 * 7,
    draft: {
      projectId: 'p-field',
      type: 'bug',
      title: '오프라인 동기화 실패 시 재시도 버튼',
      targetIds: ['t-offline'],
      currentBehavior: '1. 비행기 모드에서 작업 완료\n2. 온라인이 되어도 동기화 실패 표시만 남는다',
      desiredBehavior: '실패한 동기화를 다시 시도할 수 있다',
      criteria: ['동기화 실패 표시에서 다시 시도를 누르면 업로드가 다시 진행된다'],
    },
    steps: [
      { h: 24 * 7 - 1, ai: true },
      { h: 24 * 6, by: 'u-jung', command: { event: 'runWork' } },
      { h: 24 * 6 - 1, ai: true },
      { h: 24 * 5, by: 'u-jung', command: { event: 'approveMerge' } },
      { h: 24 * 3, by: 'u-lee', command: { event: 'confirmResult', checks: passAll(1) } },
      { h: 24 * 2, by: 'u-jung', release: 3 },
    ],
  },
  {
    by: 'u-kim',
    h: 24 * 5,
    draft: {
      projectId: 'p-portal',
      type: 'copy_design',
      title: '마이페이지 안내 문구 수정',
      targetIds: ['t-mypage'],
      currentBehavior: '“정보 변경은 고객센터로 문의”라고만 나온다',
      desiredBehavior: '직접 바꿀 수 있는 항목과 문의가 필요한 항목을 나눠 안내한다',
      criteria: [
        '마이페이지를 열면 직접 바꿀 수 있는 항목 안내가 보인다',
        '문의가 필요한 항목 옆에 고객센터 연결 버튼이 보인다',
      ],
    },
    steps: [
      { h: 24 * 5 - 1, ai: true },
      { h: 24 * 4, by: 'u-choi', command: { event: 'runWork' } },
      { h: 24 * 4 - 1, ai: true },
      { h: 24 * 2, by: 'u-choi', command: { event: 'approveMerge' } },
    ],
  },
  {
    by: 'u-lee',
    h: 24 * 4,
    draft: {
      projectId: 'p-data',
      type: 'change',
      title: '리포트 API 응답 속도 개선',
      targetIds: ['t-report-api'],
      currentBehavior: '월간 리포트를 열 때 오래 기다린다',
      desiredBehavior: '좀 빠르게 열렸으면 합니다',
      criteria: ['월간 리포트가 빠르게 열린다'],
    },
    steps: [
      { h: 24 * 4 - 1, ai: true },
      {
        h: 24 * 3,
        by: 'u-jung',
        command: {
          event: 'requestInfo',
          questions: ['어느 리포트가 느린가요? (예: 월간 매출 리포트)', '몇 초 안에 열리면 충분할까요?'],
        },
      },
    ],
  },
  {
    by: 'u-lee',
    h: 24 * 4 - 2,
    draft: {
      projectId: 'p-field',
      type: 'new_feature',
      title: '작업 목록 정렬 옵션 추가',
      targetIds: ['t-task-list'],
      currentBehavior: '작업 목록이 등록 순서로만 보인다',
      desiredBehavior: '마감일 순, 거리 순으로 정렬한다',
      criteria: [
        '정렬에서 마감일 순을 고르면 마감이 빠른 작업이 위에 온다',
        '정렬에서 거리 순을 고르면 가까운 작업이 위에 온다',
      ],
    },
    steps: [
      { h: 24 * 4 - 3, ai: true },
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
            { criterionId: 'c2', result: 'failed', note: '위치 권한을 끄면 거리 순이 아무 반응이 없습니다' },
          ],
        },
      },
    ],
  },
  {
    by: 'u-kim',
    h: 24 * 3,
    draft: {
      projectId: 'p-portal',
      type: 'change',
      title: '로그인 5회 실패 시 안내 문구 추가',
      targetIds: ['t-login', 't-password-reset'],
      currentBehavior: '비밀번호를 여러 번 틀려도 아무 안내가 없다',
      desiredBehavior: '5번 틀리면 잠시 후 다시 시도하라는 안내가 보인다',
      criteria: [
        '비밀번호를 5번 틀리면 ‘10분 후 다시 시도’ 안내가 보인다',
        '로그인하면 첫 화면이 대시보드로 열린다',
      ],
      outOfScope: '비밀번호 정책(길이, 조합) 변경',
      desiredDate: '__DAYS_AHEAD_10__',
      desiredDateReason: '고객사 보안 점검 일정',
    },
    steps: [
      { h: 24 * 3 - 1, ai: true },
      {
        h: 24 * 2 + 6,
        by: 'u-choi',
        command: { event: 'requestInfo', questions: ['잠긴 계정을 관리자가 풀 수 있어야 하나요?'] },
      },
      {
        h: 24 * 2,
        by: 'u-kim',
        command: { event: 'provideInfo', answer: '네, 관리자 화면에서 풀 수 있어야 합니다.' },
      },
      { h: 24 * 2 - 1, ai: true },
      {
        h: 24,
        by: 'u-choi',
        command: { event: 'runWork', instructions: '기존 잠금 정책과 겹치지 않게 해 주세요.' },
      },
      { h: 23, ai: true },
    ],
    patch: (r) => ({
      ...r,
      report: r.report && {
        ...r.report,
        evidence: {
          ...r.report.evidence,
          wikiDocs: [
            ...r.report.evidence.wikiDocs,
            { path: 'docs/llm-wiki/domains/auth/auto-login.md', title: '자동 로그인', verified: true },
          ],
        },
        impact: {
          changedScreens: ['로그인', '비밀번호 안내'],
          recheck: ['자동 로그인', '비밀번호 재설정', '관리자 잠금 해제'],
        },
        plan: ['실패 횟수 저장', '안내 문구 표시', '테스트 추가'],
        risks: ['기존 잠금 정책과 겹칠 수 있음'],
      },
      work: r.work && {
        ...r.work,
        summary:
          '실패 횟수를 저장하고 5회째에 안내 문구를 보여 주도록 바꿨습니다. 잠금 해제 버튼은 관리자 화면에 추가했습니다.',
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
      regression: [
        {
          id: 'rg-1024-1',
          label: '자동 로그인',
          source: 'docs/llm-wiki/domains/auth/auto-login.md',
          result: 'pending',
        },
        {
          id: 'rg-1024-2',
          label: '비밀번호 재설정',
          source: 'docs/llm-wiki/domains/auth/password-reset.md',
          result: 'pending',
        },
        {
          id: 'rg-1024-3',
          label: '관리자 잠금 해제',
          source: 'docs/llm-wiki/domains/auth/login.md',
          result: 'pending',
        },
      ],
    }),
  },
  {
    by: 'u-kim',
    h: 26,
    draft: {
      projectId: 'p-admin',
      type: 'new_feature',
      title: "권한 설정에 '읽기 전용' 역할 추가",
      targetIds: ['t-roles'],
      currentBehavior: '역할이 관리자와 일반 사용자 두 가지뿐이다',
      desiredBehavior: '조회만 가능한 읽기 전용 역할을 만들 수 있다',
      criteria: ['읽기 전용 역할로 로그인하면 저장·삭제 버튼이 보이지 않는다'],
    },
    steps: [
      { h: 25, ai: true },
      { h: 8 / 3600, by: 'u-choi', command: { event: 'runWork' } },
    ],
  },
  {
    by: 'u-lee',
    h: 20,
    draft: {
      projectId: 'p-portal',
      type: 'change',
      title: '회원가입 약관 동의 화면 개선',
      targetIds: ['t-signup'],
      targetOther: '약관 전문 팝업',
      currentBehavior: '약관 5개를 하나씩 눌러 동의해야 한다',
      desiredBehavior: '전체 동의 체크박스로 한 번에 동의할 수 있다',
      criteria: [
        '전체 동의를 누르면 필수와 선택 약관이 모두 체크된다',
        '필수 약관을 하나라도 풀면 가입 버튼이 비활성화된다',
      ],
    },
    steps: [{ h: 19, ai: true }],
  },
  {
    by: 'u-kim',
    h: 3 / 3600,
    draft: {
      projectId: 'p-field',
      type: 'new_feature',
      title: '푸시 알림 받을 항목 고르기',
      targetIds: ['t-push', 't-task-detail'],
      currentBehavior: '모든 알림이 한꺼번에 온다',
      desiredBehavior: '작업 배정, 마감 임박, 공지 중 받을 알림을 고른다',
      criteria: ['설정에서 마감 임박을 끄면 마감 임박 알림이 오지 않는다'],
    },
  },
]

/** Older finished requests so the dashboard has a believable history. */
const BACKGROUND: Array<[string, RequestDraft['type'], string, string]> = [
  ['p-portal', 'bug', '공지사항 목록 페이지 번호 오류', 't-notice'],
  ['p-field', 'change', '작업 상세 지도 확대 단계 조정', 't-task-detail'],
  ['p-admin', 'copy_design', '사용자 관리 버튼 문구 통일', 't-users'],
  ['p-portal', 'change', '마이페이지 연락처 형식 검사', 't-mypage'],
  ['p-data', 'bug', '야간 배치 실패 알림 누락', 't-batch'],
  ['p-field', 'new_feature', '작업 완료 사진 여러 장 선택', 't-photo'],
  ['p-portal', 'copy_design', '로그인 화면 오류 문구 정리', 't-login'],
  ['p-admin', 'change', '공지 작성 미리보기 추가', 't-announce'],
  ['p-portal', 'bug', '결제 내역 금액 쉼표 누락', 't-payments'],
  ['p-field', 'change', '작업 목록 새로고침 당겨서 하기', 't-task-list'],
  ['p-admin', 'bug', '통계 그래프 범례 겹침', 't-stats'],
  ['p-data', 'change', '리포트 API 페이지 크기 조정', 't-report-api'],
  ['p-portal', 'new_feature', '회원가입 이메일 인증 재발송', 't-signup'],
  ['p-field', 'bug', '오프라인 작업 시간 표시 오류', 't-offline'],
]

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

function emptyState(now: Date): MockState {
  const settings: Record<string, NotificationSettings> = {}
  for (const u of SEED_USERS) settings[u.id] = { ...DEFAULT_NOTIFICATION_SETTINGS }
  return {
    version: STATE_VERSION,
    seededAt: now.toISOString(),
    seq: 0,
    nextRequestId: 990,
    users: structuredClone(SEED_USERS),
    projects: structuredClone(SEED_PROJECTS),
    requests: [],
    notifications: [],
    notificationSettings: settings,
    budget: { monthlyLimitKrw: 500_000, perRequestLimitKrw: 20_000, alertThresholdPct: 80 },
    costs: [],
    attachments: [],
  }
}

function resolveDate(value: string | undefined, today: string): string | undefined {
  if (!value) return undefined
  const ago = /^__DAYS_AGO_(\d+)__$/.exec(value)
  if (ago) return addDays(today, -Number(ago[1]))
  const ahead = /^__DAYS_AHEAD_(\d+)__$/.exec(value)
  if (ahead) return addDays(today, Number(ahead[1]))
  return value
}

export function buildSeedState(now: Date, opts: EngineOptions): MockState {
  const state = emptyState(now)
  const engine = new MockEngine(state, opts)
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000)
  const today = localDate(now)
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
    engine.advanceRequest(id, new Date(t.getTime() + 7 * 86_400_000))
  }

  const runStep = (id: number, step: Step): void => {
    const t = at(step.h)
    if ('ai' in step) return finishAi(id, t)
    if ('release' in step) {
      const date = typeof step.release === 'number' ? addDays(today, step.release) : step.release
      engine.updateRelease(user(step.by), id, { scheduledDate: date }, t)
      return
    }
    engine.transition(user(step.by), id, step.command, t)
  }

  // Background history first (ids 990–1003), two to fifty days old.
  BACKGROUND.forEach(([projectId, type, title, target], i) => {
    const filed = 24 * (6 + i * 3.2)
    const req = engine.createRequest(
      user(i % 2 ? 'u-lee' : 'u-kim'),
      {
        projectId,
        type,
        title,
        targetIds: [target],
        currentBehavior: '현재 동작에 대한 설명',
        desiredBehavior: '원하는 동작에 대한 설명',
        acceptanceCriteria: [{ text: '화면을 열면 바뀐 동작이 보인다' }],
        attachmentIds: [],
      },
      at(filed),
    )
    const dev = state.projects.find((p) => p.id === projectId)!.ownerIds[0]!
    for (const step of shipped(dev, req.requesterId, filed, 1, 2 + (i % 4))) runStep(req.id, step)
  })

  state.nextRequestId = 1012
  for (const s of SCENARIOS) {
    const { criteria, ...rest } = s.draft
    const req = engine.createRequest(
      user(s.by),
      {
        ...rest,
        desiredDate: resolveDate(rest.desiredDate, today),
        acceptanceCriteria: criteria.map((text) => ({ text })),
        attachmentIds: [],
      } as RequestDraft,
      at(s.h),
    )
    for (const step of s.steps ?? []) runStep(req.id, step)
    if (s.patch) {
      const i = state.requests.findIndex((r) => r.id === req.id)
      state.requests[i] = s.patch(state.requests[i]!)
    }
  }

  // Older costs so the budget screen is not empty at the start of a month.
  for (let d = 1; d <= 45; d++) {
    state.costs.push({ at: at(24 * d + 5).toISOString(), tier: 'light', krw: 3 + (d % 5) })
    if (d % 2)
      state.costs.push({ at: at(24 * d + 7).toISOString(), tier: 'heavy', krw: 2_400 + (d % 7) * 350 })
  }

  // Seed notifications are history: mark everything older than two days as read.
  for (const n of state.notifications) {
    if (Date.parse(n.createdAt) < now.getTime() - 48 * 3_600_000) n.readAt = n.createdAt
  }
  return state
}
