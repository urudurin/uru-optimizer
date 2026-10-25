import {
  formatNumber,
  roundHalfUp,
} from 'lib/games/shared/format'
import {
  compareValues,
  insertRanked,
  type Ranked,
  wouldRank,
} from 'lib/games/shared/ranking'
import {
  hasStringId,
  mergeById,
  parseVersionedSave,
} from 'lib/games/shared/storage'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('format', () => {
  it('rounds half up like the stat screens', () => {
    expect(roundHalfUp(10563.6)).toBe(10564)
    expect(roundHalfUp(0.5)).toBe(1)
    expect(roundHalfUp(95.80000000000001, 1)).toBe(95.8)
    expect(roundHalfUp(1.005, 2)).toBe(1.01)
  })

  it('formats with thousands separators and a suffix', () => {
    expect(formatNumber(14745600)).toBe('14,745,600')
    expect(formatNumber(70.6, '%')).toBe('70.6%')
  })
})

describe('ranking', () => {
  it('compares main values first, then tie-breakers', () => {
    expect(compareValues([2, 0], [1, 9])).toBeGreaterThan(0)
    expect(compareValues([1, 5], [1, 9])).toBeLessThan(0)
    expect(compareValues([1, 5], [1, 5])).toBe(0)
  })

  it('keeps the best entries in order and drops the rest', () => {
    const top: Ranked<string>[] = []
    const entries: Ranked<string>[] = [
      { values: [3, 0], item: 'a' },
      { values: [5, 1], item: 'b' },
      { values: [5, 2], item: 'c' },
      { values: [1, 9], item: 'd' },
      { values: [5, 2], item: 'e' },
    ]
    for (const entry of entries) {
      if (wouldRank(top, entry.values, 3)) insertRanked(top, entry, 3)
    }

    // e ties with c exactly, so the earlier c stays ahead of it, and both beat b
    expect(top.map((entry) => entry.item)).toEqual(['c', 'e', 'b'])
  })
})

describe('storage', () => {
  it('merges by id with incoming entries winning, or replaces everything', () => {
    const existing = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }]
    const incoming = [{ id: 'b', v: 2 }, { id: 'c', v: 2 }]

    expect(mergeById(existing, incoming, 'merge')).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 2 }])
    expect(mergeById(existing, incoming, 'replace')).toEqual(incoming)
  })

  it('recognizes objects with a string id', () => {
    expect(hasStringId({ id: 'x' })).toBe(true)
    expect(hasStringId({ id: 1 })).toBe(false)
    expect(hasStringId(null)).toBe(false)
  })

  it('reads only saves of the expected version and never throws', () => {
    expect(parseVersionedSave('{"version":1,"discs":[]}', 1)).toEqual({ version: 1, discs: [] })
    expect(parseVersionedSave('{"version":2}', 1)).toBeUndefined()
    expect(parseVersionedSave('[1]', 1)).toBeUndefined()
    expect(parseVersionedSave('not json', 1)).toBeUndefined()
    expect(parseVersionedSave(null, 1)).toBeUndefined()
  })
})
