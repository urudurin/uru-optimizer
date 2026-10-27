import {
  DEFAULT_ENEMY,
  NO_DEBUFFS,
  rotationDamage,
} from 'lib/games/zzz/damage/damage'
import {
  MIYABI,
  SOLDIER_0_ANBY,
} from 'lib/games/zzz/data/agents'
import {
  HAILSTORM_SHRINE,
  SEVERED_INNOCENCE,
} from 'lib/games/zzz/data/wEngines'
import { parseZzzBuildsExport } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  countCombinations,
  filterPools,
  MAX_COMBINATIONS,
  optimizeDiscs,
  type OptimizerRequest,
} from 'lib/games/zzz/optimizer/discOptimizer'
import {
  computeStats,
  type FinalStats,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import exportFixture from 'lib/games/zzz/stats/fixtures/batch1Builds.json'
import {
  type Disc,
  ZzzStats,
} from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// 18 real discs from three builds, 3 per slot, so every one of the 729 combinations can be checked by brute force
const { discs } = parseZzzBuildsExport(exportFixture)

function makeRequest(overrides: Partial<OptimizerRequest> = {}): OptimizerRequest {
  return {
    agent: SOLDIER_0_ANBY,
    wEngine: SEVERED_INNOCENCE,
    wEngineRefinement: 1,
    coreSkillLevel: 6,
    conditions: statScreenConditions(),
    discs,
    filters: { mainStats: {}, excludeEquippedByOthers: false },
    minStats: {},
    sortBy: 'critDmg',
    limit: 10,
    ...overrides,
  }
}

function allCombinations(pools: Disc[][]): Disc[][] {
  return pools.reduce<Disc[][]>((combos, pool) => combos.flatMap((combo) => pool.map((disc) => [...combo, disc])), [[]])
}

// Display values of every combination, computed the slow way through computeStats
function bruteForce(request: OptimizerRequest, keep: (discs: Disc[], stats: FinalStats) => boolean = () => true) {
  return allCombinations(filterPools(request))
    .map((combo) => {
      const result = computeStats({ ...request, discs: combo })
      return { combo, stats: result.stats, display: toDisplayStats(result.stats) }
    })
    .filter(({ combo, stats }) => keep(combo, stats))
    .sort((a, b) => b.stats[request.sortBy as keyof FinalStats] - a.stats[request.sortBy as keyof FinalStats])
}

function setCount(combo: Disc[], setId: string): number {
  return combo.filter((disc) => disc.setId === setId).length
}

describe('optimizeDiscs', () => {
  it('uses 3 discs per slot from the fixture', () => {
    expect(countCombinations(filterPools(makeRequest()))).toBe(729)
  })

  it('finds the same best values as checking every combination', () => {
    for (const sortBy of ['critDmg', 'critRate', 'atk', 'hp', 'anomalyProficiency'] as const) {
      const request = makeRequest({ sortBy })
      const outcome = optimizeDiscs(request)
      expect(outcome.ok).toBe(true)
      if (!outcome.ok) return

      const expected = bruteForce(request).slice(0, 10).map((r) => r.display[sortBy])
      expect(outcome.builds.map((b) => b.display[sortBy])).toEqual(expected)
      expect(outcome.matched).toBe(729)
    }
  })

  it('matches every combination with all 4-pieces on, Branch & Blade Song\'s Anomaly Mastery threshold included', () => {
    const inCombat = { onField: true, inEtherVeil: true, veilTriggered: true, freezeOrShatter: true }
    for (const sortBy of ['critDmg', 'critRate', 'atk'] as const) {
      const request = makeRequest({ agent: MIYABI, wEngine: HAILSTORM_SHRINE, conditions: inCombat, sortBy })
      const outcome = optimizeDiscs(request)
      if (!outcome.ok) throw new Error(outcome.reason)

      const expected = bruteForce(request).slice(0, 10).map((r) => r.display[sortBy])
      expect(outcome.builds.map((b) => b.display[sortBy])).toEqual(expected)
    }
  })

  it('breaks ties with the thenBy stats in order', () => {
    const keys = ['critDmg', 'critRate', 'atk'] as const
    const request = makeRequest({ sortBy: 'critDmg', thenBy: ['critRate', 'atk'] })
    const outcome = optimizeDiscs(request)
    if (!outcome.ok) throw new Error(outcome.reason)

    const expected = bruteForce(request)
      .sort((a, b) => {
        for (const key of keys) if (a.stats[key] !== b.stats[key]) return b.stats[key] - a.stats[key]
        return 0
      })
      .slice(0, 10)
      .map((r) => keys.map((key) => r.display[key]))
    expect(outcome.builds.map((b) => keys.map((key) => b.display[key]))).toEqual(expected)
  })

  it('ranks by rotation damage like computing it for every build', () => {
    // Standard hits plus an anomaly, so Anomaly Proficiency counts too, and kit bonuses to some hits
    const damage = {
      multiplier: 1000,
      anomalyMultiplier: 1200,
      bonusMultiplier: 300,
      agentLevel: 60,
      enemy: { ...DEFAULT_ENEMY, def: 900 },
      debuffs: { ...NO_DEBUFFS, defShred: 30 },
    }
    const request = makeRequest({ sortBy: 'damage', damage })
    const outcome = optimizeDiscs(request)
    if (!outcome.ok) throw new Error(outcome.reason)

    const expected = bruteForce(request).map((r) => rotationDamage(r.stats, damage)).sort((a, b) => b - a).slice(0, 10)
    expect(outcome.builds.map((b) => b.damage)).toEqual(expected.map((value) => expect.closeTo(value, 6)))
  })

  it('counts team buffs in the ranking and in the results shown', () => {
    const alone = optimizeDiscs(makeRequest({ sortBy: 'critDmg' }))
    const buffed = optimizeDiscs(
      makeRequest({ sortBy: 'critDmg', teamEffects: [{ stat: ZzzStats.CRIT_DMG, value: 25, source: 'Astra Yao', confidence: 'sourced' }] }),
    )
    if (!alone.ok || !buffed.ok) throw new Error('search failed')
    expect(buffed.builds.map((b) => b.display.critDmg)).toEqual(alone.builds.map((b) => b.display.critDmg + 25))
  })

  it('leaves out builds over a maximum stat', () => {
    const free = optimizeDiscs(makeRequest({ sortBy: 'critDmg' }))
    if (!free.ok) throw new Error(free.reason)
    const cap = free.builds[0].display.critRate - 0.1
    const request = makeRequest({ sortBy: 'critDmg', maxStats: { critRate: cap } })
    const outcome = optimizeDiscs(request)
    if (!outcome.ok) throw new Error(outcome.reason)

    const expected = bruteForce(request).filter((r) => r.stats.critRate <= cap).slice(0, 10).map((r) => r.display.critDmg)
    expect(outcome.builds.map((b) => b.display.critDmg)).toEqual(expected)
    expect(outcome.builds.every((b) => b.display.critRate <= cap)).toBe(true)
  })

  it('returns builds in slot order with stats identical to the calculator', () => {
    const request = makeRequest({ conditions: { onField: true, inEtherVeil: false, veilTriggered: false, freezeOrShatter: false } })
    const outcome = optimizeDiscs(request)
    if (!outcome.ok) throw new Error(outcome.reason)

    for (const build of outcome.builds) {
      expect(build.discs.map((d) => d.slot)).toEqual([1, 2, 3, 4, 5, 6])
      expect(build.display).toEqual(toDisplayStats(computeStats({ ...request, discs: build.discs }).stats))
    }
  })

  it('applies set bonuses the same way as the calculator, including conditional 4-pieces', () => {
    const request = makeRequest({ sortBy: 'critRate', conditions: { onField: true, inEtherVeil: true, veilTriggered: true, freezeOrShatter: false } })
    const outcome = optimizeDiscs(request)
    if (!outcome.ok) throw new Error(outcome.reason)

    // Anby's own build (Shadow Harmony 4pc + Woodpecker 2pc) is among the combinations
    expect(outcome.builds[0].display.critRate).toBe(bruteForce(request)[0].display.critRate)
  })

  it('only keeps builds with the required 4-piece and 2-piece sets', () => {
    const filters = { mainStats: {}, excludeEquippedByOthers: false, fourPieceSet: 'shadow-harmony', twoPieceSet: 'woodpecker-electro' }
    const request = makeRequest({ filters })
    const outcome = optimizeDiscs(request)
    if (!outcome.ok) throw new Error(outcome.reason)

    const expected = bruteForce(request, (combo) => setCount(combo, 'shadow-harmony') >= 4 && setCount(combo, 'woodpecker-electro') >= 2)
    expect(outcome.matched).toBe(expected.length)
    expect(outcome.builds.length).toBeGreaterThan(0)
    for (const build of outcome.builds) {
      expect(setCount(build.discs, 'shadow-harmony')).toBeGreaterThanOrEqual(4)
      expect(setCount(build.discs, 'woodpecker-electro')).toBeGreaterThanOrEqual(2)
    }
    expect(outcome.builds[0].display.critDmg).toBe(expected[0].display.critDmg)
  })

  it('returns nothing when a required set has no discs', () => {
    const outcome = optimizeDiscs(makeRequest({ filters: { mainStats: {}, excludeEquippedByOthers: false, fourPieceSet: 'swing-jazz' } }))
    expect(outcome).toEqual({ ok: true, builds: [], combinations: 729, matched: 0 })
  })

  it('filters main stats for slots 4 to 6', () => {
    const outcome = optimizeDiscs(makeRequest({ filters: { mainStats: { 4: ['CRIT Rate'], 6: ['ATK%'] }, excludeEquippedByOthers: false } }))
    if (!outcome.ok) throw new Error(outcome.reason)

    for (const build of outcome.builds) {
      expect(build.discs[3].main.stat).toBe('CRIT Rate')
      expect(build.discs[5].main.stat).toBe('ATK%')
    }
  })

  it('drops builds below the minimum stats', () => {
    const request = makeRequest({ sortBy: 'atk', minStats: { critRate: 60 } })
    const outcome = optimizeDiscs(request)
    if (!outcome.ok) throw new Error(outcome.reason)

    const expected = bruteForce(request, (_, stats) => stats.critRate >= 60)
    expect(outcome.matched).toBe(expected.length)
    expect(outcome.builds.every((b) => b.display.critRate >= 60)).toBe(true)
    expect(outcome.builds[0].display.atk).toBe(expected[0].display.atk)
  })

  it('can leave out discs other agents are wearing', () => {
    // Anby's discs in the fixture have no owner, Miyabi's and Yixuan's do
    const request = makeRequest({ agent: MIYABI, wEngine: HAILSTORM_SHRINE, filters: { mainStats: {}, excludeEquippedByOthers: true } })
    const pools = filterPools(request)

    expect(pools.flat().every((disc) => !disc.equippedBy || disc.equippedBy === MIYABI.id)).toBe(true)
    expect(pools.flat().some((disc) => disc.equippedBy === MIYABI.id)).toBe(true)
  })

  it('explains empty slots and searches that are too large', () => {
    expect(optimizeDiscs(makeRequest({ filters: { mainStats: { 5: ['Energy Regen'] }, excludeEquippedByOthers: false } }))).toEqual({
      ok: false,
      reason: 'No discs left for slot 5 with these filters',
    })

    const many = Array.from({ length: 6 * 30 }, (_, i) => ({ ...discs[0], id: `x${i}`, slot: ((i % 6) + 1) as Disc['slot'] }))
    expect(30 ** 6).toBeGreaterThan(MAX_COMBINATIONS)
    const outcome = optimizeDiscs(makeRequest({ discs: many }))
    expect(outcome.ok).toBe(false)
  })
})
