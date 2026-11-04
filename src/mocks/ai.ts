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
  ScopeProposal,
  ScopeQuestion,
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
    previewAlt: (title: string) => `바뀐 화면 미리보기(가상 이미지): ${title}`,
    previewCaption: '미리보기 배포에서 찍은 화면',
    previewBadge: '미리보기',
    noWikiAssumption: (name: string) =>
      `‘${name}’은 위키 문서가 없어, 화면 이름으로 관련 코드를 찾았다고 가정했습니다.`,
    unverifiedAssumption: (titles: string) =>
      `사람이 검토하지 않은 위키(${titles})의 설명이 지금 코드와 같다고 보고 계획했습니다.`,
    constraintKept: '작업 계획과 AI 작업 지시에 이 제약을 넣었습니다.',
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
    previewAlt: (title: string) => `Preview of the changed screen (illustration): ${title}`,
    previewCaption: 'Captured on the preview deployment',
    previewBadge: 'Preview',
    noWikiAssumption: (name: string) =>
      `“${name}” has no wiki doc, so the related code was found by the screen name alone.`,
    unverifiedAssumption: (titles: string) =>
      `The plan takes the wiki docs no person has reviewed (${titles}) to match the current code.`,
    constraintKept: 'Added to the plan and to the AI work instructions.',
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

  const assumptionTexts: string[] = []
  for (const t of targets) if (!t.wikiDoc) assumptionTexts.push(c.noWikiAssumption(t.name))
  const unreviewed = wikiDocs.filter((d) => !d.verified).map((d) => d.title)
  if (unreviewed.length) assumptionTexts.push(c.unverifiedAssumption(unreviewed.join(', ')))
  const assumptions = assumptionTexts.map((text, i) => ({ id: `a${i + 1}`, text }))

  // The simulated AI never finds a conflict; a real model compares the plan with each rule.
  const constraintChecks = project.constraints.map((k) => ({
    constraintId: k.id,
    text: k.text,
    ...(k.reference ? { reference: k.reference } : {}),
    conflict: false,
    note: c.constraintKept,
  }))
  const conflict = constraintChecks.some((k) => k.conflict)

  let verdict: ReportVerdict
  if (req.type === 'non_code') verdict = 'out_of_scope'
  else if (wikiDocs.length === 0) verdict = 'undetermined'
  else if (openQuestions.length > 0 || wikiTrust === 'low' || conflict) verdict = 'conditional'
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
    assumptions: verdict === 'out_of_scope' ? [] : assumptions,
    constraintChecks: verdict === 'out_of_scope' ? [] : constraintChecks,
    wikiTrust,
    size: score <= 3 ? 'S' : score <= 5 ? 'M' : 'L',
    risks,
  }
}

/* ------------------------------------------------------------------ */
/* Scope proposal (the requester's view of the report)                 */
/* ------------------------------------------------------------------ */

const SCOPE_COPY = {
  ko: {
    thisService: '이 서비스',
    summary: (where: string, desired: string) => `${where}에서 ‘${desired}’ 되도록 바꿉니다.`,
    criteria: (n: number) => `아래 ${n}가지가 되면 끝난 것으로 봅니다.`,
    more: (n: number) => `그 밖에 ${n}건 (요청서의 항목 그대로)`,
    revised: (note: string) => `말씀하신 ‘${note}’를 반영해 다시 정리했어요.`,
    keep: (name: string) =>
      `‘${name}’ 화면은 바꾸지 않아요. 같은 코드를 써서, 영향이 없는지만 다시 확인해요.`,
    whichScreen: (other: string) => `‘${other}’은 어느 화면을 말씀하신 건가요?`,
    newScreen: '목록에 없는 새 화면이에요',
    notSure: '잘 모르겠어요',
    alsoChange: (name: string) => `‘${name}’ 화면도 같이 바뀌어야 하나요?`,
    onlyRequested: '아니요, 요청한 화면만 바꿔 주세요',
    both: (name: string) => `네, ‘${name}’도 같이 바꿔 주세요`,
  },
  en: {
    thisService: 'this service',
    summary: (where: string, desired: string) => `On ${where}, change it so that “${desired}”.`,
    criteria: (n: number) => `It is done when the ${n} item(s) below work.`,
    more: (n: number) => `${n} more, as listed in the request`,
    revised: (note: string) => `Summed up again with your note: “${note}”.`,
    keep: (name: string) =>
      `“${name}” stays as it is. It shares code, so it is only re-checked for side effects.`,
    whichScreen: (other: string) => `Which screen do you mean by “${other}”?`,
    newScreen: 'A new screen that is not listed',
    notSure: 'Not sure',
    alsoChange: (name: string) => `Should “${name}” change as well?`,
    onlyRequested: 'No, only the screens I asked for',
    both: (name: string) => `Yes, change “${name}” too`,
  },
} satisfies Record<ServerLanguage, Record<string, unknown>>

/** The note of the last "not quite" since the scope was last written, if any. */
function lastRevisionNote(req: WorkRequest): string | undefined {
  for (let i = req.timeline.length - 1; i >= 0; i--) {
    const e = req.timeline[i]!
    if (e.event === 'scopeReady') return undefined
    if (e.event === 'reviseScope') return e.note
  }
  return undefined
}

/**
 * What the requester confirms: the report in plain words, plus a choice
 * wherever the request can be read two ways. Written in the same model call
 * as the report, so it costs nothing extra.
 */
export function generateScope(
  req: WorkRequest,
  project: Project,
  report: FeasibilityReport,
  lang: ServerLanguage = 'ko',
): ScopeProposal {
  const c = SCOPE_COPY[lang]
  const names = selectedTargets(req, project).map((t) => t.name)
  const where = names.length ? names.join(', ') : req.targetOther?.trim() || c.thisService
  const note = lastRevisionNote(req)
  const criteria = req.acceptanceCriteria.map((cr) => cr.text)

  const questions: ScopeQuestion[] = []
  const other = req.targetOther?.trim()
  if (other && !req.infoRequest?.answer) {
    const candidates = project.targets.filter((t) => !req.targetIds.includes(t.id)).slice(0, 2)
    questions.push({
      id: 'q-screen',
      text: c.whichScreen(other),
      options: [
        ...candidates.map((t) => ({ id: t.id, label: t.name })),
        { id: 'new', label: c.newScreen },
        ...(candidates.length ? [] : [{ id: 'unsure', label: c.notSure }]),
      ],
    })
  }
  const neighbour = report.impact.recheck[0]
  if (neighbour) {
    // The AI tends to widen a change to code it shares; ask instead of assuming.
    questions.push({
      id: 'q-extent',
      text: c.alsoChange(neighbour),
      options: [
        { id: 'only', label: c.onlyRequested },
        { id: 'both', label: c.both(neighbour) },
      ],
      recommended: 'only',
    })
  }

  return {
    revision: report.revision,
    summary: [
      c.summary(where, req.desiredBehavior.trim().replace(/[.。]$/, '')),
      c.criteria(criteria.length),
      ...(note ? [c.revised(note)] : []),
    ].join(' '),
    changes: criteria.length > 5 ? [...criteria.slice(0, 4), c.more(criteria.length - 4)] : criteria,
    unchanged: [
      ...(req.outOfScope?.trim() ? [req.outOfScope.trim()] : []),
      ...report.impact.recheck.map(c.keep),
    ].slice(0, 5),
    questions: questions.slice(0, 3),
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

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A fictional screen with the request's title and criteria, so the demo has something to look at. */
function previewImage(title: string, criteria: string[], badge: string): string {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
  const rows = criteria
    .slice(0, 4)
    .map(
      (c, i) =>
        `<rect x="24" y="${96 + i * 40}" width="312" height="30" rx="8" fill="#eef2f7"/>` +
        `<circle cx="42" cy="${111 + i * 40}" r="6" fill="#2f6fde"/>` +
        `<text x="56" y="${116 + i * 40}" font-size="13" fill="#1f2937">${xml(clip(c, 30))}</text>`,
    )
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="270" viewBox="0 0 360 270" font-family="sans-serif">` +
    `<rect width="360" height="270" rx="16" fill="#ffffff"/>` +
    `<rect width="360" height="48" rx="16" fill="#1f3b70"/><rect y="32" width="360" height="16" fill="#1f3b70"/>` +
    `<text x="24" y="31" font-size="15" font-weight="700" fill="#ffffff">${xml(clip(title, 26))}</text>` +
    `<rect x="276" y="14" width="64" height="20" rx="10" fill="#ffd166"/>` +
    `<text x="308" y="28" font-size="11" text-anchor="middle" fill="#1f2937">${xml(badge)}</text>` +
    `<rect x="24" y="64" width="160" height="12" rx="6" fill="#d7dee8"/>` +
    rows +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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
    // A real pipeline deploys the branch and captures the changed screens; no AI involved.
    ...(failed
      ? {}
      : {
          preview: {
            url: `https://preview.example.com/ax-request-${req.id}/`,
            screenshots: [
              {
                id: `shot-${req.id}-${prev.attempt}`,
                url: previewImage(
                  req.title,
                  req.acceptanceCriteria.map((a) => a.text),
                  c.previewBadge,
                ),
                alt: c.previewAlt(req.title),
                caption: c.previewCaption,
              },
            ],
            expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
          },
        }),
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
