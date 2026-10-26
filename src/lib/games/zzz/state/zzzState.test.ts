import {
  createZzzBackup,
  deserializeZzzData,
  equipZzzDiscs,
  readZzzBackup,
  saveZzzBuild,
  serializeZzzData,
  type ZzzData,
  zzzPiecesTaken,
} from 'lib/games/zzz/state/zzzState'
import type { Disc } from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const disc: Disc = {
  id: 'd1',
  slot: 1,
  setId: 'white-water-ballad',
  setName: 'White Water Ballad',
  rarity: 'S',
  level: 15,
  main: { stat: 'HP', value: 2200 },
  substats: [{ stat: 'CRIT Rate', rolls: 1 }],
  locked: false,
}

describe('saveZzzBuild', () => {
  it('adds a build by id, or replaces the one with the same id', () => {
    const build = {
      id: 'uru-1091',
      agentId: '1091',
      name: 'Miyabi',
      element: 'Ice',
      specialty: 'Anomaly',
      level: 60,
      mindscapeLevel: 0,
      wEngineRefinement: 1,
      discIds: {},
    }
    const added = saveZzzBuild({ discs: [], builds: [] }, build)
    expect(added.builds).toEqual([build])
    expect(saveZzzBuild(added, { ...build, mindscapeLevel: 2 }).builds).toEqual([{ ...build, mindscapeLevel: 2 }])
  })
})

describe('ZZZ save', () => {
  it('round-trips discs and builds', () => {
    const data = { discs: [disc], builds: [] }
    expect(deserializeZzzData(serializeZzzData(data))).toEqual(data)
  })

  it('loads missing, corrupted or other-version saves as empty', () => {
    const empty = { discs: [], builds: [] }
    expect(deserializeZzzData(null)).toEqual(empty)
    expect(deserializeZzzData('not json')).toEqual(empty)
    expect(deserializeZzzData('{"version":99,"discs":[]}')).toEqual(empty)
  })

  it('round-trips a backup file and recognizes only its own backups', () => {
    const data = { discs: [disc], builds: [] }
    const backup = createZzzBackup(data, '2026-10-26')

    expect(JSON.parse(backup)).toMatchObject({ kind: 'uru-zzz-backup', savedAt: '2026-10-26', version: 1 })
    expect(readZzzBackup(backup)).toEqual(data)
    // The plain browser save, a builds export and a WuWa backup are not ZZZ backups
    expect(readZzzBackup(serializeZzzData(data))).toBeUndefined()
    expect(readZzzBackup(JSON.stringify({ version: '3.0', builds: [] }))).toBeUndefined()
    expect(readZzzBackup(JSON.stringify({ kind: 'uru-wuwa-backup', version: 1 }))).toBeUndefined()
    expect(readZzzBackup('not json')).toBeUndefined()
  })

  it('drops entries without a string id', () => {
    const text = JSON.stringify({ version: 1, discs: [disc, { slot: 2 }], builds: 'oops' })
    expect(deserializeZzzData(text)).toEqual({ discs: [disc], builds: [] })
  })
})

describe('equipZzzDiscs', () => {
  const agent = { id: '1091', name: 'Miyabi', element: 'Ice', specialty: 'Anomaly', level: 60 }
  const wEngine = { id: 'hailstorm-shrine', refinement: 1 }

  it('swaps with the other wearer, counting discs the source says they wear', () => {
    const worn: ZzzData = { discs: [{ ...disc, equippedBy: '1381' }, { ...disc, id: 'd2' }], builds: [] }
    const equipped = equipZzzDiscs(worn, agent, wEngine, [{ ...disc, id: 'd1' }])

    expect(equipped.discs.map((d) => [d.id, d.equippedBy])).toEqual([['d1', '1091'], ['d2', undefined]])
    expect(equipped.builds).toEqual([
      expect.objectContaining({ id: 'uru-1091', agentId: '1091', wEngineId: 'hailstorm-shrine', discIds: { 1: 'd1' } }),
    ])
    expect(zzzPiecesTaken(worn, '1091', [disc])).toEqual(['1381'])
  })
})
