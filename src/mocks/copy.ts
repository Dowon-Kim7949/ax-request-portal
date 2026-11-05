/**
 * Server-side texts of the mock API: error messages and notifications.
 * A real backend does the same — it answers in the request's Accept-Language
 * (notifications in the recipient's language).
 */
export type ServerLanguage = 'ko' | 'en'

/** First supported language in an Accept-Language header; Korean otherwise. */
export function serverLanguage(header: string | null | undefined): ServerLanguage {
  for (const part of (header ?? '').split(',')) {
    const base = part.trim().split(';')[0]?.split('-')[0]?.toLowerCase()
    if (base === 'en' || base === 'ko') return base
  }
  return 'ko'
}

type Params = Record<string, string | number>
type Text = string | ((p: Params) => string)

/** Brand names are not translated. */
function providerName(provider: string | number | undefined): string {
  return provider === 'anthropic' ? 'Anthropic(Claude)' : provider === 'openai' ? 'OpenAI' : String(provider)
}

const ERRORS = {
  ko: {
    forbidden: '이 작업을 할 권한이 없습니다.',
    requestNotFound: (p) => `요청 #${p.id}을 찾을 수 없습니다.`,
    projectNotFound: '선택한 프로젝트를 찾을 수 없습니다.',
    unknownTarget: (p) => `알 수 없는 대상입니다: ${p.target}`,
    notYourStep: '이 단계에서 할 수 있는 작업이 아닙니다.',
    invalidTransition: '지금 단계에서는 할 수 없는 작업입니다.',
    needAllPassed: '모든 완료 기준이 통과해야 완료할 수 있습니다.',
    needOneFailed: '안 되는 완료 기준을 하나 이상 표시해 주세요.',
    assumptionsUnchecked: '보고서의 가정을 모두 확인해야 AI 작업을 시작할 수 있습니다.',
    scopeUnanswered: '골라야 할 항목에 모두 답해 주세요.',
    scopeRevisionsUsed:
      '다시 정리는 더 요청할 수 없습니다. 덧붙일 말을 적어 진행하거나 요청을 취소해 주세요.',
    requestBudgetExceeded: (p) =>
      `이 요청의 AI 비용이 요청당 한도(${Number(p.limit).toLocaleString('ko-KR')}원)에 도달해 AI 작업을 더 실행할 수 없습니다. 운영자가 한도를 올리거나 직접 처리해 주세요.`,
    operatorProvisioned: '운영자 계정은 서비스가 관리합니다. 여기서 만들거나 바꿀 수 없습니다.',
    providerNotConnected: (p) =>
      `${providerName(p.provider)}가 연결되어 있지 않습니다. 먼저 API 키를 등록해 주세요.`,
    modelNotPriced: (p) => `단가표에 없는 모델입니다: ${p.model}`,
    providerInUse: (p) =>
      `${providerName(p.provider)}를 쓰는 작업이나 프로젝트가 있어 연결을 끊을 수 없습니다. 먼저 다른 모델로 바꿔 주세요.`,
    modelInUse: (p) => `지금 쓰고 있는 모델(${p.model})은 단가표에서 뺄 수 없습니다.`,
    requesterOnlyVerify: '요청자만 결과를 확인할 수 있습니다.',
    requesterOnlyPreview: '요청자만 미리보기에 의견을 남길 수 있습니다.',
    noPreviewNow: '지금은 미리보기에 의견을 남길 수 없습니다.',
    notInVerification: '지금은 결과 확인 단계가 아닙니다.',
    developerOnlyRegression: '담당 개발자만 기록할 수 있습니다.',
    developerOnlySchedule: '담당 개발자만 일정을 정할 수 있습니다.',
    cannotScheduleNow: '지금 단계에서는 배포 일정을 정할 수 없습니다.',
    releaseDateInPast: (p) => `배포 예정일은 오늘(본사 기준 ${p.today}) 이후로 정해 주세요.`,
    emailTaken: '이미 등록된 이메일입니다.',
    userNotFound: '사용자를 찾을 수 없습니다.',
    cannotChangeSelf: '자신의 역할이나 활성 상태는 바꿀 수 없습니다.',
    ownersMustBeDevelopers: '담당자는 개발자 또는 관리자여야 합니다.',
    notificationNotFound: '알림을 찾을 수 없습니다.',
    signInAgain: '다시 로그인해 주세요.',
    wrongCredentials: '이메일 또는 비밀번호가 맞지 않습니다.',
    notFound: '찾을 수 없습니다.',
    badQuery: '잘못된 조회 조건입니다.',
    checkInput: '입력값을 확인해 주세요.',
    pickFile: '파일을 선택해 주세요.',
    fileTooLarge: '10MB 이하 파일만 올릴 수 있습니다.',
    unknown: '알 수 없는 오류가 발생했습니다.',
  },
  en: {
    forbidden: 'You do not have permission to do this.',
    requestNotFound: (p) => `Request #${p.id} was not found.`,
    projectNotFound: 'The selected project was not found.',
    unknownTarget: (p) => `Unknown screen: ${p.target}`,
    notYourStep: 'You cannot do this at this step.',
    invalidTransition: 'This is not possible at the current step.',
    needAllPassed: 'Every acceptance criterion must pass before you confirm.',
    needOneFailed: 'Mark at least one acceptance criterion as not working.',
    assumptionsUnchecked: 'Confirm every assumption in the report before the AI starts work.',
    scopeUnanswered: 'Answer every question first.',
    scopeRevisionsUsed: 'The scope cannot be summed up again. Go ahead with a note, or cancel the request.',
    requestBudgetExceeded: (p) =>
      `This request has used its per-request AI budget (₩${Number(p.limit).toLocaleString('en-US')}), so AI work cannot run again. Ask an operator to raise the limit, or handle it by hand.`,
    operatorProvisioned:
      'Operator accounts are managed by the service and cannot be created or changed here.',
    providerNotConnected: (p) => `${providerName(p.provider)} is not connected. Add its API key first.`,
    modelNotPriced: (p) => `This model is not in the price table: ${p.model}`,
    providerInUse: (p) =>
      `A task or project still uses ${providerName(p.provider)}, so it cannot be disconnected. Switch them to another model first.`,
    modelInUse: (p) => `A model in use (${p.model}) cannot be removed from the price table.`,
    requesterOnlyVerify: 'Only the requester can check the result.',
    requesterOnlyPreview: 'Only the requester can comment on the preview.',
    noPreviewNow: 'There is no preview to comment on right now.',
    notInVerification: 'The request is not waiting for a result check.',
    developerOnlyRegression: 'Only the responsible developer can record this.',
    developerOnlySchedule: 'Only the responsible developer can set the release date.',
    cannotScheduleNow: 'A release date cannot be set at this step.',
    releaseDateInPast: (p) =>
      `The release date cannot be in the past. Today is ${p.today} at the head office.`,
    emailTaken: 'This email is already registered.',
    userNotFound: 'User not found.',
    cannotChangeSelf: 'You cannot change your own role or status.',
    ownersMustBeDevelopers: 'Owners must be developers or admins.',
    notificationNotFound: 'Notification not found.',
    signInAgain: 'Please sign in again.',
    wrongCredentials: 'The email or password is incorrect.',
    notFound: 'Not found.',
    badQuery: 'The query parameters are invalid.',
    checkInput: 'Please check the input.',
    pickFile: 'Choose a file.',
    fileTooLarge: 'Files must be 10 MB or smaller.',
    unknown: 'An unexpected error occurred.',
  },
} satisfies Record<ServerLanguage, Record<string, Text>>

export type ErrorKey = keyof (typeof ERRORS)['ko']

export function errorText(lang: ServerLanguage, key: ErrorKey, params: Params = {}): string {
  const text: Text = ERRORS[lang][key]
  return typeof text === 'function' ? text(params) : text
}

/* ------------------------------------------------------------------ */
/* Notifications: stored as key + params, rendered when read           */
/* ------------------------------------------------------------------ */

const NOTIFICATIONS = {
  ko: {
    reportReady: { title: '구현 확인 보고서가 준비되었습니다', body: (p) => String(p.title) },
    scopeCheck: { title: '진행 범위를 확인해 주세요', body: (p) => String(p.title) },
    scopeApproved: { title: '요청자가 진행 범위를 확인했습니다', body: (p) => String(p.title) },
    infoNeeded: { title: '추가 정보가 필요합니다', body: (p) => String(p.questions) },
    requesterAnswered: { title: '요청자가 답변했습니다', body: '보고서를 다시 쓰고 있습니다.' },
    rejected: { title: '진행하지 않기로 했습니다', body: (p) => String(p.reason) },
    workStarted: { title: '작업을 시작했습니다', body: (p) => String(p.title) },
    workFinished: { title: 'AI 작업이 끝났습니다', body: '변경 내용과 테스트 결과를 검토해 주세요.' },
    previewReady: {
      title: '바뀐 화면을 미리 볼 수 있습니다',
      body: (p) => `${p.title} — 반영 전에 보고 의견을 주시면 먼저 고칠 수 있습니다.`,
    },
    previewGood: { title: '요청자가 미리보기를 좋다고 했습니다', body: (p) => String(p.title) },
    previewChange: { title: '요청자가 미리보기에서 수정을 요청했습니다', body: (p) => String(p.note) },
    pleaseCheck: {
      title: '결과를 확인해 주세요',
      body: (p) => `완료 기준 ${p.count}개를 하나씩 확인해 주시면 됩니다.`,
    },
    issueReported: { title: '확인에서 문제가 나왔습니다', body: (p) => String(p.title) },
    scheduleRelease: { title: '배포 일정을 정해 주세요', body: '요청자가 결과를 확인했습니다.' },
    released: { title: '반영되었습니다', body: (p) => String(p.title) },
    cancelled: { title: '요청이 취소되었습니다', body: (p) => String(p.title) },
    releaseDateSet: { title: '배포 예정일이 정해졌습니다', body: (p) => String(p.date) },
  },
  en: {
    reportReady: { title: 'Feasibility report is ready', body: (p) => String(p.title) },
    scopeCheck: { title: 'Please confirm the scope', body: (p) => String(p.title) },
    scopeApproved: { title: 'The requester confirmed the scope', body: (p) => String(p.title) },
    infoNeeded: { title: 'More information needed', body: (p) => String(p.questions) },
    requesterAnswered: { title: 'The requester answered', body: 'The report is being rewritten.' },
    rejected: { title: 'This request will not go ahead', body: (p) => String(p.reason) },
    workStarted: { title: 'Work has started', body: (p) => String(p.title) },
    workFinished: { title: 'AI work is done', body: 'Review the changes and test results.' },
    previewReady: {
      title: 'You can preview the change',
      body: (p) => `${p.title} — tell us what you think before it goes in, and it can be fixed first.`,
    },
    previewGood: { title: 'The requester likes the preview', body: (p) => String(p.title) },
    previewChange: { title: 'The requester asked for a change in the preview', body: (p) => String(p.note) },
    pleaseCheck: {
      title: 'Please check the result',
      body: (p) => `Check the ${p.count} acceptance criteria one by one.`,
    },
    issueReported: { title: 'A problem was found in the check', body: (p) => String(p.title) },
    scheduleRelease: { title: 'Set a release date', body: 'The requester has confirmed the result.' },
    released: { title: 'It is live', body: (p) => String(p.title) },
    cancelled: { title: 'Request cancelled', body: (p) => String(p.title) },
    releaseDateSet: { title: 'Release date set', body: (p) => String(p.date) },
  },
} satisfies Record<ServerLanguage, Record<string, { title: string; body: Text }>>

export type NotificationKey = keyof (typeof NOTIFICATIONS)['ko']

export function renderNotification(
  lang: ServerLanguage,
  key: NotificationKey,
  params: Params,
  requestId?: number,
): { title: string; body: string } {
  const entry: { title: string; body: Text } = NOTIFICATIONS[lang][key]
  const body = typeof entry.body === 'function' ? entry.body(params) : entry.body
  return { title: requestId ? `[#${requestId}] ${entry.title}` : entry.title, body }
}
