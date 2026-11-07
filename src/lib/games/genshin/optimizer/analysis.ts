import type { CombatSetup } from 'lib/games/genshin/damage/combatEffects'
import {
  averageRoll,
  maxRoll,
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
  type GenshinStatKey,
  statLabel,
} from 'lib/games/genshin/types'
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
  simulationExtra,
  type SimulationRolls,
  substatTotals,
} from 'lib/games/shared/statSimulation'

// What one more average 5-star roll of each substat would add to this build's score, best first
export function genshinSubstatUpgrades(
  character: GenshinCharacter,
  artifacts: Artifact[],
  target: OptimizerTarget,
  teamBuffs?: TeamBuffTotals,
  combat?: CombatSetup,
): SubstatUpgrade[] {
  const score = (extra = {}) => scoreStats(computeGenshinStats(character, artifacts, extra, teamBuffs, combat).stats, target)
  return rankUpgrades(
    score(),
    SUBSTAT_STATS.map((stat) => {
      const roll = averageRoll(stat)
      return { stat, label: statLabel(stat), roll, score: score({ [stat]: roll }) }
    }),
  )
}

// HSR's DPS score rolls (shared/damageScore.ts) for five 5-star artifacts, after KQM Standards: the benchmark is 40
// average rolls, 2 on every substat and 20 placed, at most 2 per artifact whose main stat isn't that substat (12 less 2
// per matching main); perfect is 45 max rolls (9 per artifact), at most 6 per artifact on one substat
export const GENSHIN_SCORE_PARAMS: DamageScoreParams = {
  benchmark: { goal: 40, free: 2, maxPerSub: 12, deductionPerMain: 2 },
  perfect: { goal: 45, free: 0, maxPerSub: 30, deductionPerMain: 6 },
}

// The build's rating by rotation damage; only for a full set of artifacts ranked by damage
export function genshinDamageScore(
  character: GenshinCharacter,
  artifacts: Artifact[],
  target: OptimizerTarget,
  teamBuffs?: TeamBuffTotals,
  combat?: CombatSetup,
): DamageScore | undefined {
  if (target.kind !== 'damage' || artifacts.length < 5) return undefined
  const actual: Record<string, number> = {}
  for (const artifact of artifacts) for (const sub of artifact.substats) actual[sub.stat] = (actual[sub.stat] ?? 0) + sub.value
  return damageScore({
    stats: SUBSTAT_STATS,
    roll: (stat, kind) => (kind === 'max' ? maxRoll : averageRoll)(stat as GenshinStatKey),
    actual,
    mains: artifacts.map((artifact) => artifact.main.stat),
    score: (extra) => scoreStats(computeGenshinStats(character, artifacts, extra, teamBuffs, combat).stats, target),
  }, GENSHIN_SCORE_PARAMS)
}

// Stat simulation (shared/statSimulation.ts): one average roll of each artifact substat
export const GENSHIN_SIM_ROLLS: SimulationRolls = { stats: SUBSTAT_STATS, roll: (stat) => averageRoll(stat as GenshinStatKey) }

// The stats of these artifacts' sets and main stats with these substat rolls instead of their own
export function genshinSimulatedStats(
  character: GenshinCharacter,
  artifacts: Artifact[],
  rolls: Record<string, number>,
  teamBuffs?: TeamBuffTotals,
  combat?: CombatSetup,
) {
  const extra = simulationExtra(GENSHIN_SIM_ROLLS, substatTotals(artifacts.flatMap((a) => a.substats)), rolls)
  return computeGenshinStats(character, artifacts, extra, teamBuffs, combat).stats
}
