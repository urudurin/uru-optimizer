import { filterPools as genshinPools } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import { filterPool as wuwaPool } from 'lib/games/wuwa/optimizer/echoOptimizer'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import { filterPools as zzzPools } from 'lib/games/zzz/optimizer/discOptimizer'
import type { Disc } from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// HSR's Keep current, Min enhance and Min rarity in each game's pool filter (only the fields the filters read)

describe('Genshin optimizer options', () => {
  const character = { id: 'Xiangling', artifactIds: { flower: 'f1' } } as unknown as GenshinCharacter
  const flower = (id: string, level: number, rarity: number) => ({ id, slot: 'flower', level, rarity, main: { stat: 'hp', value: 0 } }) as unknown as Artifact
  const artifacts = [flower('f1', 8, 5), flower('f2', 20, 5), flower('f3', 20, 4)]
  const flowers = (filters: object) =>
    genshinPools({ character, artifacts, filters: { mainStats: {}, twoPieceSets: [], excludeEquippedByOthers: false, ...filters } })[0].map((a) => a.id)

  it('keeps the worn artifact, leaves out low levels and rarities', () => {
    expect(flowers({})).toEqual(['f1', 'f2', 'f3'])
    expect(flowers({ keep: character.artifactIds })).toEqual(['f1'])
    expect(flowers({ minLevel: 16 })).toEqual(['f2', 'f3'])
    expect(flowers({ minRarity: 5 })).toEqual(['f1', 'f2'])
  })
})

describe('ZZZ optimizer options', () => {
  const agent = { id: '1091' } as AgentData
  const disc = (id: string, level: number, rarity: string) => ({ id, slot: 1, level, rarity, main: { stat: 'HP', value: 0 } }) as unknown as Disc
  const discs = [disc('d1', 9, 'S'), disc('d2', 15, 'S'), disc('d3', 15, 'A'), disc('d4', 15, 'B')]
  const slot1 = (filters: object) => zzzPools({ agent, discs, filters: { mainStats: {}, excludeEquippedByOthers: false, ...filters } })[0].map((d) => d.id)

  it('keeps the build\'s disc, leaves out low levels and ranks', () => {
    expect(slot1({ keep: { 1: 'd1' } })).toEqual(['d1'])
    expect(slot1({ minLevel: 12 })).toEqual(['d2', 'd3', 'd4'])
    expect(slot1({ minRarity: 'A' })).toEqual(['d1', 'd2', 'd3'])
    expect(slot1({ minRarity: 'S' })).toEqual(['d1', 'd2'])
  })
})

describe('WuWa optimizer options', () => {
  const character = { charId: 'hsin', echoIds: [] } as unknown as CharacterState
  const echo = (id: string, level: number) => ({ id, cost: 1, mainStat: 'atkPct', level, substats: [] }) as unknown as Echo
  it('leaves out echoes below the minimum level', () => {
    const pool = wuwaPool({
      character,
      characters: [character],
      echoes: [echo('e1', 10), echo('e2', 25)],
      filters: { mainStats: {}, twoPieceSets: [], excludeEquippedByOthers: false, minLevel: 20 },
    })
    expect(pool.map((e) => e.id)).toEqual(['e2'])
  })
})
