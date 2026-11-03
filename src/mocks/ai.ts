/**
 * Deterministic stand-ins for the AI jobs. A real backend replaces these
 * with model calls; the shapes they return are the contract. The text is
 * written in the request's language (Accept-Language), like a model would.
 * Token usage is simulated in each provider's own report format, so the
 * normalization in src/domain/ai.ts runs on the same shapes as in production.
 */
import type { AiProvider, AiTask, RawUsage } from '../domain/ai'
import type {
  FeasibilityReport,
  Project,
  RegressionCheck,
  ReportVerdict,
  WorkPhase,
  WorkRequest,
  WorkRun,
} from '../domain/model'
import { deriveWikiTrust } from '../domain/report'
import type { ServerLanguage } from './copy'

const COPY = {
  ko: {
    summary: {
      feasible: '근거 위키와 코드가 충분합니다. 바로 작업할 수 있습니다.',
      conditional: '추가 확인이 풀리면 바로 작업할 수 있습니다.',
      out_of_scope: '코드를 바꾸지 않아도 되는 요청입니다. 담당자가 직접 처리하는 편이 빠릅니다.',
      undetermined: '관련 위키를 찾지 못해 판단하지 못했습니다. 담당자가 직접 확인해 주세요.',
    },
    whichScreen: (other: string) => `‘${other}’이 어느 화면인지 확인이 필요합니다.`,
    vagueCriteria:
      '완료 기준 중 확인 방법이 모호한 항목이 있습니다. 요청자에게 구체적인 결과를 물어봐 주세요.',
    unverifiedRisk: '근거 위키 중 사람이 확인하지 않은 문서가 있어, 영향 범위가 실제보다 넓을 수 있습니다.',
    overlapRisk: (name: string) => `${name} 기능과 코드를 함께 쓰고 있어 동작이 겹칠 수 있습니다.`,
    implement: (text: string) => `${text} — 구현`,
    addTests: '완료 기준별 테스트 추가',
    updateWiki: '관련 위키 문서 갱신',
    autoMethod: '화면 동작을 자동 테스트(E2E)로 확인',
    manualMethod: '변경 전후 화면을 비교해 사람이 확인',
    done: (n: number) => `완료 기준 ${n}개를 반영했습니다.`,
    followedMemo: (memo: string) => `담당자 메모(“${memo}”)를 따랐습니다.`,
    testFailed: '기존 테스트 1개가 실패해 확인이 필요합니다.',
  },
  en: {
    summary: {
      feasible: 'The wiki and code give enough to go on. Work can start right away.',
      conditional: 'Work can start once the open questions are answered.',
      out_of_scope: 'No code change is needed. The developer can handle this directly, faster.',
      undetermined: 'No related wiki was found, so feasibility cannot be judged. Please check manually.',
    },
    whichScreen: (other: string) => `Confirm which screen “${other}” refers to.`,
    vagueCriteria:
      'Some acceptance criteria cannot be checked as written. Ask the requester for a concrete result.',
    unverifiedRisk:
      'Some evidence docs were not reviewed by a person, so the impact may be wider than it looks.',
    overlapRisk: (name: string) => `Shares code with ${name}, so the behaviour may overlap.`,
    implement: (text: string) => `Implement: ${text}`,
    addTests: 'Add a test for each acceptance criterion',
    updateWiki: 'Update the related wiki docs',
    autoMethod: 'Automated end-to-end test of the screen',
    manualMethod: 'A person compares the screen before and after',
    done: (n: number) => `Implemented the ${n} acceptance criteria.`,
    followedMemo: (memo: string) => `Followed the developer's note (“${memo}”).`,
    testFailed: 'One existing test fails and needs a look.',
  },
} satisfies Record<ServerLanguage, { summary: Record<ReportVerdict, string> } & Record<string, unknown>>

function selectedTargets(req: WorkRequest, project: Project) {
  return project.targets.filter((t) => req.targetIds.includes(t.id))
}

/** The first round(ratio × n) documented targets count as human-verified. */
export function verifiedTargetIds(project: Project): Set<string> {
  const documented = project.targets.filter((t) => t.wikiDoc)
  const ratio = project.wikiStats.totalDocs ? project.wikiStats.verifiedDocs / project.wikiStats.totalDocs : 0
  return new Set(documented.slice(0, Math.round(ratio * documented.length)).map((t) => t.id))
}

/** Up to two neighbouring features that share code with the selected ones. */
function neighbours(req: WorkRequest, project: Project): string[] {
  const idx = project.targets.map((t, i) => (req.targetIds.includes(t.id) ? i : -1)).filter((i) => i >= 0)
  const out = new Set<string>()
  for (const i of idx) {
    for (const j of [i + 1, i - 1]) {
      const t = project.targets[j]
      if (t && !req.targetIds.includes(t.id)) out.add(t.name)
    }
  }
  return [...out].slice(0, 2)
}

export function generateReport(
  req: WorkRequest,
  project: Project,
  now: Date,
  lang: ServerLanguage = 'ko',
): FeasibilityReport {
  const c = COPY[lang]
  const targets = selectedTargets(req, project)
  const verified = verifiedTargetIds(project)
  const wikiDocs = targets
    .filter((t) => t.wikiDoc)
    .map((t) => ({ path: `${project.wikiPath}/${t.wikiDoc}`, title: t.name, verified: verified.has(t.id) }))
  const codeFiles = targets.flatMap((t) => {
    const name = t.id.replace(/^t-/, '')
    return [`src/features/${name}/${name}.view.tsx`, `src/features/${name}/${name}.service.ts`]
  })
  const wikiTrust = deriveWikiTrust(wikiDocs)
  const recheck = neighbours(req, project)

  const answered = Boolean(req.infoRequest?.answer)
  const openQuestions: string[] = []
  if (!answered) {
    if (req.targetOther?.trim()) openQuestions.push(c.whichScreen(req.targetOther.trim()))
    if (req.precheck.some((i) => i.severity === 'warning' && i.field.startsWith('acceptanceCriteria'))) {
      openQuestions.push(c.vagueCriteria)
    }
  }

  let verdict: ReportVerdict
  if (req.type === 'non_code') verdict = 'out_of_scope'
  else if (wikiDocs.length === 0) verdict = 'undetermined'
  else if (openQuestions.length > 0 || wikiTrust === 'low') verdict = 'conditional'
  else verdict = 'feasible'

  const criteria = req.acceptanceCriteria
  const automatable = req.type !== 'copy_design'
  const score = criteria.length + targets.length
  const risks: string[] = []
  if (wikiTrust !== 'high' && wikiDocs.length > 0) risks.push(c.unverifiedRisk)
  if (recheck[0]) risks.push(c.overlapRisk(recheck[0]))

  return {
    revision: (req.report?.revision ?? 0) + 1,
    generatedAt: now.toISOString(),
    verdict,
    summary: c.summary[verdict],
    evidence: { wikiDocs, codeFiles },
    impact: { changedScreens: targets.map((t) => t.name), recheck },
    plan:
      verdict === 'out_of_scope' || verdict === 'undetermined'
        ? []
        : [...criteria.map((cr) => c.implement(cr.text.replace(/\.$/, ''))), c.addTests, c.updateWiki],
    verification: criteria.map((cr) => ({
      criterionId: cr.id,
      automatable,
      method: automatable ? c.autoMethod : c.manualMethod,
    })),
    openQuestions,
    wikiTrust,
    size: score <= 3 ? 'S' : score <= 5 ? 'M' : 'L',
    risks,
  }
}

/* ------------------------------------------------------------------ */
/* Work run                                                            */
/* ------------------------------------------------------------------ */

const PHASES: Array<[number, WorkPhase]> = [
  [0.1, 'queued'],
  [0.55, 'editing'],
  [0.85, 'testing'],
  [1, 'opening_mr'],
]

export function phaseAt(progress: number): WorkPhase {
  for (const [until, phase] of PHASES) if (progress < until) return phase
  return 'finished'
}

export function finishWork(
  req: WorkRequest,
  project: Project,
  now: Date,
  lang: ServerLanguage = 'ko',
): { work: WorkRun; regression: RegressionCheck[] } {
  const c = COPY[lang]
  const prev = req.work
  if (!prev) throw new Error(`request #${req.id} has no work run`)
  const criteria = req.acceptanceCriteria.length
  const targets = req.targetIds.length
  const failed = req.id % 7 === 0 && prev.attempt === 1
  const existingTotal = 80 + (req.id % 60)
  const number = 30 + (req.id % 50) + prev.attempt
  const url =
    project.repository.provider === 'gitlab'
      ? `${project.repository.url}/-/merge_requests/${number}`
      : `${project.repository.url}/pull/${number}`
  const wikiDocs = req.report?.evidence.wikiDocs.map((d) => d.path) ?? []

  const summaryParts = [c.done(criteria)]
  if (prev.instructions) summaryParts.push(c.followedMemo(prev.instructions))
  if (failed) summaryParts.push(c.testFailed)

  const work: WorkRun = {
    ...prev,
    phase: 'finished',
    finishedAt: now.toISOString(),
    outcome: failed ? 'tests_failed' : 'success',
    mergeRequest: {
      number,
      url,
      filesChanged: 2 + criteria + targets,
      additions: 20 + 30 * criteria,
      deletions: 4 * criteria,
    },
    tests: {
      existingPassed: failed ? existingTotal - 1 : existingTotal,
      existingTotal,
      criteriaPassed: failed ? criteria - 1 : criteria,
      criteriaTotal: criteria,
    },
    wikiChanges: { docs: wikiDocs.slice(0, 1), pendingReview: true },
    summary: summaryParts.join(' '),
  }

  const sources = req.report?.evidence.wikiDocs ?? []
  const regression: RegressionCheck[] = (req.report?.impact.recheck ?? []).map((label, i) => ({
    id: `rg-${req.id}-${i + 1}`,
    label,
    source: sources[i]?.path ?? `${project.wikiPath}/index.md`,
    result: 'pending',
  }))
  return { work, regression }
}

/* ------------------------------------------------------------------ */
/* Token usage                                                         */
/* ------------------------------------------------------------------ */

export interface UsageShape {
  /** Varies the numbers between requests; the request id is enough */
  seed: number
  criteria: number
  targets: number
  /** 1 for the first run or report revision */
  attempt: number
}

/** Small deterministic jitter in [0.9, 1.1]. */
function jitter(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return 0.9 + (x - Math.floor(x)) * 0.2
}

/**
 * Token counts for one AI job, as the provider reports them. precheck and
 * report are single model API calls; work is a whole coding-agent run
 * (Claude Code reports Anthropic usage; Codex reports per-turn usage that is
 * summed here). Cache reads dominate agent runs, as in practice.
 */
export function simulateUsage(task: AiTask, provider: AiProvider, s: UsageShape): RawUsage {
  const j = (salt: number, n: number) => Math.round(n * jitter(s.seed + s.attempt, salt))
  const sizes = {
    precheck: { fresh: 700 + 60 * s.criteria, cached: 1_800, written: 0, output: 160 + 40 * s.criteria },
    report: {
      fresh: 5_000 + 1_500 * s.targets + 800 * s.criteria,
      cached: s.attempt > 1 ? 26_000 : 2_000,
      written: s.attempt > 1 ? 1_500 : 24_000,
      output: 2_000 + 350 * s.criteria,
    },
    work: {
      fresh: 30_000 + 12_000 * s.criteria,
      cached: 800_000 + 250_000 * s.criteria + 150_000 * (s.attempt - 1),
      written: 50_000 + 10_000 * s.criteria,
      output: 16_000 + 6_000 * s.criteria,
    },
  }[task]
  const fresh = j(1, sizes.fresh)
  const cached = j(2, sizes.cached)
  const written = j(3, sizes.written)
  const output = j(4, sizes.output)
  if (provider === 'anthropic') {
    return {
      provider,
      usage: {
        input_tokens: fresh,
        cache_read_input_tokens: cached,
        cache_creation_input_tokens: written,
        output_tokens: output,
      },
    }
  }
  const reasoning = Math.round(output * (task === 'precheck' ? 0.25 : 0.4))
  if (task === 'work') {
    return {
      provider: 'codex',
      usage: {
        input_tokens: fresh + cached + written,
        cached_input_tokens: cached,
        cache_write_input_tokens: written,
        output_tokens: output,
        reasoning_output_tokens: reasoning,
      },
    }
  }
  return {
    provider,
    usage: {
      input_tokens: fresh + cached + written,
      input_tokens_details: { cached_tokens: cached, cache_write_tokens: written },
      output_tokens: output,
      output_tokens_details: { reasoning_tokens: reasoning },
    },
  }
}
