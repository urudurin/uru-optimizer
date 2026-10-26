import {
  equipSlots,
  type Loadouts,
  piecesTaken,
} from 'lib/games/shared/equip'
import {
  nestedFraction,
  throttleProgress,
} from 'lib/games/shared/progress'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

type Slot = 'flower' | 'plume'

function loadouts(): Loadouts<Slot> {
  return new Map([
    ['amber', { flower: 'f1', plume: 'p1' }],
    ['bennett', { flower: 'f2' }],
  ])
}

describe('equipSlots', () => {
  it('swaps a piece another character wears for this character\'s old one', () => {
    const map = loadouts()
    const change = equipSlots(map, 'amber', [{ slot: 'flower', id: 'f2' }])

    expect(map.get('amber')).toEqual({ flower: 'f2', plume: 'p1' })
    expect(map.get('bennett')).toEqual({ flower: 'f1' })
    expect([...change.owners]).toEqual([['f2', 'amber'], ['f1', 'bennett']])
    expect([...change.changedOwners]).toEqual(['amber', 'bennett'])
    expect(change.takenFrom).toEqual([{ owner: 'bennett', itemId: 'f2' }])
  })

  it('leaves the other character\'s slot empty when this one had nothing there, and unequips replaced pieces', () => {
    const map = loadouts()
    const change = equipSlots(map, 'bennett', [{ slot: 'plume', id: 'p1' }, { slot: 'flower', id: 'f3' }])

    expect(map.get('amber')).toEqual({ flower: 'f1' })
    expect(map.get('bennett')).toEqual({ flower: 'f3', plume: 'p1' })
    expect(change.owners.get('f2')).toBeUndefined()
    expect(change.owners.has('f2')).toBe(true)
  })

  it('changes nothing for pieces already worn, and gives a new character a loadout', () => {
    const map = loadouts()
    expect(equipSlots(map, 'amber', [{ slot: 'flower', id: 'f1' }]).changedOwners.size).toBe(0)
    equipSlots(map, 'collei', [{ slot: 'plume', id: 'p9' }])
    expect(map.get('collei')).toEqual({ plume: 'p9' })
  })

  it('lists whose pieces would be taken without changing anything', () => {
    const map = loadouts()
    expect(piecesTaken(map, 'collei', [{ slot: 'flower', id: 'f2' }, { slot: 'plume', id: 'p9' }])).toEqual([{ owner: 'bennett', itemId: 'f2' }])
    expect(map.get('bennett')).toEqual({ flower: 'f2' })
  })
})

describe('search progress', () => {
  it('works out how far through two nested loops a search is', () => {
    expect(nestedFraction(0, 4, 0, 10)).toBe(0)
    expect(nestedFraction(1, 4, 5, 10)).toBeCloseTo(0.375)
    expect(nestedFraction(3, 4, 10, 10)).toBe(1)
    expect(nestedFraction(0, 0, 0, 0)).toBe(0)
  })

  it('reports at most once per interval', () => {
    const calls = vi.fn()
    const report = throttleProgress(calls, 1000)!
    report({ visited: 1, fraction: 0.1 })
    report({ visited: 2, fraction: 0.2 })
    expect(calls).toHaveBeenCalledTimes(1)
    expect(throttleProgress(undefined)).toBeUndefined()
  })
})
