import {
  benchmarkRating,
  type GearScore,
} from 'lib/games/shared/gearScore'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'

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
}

// HSR's calculateScorePercent (lib/scoring/scoringConfig.ts): baseline 0, benchmark 1, perfection 2
export function scorePercent(score: number, baseline: number, benchmark: number, perfection: number): number {
  const clampedPerfection = Math.max(perfection, benchmark)
  if (score >= benchmark) {
    const range = clampedPerfection - benchmark
    return range > 0 ? 1 + (score - benchmark) / range : 1
  }
  const range = benchmark - baseline
  return range > 0 ? (score - baseline) / range : 0
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
  return current
}

// The pages work a score out on every render, and a full one is a few hundred damage calculations (~10-25 ms). The
// build's damage with one more roll of each substat is a cheap fingerprint of everything the score depends on (gear,
// character, team, rotation, enemy), so a result is reused while that fingerprint, the substats and the mains match
const MEMO_SIZE = 32
const memo = new Map<string, DamageScore | undefined>()

export function damageScore(input: DamageScoreInput, params: DamageScoreParams): DamageScore | undefined {
  const damage = input.score({})
  const probes = input.stats.map((stat) => input.score({ [stat]: input.roll(stat, 'average') }))
  const key = JSON.stringify([params, input.mains, input.actual, damage, probes])
  if (memo.has(key)) return memo.get(key)

  const baselineParams = { ...params.benchmark, goal: params.benchmark.free * input.stats.length }
  const baseline = simulateBuild(input, baselineParams, 'average')
  const benchmark = simulateBuild(input, params.benchmark, 'average')
  const perfect = simulateBuild(input, params.perfect, 'max')
  let result: DamageScore | undefined
  if (damage > 0 && benchmark > baseline) {
    const percent = Math.floor(scorePercent(damage, baseline, benchmark, perfect) * 1000) / 10
    result = { percent, rating: benchmarkRating(percent), damage, baseline, benchmark, perfect }
  }

  memo.set(key, result)
  if (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value!)
  return result
}

// The last damage score each character's current build got in the optimizer, for the characters pages, which have no
// rotation setup of their own. Kept in localStorage `<game>-dps-scores` with the worn piece ids it was worked out for:
// once the gear changes it no longer shows. A cache only, so it isn't in backups.

type RememberedScores = Record<string, { gear: string, percent: number, rating: string }>

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
  if (score && old?.gear === gear && old.percent === score.percent) return
  if (score) scores[characterId] = { gear, percent: score.percent, rating: score.rating }
  else if (old) delete scores[characterId]
  else return
  writeStorage(scoresKey(game), JSON.stringify(scores))
}

export function rememberedDamageScore(game: string, characterId: string, pieceIds: string[]): GearScore | undefined {
  const entry = readScores(game)[characterId]
  if (!entry || entry.gear !== gearKey(pieceIds) || typeof entry.percent !== 'number') return undefined
  return { percent: entry.percent, rating: entry.rating }
}
