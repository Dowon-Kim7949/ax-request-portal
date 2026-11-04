import * as z from 'zod'
import { Attachment, RequestType, type PrecheckIssue, type RequestDraft } from '@/domain/model'
import { ACCEPTANCE_CRITERIA_MAX, CHECKLIST_ITEMS_MAX } from '@/domain/model'

const ChecklistRow = z.object({
  ref: z.string().max(60),
  clause: z.string().max(60),
  finding: z.string().max(500),
  expected: z.string().max(300),
})
export type ChecklistRow = z.infer<typeof ChecklistRow>

export const EMPTY_ROW: ChecklistRow = { ref: '', clause: '', finding: '', expected: '' }
const filled = (r: ChecklistRow) =>
  Boolean(r.ref.trim() || r.clause.trim() || r.finding.trim() || r.expected.trim())

/**
 * Form model of the wizard. Looser than RequestDraft (empty strings while
 * typing); `toDraft` converts it to the API shape. Messages are i18n keys.
 */
export const WizardSchema = z
  .object({
    projectId: z.string().min(1, 'wizard.error.pickProject'),
    // Boolean(v), not `v !== ''`: an inferred type predicate would drop '' from the form type.
    type: z.union([RequestType, z.literal('')]).refine((v) => Boolean(v), 'wizard.error.pickType'),
    targetIds: z.array(z.string()),
    targetOther: z.string().max(200),
    title: z.string().trim().min(2, 'wizard.error.title').max(120),
    currentBehavior: z.string().max(2000),
    desiredBehavior: z.string().trim().min(1, 'wizard.error.desired').max(2000),
    acceptanceCriteria: z.array(z.object({ text: z.string().max(300) })).max(ACCEPTANCE_CRITERIA_MAX),
    checklistSource: z.string().max(100),
    checklist: z.array(ChecklistRow).max(CHECKLIST_ITEMS_MAX),
    outOfScope: z.string().max(1000),
    attachments: z.array(Attachment),
    desiredDate: z.string(),
    desiredDateReason: z.string().max(300),
  })
  .superRefine((v, ctx) => {
    // An audit request lists findings instead of acceptance criteria.
    if (v.type === 'checklist') {
      if (!v.checklist.some(filled)) {
        ctx.addIssue({ code: 'custom', path: ['checklist'], message: 'wizard.error.checklist' })
      }
      v.checklist.forEach((r, i) => {
        if (filled(r) && (!r.ref.trim() || !r.finding.trim())) {
          ctx.addIssue({ code: 'custom', path: ['checklist', i], message: 'wizard.error.checklistItem' })
        }
      })
    } else if (!v.acceptanceCriteria.some((c) => c.text.trim())) {
      ctx.addIssue({ code: 'custom', path: ['acceptanceCriteria'], message: 'wizard.error.criteria' })
    }
  })

export type WizardValues = z.infer<typeof WizardSchema>

export const EMPTY_VALUES: WizardValues = {
  projectId: '',
  type: '',
  targetIds: [],
  targetOther: '',
  title: '',
  currentBehavior: '',
  desiredBehavior: '',
  acceptanceCriteria: [{ text: '' }],
  checklistSource: '',
  checklist: [EMPTY_ROW],
  outOfScope: '',
  attachments: [],
  desiredDate: '',
  desiredDateReason: '',
}

export const STEPS = [
  { key: 'project', fields: ['projectId'] },
  { key: 'type', fields: ['type'] },
  { key: 'targets', fields: ['targetIds', 'targetOther'] },
  { key: 'describe', fields: ['title', 'currentBehavior', 'desiredBehavior'] },
  { key: 'criteria', fields: ['acceptanceCriteria', 'checklistSource', 'checklist'] },
  { key: 'extra', fields: ['outOfScope', 'attachments', 'desiredDate', 'desiredDateReason'] },
  { key: 'review', fields: [] },
] as const satisfies ReadonlyArray<{ key: string; fields: ReadonlyArray<keyof WizardValues> }>

export type StepKey = (typeof STEPS)[number]['key']

/** Which step owns a RequestDraft field (used to send precheck issues back to the right screen). */
export function stepOfField(field: string): number {
  const root = field.split('.')[0] as keyof WizardValues | 'attachmentIds'
  const key = root === 'attachmentIds' ? 'attachments' : root
  const index = STEPS.findIndex((s) => (s.fields as ReadonlyArray<string>).includes(key))
  return index < 0 ? STEPS.length - 1 : index
}

/** First step whose fields are not valid yet — the furthest a user may jump to. */
export function firstInvalidStep(values: WizardValues): number {
  const result = WizardSchema.safeParse(values)
  if (result.success) return STEPS.length - 1
  const bad = new Set(result.error.issues.map((i) => String(i.path[0])))
  const index = STEPS.findIndex((s) => s.fields.some((f) => bad.has(f)))
  return index < 0 ? STEPS.length - 1 : index
}

const blank = (s: string) => (s.trim() ? s.trim() : undefined)

export function toDraft(v: WizardValues): RequestDraft {
  const audit = v.type === 'checklist'
  return {
    projectId: v.projectId,
    type: v.type as RequestDraft['type'],
    title: v.title.trim(),
    targetIds: v.targetIds,
    targetOther: blank(v.targetOther),
    currentBehavior: v.currentBehavior.trim(),
    desiredBehavior: v.desiredBehavior.trim(),
    acceptanceCriteria: audit
      ? []
      : v.acceptanceCriteria.filter((c) => c.text.trim()).map((c) => ({ text: c.text.trim() })),
    ...(audit
      ? {
          checklistSource: blank(v.checklistSource),
          checklist: v.checklist.filter(filled).map((r) => ({
            ref: r.ref.trim(),
            clause: blank(r.clause),
            finding: r.finding.trim(),
            expected: blank(r.expected),
          })),
        }
      : {}),
    outOfScope: blank(v.outOfScope),
    attachmentIds: v.attachments.map((a) => a.id),
    desiredDate: blank(v.desiredDate),
    desiredDateReason: v.desiredDate ? blank(v.desiredDateReason) : undefined,
  }
}

/** Precheck issues keyed by the wizard field they belong to. */
export function adviceByField(issues: PrecheckIssue[]): Map<string, PrecheckIssue[]> {
  const map = new Map<string, PrecheckIssue[]>()
  for (const issue of issues) {
    const key = issue.field === 'attachmentIds' ? 'attachments' : issue.field
    map.set(key, [...(map.get(key) ?? []), issue])
  }
  return map
}

/**
 * Rows copied from a spreadsheet or a document table: tab-separated (or "|"),
 * one finding per line. 4+ columns = number, clause, finding, expected;
 * 3 = number, finding, expected; 2 = number, finding; 1 = finding.
 * A header row is skipped.
 */
export function parseChecklist(text: string): ChecklistRow[] {
  const clip = (s: string | undefined, n: number) => (s ?? '').trim().slice(0, n)
  const rows: ChecklistRow[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells = (line.includes('\t') ? line.split('\t') : line.split('|')).map((c) => c.trim())
    while (cells.length && !cells[0]) cells.shift()
    while (cells.length && !cells[cells.length - 1]) cells.pop()
    if (!cells.length) continue
    if (/^(#|no\.?|ref|id|번호|순번|지적\s*번호)$/i.test(cells[0]!)) continue
    const [a, b, c, d] = cells
    const row =
      cells.length >= 4
        ? { ref: a, clause: b, finding: c, expected: d }
        : cells.length === 3
          ? { ref: a, clause: '', finding: b, expected: c }
          : cells.length === 2
            ? { ref: a, clause: '', finding: b, expected: '' }
            : { ref: String(rows.length + 1), clause: '', finding: a, expected: '' }
    rows.push({
      ref: clip(row.ref, 60),
      clause: clip(row.clause, 60),
      finding: clip(row.finding, 500),
      expected: clip(row.expected, 300),
    })
  }
  return rows
}

/* ------------------------------------------------------------------ */
/* Draft persistence: phones switch apps; the draft must survive it.   */
/* ------------------------------------------------------------------ */

const draftKey = (userId: string) => `ax-request-portal:draft:${userId}`

/**
 * Shape-only schema for a half-written draft. It must not reuse WizardSchema's
 * constraints: an empty "desired behaviour" is normal mid-way, and rejecting it
 * would silently throw the whole draft away.
 */
const DraftShape = z
  .object({
    projectId: z.string(),
    type: z.union([RequestType, z.literal('')]),
    targetIds: z.array(z.string()),
    targetOther: z.string(),
    title: z.string(),
    currentBehavior: z.string(),
    desiredBehavior: z.string(),
    acceptanceCriteria: z.array(z.object({ text: z.string() })).max(ACCEPTANCE_CRITERIA_MAX),
    checklistSource: z.string(),
    checklist: z
      .array(z.object({ ref: z.string(), clause: z.string(), finding: z.string(), expected: z.string() }))
      .max(CHECKLIST_ITEMS_MAX),
    outOfScope: z.string(),
    attachments: z.array(Attachment),
    desiredDate: z.string(),
    desiredDateReason: z.string(),
  })
  .partial()

export function loadDraft(userId: string): WizardValues | null {
  try {
    const raw = localStorage.getItem(draftKey(userId))
    if (!raw) return null
    const parsed = DraftShape.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const draft = { ...EMPTY_VALUES, ...parsed.data }
    if (!draft.acceptanceCriteria.length) draft.acceptanceCriteria = [{ text: '' }]
    if (!draft.checklist.length) draft.checklist = [EMPTY_ROW]
    return draft
  } catch {
    return null
  }
}

export function saveDraft(userId: string, values: WizardValues): void {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(values))
  } catch {
    // Quota exceeded (large inline attachments): keep going without persistence.
  }
}

export function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(draftKey(userId))
  } catch {
    // ignore
  }
}

export function isEmptyDraft(v: WizardValues): boolean {
  return !v.projectId && !v.title && !v.desiredBehavior
}
