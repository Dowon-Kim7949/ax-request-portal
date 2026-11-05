import * as z from 'zod'
import { Attachment, RequestType, type PrecheckIssue, type RequestDraft } from '@/domain/model'
import { ACCEPTANCE_CRITERIA_MAX, CHECKLIST_ITEMS_MAX } from '@/domain/model'
import { draftKey } from '@/stores/draft'

export { clearDraft } from '@/stores/draft'

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

/**
 * An attachment as a draft stores it: shape only. Whether the URL may be shown
 * is checked per attachment after reading (`restoreDraft`), so a contract rule
 * that grew stricter drops that attachment, not the whole draft.
 */
const DraftAttachment = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
  url: z.string(),
})

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
    attachments: z.array(DraftAttachment),
    desiredDate: z.string(),
    desiredDateReason: z.string(),
  })
  .partial()

/** A draft read back: the values, and the names of attachments that could not be kept. */
export interface RestoredDraft {
  values: WizardValues
  /** Attachments the draft held whose URL is no longer accepted (e.g. a type an earlier version allowed) */
  droppedAttachments: string[]
}

export function restoreDraft(userId: string): RestoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId))
    if (!raw) return null
    const parsed = DraftShape.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const { attachments = [], ...rest } = parsed.data
    const kept: Attachment[] = []
    const droppedAttachments: string[] = []
    for (const a of attachments) {
      const ok = Attachment.safeParse(a)
      if (ok.success) kept.push(ok.data)
      else droppedAttachments.push(a.name)
    }
    const values: WizardValues = { ...EMPTY_VALUES, ...rest, attachments: kept }
    if (!values.acceptanceCriteria.length) values.acceptanceCriteria = [{ text: '' }]
    if (!values.checklist.length) values.checklist = [EMPTY_ROW]
    return { values, droppedAttachments }
  } catch {
    return null
  }
}

export function loadDraft(userId: string): WizardValues | null {
  return restoreDraft(userId)?.values ?? null
}

/**
 * The attachments a submission was refused for: the server names each one it
 * cannot find as `attachmentIds.<index>` in `issues` (see createRequest in the
 * contract). Ids, in the order sent; empty when the refusal is about something else.
 */
export function missingAttachmentIds(
  issues: ReadonlyArray<{ path: string; message: string }> | undefined,
  attachmentIds: readonly string[],
): string[] {
  const ids = (issues ?? []).flatMap((issue) => {
    const index = /^attachmentIds\.(\d+)$/.exec(issue.path)?.[1]
    const id = index === undefined ? undefined : attachmentIds[Number(index)]
    return id === undefined ? [] : [id]
  })
  return [...new Set(ids)]
}

/** How long typing pauses before the draft is written (every keystroke would re-serialise attachments). */
export const DRAFT_SAVE_DELAY_MS = 300

/** What became of a draft save: kept whole, kept without its attachments, or not kept at all. */
export type DraftSaveResult = 'saved' | 'withoutAttachments' | 'failed'

export function saveDraft(userId: string, values: WizardValues): DraftSaveResult {
  const key = draftKey(userId)
  try {
    localStorage.setItem(key, JSON.stringify(values))
    return 'saved'
  } catch {
    // Quota exceeded, or storage blocked. Fall through.
  }
  // Inline attachments (data URLs in the demo) fill the quota first: keep the words at least.
  if (values.attachments.length) {
    try {
      localStorage.setItem(key, JSON.stringify({ ...values, attachments: [] }))
      return 'withoutAttachments'
    } catch {
      // Still too large: the previous draft, if any, stays as it was.
    }
  }
  return 'failed'
}

export function isEmptyDraft(v: WizardValues): boolean {
  return !v.projectId && !v.title && !v.desiredBehavior
}

/**
 * Something the person wrote or attached — worth a "leave anyway?" question.
 * Picking the service, type or screens is not: each takes one tap to redo.
 */
export function hasWrittenContent(v: WizardValues): boolean {
  return Boolean(
    v.title.trim() ||
    v.currentBehavior.trim() ||
    v.desiredBehavior.trim() ||
    v.targetOther.trim() ||
    v.acceptanceCriteria.some((c) => c.text.trim()) ||
    v.checklistSource.trim() ||
    v.checklist.some(filled) ||
    v.outOfScope.trim() ||
    v.attachments.length ||
    v.desiredDate ||
    v.desiredDateReason.trim(),
  )
}
