import {
  computeGenshinStats,
  inferAscension,
} from 'lib/games/genshin/stats/computeStats'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const character = (parts: Partial<GenshinCharacter>): GenshinCharacter => ({
  id: 'Venti',
  name: 'Venti',
  level: 90,
  ascension: 6,
  constellation: 0,
  artifactIds: {},
  stats: {},
  statsDate: '2026-10-26',
  ...parts,
})

const artifact = (parts: Partial<Artifact>): Artifact => ({
  id: 'a',
  slot: 'flower',
  setId: 'GladiatorsFinale',
  setName: 'Gladiator\'s Finale',
  rarity: 5,
  level: 20,
  main: { stat: 'hp', value: 4780 },
  substats: [],
  ...parts,
})

describe('computeGenshinStats', () => {
  it('matches the game\'s base stats at level 90', () => {
    // Venti's level 90 stats in game: 10,531 HP, 263 ATK, 669 DEF, 32% Energy Recharge from ascension
    const { stats } = computeGenshinStats(character({}), [])
    expect(Math.round(stats.hp!)).toBe(10531)
    expect(Math.round(stats.atk!)).toBe(263)
    expect(Math.round(stats.def!)).toBe(669)
    expect(stats.energyRecharge).toBeCloseTo(132)
    expect(stats.critRate).toBe(5)
    expect(stats.critDmg).toBe(50)
  })

  it('adds weapon base ATK, artifact stats and 2-piece bonuses', () => {
    const weapon = { id: 'FadingTwilight', name: 'Fading Twilight', rarity: 4, level: 90, ascension: 6, refinement: 5 }
    const bare = computeGenshinStats(character({}), []).stats
    const pieces = [
      artifact({ substats: [{ stat: 'critRate', value: 10, rolls: 3 }] }),
      artifact({ id: 'b', slot: 'plume', main: { stat: 'atk', value: 311 } }),
    ]
    const { stats, missing } = computeGenshinStats(character({ weapon }), pieces)

    expect(missing).toEqual([])
    // Fading Twilight at 90: 565 base ATK, 30.6% Energy Recharge
    const baseAtk = 263 + 565
    expect(stats.atk).toBeCloseTo(baseAtk * 1.18 + 311, -1)
    expect(stats.hp).toBeCloseTo(bare.hp! + 4780)
    expect(stats.critRate).toBeCloseTo(15)
    expect(stats.energyRecharge).toBeCloseTo(132 + 30.6, 0)
  })

  it('adds always-on passives that read other stats', () => {
    // Raiden's passive: 0.4% Electro DMG per 1% Energy Recharge above 100%
    const raiden = character({ id: 'RaidenShogun', name: 'Raiden Shogun' })
    const er = artifact({ slot: 'sands', setId: 'Other', main: { stat: 'energyRecharge', value: 51.8 } })
    const { stats } = computeGenshinStats(raiden, [er])
    expect(stats.electroDmg).toBeCloseTo((stats.energyRecharge! - 100) * 0.4)
  })

  it('names what it cannot count', () => {
    expect(computeGenshinStats(character({ id: 'Nobody', name: 'Nobody' }), []).missing).toEqual(['Nobody isn\'t in the stat data yet'])
    const weapon = { id: 'NoSuchSword', name: 'No Such Sword', rarity: 4, level: 90, refinement: 1 }
    expect(computeGenshinStats(character({ weapon }), []).missing).toEqual(['No Such Sword (weapon) isn\'t in the stat data'])
  })

  it('infers ascension from level', () => {
    expect([1, 20, 21, 40, 80, 81, 90].map(inferAscension)).toEqual([0, 0, 1, 1, 5, 6, 6])
  })
})
