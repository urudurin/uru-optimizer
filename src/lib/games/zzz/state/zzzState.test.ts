import {
  createZzzBackup,
  deserializeZzzData,
  readZzzBackup,
  serializeZzzData,
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
