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
  avgRollPct,
  maxRoll,
  SUBSTAT_KEYS,
} from 'lib/games/wuwa/echoStats'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
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
  type StatKey,
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
// variants: the same echoes with the metadata's benchmark sets and mains (wuwaBenchmarkVariants)
export function wuwaDamageScore(
  character: CharacterState,
  echoes: Echo[],
  target: EchoTarget,
  teamBonus: Bonus = {},
  variants: Echo[][] = [],
): DamageScore | undefined {
  const inputs = wuwaScoreInputs(character, echoes, target, teamBonus, variants)
  return inputs && damageScore(inputs.input, WUWA_SCORE_PARAMS, inputs.variants)
}

// The DPS score's inputs (shared/damageScore.ts) for these echoes and their benchmark variants; the Benchmarks page shows
// the simulated builds from them
export function wuwaScoreInputs(
  character: CharacterState,
  echoes: Echo[],
  target: EchoTarget,
  teamBonus: Bonus = {},
  variants: Echo[][] = [],
): { input: DamageScoreInput, variants: DamageScoreInput[] } | undefined {
  if (target.kind !== 'damage' || echoes.length === 0) return undefined
  const actual: Record<string, number> = {}
  for (const echo of echoes) for (const sub of echo.substats) actual[sub.stat] = (actual[sub.stat] ?? 0) + sub.value
  const inputFor = (pieces: Echo[]) => ({
    stats: SUBSTAT_KEYS,
    roll: (stat: string, kind: 'average' | 'max') => maxRoll(stat as SubstatKey) * (kind === 'max' ? 1 : avgRollPct(stat as SubstatKey)),
    actual,
    mains: pieces.map((echo) => echo.mainStat),
    score: scorer(character, pieces, target, teamBonus),
  })
  return { input: inputFor(echoes), variants: variants.map(inputFor) }
}

// The DPS score's benchmark sets and mains from the Resonator's metadata simulation (shared/benchmarkVariants.ts): a
// set option over the whole loadout (or 2 + the rest), each listed main stat per cost at +25
export function wuwaBenchmarkVariants(echoes: Echo[], simulation: SimulationMetadata<unknown> | undefined): Echo[][] {
  return benchmarkVariants(echoes, simulation, {
    slotOf: (echo) => String(echo.cost),
    withMain: (echo, stat) => (MAIN_STAT_MAX[echo.cost]?.[stat as StatKey] === undefined ? undefined : { ...echo, mainStat: stat as StatKey, level: 25 }),
    withSet: (echo, setId) => ({ ...echo, setId }),
    setPattern: (option, pieces) => (option.length === 1 ? [pieces] : [2, pieces - 2]),
  })
}

// Stat simulation (shared/statSimulation.ts): one average roll (the tiers' mean) of each echo substat
export const WUWA_SIM_ROLLS: SimulationRolls = { stats: SUBSTAT_KEYS, roll: (stat) => maxRoll(stat as SubstatKey) * avgRollPct(stat as SubstatKey) }

// The stats of these echoes' sets and main stats with these substat rolls instead of their own
export function wuwaSimulatedStats(character: CharacterState, echoes: Echo[], rolls: Record<string, number>, teamBonus: Bonus = {}) {
  const extra = simulationExtra(WUWA_SIM_ROLLS, substatTotals(echoes.flatMap((e) => e.substats)), rolls)
  const total: Bonus = { ...teamBonus }
  for (const [stat, value] of Object.entries(extra) as [keyof Bonus, number][]) total[stat] = (total[stat] ?? 0) + value
  return computeWuwaStats(character, echoes, total).stats
}
