import {
  createGenshinBackup,
  deserializeGenshinData,
  EMPTY_GENSHIN_DATA,
  type GenshinData,
  mergeGenshinData,
  readGenshinBackup,
  serializeGenshinData,
} from 'lib/games/genshin/state/genshinState'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const artifact = (id: string, equippedBy?: string): Artifact => ({
  id,
  slot: 'flower',
  setId: '15002',
  setName: 'Viridescent Venerer',
  rarity: 5,
  level: 20,
  main: { stat: 'hp', value: 4780 },
  substats: [],
  ...(equippedBy ? { equippedBy } : {}),
})
const character = (id: string, flower?: string): GenshinCharacter => ({
  id,
  name: `Character ${id}`,
  level: 90,
  constellation: 0,
  artifactIds: flower ? { flower } : {},
  stats: { hp: 20000 },
  statsDate: '2026-10-26',
})

const data: GenshinData = { artifacts: [artifact('a1', 'c1'), artifact('a2', 'c2')], characters: [character('c1', 'a1'), character('c2', 'a2')] }

describe('Genshin save', () => {
  it('round-trips, and loads bad saves as empty', () => {
    expect(deserializeGenshinData(serializeGenshinData(data))).toEqual(data)
    expect(deserializeGenshinData('not json')).toEqual(EMPTY_GENSHIN_DATA)
    expect(deserializeGenshinData('{"version":9}')).toEqual(EMPTY_GENSHIN_DATA)
  })

  it('round-trips a backup and recognizes only Genshin backups', () => {
    const backup = createGenshinBackup(data, '2026-10-26')
    expect(JSON.parse(backup)).toMatchObject({ kind: 'uru-genshin-backup', savedAt: '2026-10-26' })
    expect(readGenshinBackup(backup)).toEqual(data)
    expect(readGenshinBackup(JSON.stringify({ kind: 'uru-zzz-backup', version: 1 }))).toBeUndefined()
  })

  it('frees artifacts a re-imported character no longer wears', () => {
    const reimport: GenshinData = { artifacts: [artifact('a3', 'c1')], characters: [character('c1', 'a3')] }
    const merged = mergeGenshinData(data, reimport, 'merge')

    expect(merged.artifacts.map((a) => [a.id, a.equippedBy])).toEqual([['a1', undefined], ['a2', 'c2'], ['a3', 'c1']])
    expect(merged.characters.find((c) => c.id === 'c1')?.artifactIds.flower).toBe('a3')
    expect(mergeGenshinData(data, reimport, 'replace')).toEqual(reimport)
  })
})
