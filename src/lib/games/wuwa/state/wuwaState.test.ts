import {
  createWuwaBackup,
  deserializeWuwaData,
  EMPTY_WUWA_DATA,
  equipWuwaEchoes,
  mergeWuwaData,
  readWuwaBackup,
  saveWuwaCharacter,
  serializeWuwaData,
  type WuwaData,
  wuwaPiecesTaken,
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

describe('saveWuwaCharacter', () => {
  it('adds a Resonator with empty echo slots, or updates one and keeps their echoes', () => {
    const { echoIds: _, ...details } = character('y', 70)
    const added = saveWuwaCharacter(data, details)
    expect(added.characters.map((c) => [c.charId, c.level, c.echoIds.length])).toEqual([['x', 90, 5], ['y', 70, 5]])

    const worn: WuwaData = { ...data, characters: [{ ...character('x'), echoIds: ['a', null, null, null, null] }] }
    const updated = saveWuwaCharacter(worn, { ...details, charId: 'x', sequence: 2, weaponId: 'w' })
    expect(updated.characters).toEqual([{ ...character('x', 70), sequence: 2, weaponId: 'w', echoIds: ['a', null, null, null, null] }])
  })
})

describe('equipWuwaEchoes', () => {
  it('puts the 4-cost echo first and takes echoes off whoever wore them', () => {
    const four: Echo = { ...echo('c'), cost: 4 }
    const worn: WuwaData = {
      ...data,
      echoes: [...data.echoes, four],
      characters: [character('x'), { ...character('y'), echoIds: ['a', null, null, null, null] }],
    }
    const equipped = equipWuwaEchoes(worn, 'x', [echo('a'), four])

    expect(equipped.characters.map((c) => [c.charId, c.echoIds])).toEqual([
      ['x', ['c', 'a', null, null, null]],
      ['y', [null, null, null, null, null]],
    ])
    expect(wuwaPiecesTaken(worn, 'x', [echo('a')])).toEqual(['y'])
  })
})
