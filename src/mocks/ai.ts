/**
 * Deterministic stand-ins for the two AI jobs. A real backend replaces these
 * with model calls; the shapes they return are the contract.
 */
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

const SUMMARY: Record<ReportVerdict, string> = {
  feasible: '근거 위키와 코드가 충분합니다. 바로 작업할 수 있습니다.',
  conditional: '추가 확인이 풀리면 바로 작업할 수 있습니다.',
  out_of_scope: '코드를 바꾸지 않아도 되는 요청입니다. 담당자가 직접 처리하는 편이 빠릅니다.',
  undetermined: '관련 위키를 찾지 못해 판단하지 못했습니다. 담당자가 직접 확인해 주세요.',
}

export function generateReport(req: WorkRequest, project: Project, now: Date): FeasibilityReport {
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
    if (req.targetOther?.trim())
      openQuestions.push(`‘${req.targetOther.trim()}’이 어느 화면인지 확인이 필요합니다.`)
    for (const issue of req.precheck.filter((i) => i.severity === 'warning')) {
      if (issue.field.startsWith('acceptanceCriteria')) {
        openQuestions.push(
          '완료 기준 중 확인 방법이 모호한 항목이 있습니다. 요청자에게 구체적인 결과를 물어봐 주세요.',
        )
        break
      }
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
  if (wikiTrust !== 'high' && wikiDocs.length > 0) {
    risks.push('근거 위키 중 사람이 확인하지 않은 문서가 있어, 영향 범위가 실제보다 넓을 수 있습니다.')
  }
  if (recheck[0]) risks.push(`${recheck[0]} 기능과 코드를 함께 쓰고 있어 동작이 겹칠 수 있습니다.`)

  return {
    revision: (req.report?.revision ?? 0) + 1,
    generatedAt: now.toISOString(),
    verdict,
    summary: SUMMARY[verdict],
    evidence: { wikiDocs, codeFiles },
    impact: { changedScreens: targets.map((t) => t.name), recheck },
    plan:
      verdict === 'out_of_scope' || verdict === 'undetermined'
        ? []
        : [
            ...criteria.map((c) => c.text.replace(/\.$/, '') + ' — 구현'),
            '완료 기준별 테스트 추가',
            '관련 위키 문서 갱신',
          ],
    verification: criteria.map((c) => ({
      criterionId: c.id,
      automatable,
      method: automatable ? '화면 동작을 자동 테스트(E2E)로 확인' : '변경 전후 화면을 비교해 사람이 확인',
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
): { work: WorkRun; regression: RegressionCheck[] } {
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

  const summaryParts = [`완료 기준 ${criteria}개를 반영했습니다.`]
  if (prev.instructions) summaryParts.push(`담당자 메모(“${prev.instructions}”)를 따랐습니다.`)
  if (failed) summaryParts.push('기존 테스트 1개가 실패해 확인이 필요합니다.')

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
    costKrw: 1800 + 900 * criteria + 300 * prev.attempt,
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

/** Approximate cost in KRW of writing one report (heavy model). */
export function reportCost(req: WorkRequest): number {
  return 400 + 150 * req.acceptanceCriteria.length + 100 * req.targetIds.length
}

/** Approximate cost in KRW of one submission check (light model). */
export const PRECHECK_COST_KRW = 1
