import {
  benchmarkRating,
  type GearScore,
} from 'lib/games/shared/gearScore'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { calculateScorePercent } from 'lib/scoring/scoreScales'

// A build's rating by its rotation damage, after HSR's DPS score (lib/scoring/simScoringUtils.ts): the build's damage
// is placed between three simulated builds that keep its main stats and sets but swap its substats for made-up ones.
//   baseline:  only the free rolls, spread evenly over every substat (0%)
//   benchmark: the free rolls plus the rest of a standard number of average rolls, each placed where it adds the most
//              damage (100%, SS)
//   perfect:   every roll a max roll, all placed where they add the most (200%)
// Each game says how many rolls its builds get (SimParams) and how to score a build with its substats changed by
// extra stats (DamageScoreInput.score), usually its substat-upgrade scorer from optimizer/analysis.ts.

export type SimParams = {
  // Rolls in the whole build, free ones included
  goal: number,
  // Rolls every substat gets before the rest are placed
  free: number,
  // Most rolls one substat can have, less deductionPerMain for every piece whose main stat it is
  maxPerSub: number,
  deductionPerMain: number,
}

export type DamageScoreParams = {
  benchmark: SimParams,
  perfect: SimParams,
}

export type DamageScoreInput = {
  // Every stat a substat can be
  stats: string[],
  // One roll of a stat: an average roll for the baseline and benchmark, a max roll for the perfect build
  roll: (stat: string, kind: 'average' | 'max') => number,
  // The build's own substat totals, which the simulated substats replace
  actual: Record<string, number>,
  // Each piece's main stat
  mains: string[],
  // The build's score with these extra stats added (negative ones take stats away)
  score: (extra: Record<string, number>) => number,
}

export type DamageScore = GearScore & {
  damage: number,
  baseline: number,
  benchmark: number,
  perfect: number,
  // The benchmark's main stats, when they came from the character's metadata (variants); the build's own otherwise
  benchmarkMains?: string[],
}

// The extra stats that turn the build's substats into these rolls
function extraFor(input: DamageScoreInput, rolls: Record<string, number>, kind: 'average' | 'max'): Record<string, number> {
  const extra: Record<string, number> = {}
  for (const stat of new Set([...input.stats, ...Object.keys(input.actual)])) {
    const value = (rolls[stat] ?? 0) * (input.stats.includes(stat) ? input.roll(stat, kind) : 0) - (input.actual[stat] ?? 0)
    if (value !== 0) extra[stat] = value
  }
  return extra
}

// The free rolls on every substat, then the rest one at a time on whichever substat adds the most
export function simulateBuild(input: DamageScoreInput, params: SimParams, kind: 'average' | 'max'): number {
  return simulateRolls(input, params, kind).score
}

// The same, with where the rolls went (the Benchmarks pages show them)
export function simulateRolls(input: DamageScoreInput, params: SimParams, kind: 'average' | 'max'): { score: number, rolls: Record<string, number> } {
  const rolls: Record<string, number> = Object.fromEntries(input.stats.map((stat) => [stat, params.free]))
  const cap = (stat: string) => params.maxPerSub - params.deductionPerMain * input.mains.filter((main) => main === stat).length
  let current = input.score(extraFor(input, rolls, kind))
  let left = params.goal - params.free * input.stats.length
  while (left > 0) {
    const step = Math.min(1, left)
    let best: { stat: string, score: number } | undefined
    for (const stat of input.stats) {
      if (rolls[stat] + step > cap(stat)) continue
      const score = input.score(extraFor(input, { ...rolls, [stat]: rolls[stat] + step }, kind))
      if (!best || score > best.score) best = { stat, score }
    }
    // Nothing left to raise: the remaining rolls can't add damage
    if (!best || best.score <= current) break
    rolls[best.stat] += step
    current = best.score
    left -= step
  }
  return { score: current, rolls }
}

export type SimulatedBuild = { score: number, rolls: Record<string, number>, extra: Record<string, number> }

export type BenchmarkBuilds = {
  // The variant the benchmark used (index into variants), undefined for the build's own sets and mains
  variant?: number,
  mains: string[],
  baseline: SimulatedBuild,
  benchmark: SimulatedBuild,
  perfect: SimulatedBuild,
}

// The three simulated builds behind a DPS score, after HSR's Benchmarks tab: the baseline (0%), the benchmark (100%)
// and the perfect build (200%), each with its rolls per substat and the extra stats that make them
export function benchmarkBuilds(input: DamageScoreInput, params: DamageScoreParams, variants: DamageScoreInput[] = []): BenchmarkBuilds {
  const candidates = variants.length > 0 ? variants : [input]
  let best = { index: 0, benchmark: simulateRolls(candidates[0], params.benchmark, 'average') }
  candidates.forEach((candidate, index) => {
    if (index === 0) return
    const benchmark = simulateRolls(candidate, params.benchmark, 'average')
    if (benchmark.score > best.benchmark.score) best = { index, benchmark }
  })
  const candidate = candidates[best.index]
  const withExtra = (simulated: { score: number, rolls: Record<string, number> }, kind: 'average' | 'max'): SimulatedBuild => ({
    ...simulated,
    extra: extraFor(candidate, simulated.rolls, kind),
  })
  const baselineParams = { ...params.benchmark, goal: params.benchmark.free * candidate.stats.length }
  return {
    ...(variants.length > 0 ? { variant: best.index } : {}),
    mains: candidate.mains,
    baseline: withExtra(simulateRolls(candidate, baselineParams, 'average'), 'average'),
    benchmark: withExtra(best.benchmark, 'average'),
    perfect: withExtra(simulateRolls(candidate, params.perfect, 'max'), 'max'),
  }
}

// The pages work a score out on every render, and a full one is a few hundred damage calculations (~10-25 ms). The
// build's damage with one more roll of each substat is a cheap fingerprint of everything the score depends on (gear,
// character, team, rotation, enemy), so a result is reused while that fingerprint, the substats and the mains match
const MEMO_SIZE = 32
const memo = new Map<string, DamageScore | undefined>()

// variants: the same build with other sets and main stats (shared/benchmarkVariants.ts, from the character's metadata
// simulation), after HSR, whose benchmark picks its sets and mains from the curated lists. The best variant's benchmark
// is the one the build is compared with; without variants the build's own sets and mains are kept
export function damageScore(input: DamageScoreInput, params: DamageScoreParams, variants: DamageScoreInput[] = []): DamageScore | undefined {
  const damage = input.score({})
  const probes = input.stats.map((stat) => input.score({ [stat]: input.roll(stat, 'average') }))
  const candidates = variants.length > 0 ? variants : [input]
  const key = JSON.stringify([params, input.mains, input.actual, damage, probes, variants.map((v) => [v.mains, v.score({})])])
  if (memo.has(key)) return memo.get(key)

  let best = { candidate: candidates[0], benchmark: -Infinity }
  for (const candidate of candidates) {
    const value = simulateBuild(candidate, params.benchmark, 'average')
    if (value > best.benchmark) best = { candidate, benchmark: value }
  }
  const { candidate, benchmark } = best
  const baselineParams = { ...params.benchmark, goal: params.benchmark.free * candidate.stats.length }
  const baseline = simulateBuild(candidate, baselineParams, 'average')
  const perfect = simulateBuild(candidate, params.perfect, 'max')
  let result: DamageScore | undefined
  if (damage > 0 && benchmark > baseline) {
    const percent = Math.floor(calculateScorePercent(damage, baseline, benchmark, perfect) * 1000) / 10
    // The grade stretches small damage gaps (an EM character's substats move her Swirls a few percent), so the plain
    // damage share is shown next to it
    const ofBenchmark = Math.round((damage / benchmark) * 1000) / 10
    result = {
      percent,
      rating: benchmarkRating(percent),
      ofBenchmark,
      damage,
      baseline,
      benchmark,
      perfect,
      ...(variants.length > 0 ? { benchmarkMains: candidate.mains } : {}),
    }
  }

  memo.set(key, result)
  if (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value!)
  return result
}

// The last damage score each character's current build got in the optimizer, for the characters pages, which have no
// rotation setup of their own. Kept in localStorage `<game>-dps-scores` with the worn piece ids it was worked out for:
// once the gear changes it no longer shows. A cache only, so it isn't in backups.

type RememberedScores = Record<string, { gear: string, percent: number, rating: string, ofBenchmark?: number }>

const scoresKey = (game: string) => `${game}-dps-scores`
const gearKey = (pieceIds: string[]) => [...pieceIds].sort().join(',')

function readScores(game: string): RememberedScores {
  try {
    const parsed: unknown = JSON.parse(readStorage(scoresKey(game)) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as RememberedScores : {}
  } catch {
    return {}
  }
}

export function rememberDamageScore(game: string, characterId: string, pieceIds: string[], score: GearScore | undefined) {
  const scores = readScores(game)
  const gear = gearKey(pieceIds)
  const old = scores[characterId]
  if (score && old?.gear === gear && old.percent === score.percent && old.ofBenchmark === score.ofBenchmark) return
  if (score) scores[characterId] = { gear, percent: score.percent, rating: score.rating, ofBenchmark: score.ofBenchmark }
  else if (old) delete scores[characterId]
  else return
  writeStorage(scoresKey(game), JSON.stringify(scores))
}

export function rememberedDamageScore(game: string, characterId: string, pieceIds: string[]): GearScore | undefined {
  const entry = readScores(game)[characterId]
  if (!entry || entry.gear !== gearKey(pieceIds) || typeof entry.percent !== 'number') return undefined
  return { percent: entry.percent, rating: entry.rating, ...(typeof entry.ofBenchmark === 'number' ? { ofBenchmark: entry.ofBenchmark } : {}) }
}
