/** The change before it goes in: the requester reacts, the developer sees the reaction. */
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { usePreviewFeedback } from '@/api/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { DateTimeText } from '@/components/ui/date-time'
import { Field, Textarea } from '@/components/ui/field'
import type { PreviewFeedback, WorkPreview, WorkRequest } from '@/domain/model'
import { isSafeUrl } from '@/domain/url'

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

export function PreviewImages({ preview, compact }: { preview: WorkPreview; compact?: boolean }) {
  const shots = preview.screenshots.filter((s) => isSafeUrl(s.url, 'image'))
  if (!shots.length) return null
  return (
    <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
      {shots.map((s) => (
        <figure key={s.id} className="min-w-0">
          <img
            src={s.url}
            alt={s.alt}
            loading="lazy"
            className="h-auto w-full rounded-xl bg-surface ring-1 ring-line"
          />
          {s.caption && !compact ? (
            <figcaption className="mt-1 text-xs text-ink-500">{s.caption}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  )
}

export function PreviewLink({ url, label }: { url: string; label: string }) {
  // Defence in depth: the contract already refuses a URL that is not http(s) or on this site.
  if (!isSafeUrl(url, 'link')) return null
  return (
    <Button asChild variant="secondary" size="lg" block>
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink aria-hidden />
        {label}
      </a>
    </Button>
  )
}

export function FeedbackBadge({ feedback }: { feedback: PreviewFeedback }) {
  const { t } = useTranslation()
  return (
    <Badge tone={feedback.verdict === 'looks_good' ? 'success' : 'warning'}>
      {t(`detail.preview.verdict.${feedback.verdict}`)}
    </Badge>
  )
}

/** The requester's card while the change is in code review. Optional: nothing waits on it. */
export function PreviewCard({ request }: { request: WorkRequest }) {
  const { t } = useTranslation()
  const send = usePreviewFeedback(request.id)
  const preview = request.work?.preview
  const feedback = request.work?.previewFeedback
  const [editing, setEditing] = useState(false)
  const [changing, setChanging] = useState(false)
  const [note, setNote] = useState('')
  if (!preview) return null

  const submit = (verdict: PreviewFeedback['verdict']) =>
    send.mutate(verdict === 'needs_change' ? { verdict, note: note.trim() } : { verdict }, {
      onSuccess: () => {
        setEditing(false)
        setChanging(false)
        toast.success(t('detail.preview.sent'))
      },
      onError: (e) => toast.error(errorText(e, t('errors.generic'))),
    })
  const asking = !feedback || editing

  return (
    <Card className="ring-2 ring-brand-500/40" aria-labelledby="preview-title">
      <CardHeader className="items-start">
        <div>
          <CardTitle id="preview-title">{t('detail.preview.title')}</CardTitle>
          <p className="mt-1 text-sm text-ink-500">{t('detail.preview.lead')}</p>
        </div>
      </CardHeader>

      <PreviewImages preview={preview} />
      {preview.url ? (
        <div className="mt-3">
          <PreviewLink url={preview.url} label={t('detail.preview.open')} />
          {preview.expiresAt ? (
            <p className="mt-1.5 text-center text-xs text-ink-500">
              <DateTimeText
                iso={preview.expiresAt}
                variant="full"
                sentence={(date) => t('detail.preview.until', { date })}
              />
            </p>
          ) : null}
        </div>
      ) : null}

      {asking ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="secondary"
              loading={send.isPending && send.variables?.verdict === 'looks_good'}
              onClick={() => submit('looks_good')}
            >
              {t('detail.preview.good')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              aria-expanded={changing}
              aria-controls="preview-change"
              onClick={() => setChanging((v) => !v)}
            >
              {t('detail.preview.change')}
            </Button>
          </div>
          {changing ? (
            <form
              id="preview-change"
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (note.trim()) submit('needs_change')
              }}
            >
              <Field label={t('detail.preview.changeNote')}>
                {(p) => (
                  <Textarea
                    {...p}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('detail.preview.changePlaceholder')}
                  />
                )}
              </Field>
              <Button
                type="submit"
                size="lg"
                block
                disabled={!note.trim()}
                loading={send.isPending && send.variables?.verdict === 'needs_change'}
              >
                {t('detail.preview.send')}
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-muted px-4 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-700">
              {t('detail.preview.yours')}
              <FeedbackBadge feedback={feedback} />
            </p>
            {feedback.note ? <p className="mt-1 text-ink-700">{feedback.note}</p> : null}
          </div>
          <Button variant="ghost" className="w-fit" onClick={() => setEditing(true)}>
            {t('detail.preview.edit')}
          </Button>
        </div>
      )}
    </Card>
  )
}
