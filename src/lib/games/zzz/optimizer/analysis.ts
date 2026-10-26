import {
  rankUpgrades,
  type SubstatUpgrade,
} from 'lib/games/shared/analysis'
import {
  getSubstatValue,
  SUBSTAT_STATS,
} from 'lib/games/zzz/discStats'
import {
  type ComputeInput,
  computeStats,
  type FinalStats,
} from 'lib/games/zzz/stats/computeStats'

// What one more S-rank roll of each disc substat would add to the ranked stat of this build, best first
export function zzzSubstatUpgrades(input: ComputeInput, sortBy: keyof FinalStats): SubstatUpgrade[] {
  const score = (extraStats = {}) => computeStats({ ...input, extraStats }).stats[sortBy]
  return rankUpgrades(
    score(),
    SUBSTAT_STATS.map((stat) => {
      const roll = getSubstatValue('S', stat, 1) ?? 0
      return { stat, label: stat, roll, score: score({ [stat]: roll }) }
    }),
  )
}
