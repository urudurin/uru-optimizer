import { genshinSubstatUpgrades } from 'lib/games/genshin/optimizer/analysis'
import type { GenshinCharacter } from 'lib/games/genshin/types'
import { rankUpgrades } from 'lib/games/shared/analysis'
import { wuwaSubstatUpgrades } from 'lib/games/wuwa/optimizer/analysis'
import type { CharacterState } from 'lib/games/wuwa/types'
import {
  MIYABI,
} from 'lib/games/zzz/data/agents'
import { HAILSTORM_SHRINE } from 'lib/games/zzz/data/wEngines'
import { zzzSubstatUpgrades } from 'lib/games/zzz/optimizer/analysis'
import { statScreenConditions } from 'lib/games/zzz/stats/computeStats'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('substat upgrades', () => {
  it('ranks gains best first, as a percent of the score', () => {
    const ranked = rankUpgrades(200, [
      { stat: 'a', label: 'A', roll: 1, score: 210 },
      { stat: 'b', label: 'B', roll: 1, score: 230 },
      { stat: 'c', label: 'C', roll: 1, score: 200 },
    ])
    expect(ranked.map((u) => [u.stat, u.gain, u.percent])).toEqual([['b', 30, 15], ['a', 10, 5], ['c', 0, 0]])
  })

  it('Genshin: one average roll, crit counts twice in Crit Value', () => {
    const venti: GenshinCharacter = { id: 'Venti', name: 'Venti', level: 90, ascension: 6, constellation: 0, artifactIds: {}, stats: {}, statsDate: '' }
    const upgrades = genshinSubstatUpgrades(venti, [], { kind: 'critValue' })
    const gain = (stat: string) => upgrades.find((u) => u.stat === stat)!.gain

    expect(gain('critRate')).toBeCloseTo(2 * 3.89 * 0.85)
    expect(gain('critDmg')).toBeCloseTo(7.77 * 0.85)
    expect(gain('atkPct')).toBe(0)
    expect(upgrades[0].stat).toBe('critRate')
  })

  it('WuWa: ATK% and crit help an average ATK hit, DEF doesn\'t', () => {
    const hsin: CharacterState = {
      charId: 'hsin',
      level: 90,
      sequence: 0,
      weaponId: 'blooming-jadehaven',
      weaponLevel: 90,
      refinement: 1,
      minorFortes: true,
      echoIds: [],
    }
    const upgrades = wuwaSubstatUpgrades(hsin, [], { kind: 'averageHit', stat: 'atk', bonus: 'none' })
    const gain = (stat: string) => upgrades.find((u) => u.stat === stat)!.gain

    expect(gain('atkPct')).toBeGreaterThan(0)
    expect(gain('critDmg')).toBeGreaterThan(0)
    expect(gain('defPct')).toBe(0)
  })

  it('ZZZ: the ranked stat gains one S-rank roll', () => {
    const input = { agent: MIYABI, wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: statScreenConditions() }
    const upgrades = zzzSubstatUpgrades(input, 'critDmg')

    expect(upgrades[0]).toMatchObject({ stat: 'CRIT DMG', gain: expect.closeTo(4.8) })
    expect(upgrades.find((u) => u.stat === 'HP')?.gain).toBe(0)
  })
})
