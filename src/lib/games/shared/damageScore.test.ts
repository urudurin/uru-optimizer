import {
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
