import {
  CHARACTERS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  bestWuwaWeapon,
  wuwaRoster,
} from 'lib/games/wuwa/state/roster'
import type { CharacterState } from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('wuwaRoster', () => {
  it('keeps saved Resonators and adds defaults for the rest', () => {
    const saved: CharacterState = { charId: 'hsin', level: 80, sequence: 2, weaponLevel: 80, refinement: 1, minorFortes: false, echoIds: [] }
    const roster = wuwaRoster([saved])
    expect(roster[0]).toBe(saved)
    expect(roster).toHaveLength(Object.keys(CHARACTERS).length)
    const other = roster.find((c) => c.charId === 'aalto')!
    expect(other).toMatchObject({ level: 90, sequence: 0, refinement: 1, minorFortes: true, echoIds: [null, null, null, null, null] })
    expect(WEAPONS[other.weaponId!].weaponType).toBe(CHARACTERS.aalto.weaponType)
  })

  it('picks a 5-star weapon of the type', () => {
    for (const type of [1, 2, 3, 4, 5]) expect(WEAPONS[bestWuwaWeapon(type)!].rarity).toBe(5)
    expect(bestWuwaWeapon(null)).toBeUndefined()
  })
})
