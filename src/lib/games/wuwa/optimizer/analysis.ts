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
  type SubstatKey,
} from 'lib/games/wuwa/types'

function scorer(character: CharacterState, echoes: Echo[], target: EchoTarget, teamBonus: Bonus) {
  return (extra: Bonus = {}) => {
    const total: Bonus = { ...teamBonus }
    for (const [stat, value] of Object.entries(extra) as [keyof Bonus, number][]) total[stat] = (total[stat] ?? 0) + value
    return scoreStats(computeWuwaStats(character, echoes, total).stats, target)
  }
}

// What one more average roll of each echo substat would add to this loadout's score, best first
// teamBonus: what teammates give (team/teamBuffs.ts), counted under every roll
export function wuwaSubstatUpgrades(character: CharacterState, echoes: Echo[], target: EchoTarget, teamBonus: Bonus = {}): SubstatUpgrade[] {
  const score = scorer(character, echoes, target, teamBonus)
  return rankUpgrades(
    score(),
    SUBSTAT_KEYS.map((stat) => {
      const roll = avgRollPct(stat) * maxRoll(stat)
      return { stat, label: statLabel(stat), roll, score: score({ [stat]: roll }) }
    }),
  )
}

// HSR's DPS score rolls (shared/damageScore.ts) for five echoes with five substats each, every substat at most once per
// echo: the benchmark is 25 average rolls, 1 on every substat and 12 placed (our WuWa standard build, echoScore.ts
// standardBenchmark); perfect is the same 25 at their top tier
export const WUWA_SCORE_PARAMS: DamageScoreParams = {
  benchmark: { goal: 25, free: 1, maxPerSub: 5, deductionPerMain: 0 },
  perfect: { goal: 25, free: 0, maxPerSub: 5, deductionPerMain: 0 },
}

// The loadout's rating by rotation damage; only when ranked by damage
export function wuwaDamageScore(character: CharacterState, echoes: Echo[], target: EchoTarget, teamBonus: Bonus = {}): DamageScore | undefined {
  if (target.kind !== 'damage' || echoes.length === 0) return undefined
  const actual: Record<string, number> = {}
  for (const echo of echoes) for (const sub of echo.substats) actual[sub.stat] = (actual[sub.stat] ?? 0) + sub.value
  return damageScore({
    stats: SUBSTAT_KEYS,
    roll: (stat, kind) => maxRoll(stat as SubstatKey) * (kind === 'max' ? 1 : avgRollPct(stat as SubstatKey)),
    actual,
    mains: echoes.map((echo) => echo.mainStat),
    score: scorer(character, echoes, target, teamBonus),
  }, WUWA_SCORE_PARAMS)
}
