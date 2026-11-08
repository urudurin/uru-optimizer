import {
  gearPotential,
  type GearScore,
  type PieceRules,
  scoreBuild,
  scoreGear,
} from 'lib/games/shared/gearScore'
import { withWeightOverrides } from 'lib/games/shared/scoreWeights'
import { wuwaMetadata } from 'lib/games/wuwa/data/metadata'
import { weightsFromPriority } from 'lib/games/wuwa/data/statPriorities'
import {
  avgRollPct,
  maxRoll,
  SUBSTAT_KEYS,
} from 'lib/games/wuwa/echoStats'
import {
  type CharacterState,
  type Echo,
  MAX_LOADOUT_ECHOES,
  type SubstatKey,
} from 'lib/games/wuwa/types'

// Echo scores (shared/gearScore.ts) for one Resonator, with fixed weights per Resonator like Fribbels' HSR relic scores:
// Crit Rate and Crit DMG 1 when crits matter, the stat they scale on 0.75 (1 without crits), its flat version a third
// of that, their skill-type DMG 0.5, Energy Regen as data/statPriorities.ts says. Substats count in max rolls, so a
// top-tier roll is 1.
//
// The build rating's 100% is the Resonator's standard build. WuWa has no community standard like Genshin's KQM
// Standards, so ours follows its idea: 5 echoes of 5 substats at average rolls, 12 of the 25 on the Resonator's best
// stats (at most once per echo), the other 13 spread over every substat in turn.

// 5 substats rolled once each; a substat can be the same stat as the main stat
export const ECHO_RULES: PieceRules = { substats: 5, upgrades: 0, substatCanMatchMain: true }

// The table's weights, before the user's own (the Scoring weights modal resets to these)
export function defaultEchoWeights(character: CharacterState): Record<string, number> {
  return { ...wuwaMetadata(character.charId).stats }
}

export function wuwaEchoWeights(character: CharacterState): Record<string, number> {
  // The user's own weights for this Resonator win (shared/scoreWeights.ts)
  return withWeightOverrides('wuwa', character.charId, defaultEchoWeights(character))
}

export function scoreEcho(echo: Echo, weights: Record<string, number>): GearScore | undefined {
  const substats = echo.substats.map((sub) => ({ stat: sub.stat, units: sub.value / maxRoll(sub.stat) }))
  return scoreGear(substats, echo.mainStat, weights, ECHO_RULES)
}

const SUBSTATS_PER_ECHO = 5
const BEST_STAT_SLOTS = 12

const benchmarkCache = new Map<string, number>()

// The average echo score of the Resonator's standard build
export function standardBenchmark(weights: Record<string, number>): number {
  const key = JSON.stringify(weights)
  const cached = benchmarkCache.get(key)
  if (cached !== undefined) return cached

  const echoes = Array.from({ length: MAX_LOADOUT_ECHOES }, () => new Set<SubstatKey>())
  const total = MAX_LOADOUT_ECHOES * SUBSTATS_PER_ECHO
  let placed = 0
  // The best stats, once per echo
  for (const stat of SUBSTAT_KEYS.filter((s) => (weights[s] ?? 0) > 0).sort((a, b) => weights[b] - weights[a])) {
    for (const echo of echoes) {
      if (placed === BEST_STAT_SLOTS) break
      echo.add(stat)
      placed++
    }
  }
  // The rest: every substat in turn, on the echo with the most room that doesn't have it yet
  while (placed < total) {
    const before = placed
    for (const stat of SUBSTAT_KEYS) {
      if (placed === total) break
      const echo = echoes.filter((e) => !e.has(stat) && e.size < SUBSTATS_PER_ECHO).sort((a, b) => a.size - b.size)[0]
      if (!echo) continue
      echo.add(stat)
      placed++
    }
    if (placed === before) break
  }

  const scores = echoes.map((echo) =>
    // Main stats aren't scored and substats may match them, so any main stat gives the same score
    scoreGear([...echo].map((stat) => ({ stat, units: avgRollPct(stat) })), 'critRate', weights, ECHO_RULES)?.percent ?? 0
  )
  const benchmark = scores.reduce((sum, s) => sum + s, 0) / scores.length
  benchmarkCache.set(key, benchmark)
  return benchmark
}

// The worn echoes' rating against the Resonator's standard build (100%)
export function wuwaBuildScore(character: CharacterState, worn: Echo[]): GearScore | undefined {
  const weights = wuwaEchoWeights(character)
  return scoreBuild(worn.map((echo) => scoreEcho(echo, weights)), MAX_LOADOUT_ECHOES, standardBenchmark(weights))
}

// The echo's score once at +25, average and best case (shared/gearScore.ts gearPotential): a new substat every 5 levels
// up to 5, each rolled once from its tiers, no upgrades
export function echoPotential(echo: Echo, weights: Record<string, number>): { avg: number, max: number } | undefined {
  return gearPotential(echo.substats.map((sub) => ({ stat: sub.stat, units: sub.value / maxRoll(sub.stat) })), echo.mainStat, weights, ECHO_RULES, {
    newSubstats: Math.max(0, 5 - echo.substats.length),
    upgrades: 0,
    pool: SUBSTAT_KEYS,
    averageRoll: (stat) => avgRollPct(stat as SubstatKey),
  })
}

// Kept here for older imports; the formula lives next to the table
export { weightsFromPriority } from 'lib/games/wuwa/data/statPriorities'
