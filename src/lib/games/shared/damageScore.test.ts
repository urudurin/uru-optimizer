import { benchmarkVariants } from 'lib/games/shared/benchmarkVariants'
import {
  benchmarkBuilds,
  damageScore,
  type DamageScoreInput,
  simulateBuild,
} from 'lib/games/shared/damageScore'
import { calculateScorePercent } from 'lib/scoring/scoreScales'
import {
  describe,
  expect,
  it,
} from 'vitest'

// A toy build: damage = atk x (1 + cr x cd), one useless stat, a roll is 1 of anything (0.8 on average)
function toyInput(actual: Record<string, number>, mains: string[] = []): DamageScoreInput {
  return {
    stats: ['atk', 'cr', 'cd', 'hp'],
    roll: (_stat, kind) => (kind === 'max' ? 1 : 0.8),
    actual,
    mains,
    score: (extra) => {
      const total = (stat: string) => (actual[stat] ?? 0) + (extra[stat] ?? 0)
      return (10 + total('atk')) * (1 + 0.05 * total('cr') * 0.1 * total('cd'))
    },
  }
}

const params = {
  benchmark: { goal: 20, free: 2, maxPerSub: 8, deductionPerMain: 2 },
  perfect: { goal: 24, free: 0, maxPerSub: 10, deductionPerMain: 2 },
}

describe('calculateScorePercent (HSR)', () => {
  it('maps baseline, benchmark and perfection to 0, 1 and 2', () => {
    expect(calculateScorePercent(10, 10, 20, 40)).toBe(0)
    expect(calculateScorePercent(15, 10, 20, 40)).toBe(0.5)
    expect(calculateScorePercent(20, 10, 20, 40)).toBe(1)
    expect(calculateScorePercent(30, 10, 20, 40)).toBe(1.5)
  })
})

describe('simulateBuild', () => {
  it('gives every substat its free rolls and places the rest where they add the most, within the caps', () => {
    const input = toyInput({})
    const damage = simulateBuild(input, params.benchmark, 'average')
    expect(damage).toBeGreaterThan(input.score({ atk: 1.6, cr: 1.6, cd: 1.6, hp: 1.6 }))
    // The 12 placed rolls all go to useful stats (hp keeps its 2 free ones), 18 in all, none over its cap of 8
    let best = 0
    for (let atk = 2; atk <= 8; atk++) {
      for (let cr = 2; cr <= 8; cr++) {
        const cd = 18 - atk - cr
        if (cd < 2 || cd > 8) continue
        best = Math.max(best, input.score({ atk: atk * 0.8, cr: cr * 0.8, cd: cd * 0.8, hp: 1.6 }))
      }
    }
    expect(damage).toBeCloseTo(best, 6)
  })

  it('takes rolls off a substat for each piece with it as the main stat', () => {
    const free = simulateBuild(toyInput({}), params.benchmark, 'average')
    const capped = simulateBuild(toyInput({}, ['cr', 'cr', 'cr']), params.benchmark, 'average')
    expect(capped).toBeLessThan(free)
  })
})

describe('damageScore', () => {
  it('puts a benchmark-like build near 100% and an empty one at 0%', () => {
    const empty = damageScore(toyInput({ atk: 1.6, cr: 1.6, cd: 1.6, hp: 1.6 }), params)!
    expect(empty.percent).toBeCloseTo(0, 0)
    const strong = damageScore(toyInput({ atk: 6, cr: 6, cd: 6, hp: 1.6 }), params)!
    expect(strong.percent).toBeGreaterThan(95)
    expect(strong.benchmark).toBeGreaterThan(strong.baseline)
    expect(strong.perfect).toBeGreaterThan(strong.benchmark)
    // The plain damage share, one decimal
    expect(strong.ofBenchmark).toBeCloseTo(Math.round((strong.damage / strong.benchmark) * 1000) / 10, 6)
    expect(empty.ofBenchmark).toBeLessThan(100)
  })

  it('reuses the result while the build and its setup are unchanged', () => {
    let calls = 0
    const input = toyInput({ atk: 4, cr: 3, cd: 5, hp: 2 })
    const counted = { ...input, score: (extra: Record<string, number>) => (calls++, input.score(extra)) }
    const first = damageScore(counted, params)
    const full = calls
    calls = 0
    expect(damageScore(counted, params)).toBe(first)
    // The damage and one probe per substat
    expect(calls).toBe(1 + input.stats.length)
    expect(full).toBeGreaterThan(calls)
  })

  it('has no score without damage', () => {
    expect(damageScore({ ...toyInput({}), score: () => 0 }, params)).toBeUndefined()
  })
})

describe('benchmark variants (sets and mains from the metadata, step 4)', () => {
  it('compares the build with the best variant\'s benchmark and shows where its rolls went', () => {
    const build = toyInput({ atk: 4, cr: 4, cd: 4 })
    // A variant whose mains give +5 ATK on top: its benchmark is higher, so the same build grades lower against it
    const better: DamageScoreInput = { ...toyInput({ atk: 4, cr: 4, cd: 4 }, ['atk']), score: (extra) => build.score({ ...extra, atk: (extra.atk ?? 0) + 5 }) }
    const own = damageScore(build, params)!
    const withVariants = damageScore(build, params, [toyInput({ atk: 4, cr: 4, cd: 4 }, ['hp']), better])!
    expect(withVariants.damage).toBe(own.damage)
    expect(withVariants.benchmark).toBeGreaterThan(own.benchmark)
    expect(withVariants.percent).toBeLessThan(own.percent)
    expect(withVariants.benchmarkMains).toEqual(['atk'])

    const builds = benchmarkBuilds(build, params, [toyInput({ atk: 4, cr: 4, cd: 4 }, ['hp']), better])
    expect(builds.variant).toBe(1)
    expect(builds.benchmark.score).toBeCloseTo(withVariants.benchmark, 6)
    expect(builds.perfect.score).toBeCloseTo(withVariants.perfect, 6)
    expect(Object.values(builds.benchmark.rolls).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(params.benchmark.goal)
    expect(builds.baseline.rolls).toEqual({ atk: 2, cr: 2, cd: 2, hp: 2 })
  })

  it('builds a variant per set option and main stat combination, and none without a simulation', () => {
    type Piece = { slot: string, main: string, set: string }
    const pieces: Piece[] = ['a', 'b', 'c', 'd', 'e'].map((slot) => ({ slot, main: 'x', set: 'own' }))
    const ops = {
      slotOf: (p: Piece) => p.slot,
      withMain: (p: Piece, stat: string) => (stat === 'bad' ? undefined : { ...p, main: stat }),
      withSet: (p: Piece, set: string) => ({ ...p, set }),
      setPattern: (option: string[]) => (option.length === 1 ? [4] : [2, 2]),
    }
    expect(benchmarkVariants(pieces, undefined, ops)).toEqual([])
    const variants = benchmarkVariants(
      pieces,
      { teammates: [], rotation: {}, sets: [['A'], ['B', 'C']], parts: { c: ['m1', 'bad'], d: ['m2'] }, substats: [] },
      ops,
    )
    expect(variants).toHaveLength(4)
    expect(variants[0].map((p) => `${p.set}:${p.main}`)).toEqual(['A:x', 'A:x', 'A:m1', 'A:m2', 'own:x'])
    // A main stat the slot can't have keeps the piece's own
    expect(variants[1].map((p) => `${p.set}:${p.main}`)).toEqual(['A:x', 'A:x', 'A:x', 'A:m2', 'own:x'])
    expect(variants[2].map((p) => p.set)).toEqual(['B', 'B', 'C', 'C', 'own'])
  })
})
