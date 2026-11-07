import {
  genshinSampleData,
} from 'lib/games/genshin/data/sampleData'
import {
  GENSHIN_SIM_ROLLS,
  genshinSimulatedStats,
} from 'lib/games/genshin/optimizer/analysis'
import { computeGenshinStats } from 'lib/games/genshin/stats/computeStats'
import { ARTIFACT_SLOTS } from 'lib/games/genshin/types'
import {
  rollsFromTotals,
  simulationExtra,
  type SimulationRolls,
  substatTotals,
} from 'lib/games/shared/statSimulation'
import { wuwaSampleData } from 'lib/games/wuwa/data/sampleData'
import {
  WUWA_SIM_ROLLS,
  wuwaSimulatedStats,
} from 'lib/games/wuwa/optimizer/analysis'
import { computeWuwaStats } from 'lib/games/wuwa/stats/computeStats'
import {
  describe,
  expect,
  it,
} from 'vitest'

const model: SimulationRolls = { stats: ['critRate', 'critDmg', 'atkPct'], roll: (stat) => ({ critRate: 3, critDmg: 6, atkPct: 5 })[stat] ?? 0 }

describe('stat simulation', () => {
  it('turns roll counts into extra stats on top of the build, less its own substats', () => {
    const actual = { critRate: 9, atkPct: 10, hpPct: 4 }
    expect(simulationExtra(model, actual, { critRate: 5, critDmg: 2 })).toEqual({ critRate: 6, critDmg: 12, atkPct: -10, hpPct: -4 })
    // The build's own rolls back: no extra stats
    expect(simulationExtra(model, actual, { critRate: 3, atkPct: 2 })).toEqual({ hpPct: -4 })
  })

  it('reads a build’s substats as roll counts', () => {
    expect(rollsFromTotals(model, { critRate: 9.3, critDmg: 0, atkPct: 7.5 })).toEqual({ critRate: 3.1, atkPct: 1.5 })
    expect(substatTotals([{ stat: 'critRate', value: 3 }, { stat: 'critRate', value: 2.5 }, { stat: 'atkPct', value: 4 }])).toEqual({
      critRate: 5.5,
      atkPct: 4,
    })
  })

  it('gives a Genshin build its own stats back when simulated with its own substats', () => {
    const sample = genshinSampleData()
    const character = sample.characters[0]
    const worn = ARTIFACT_SLOTS.flatMap((slot) => sample.artifacts.find((a) => a.id === character.artifactIds[slot]) ?? [])
    expect(worn).toHaveLength(5)
    // Exact roll counts (no rounding), so the simulated substats equal the real ones
    const actual = substatTotals(worn.flatMap((a) => a.substats))
    const rolls = Object.fromEntries(GENSHIN_SIM_ROLLS.stats.map((stat) => [stat, (actual[stat] ?? 0) / GENSHIN_SIM_ROLLS.roll(stat)]))
    const simulated = genshinSimulatedStats(character, worn, rolls)
    const real = computeGenshinStats(character, worn).stats
    for (const [stat, value] of Object.entries(real)) expect(simulated[stat as keyof typeof simulated]).toBeCloseTo(value ?? 0, 6)
    // Two more CRIT Rate rolls than it has
    const more = genshinSimulatedStats(character, worn, { ...rolls, critRate: (rolls.critRate ?? 0) + 2 })
    expect((more.critRate ?? 0) - (real.critRate ?? 0)).toBeCloseTo(2 * GENSHIN_SIM_ROLLS.roll('critRate'), 6)
  })

  it('gives a WuWa loadout its own stats back when simulated with its own substats', () => {
    const sample = wuwaSampleData()
    const character = sample.characters[0]
    const worn = character.echoIds.flatMap((id) => sample.echoes.find((e) => e.id === id) ?? [])
    expect(worn.length).toBeGreaterThan(0)
    const actual = substatTotals(worn.flatMap((e) => e.substats))
    const rolls = Object.fromEntries(WUWA_SIM_ROLLS.stats.map((stat) => [stat, (actual[stat] ?? 0) / WUWA_SIM_ROLLS.roll(stat)]))
    const simulated = wuwaSimulatedStats(character, worn, rolls)
    const real = computeWuwaStats(character, worn).stats
    for (const [stat, value] of Object.entries(real)) expect(simulated[stat as keyof typeof simulated]).toBeCloseTo(value, 6)
  })
})
