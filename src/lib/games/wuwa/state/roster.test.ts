import { CHARACTERS } from 'lib/games/wuwa/data/gameData'
import { wuwaRoster } from 'lib/games/wuwa/state/roster'
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
    expect(roster.find((c) => c.charId === 'aalto')).toMatchObject({ level: 90, sequence: 0, refinement: 1, minorFortes: true })
  })

  it('starts defaults with no weapon and no echoes', () => {
    for (const character of wuwaRoster([])) {
      expect(character.weaponId).toBeUndefined()
      expect(character.echoIds).toEqual([null, null, null, null, null])
    }
  })
})
