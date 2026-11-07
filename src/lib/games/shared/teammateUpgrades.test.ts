import {
  rankTeammateUpgrades,
  teammateSetTries,
} from 'lib/games/shared/teammateUpgrades'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('teammate set upgrades', () => {
  const mates = [{ id: 'a', name: 'A', fourPiece: 'x' }, { id: 'b', name: 'B' }]
  const damage: Record<string, number> = { 'a:y': 110, 'a:z': 95, 'b:x': 100, 'b:y': 120, 'b:z': 105 }

  it('tries every set but the one a teammate already wears', () => {
    const tries = teammateSetTries(mates, ['x', 'y', 'z'], (id, set) => damage[`${id}:${set}`])
    expect(tries.map((t) => `${t.teammateId}:${t.to}`)).toEqual(['a:y', 'a:z', 'b:x', 'b:y', 'b:z'])
    expect(tries[0]).toMatchObject({ teammateName: 'A', from: 'x', damage: 110 })
    expect(tries[2].from).toBeUndefined()
  })

  it('ranks swaps by damage gained, best swap per set, and drops swaps that change nothing', () => {
    const ranked = rankTeammateUpgrades(100, teammateSetTries(mates, ['x', 'y', 'z'], (id, set) => damage[`${id}:${set}`]))
    expect(ranked.swaps.map((r) => `${r.teammateId}:${r.to}`)).toEqual(['b:y', 'a:y', 'b:z', 'a:z'])
    expect(ranked.bySet.map((r) => `${r.teammateId}:${r.to}`)).toEqual(['b:y', 'b:z'])
    expect(ranked.swaps[0]).toMatchObject({ delta: 20, percent: 20 })
    expect(ranked.swaps[3]).toMatchObject({ delta: -5, percent: -5 })
  })
})
