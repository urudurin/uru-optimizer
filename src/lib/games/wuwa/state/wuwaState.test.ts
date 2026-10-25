import {
  deserializeWuwaData,
  EMPTY_WUWA_DATA,
  mergeWuwaData,
  serializeWuwaData,
  type WuwaData,
} from 'lib/games/wuwa/state/wuwaState'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const echo = (id: string, level = 25): Echo => ({ id, defId: 'd', cost: 1, setId: 's', mainStat: 'atkPct', level, substats: [] })
const character = (charId: string, level = 90): CharacterState => ({
  charId,
  level,
  sequence: 0,
  weaponLevel: 90,
  refinement: 1,
  minorFortes: true,
  echoIds: [null, null, null, null, null],
})

const data: WuwaData = { echoes: [echo('a'), echo('b')], characters: [character('x')], teams: [], priority: ['x'] }

describe('WuWa save', () => {
  it('round-trips', () => {
    expect(deserializeWuwaData(serializeWuwaData(data))).toEqual(data)
  })

  it('loads missing, corrupted or other-version saves as empty', () => {
    expect(deserializeWuwaData(null)).toEqual(EMPTY_WUWA_DATA)
    expect(deserializeWuwaData('not json')).toEqual(EMPTY_WUWA_DATA)
    expect(deserializeWuwaData('{"version":9,"echoes":[]}')).toEqual(EMPTY_WUWA_DATA)
  })

  it('merges by id and charId with incoming entries winning, or replaces everything', () => {
    const incoming: WuwaData = { echoes: [echo('b', 20), echo('c')], characters: [character('x', 80), character('y')], teams: [], priority: [] }

    const merged = mergeWuwaData(data, incoming, 'merge')
    expect(merged.echoes.map((e) => [e.id, e.level])).toEqual([['a', 25], ['b', 20], ['c', 25]])
    expect(merged.characters.map((c) => [c.charId, c.level])).toEqual([['x', 80], ['y', 90]])
    // An import without a priority list keeps the existing one
    expect(merged.priority).toEqual(['x'])

    expect(mergeWuwaData(data, incoming, 'replace')).toEqual(incoming)
  })
})
