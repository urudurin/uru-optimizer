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
import {
  type Bonus,
  computeWuwaStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  type CharacterState,
  type Echo,
  statLabel,
} from 'lib/games/wuwa/types'

// What one more average roll of each echo substat would add to this loadout's score, best first
// teamBonus: what teammates give (team/teamBuffs.ts), counted under every roll
export function wuwaSubstatUpgrades(character: CharacterState, echoes: Echo[], target: EchoTarget, teamBonus: Bonus = {}): SubstatUpgrade[] {
  const score = (extra: Bonus = {}) => {
    const total: Bonus = { ...teamBonus }
    for (const [stat, value] of Object.entries(extra) as [keyof Bonus, number][]) total[stat] = (total[stat] ?? 0) + value
    return scoreStats(computeWuwaStats(character, echoes, total).stats, target)
  }
  return rankUpgrades(
    score(),
    SUBSTAT_KEYS.map((stat) => {
      const roll = avgRollPct(stat) * maxRoll(stat)
      return { stat, label: statLabel(stat), roll, score: score({ [stat]: roll }) }
    }),
  )
}
