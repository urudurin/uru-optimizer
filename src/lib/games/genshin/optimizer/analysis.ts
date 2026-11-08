import type { CombatSetup } from 'lib/games/genshin/damage/combatEffects'
import {
  MAIN_STAT_OPTIONS,
  MAX_MAIN_VALUE,
} from 'lib/games/genshin/data/mainStatOptions'
import {
  averageRoll,
  maxRoll,
  SUBSTAT_STATS,
} from 'lib/games/genshin/goodKeys'
import { nameFromGoodKey } from 'lib/games/genshin/goodKeys'
import {
  type OptimizerTarget,
  scoreStats,
} from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { MainStatSlot } from 'lib/games/genshin/optimizer/artifactOptimizer'
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
  // The same artifacts with the metadata's benchmark sets and mains (genshinBenchmarkVariants)
  variants: Artifact[][] = [],
): DamageScore | undefined {
  const inputs = genshinScoreInputs(character, artifacts, target, teamBuffs, combat, variants)
  return inputs && damageScore(inputs.input, GENSHIN_SCORE_PARAMS, inputs.variants)
}

// The DPS score's inputs (shared/damageScore.ts) for these artifacts and their benchmark variants; the Benchmarks page
// shows the simulated builds from them
export function genshinScoreInputs(
  character: GenshinCharacter,
  artifacts: Artifact[],
  target: OptimizerTarget,
  teamBuffs?: TeamBuffTotals,
  combat?: CombatSetup,
  variants: Artifact[][] = [],
): { input: DamageScoreInput, variants: DamageScoreInput[] } | undefined {
  if (target.kind !== 'damage' || artifacts.length < 5) return undefined
  const actual: Record<string, number> = {}
  for (const artifact of artifacts) for (const sub of artifact.substats) actual[sub.stat] = (actual[sub.stat] ?? 0) + sub.value
  const inputFor = (pieces: Artifact[]) => {
    // A variant's 4-piece set counts in combat like the build's own (computeGenshinStats checks the piece counts)
    const pieceCombat = combat && pieces !== artifacts ? { ...combat, sets: [...new Set([...combat.sets, ...pieces.map((a) => a.setId)])] } : combat
    return {
      stats: SUBSTAT_STATS,
      roll: (stat: string, kind: 'average' | 'max') => (kind === 'max' ? maxRoll : averageRoll)(stat as GenshinStatKey),
      actual,
      mains: pieces.map((artifact) => artifact.main.stat),
      score: (extra: Record<string, number>) => scoreStats(computeGenshinStats(character, pieces, extra, teamBuffs, pieceCombat).stats, target),
    }
  }
  return { input: inputFor(artifacts), variants: variants.map(inputFor) }
}

// The DPS score's benchmark sets and mains from the character's metadata simulation (shared/benchmarkVariants.ts): a
// 4-piece set (and the fifth piece as it is) or 2 + 2, each listed main stat at +20
export function genshinBenchmarkVariants(artifacts: Artifact[], simulation: SimulationMetadata<unknown> | undefined): Artifact[][] {
  return benchmarkVariants(artifacts, simulation, {
    slotOf: (artifact) => artifact.slot,
    withMain: (artifact, stat) => {
      const value = MAX_MAIN_VALUE[stat as GenshinStatKey]
      if (value === undefined || !MAIN_STAT_OPTIONS[artifact.slot as MainStatSlot]?.includes(stat as GenshinStatKey)) return undefined
      return { ...artifact, rarity: 5, level: 20, main: { stat: stat as GenshinStatKey, value } }
    },
    withSet: (artifact, setId) => ({ ...artifact, setId, setName: nameFromGoodKey(setId) }),
    setPattern: (option) => (option.length === 1 ? [4] : option.map(() => 2)),
  })
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
