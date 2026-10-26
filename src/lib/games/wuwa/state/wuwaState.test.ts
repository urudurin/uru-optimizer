import {
  createWuwaBackup,
  deserializeWuwaData,
  EMPTY_WUWA_DATA,
  mergeWuwaData,
  readWuwaBackup,
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

  it('round-trips a backup file and tells it apart from a WuwaEchoScorer user-data file', () => {
    const backup = createWuwaBackup(data, '2026-10-26')

    expect(JSON.parse(backup)).toMatchObject({ kind: 'uru-wuwa-backup', savedAt: '2026-10-26', version: 1 })
    expect(readWuwaBackup(backup)).toEqual(data)
    // A user-data file is also version 1 but has no backup marker, so it goes to the user-data importer instead
    expect(readWuwaBackup(JSON.stringify({ version: 1, echoes: {}, characters: {} }))).toBeUndefined()
    expect(readWuwaBackup(JSON.stringify({ kind: 'uru-zzz-backup', version: 1 }))).toBeUndefined()
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
