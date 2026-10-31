import {
  rankUpgrades,
  type SubstatUpgrade,
} from 'lib/games/shared/analysis'
import {
  type DamageScore,
  damageScore,
  type DamageScoreParams,
} from 'lib/games/shared/damageScore'
import {
  type DamageSetup,
  rotationDamage,
} from 'lib/games/zzz/damage/damage'
import {
  getSubstatValue,
  SUBSTAT_STATS,
} from 'lib/games/zzz/discStats'
import type { RankKey } from 'lib/games/zzz/optimizer/discOptimizer'
import {
  type ComputeInput,
  computeStats,
} from 'lib/games/zzz/stats/computeStats'
import type { ZzzStatsValues } from 'lib/games/zzz/types'

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
export function zzzDamageScore(input: ComputeInput, damage?: DamageSetup): DamageScore | undefined {
  if (!damage || input.discs.length < 6) return undefined
  const actual: Record<string, number> = {}
  for (const disc of input.discs) {
    for (const sub of disc.substats) actual[sub.stat] = (actual[sub.stat] ?? 0) + (getSubstatValue(disc.rarity, sub.stat, sub.rolls) ?? 0)
  }
  return damageScore({
    stats: SUBSTAT_STATS,
    roll: (stat, kind) => (getSubstatValue('S', stat as ZzzStatsValues, 1) ?? 0) * (kind === 'max' ? 1 : BENCHMARK_QUALITY),
    actual,
    mains: input.discs.map((disc) => disc.main.stat),
    score: (extraStats) => rotationDamage(computeStats({ ...input, extraStats }).stats, damage),
  }, ZZZ_SCORE_PARAMS)
}
