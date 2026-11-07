import type { SubstatUpgrade } from 'lib/games/shared/analysis'
import { pctToRating } from 'lib/relics/scoring/scoreFormatting'
import { SimScoreGrades } from 'lib/scoring/scoreScales'

// One piece of gear's score, after Fribbels' HSR relic score (lib/relics/scoring): its substats weighted by how much
// the character wants each stat, as a percent of the best piece possible for that character, with HSR's grades
// (each grade is 5% of a perfect piece). The main stat isn't scored, like HSR's current-score.
// Shared by ZZZ discs, Genshin artifacts and WuWa echoes; each game says how its substats roll.

// ofBenchmark: DPS scores only, the build's damage as a percent of the benchmark build's (shared/damageScore.ts)
export type GearScore = { percent: number, rating: string, ofBenchmark?: number }

// How a piece's substats roll
export type PieceRules = {
  // Substats a piece has, each rolled once
  substats: number,
  // Extra rolls that land on one of them
  upgrades: number,
  // Whether a substat can be the same stat as the main stat (WuWa yes, ZZZ and Genshin no)
  substatCanMatchMain: boolean,
}

// A substat in rolls of its maximum value: 1 = one max roll
export type SubstatUnits = { stat: string, units: number }

// HSR's relic grades (relics/scoring/scoreFormatting.ts pctToRating): 5% of the ideal piece per grade, F to WTF+, '?'
// for nothing useful
export function ratingFor(percent: number): string {
  return pctToRating(percent)
}

// The best a piece can score: its substats are the most wanted stats, and every upgrade lands on the most wanted one
export function idealUnits(weights: Record<string, number>, mainStat: string, rules: PieceRules): number {
  const ranked = Object.entries(weights)
    .filter(([stat, weight]) => weight > 0 && (rules.substatCanMatchMain || stat !== mainStat))
    .map(([, weight]) => weight)
    .sort((a, b) => b - a)
  const best = ranked.slice(0, rules.substats)
  return best.reduce((sum, weight) => sum + weight, 0) + rules.upgrades * (best[0] ?? 0)
}

export function scoreGear(substats: SubstatUnits[], mainStat: string, weights: Record<string, number>, rules: PieceRules): GearScore | undefined {
  const ideal = idealUnits(weights, mainStat, rules)
  if (ideal <= 0) return undefined
  const raw = substats.reduce((sum, sub) => sum + sub.units * (weights[sub.stat] ?? 0), 0)
  const percent = Math.floor((raw / ideal) * 1000) / 10
  return { percent, rating: ratingFor(percent) }
}

// What levelling a piece still adds, per game: new substats it will gain, upgrades still to land on one of its
// substats, every stat a new substat can be, and an average roll of a stat in units (1 = a max roll)
export type PieceGrowth = { newSubstats: number, upgrades: number, pool: string[], averageRoll: (stat: string) => number }

// HSR's relic potential (Relics tab Avg / Max potential): the score once the piece is fully levelled. Best case: new
// substats are the most wanted stats it doesn't have and every upgrade is a max roll on its most wanted substat.
// Average: new substats are any stat it can still get and upgrades land on its substats evenly, with average rolls
export function gearPotential(
  substats: SubstatUnits[],
  mainStat: string,
  weights: Record<string, number>,
  rules: PieceRules,
  growth: PieceGrowth,
): { avg: number, max: number } | undefined {
  const ideal = idealUnits(weights, mainStat, rules)
  if (ideal <= 0) return undefined
  const weight = (stat: string) => weights[stat] ?? 0
  const now = substats.reduce((sum, sub) => sum + sub.units * weight(sub.stat), 0)
  const have = new Set(substats.map((s) => s.stat))
  const open = growth.pool.filter((stat) => !have.has(stat) && (rules.substatCanMatchMain || stat !== mainStat))
  const newCount = Math.min(growth.newSubstats, open.length)

  const bestNew = open.map(weight).sort((a, b) => b - a).slice(0, newCount)
  const bestFinal = Math.max(0, ...substats.map((s) => weight(s.stat)), ...bestNew)
  const max = now + bestNew.reduce((sum, w) => sum + w, 0) + growth.upgrades * bestFinal

  // An average new substat, and an average upgrade spread evenly over the final substats
  const openAverage = open.length ? open.reduce((sum, stat) => sum + weight(stat) * growth.averageRoll(stat), 0) / open.length : 0
  const finalCount = substats.length + newCount
  const upgradeAverage = finalCount
    ? (substats.reduce((sum, s) => sum + weight(s.stat) * growth.averageRoll(s.stat), 0) + newCount * openAverage) / finalCount
    : 0
  const avg = now + newCount * openAverage + growth.upgrades * upgradeAverage

  const percent = (raw: number) => Math.floor((raw / ideal) * 1000) / 10
  return { avg: percent(avg), max: percent(max) }
}

// Weights from the build analysis: each substat's gain from one more roll, against the biggest gain. Stats that add
// less than 5% of the best count as unwanted
export function weightsFromUpgrades(upgrades: SubstatUpgrade[]): Record<string, number> {
  const best = Math.max(0, ...upgrades.map((u) => u.gain))
  if (best <= 0) return {}
  return Object.fromEntries(upgrades.map((u) => {
    const weight = u.gain / best
    return [u.stat, weight >= 0.05 ? Math.round(weight * 100) / 100 : 0]
  }))
}

// Weights from a priority list, best first: 1, 0.8, 0.6, 0.4, 0.2
export function weightsFromPriority(priority: string[]): Record<string, number> {
  return Object.fromEntries(priority.slice(0, 5).map((stat, i) => [stat, Math.round((1 - i * 0.2) * 100) / 100]))
}

// The whole build's rating, on the scale of the DPS Benchmark summary under HSR's stat block
// (lib/scoring/scoringConfig.ts calculateScorePercent): 0% is a build with no useful substats, 100% the benchmark, 200%
// perfection, with HSR's benchmark grades (lib/scoring/dpsScore.ts SimScoreGrades). Without a damage calculation it
// stretches the average piece score instead, empty slots counting as 0.
// The benchmark is a 62% average piece score, calibrated on HSR itself: a Himeko build whose six relic scores average
// 62.3 gets 100.8% · SS from HSR's DPS Benchmark, and this scale gives the same 100.8%
export const BENCHMARK_PIECE_PERCENT = 62

// HSR's DPS score grades, best first; AEON is for verified HSR builds only
const BENCHMARK_GRADES = Object.entries(SimScoreGrades).filter(([grade]) => grade !== 'AEON').sort((a, b) => b[1] - a[1])

export function benchmarkRating(percent: number): string {
  // Below HSR's lowest grade we still show F, where HSR shows '?'
  return BENCHMARK_GRADES.find(([, min]) => percent >= min)?.[0] ?? 'F'
}

// An average piece score (0-100) on the benchmark scale (0-200). benchmark is the average piece score that counts as 100%
export function benchmarkPercent(averagePiece: number, benchmark = BENCHMARK_PIECE_PERCENT): number {
  const b = Math.min(Math.max(benchmark, 1), 99)
  return averagePiece <= b ? (averagePiece / b) * 100 : 100 + ((averagePiece - b) / (100 - b)) * 100
}

// slots is how many pieces a full build has; a game can pass its own benchmark (Genshin: a KQM Standards build)
export function scoreBuild(scores: (GearScore | undefined)[], slots: number, benchmark = BENCHMARK_PIECE_PERCENT): GearScore | undefined {
  if (slots <= 0 || scores.every((s) => !s)) return undefined
  const average = scores.reduce((sum, s) => sum + (s?.percent ?? 0), 0) / slots
  const percent = Math.floor(benchmarkPercent(average, benchmark) * 10) / 10
  return { percent, rating: benchmarkRating(percent) }
}
