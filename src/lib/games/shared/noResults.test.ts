import {
  poolCauses,
  statLimitCauses,
} from 'lib/games/shared/noResults'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

type Filters = { set?: string, main?: string, worn: boolean }

describe('poolCauses', () => {
  // The pool is empty while both the set and the main stat filter are on, or the set alone (nothing of it in slot 4)
  const poolEmpty = (f: Filters) => f.set === 'rare'
  const current: Filters = { set: 'rare', main: 'crit', worn: true }
  const candidates = [
    { key: 'main', label: 'Main stat', fixLabel: 'Allow any', apply: () => {}, without: { ...current, main: undefined } },
    { key: 'set', label: '4-piece set', fixLabel: 'Clear', apply: () => {}, without: { ...current, set: undefined } },
    { key: 'worn', label: 'Worn gear', fixLabel: 'Allow them', apply: () => {}, without: { ...current, worn: false } },
  ]

  it('marks the filters that empty the pool on their own and lists them first', () => {
    const causes = poolCauses(candidates, poolEmpty, true)
    expect(causes.map((c) => [c.key, c.blocking])).toEqual([['set', true], ['main', false], ['worn', false]])
  })

  it('marks nothing while the pool has pieces', () => {
    expect(poolCauses(candidates, poolEmpty, false).every((c) => !c.blocking)).toBe(true)
  })
})

describe('statLimitCauses', () => {
  it('lists each limit that is set, minimums first, and clears just that one', () => {
    const setMin = vi.fn()
    const causes = statLimitCauses(
      [{ key: 'critRate', label: 'CRIT Rate' }, { key: 'atk', label: 'ATK' }],
      { critRate: 70 },
      { atk: 2000 },
      setMin,
      () => {},
    )
    expect(causes.map((c) => c.label)).toEqual(['Minimum CRIT Rate 70', 'Maximum ATK 2000'])
    causes[0].apply()
    expect(setMin).toHaveBeenCalledWith({ critRate: undefined })
  })
})
