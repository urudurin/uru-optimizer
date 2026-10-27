import {
  rankUpgrades,
  type SubstatUpgrade,
} from 'lib/games/shared/analysis'
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
