import type { PrecheckIssue, RequestDraft } from './model'

/**
 * Deterministic submission check used by the mock API.
 *
 * In production this runs on a light model with structured output, but the
 * contract is the same: issues are shown next to the field and never block
 * submission — the portal never runs a back-and-forth chat with requesters;
 * remaining questions go person to person. The rules below double as a
 * fallback when the model is unavailable.
 *
 * Detection works on Korean and English text regardless of the UI language;
 * the messages follow `lang` (the request's Accept-Language).
 */

export type PrecheckLanguage = 'ko' | 'en'

/** Vague words that read differently to every person */
const VAGUE_KO = ['좀 ', '편하게', '깔끔하게', '알아서', '적당히', '보기 좋게', '예쁘게', '등등', '최대한']
const VAGUE_EN = [
  'somehow',
  'nicer',
  'better',
  'user-friendly',
  'user friendly',
  'cleaner',
  'as soon as possible',
  'etc',
  'and so on',
  'intuitive',
  'easier',
]

const CONDITION_KO = /(하면|되면|으면|면\s|면,|\S\s?때|경우|후에)/
const OUTCOME_KO = /(된다|보인다|열린다|나온다|사라진다|바뀐다|이동한다|저장된다|표시된다|한다|있다|없다)\.?$/
const CONDITION_EN = /\b(when|if|after|once|whenever|on)\b/i
const OUTCOME_EN =
  /\b(is|are|gets?|shows?|appears?|opens?|closes?|displays?|saves?|is saved|redirects?|returns?|becomes?|changes?|sees?|receives?|disappears?|lists?|downloads?)\b/i

const MESSAGES = {
  ko: {
    targets: '대상 화면이나 기능을 고르면 AI가 관련 코드를 더 정확하게 찾습니다.',
    reproSteps: '버그라면 재현 순서를 한 줄에 하나씩 적어 주세요. (예: 1. 로그인 화면 열기 2. ...)',
    current: '지금은 어떻게 동작하는지 적어 주면 무엇을 바꿀지 분명해집니다.',
    vagueDesired: (w: string) =>
      `‘${w}’ 같은 표현은 사람마다 다르게 읽힙니다. 무엇이 어떻게 되면 좋은지 적어 주세요.`,
    vagueCriterion: (w: string) =>
      `‘${w}’는 확인할 수 있는 기준이 아닙니다. 눈으로 확인할 수 있는 결과로 바꿔 주세요.`,
    criterionForm: '‘~하면 ~된다’ 형식으로 쓰면 맞는지 하나씩 확인할 수 있습니다.',
    pastDate: '희망 일정이 이미 지난 날짜입니다.',
    dateReason: '날짜에 이유가 있으면 우선순위를 정할 때 도움이 됩니다. (예: 고객 약속)',
    duplicateRef: (ref: string) => `‘${ref}’ 번호가 두 번 나옵니다. 같은 지적이면 하나로 합쳐 주세요.`,
    expected: '어떻게 되면 해결된 것인지 적으면, 나중에 항목별로 확인하기 쉬워집니다.',
  },
  en: {
    targets: 'Picking the screens or features helps the AI find the right code.',
    reproSteps:
      'For a bug, list the steps to reproduce it, one per line (e.g. 1. Open the sign-in screen 2. …).',
    current: 'Describing what happens today makes it clear what should change.',
    vagueDesired: (w: string) =>
      `Words like "${w}" mean different things to different people. Say what should happen.`,
    vagueCriterion: (w: string) => `"${w}" cannot be checked. Describe a result you could see on screen.`,
    criterionForm: 'Writing it as "when X, Y happens" makes it easy to check one by one.',
    pastDate: 'The wanted-by date is already in the past.',
    dateReason: 'A reason for the date helps with prioritising (e.g. a customer commitment).',
    duplicateRef: (ref: string) => `"${ref}" appears twice. If it is the same finding, merge them.`,
    expected: 'Saying what counts as fixed makes each item easy to check later.',
  },
} as const

function vaguePhrase(text: string): string | undefined {
  const ko = VAGUE_KO.find((p) => text.includes(p))
  if (ko) return ko.trim()
  const lower = text.toLowerCase()
  return VAGUE_EN.find((p) => new RegExp(`\\b${p.replace(/[-\s]/g, '[-\\s]')}\\b`).test(lower))
}

/** "~하면 ~된다" or "when X, Y happens" */
export function looksLikeAcceptanceCriterion(text: string): boolean {
  const t = text.trim()
  return (CONDITION_KO.test(t) && OUTCOME_KO.test(t)) || (CONDITION_EN.test(t) && OUTCOME_EN.test(t))
}

export function precheckDraft(
  draft: RequestDraft,
  today: string,
  lang: PrecheckLanguage = 'ko',
): PrecheckIssue[] {
  const m = MESSAGES[lang]
  const issues: PrecheckIssue[] = []

  if (draft.type !== 'non_code' && draft.targetIds.length === 0 && !draft.targetOther?.trim()) {
    issues.push({ field: 'targetIds', severity: 'warning', message: m.targets })
  }

  if (draft.type === 'bug') {
    const steps = draft.currentBehavior.split('\n').filter((l) => l.trim()).length
    if (steps < 2) issues.push({ field: 'currentBehavior', severity: 'warning', message: m.reproSteps })
  } else if (draft.type !== 'new_feature' && draft.type !== 'checklist' && !draft.currentBehavior.trim()) {
    issues.push({ field: 'currentBehavior', severity: 'info', message: m.current })
  }

  const vague = vaguePhrase(draft.desiredBehavior)
  if (vague) issues.push({ field: 'desiredBehavior', severity: 'warning', message: m.vagueDesired(vague) })

  draft.acceptanceCriteria.forEach((c, i) => {
    const phrase = vaguePhrase(c.text)
    if (phrase) {
      issues.push({
        field: `acceptanceCriteria.${i}`,
        severity: 'warning',
        message: m.vagueCriterion(phrase),
      })
    } else if (!looksLikeAcceptanceCriterion(c.text)) {
      issues.push({ field: `acceptanceCriteria.${i}`, severity: 'info', message: m.criterionForm })
    }
  })

  const seen = new Set<string>()
  draft.checklist?.forEach((item, i) => {
    const ref = item.ref.trim()
    if (seen.has(ref)) {
      issues.push({ field: `checklist.${i}.ref`, severity: 'warning', message: m.duplicateRef(ref) })
    }
    seen.add(ref)
    if (!item.expected?.trim()) {
      issues.push({ field: `checklist.${i}.expected`, severity: 'info', message: m.expected })
    }
  })

  if (draft.desiredDate) {
    if (draft.desiredDate < today)
      issues.push({ field: 'desiredDate', severity: 'warning', message: m.pastDate })
    if (!draft.desiredDateReason?.trim()) {
      issues.push({ field: 'desiredDateReason', severity: 'info', message: m.dateReason })
    }
  }

  return issues
}
