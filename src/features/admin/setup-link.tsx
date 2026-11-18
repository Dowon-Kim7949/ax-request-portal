import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { SetupLink } from '@/api/contract'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import type { User } from '@/domain/model'
import { setupUrl } from '@/features/auth/setup-url'
import { formatDateTime } from '@/lib/format'

/** Shows a setup link once, to copy and pass on. Closing it forgets the link. */
export function SetupLinkSheet({
  issued,
  onClose,
}: {
  issued: { user: User; link: SetupLink } | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const url = issued ? setupUrl(issued.link.token) : ''
  const name = issued?.user.name ?? ''

  const copy = () => {
    if (!navigator.clipboard) {
      toast.error(t('users.copyFailed'))
      return
    }
    navigator.clipboard.writeText(url).then(
      () => toast.success(t('users.linkCopied')),
      () => toast.error(t('users.copyFailed')),
    )
  }

  return (
    <Sheet
      open={issued !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t('users.setupLinkTitle', { name })}
      closeLabel={t('common.close')}
    >
      {issued ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-ink-600">
            {t('users.setupLinkHint', { name, expires: formatDateTime(issued.link.expiresAt) })}
          </p>
          <Field label={t('users.setupLinkLabel')}>
            {(p) => (
              <Input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-[13px]"
                {...p}
              />
            )}
          </Field>
          <Button size="lg" block onClick={copy}>
            <Copy aria-hidden />
            {t('users.copyLink')}
          </Button>
          <p className="text-[13px] leading-relaxed text-ink-500">{t('users.setupLinkOnce')}</p>
        </div>
      ) : null}
    </Sheet>
  )
}
