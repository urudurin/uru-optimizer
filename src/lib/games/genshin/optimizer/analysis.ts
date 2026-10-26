import {
  averageRoll,
  SUBSTAT_STATS,
} from 'lib/games/genshin/goodKeys'
import {
  type OptimizerTarget,
  scoreStats,
} from 'lib/games/genshin/optimizer/artifactOptimizer'
import {
  computeGenshinStats,
  type TeamBuffTotals,
} from 'lib/games/genshin/stats/computeStats'
import {
  type Artifact,
  type GenshinCharacter,
  statLabel,
} from 'lib/games/genshin/types'
import {
  rankUpgrades,
  type SubstatUpgrade,
} from 'lib/games/shared/analysis'

// What one more average 5-star roll of each substat would add to this build's score, best first
export function genshinSubstatUpgrades(
  character: GenshinCharacter,
  artifacts: Artifact[],
  target: OptimizerTarget,
  teamBuffs?: TeamBuffTotals,
): SubstatUpgrade[] {
  const score = (extra = {}) => scoreStats(computeGenshinStats(character, artifacts, extra, teamBuffs).stats, target)
  return rankUpgrades(
    score(),
    SUBSTAT_STATS.map((stat) => {
      const roll = averageRoll(stat)
      return { stat, label: statLabel(stat), roll, score: score({ [stat]: roll }) }
    }),
  )
}
