import {
  rankUpgrades,
  type SubstatUpgrade,
} from 'lib/games/shared/analysis'
import { benchmarkVariants } from 'lib/games/shared/benchmarkVariants'
import type { SimulationMetadata } from 'lib/games/shared/characterMetadata'
import {
  type DamageScore,
  damageScore,
  type DamageScoreInput,
  type DamageScoreParams,
} from 'lib/games/shared/damageScore'
import {
  simulationExtra,
  type SimulationRolls,
  substatTotals,
} from 'lib/games/shared/statSimulation'
import {
  type DamageSetup,
  rotationDamage,
} from 'lib/games/zzz/damage/damage'
import { SETS } from 'lib/games/zzz/data/sets'
import {
  getSubstatValue,
  SUBSTAT_STATS,
} from 'lib/games/zzz/discStats'
import { MAIN_STATS_BY_SLOT } from 'lib/games/zzz/discStats'
import type { RankKey } from 'lib/games/zzz/optimizer/discOptimizer'
import {
  type ComputeInput,
  computeStats,
} from 'lib/games/zzz/stats/computeStats'
import type {
  Disc,
  MainStatSlot,
  ZzzStatsValues,
} from 'lib/games/zzz/types'
import { sMainValue } from 'lib/games/zzz/ui/discKind'

// What one more S-rank roll of each disc substat would add to what this build is ranked by (a stat, or the rotation's
// damage with the damage setup), best first
export function zzzSubstatUpgrades(input: ComputeInput, sortBy: RankKey, damage?: DamageSetup): SubstatUpgrade[] {
  const score = (extraStats = {}) => {
    const stats = computeStats({ ...input, extraStats }).stats
    return sortBy === 'damage' ? (damage ? rotationDamage(stats, damage) : 0) : stats[sortBy]
  }
  return rankUpgrades(
    score(),
    SUBSTAT_STATS.map((stat) => {
      const roll = getSubstatValue('S', stat, 1) ?? 0
      return { stat, label: stat, roll, score: score({ [stat]: roll }) }
    }),
  )
}

// HSR's DPS score rolls (shared/damageScore.ts; lib/scoring/simScoringUtils.ts benchmarkScoringParams and
// maximumScoringParams), since six S-rank discs have HSR's 54 rolls: the benchmark is 48 rolls at 80% value (HSR's low
// roll; ZZZ rolls are one fixed value), 2 on every substat and the rest placed, at most 30 less 5 per matching main;
// perfect is 54 full rolls, at most 36 less 6 per matching main
const BENCHMARK_QUALITY = 0.8
export const ZZZ_SCORE_PARAMS: DamageScoreParams = {
  benchmark: { goal: 48, free: 2, maxPerSub: 30, deductionPerMain: 5 },
  perfect: { goal: 54, free: 0, maxPerSub: 36, deductionPerMain: 6 },
}

// The build's rating by rotation damage; only for six discs with a damage setup
// variants: the same discs with the metadata's benchmark sets and mains (zzzBenchmarkVariants)
export function zzzDamageScore(input: ComputeInput, damage?: DamageSetup, variants: Disc[][] = []): DamageScore | undefined {
  const inputs = zzzScoreInputs(input, damage, variants)
  return inputs && damageScore(inputs.input, ZZZ_SCORE_PARAMS, inputs.variants)
}

// The DPS score's inputs (shared/damageScore.ts) for these discs and their benchmark variants; the Benchmarks page shows
// the simulated builds from them
export function zzzScoreInputs(
  input: ComputeInput,
  damage?: DamageSetup,
  variants: Disc[][] = [],
): { input: DamageScoreInput, variants: DamageScoreInput[] } | undefined {
  if (!damage || input.discs.length < 6) return undefined
  const actual: Record<string, number> = {}
  for (const disc of input.discs) {
    for (const sub of disc.substats) actual[sub.stat] = (actual[sub.stat] ?? 0) + (getSubstatValue(disc.rarity, sub.stat, sub.rolls) ?? 0)
  }
  const inputFor = (discs: ComputeInput['discs']) => ({
    stats: SUBSTAT_STATS,
    roll: (stat: string, kind: 'average' | 'max') => (getSubstatValue('S', stat as ZzzStatsValues, 1) ?? 0) * (kind === 'max' ? 1 : BENCHMARK_QUALITY),
    actual,
    mains: discs.map((disc) => disc.main.stat),
    score: (extraStats: Record<string, number>) => rotationDamage(computeStats({ ...input, discs, extraStats }).stats, damage),
  })
  return { input: inputFor(input.discs), variants: variants.map(inputFor) }
}

// The DPS score's benchmark sets and mains from the agent's metadata simulation (shared/benchmarkVariants.ts): a
// 4-piece + 2-piece set option, each listed main stat on an S-rank disc at +15
export function zzzBenchmarkVariants(discs: Disc[], simulation: SimulationMetadata<unknown> | undefined): Disc[][] {
  return benchmarkVariants(discs, simulation, {
    slotOf: (disc) => String(disc.slot),
    withMain: (disc, stat) => {
      const value = sMainValue(stat as ZzzStatsValues, 15)
      if (value === undefined || !MAIN_STATS_BY_SLOT[disc.slot as MainStatSlot]?.includes(stat as ZzzStatsValues)) return undefined
      return { ...disc, rarity: 'S', level: 15, main: { stat: stat as ZzzStatsValues, value } }
    },
    withSet: (disc, setId) => ({ ...disc, setId, setName: SETS[setId]?.name ?? setId }),
    setPattern: (option) => (option.length === 1 ? [4] : [4, 2]),
  })
}

// Stat simulation (shared/statSimulation.ts): one S-rank roll of each disc substat (ZZZ rolls have one value)
export const ZZZ_SIM_ROLLS: SimulationRolls = { stats: SUBSTAT_STATS, roll: (stat) => getSubstatValue('S', stat as ZzzStatsValues, 1) ?? 0 }

// The disc substats' totals, by the value each disc's rolls are worth
export function zzzSubstatTotals(discs: ComputeInput['discs']): Record<string, number> {
  return substatTotals(
    discs.flatMap((disc) => disc.substats.map((sub) => ({ stat: sub.stat, value: getSubstatValue(disc.rarity, sub.stat, sub.rolls) ?? 0 }))),
  )
}

// The stats of these discs' sets and main stats with these substat rolls instead of their own
export function zzzSimulatedStats(input: ComputeInput, rolls: Record<string, number>) {
  return computeStats({ ...input, extraStats: simulationExtra(ZZZ_SIM_ROLLS, zzzSubstatTotals(input.discs), rolls) }).stats
}
