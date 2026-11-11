import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/i18n'
import { PeopleList, TeamBars, TOP_PEOPLE } from './usage-charts'

const names: Record<string, string> = { 'u-1': '김하나' }
const userName = (id: string) => names[id] ?? id

describe('people', () => {
  it('names the ten who spent most and sums everyone else in one row', () => {
    const rows = Array.from({ length: TOP_PEOPLE + 3 }, (_, i) => ({
      userId: `u-${i + 1}`,
      ...(i % 2 ? {} : { team: '기획팀' }),
      calls: 2,
      costKrw: 1_000 * (TOP_PEOPLE + 3 - i),
    }))
    render(<PeopleList rows={rows} userName={userName} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(TOP_PEOPLE + 1)
    expect(items[0]).toHaveTextContent('김하나 기획팀')
    // No team: the name stands alone.
    expect(items[1]).toHaveTextContent(/^u-2\d/)
    expect(items[1]).not.toHaveTextContent('기획팀')
    // The last three: 3,000 + 2,000 + 1,000 won in 6 calls.
    const rest = items[TOP_PEOPLE]!
    expect(within(rest).getByText('그 외 3명')).toBeInTheDocument()
    expect(rest).toHaveTextContent('6,000원')
    expect(rest).toHaveTextContent('6회')
  })

  it('has no "everyone else" row when ten or fewer people spent', () => {
    render(<PeopleList rows={[{ userId: 'u-1', calls: 1, costKrw: 500 }]} userName={userName} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText(/그 외/)).not.toBeInTheDocument()
  })
})

describe('teams', () => {
  it('names the row of people without a team', () => {
    render(
      <TeamBars
        rows={[
          { team: '개발팀', calls: 4, costKrw: 8_000 },
          { calls: 1, costKrw: 500 },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('개발팀')
    expect(items[1]).toHaveTextContent('팀 없음')
  })
})
