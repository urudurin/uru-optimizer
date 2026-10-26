import {
  rankUpgrades,
  type SubstatUpgrade,
} from 'lib/games/shared/analysis'
import {
  avgRollPct,
  maxRoll,
  SUBSTAT_KEYS,
} from 'lib/games/wuwa/echoStats'
import {
  type EchoTarget,
  scoreStats,
} from 'lib/games/wuwa/optimizer/echoOptimizer'
import { computeWuwaStats } from 'lib/games/wuwa/stats/computeStats'
import {
  type CharacterState,
  type Echo,
  statLabel,
} from 'lib/games/wuwa/types'

// What one more average roll of each echo substat would add to this loadout's score, best first
export function wuwaSubstatUpgrades(character: CharacterState, echoes: Echo[], target: EchoTarget): SubstatUpgrade[] {
  const score = (extra = {}) => scoreStats(computeWuwaStats(character, echoes, extra).stats, target)
  return rankUpgrades(
    score(),
    SUBSTAT_KEYS.map((stat) => {
      const roll = avgRollPct(stat) * maxRoll(stat)
      return { stat, label: statLabel(stat), roll, score: score({ [stat]: roll }) }
    }),
  )
}
