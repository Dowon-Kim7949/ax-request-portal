import type { NotificationSettings } from '@/domain/model'

type Channel = 'email' | 'messenger'

const ROWS = [
  { key: 'inApp', label: 'settings.inApp', hint: 'settings.inAppHint' },
  { key: 'email', label: 'settings.email', hint: 'settings.emailHint' },
  { key: 'messenger', label: 'settings.messenger', hint: 'settings.messengerHint' },
  { key: 'onlyActionRequired', label: 'settings.onlyAction', hint: 'settings.onlyActionHint' },
] as const satisfies ReadonlyArray<{ key: keyof NotificationSettings; label: string; hint: string }>

const CHANNELS: ReadonlySet<string> = new Set<Channel>(['email', 'messenger'])

/** The notification switches to offer: in-app ones always, other channels only when the backend sends them. */
export function notificationRows(channels: readonly Channel[]) {
  return ROWS.filter((row) => !CHANNELS.has(row.key) || channels.includes(row.key as Channel))
}
