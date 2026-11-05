import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@/i18n'
import type { WorkRequest } from '@/domain/model'
import { usePreferences } from '@/stores/preferences'
import { ReleaseCard } from './request-content'

afterEach(() => {
  usePreferences.setState({ timeZone: 'auto', showHqTime: true })
})

const at = (timeZone: string) => usePreferences.setState({ timeZone, showHqTime: true })

describe('ReleaseCard', () => {
  const released = {
    status: 'done',
    release: { scheduledDate: '2026-11-05', releasedAt: '2026-11-05T01:30:00.000Z' },
  } as unknown as WorkRequest

  it('shows the release day of the schedule and the dashboard, wherever the viewer is', () => {
    at('America/Los_Angeles')
    const { container } = render(<ReleaseCard request={released} />)
    expect(container).toHaveTextContent('11월 5일 (목) 배포됨')
    expect(container).toHaveTextContent('본사(한국) 시간 기준')
  })

  it('adds no note for a viewer on the head-office clock', () => {
    at('Asia/Seoul')
    const { container } = render(<ReleaseCard request={released} />)
    expect(container).toHaveTextContent('11월 5일 (목) 배포됨')
    expect(container).not.toHaveTextContent('본사')
  })
})
