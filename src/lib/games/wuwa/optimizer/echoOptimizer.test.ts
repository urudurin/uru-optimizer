import { SUBSTAT_TIERS } from 'lib/games/wuwa/echoStats'
import {
  costPatterns,
  type EchoFilters,
  type EchoTarget,
  optimizeEchoes,
  scoreStats,
} from 'lib/games/wuwa/optimizer/echoOptimizer'
import {
  computeWuwaStats,
  type WuwaStats,
} from 'lib/games/wuwa/stats/computeStats'
import type {
  CharacterState,
  Cost,
  Echo,
  StatKey,
  SubstatKey,
} from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const hsin: CharacterState = {
  charId: 'hsin',
  level: 90,
  sequence: 0,
  weaponId: 'blooming-jadehaven',
  weaponLevel: 90,
  refinement: 1,
  minorFortes: true,
  echoIds: ['echo-0', 'echo-1'],
}

const MAINS: Record<Cost, StatKey[]> = {
  4: ['critRate', 'critDmg', 'atkPct'],
  3: ['electroDmg', 'atkPct', 'energyRegen'],
  1: ['atkPct', 'hpPct'],
}
const SUBS: SubstatKey[] = ['critRate', 'critDmg', 'atkPct', 'energyRegen', 'atkFlat', 'skillDmg', 'hpPct', 'defFlat']
const SETS = ['heart-of-sworn-vigil', 'void-thunder', 'lingering-tunes', 'moonlit-clouds']
const DEFS = ['a', 'b', 'c']

// A small made-up inventory, the same every run
function inventory(counts: Record<Cost, number>): Echo[] {
  let seed = 11
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]
  let n = 0
  return ([4, 3, 1] as Cost[]).flatMap((cost) =>
    Array.from({ length: counts[cost] }, () => ({
      id: `echo-${n++}`,
      defId: `${cost}-${pick(DEFS)}`,
      cost,
      setId: pick(SETS),
      mainStat: pick(MAINS[cost]),
      level: 25,
      substats: SUBS.filter(() => random() < 0.6).slice(0, 5).map((stat) => ({ stat, value: pick(SUBSTAT_TIERS[stat]) })),
    }))
  )
}

// Every loadout with no room for another echo, scored the slow way
function bruteForce(echoes: Echo[], target: EchoTarget, minStats: Partial<Record<keyof WuwaStats, number>>, filters: EchoFilters): number[] {
  const scores: number[] = []
  const walk = (start: number, chosen: Echo[], cost: number) => {
    const roomLeft = chosen.length < 5 && echoes.some((e) => !chosen.includes(e) && cost + e.cost <= 12)
    if (!roomLeft && chosen.length > 0) {
      const distinct = (setId: string) => new Set(chosen.filter((e) => e.setId === setId).map((e) => e.defId)).size
      if (filters.fullSet && distinct(filters.fullSet) < 5) return
      if (filters.twoPieceSets.some((id) => distinct(id) < 2)) return
      const { stats } = computeWuwaStats(hsin, chosen)
      if (Object.entries(minStats).some(([stat, min]) => stats[stat as keyof WuwaStats] < min)) return
      scores.push(scoreStats(stats, target))
    }
    for (let i = start; i < echoes.length; i++) {
      if (chosen.length < 5 && cost + echoes[i].cost <= 12) walk(i + 1, [...chosen, echoes[i]], cost + echoes[i].cost)
    }
  }
  walk(0, [], 0)
  return scores.sort((a, b) => b - a)
}

const noFilters: EchoFilters = { mainStats: {}, twoPieceSets: [], excludeEquippedByOthers: false }

describe('optimizeEchoes', () => {
  const echoes = inventory({ 4: 5, 3: 7, 1: 8 })
  const cases: [string, EchoTarget, Partial<Record<keyof WuwaStats, number>>, EchoFilters][] = [
    ['ATK', { kind: 'stat', stat: 'atk' }, {}, noFilters],
    ['Crit Value', { kind: 'critValue' }, {}, noFilters],
    ['average ATK hit with skill DMG and 120% Energy Regen', { kind: 'averageHit', stat: 'atk', bonus: 'skillDmg' }, { energyRegen: 120 }, noFilters],
    ['Element DMG with 2+2 sets', { kind: 'stat', stat: 'elementDmg' }, {}, { ...noFilters, twoPieceSets: ['void-thunder', 'lingering-tunes'] }],
  ]

  for (const [name, target, minStats, filters] of cases) {
    it(`finds the same top 5 as trying every loadout: ${name}`, () => {
      const outcome = optimizeEchoes({ character: hsin, characters: [hsin], echoes, filters, minStats, target, limit: 5 })
      if (!outcome.ok) throw new Error(outcome.reason)
      const expected = bruteForce(echoes, target, minStats, filters).slice(0, 5)

      expect(outcome.truncated).toBe(false)
      expect(outcome.builds.map((b) => b.score)).toEqual(expected.map((score) => expect.closeTo(score, 6)))
      expect(outcome.builds.every((b) => b.echoes.reduce((sum, e) => sum + e.cost, 0) <= 12 && b.echoes.length <= 5)).toBe(true)
    })
  }

  it('lists cost patterns with no room for another echo', () => {
    const patterns = costPatterns([9, 9, 9]).map((p) => p.join(''))
    expect(patterns).toEqual(expect.arrayContaining(['122', '211', '300', '040', '014', '005']))
    expect(patterns).not.toContain('120')
    // Without 1-cost echoes, 4-3-3 has no room left
    expect(costPatterns([9, 9, 0]).map((p) => p.join(''))).toContain('120')
  })

  it('compares with the current echoes and leaves out ones others wear', () => {
    const other: CharacterState = { ...hsin, charId: 'someone', echoIds: echoes.filter((e) => e.cost === 1).map((e) => e.id) }
    const request = { character: hsin, characters: [hsin, other], echoes, minStats: {}, target: { kind: 'critValue' } as const, limit: 3 }
    const outcome = optimizeEchoes({ ...request, filters: { ...noFilters, excludeEquippedByOthers: true } })
    if (!outcome.ok) throw new Error(outcome.reason)

    expect(outcome.current?.echoes.map((e) => e.id)).toEqual(['echo-0', 'echo-1'])
    expect(outcome.builds.every((b) => b.echoes.every((e) => e.cost !== 1))).toBe(true)
  })

  it('explains sets that cannot fit', () => {
    const outcome = optimizeEchoes({
      character: hsin,
      characters: [hsin],
      echoes,
      filters: { ...noFilters, fullSet: 'void-thunder', twoPieceSets: ['lingering-tunes'] },
      minStats: {},
      target: { kind: 'critValue' },
      limit: 3,
    })
    expect(outcome).toEqual({ ok: false, reason: 'Those sets need 7 echoes, a loadout holds 5' })
  })
})
