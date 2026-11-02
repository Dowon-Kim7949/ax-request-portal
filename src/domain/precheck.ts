import type { PrecheckIssue, RequestDraft } from './model'

/**
 * Deterministic submission check used by the mock API.
 *
 * In production this runs on a light model with structured output, but the
 * contract is the same: issues are shown next to the field and never block
 * submission — the portal never runs a back-and-forth chat with requesters;
 * remaining questions go person to person. The rules below double as a fallback when the
 * model is unavailable.
 */

const VAGUE_PHRASES = [
  '좀 ',
  '편하게',
  '깔끔하게',
  '알아서',
  '적당히',
  '보기 좋게',
  '예쁘게',
  '등등',
  '최대한',
]

const CONDITION = /(하면|되면|으면|면\s|면,|\S\s?때|경우|후에)/
const OUTCOME = /(된다|보인다|열린다|나온다|사라진다|바뀐다|이동한다|저장된다|표시된다|한다|있다|없다)\.?$/

function vaguePhrase(text: string): string | undefined {
  return VAGUE_PHRASES.find((p) => text.includes(p))
}

export function looksLikeAcceptanceCriterion(text: string): boolean {
  const t = text.trim()
  return CONDITION.test(t) && OUTCOME.test(t)
}

export function precheckDraft(draft: RequestDraft, today: string): PrecheckIssue[] {
  const issues: PrecheckIssue[] = []

  if (draft.type !== 'non_code' && draft.targetIds.length === 0 && !draft.targetOther?.trim()) {
    issues.push({
      field: 'targetIds',
      severity: 'warning',
      message: '대상 화면이나 기능을 고르면 AI가 관련 코드를 더 정확하게 찾습니다.',
    })
  }

  if (draft.type === 'bug') {
    const steps = draft.currentBehavior.split('\n').filter((l) => l.trim()).length
    if (steps < 2) {
      issues.push({
        field: 'currentBehavior',
        severity: 'warning',
        message: '버그라면 재현 순서를 한 줄에 하나씩 적어 주세요. (예: 1. 로그인 화면 열기 2. ...)',
      })
    }
  } else if (draft.type !== 'new_feature' && !draft.currentBehavior.trim()) {
    issues.push({
      field: 'currentBehavior',
      severity: 'info',
      message: '지금은 어떻게 동작하는지 적어 주면 무엇을 바꿀지 분명해집니다.',
    })
  }

  const vague = vaguePhrase(draft.desiredBehavior)
  if (vague) {
    issues.push({
      field: 'desiredBehavior',
      severity: 'warning',
      message: `‘${vague.trim()}’ 같은 표현은 사람마다 다르게 읽힙니다. 무엇이 어떻게 되면 좋은지 적어 주세요.`,
    })
  }

  draft.acceptanceCriteria.forEach((c, i) => {
    const phrase = vaguePhrase(c.text)
    if (phrase) {
      issues.push({
        field: `acceptanceCriteria.${i}`,
        severity: 'warning',
        message: `‘${phrase.trim()}’는 확인할 수 있는 기준이 아닙니다. 눈으로 확인할 수 있는 결과로 바꿔 주세요.`,
      })
    } else if (!looksLikeAcceptanceCriterion(c.text)) {
      issues.push({
        field: `acceptanceCriteria.${i}`,
        severity: 'info',
        message: '‘~하면 ~된다’ 형식으로 쓰면 맞는지 하나씩 확인할 수 있습니다.',
      })
    }
  })

  if (draft.desiredDate) {
    if (draft.desiredDate < today) {
      issues.push({ field: 'desiredDate', severity: 'warning', message: '희망 일정이 이미 지난 날짜입니다.' })
    }
    if (!draft.desiredDateReason?.trim()) {
      issues.push({
        field: 'desiredDateReason',
        severity: 'info',
        message: '날짜에 이유가 있으면 우선순위를 정할 때 도움이 됩니다. (예: 고객 약속)',
      })
    }
  }

  return issues
}
