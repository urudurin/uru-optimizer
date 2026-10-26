import {
  optimizeArtifacts,
  type OptimizerFilters,
  type OptimizerTarget,
  scoreStats,
} from 'lib/games/genshin/optimizer/artifactOptimizer'
import { computeGenshinStats } from 'lib/games/genshin/stats/computeStats'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  type ArtifactSlot,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const raiden: GenshinCharacter = {
  id: 'RaidenShogun',
  name: 'Raiden Shogun',
  level: 90,
  ascension: 6,
  constellation: 0,
  weapon: { id: 'EngulfingLightning', name: 'Engulfing Lightning', rarity: 5, level: 90, ascension: 6, refinement: 1 },
  artifactIds: {},
  stats: {},
  statsDate: '2026-10-26',
}

const MAINS: Record<ArtifactSlot, GenshinStatKey[]> = {
  flower: ['hp'],
  plume: ['atk'],
  sands: ['atkPct', 'energyRecharge', 'elementalMastery'],
  goblet: ['electroDmg', 'atkPct', 'hpPct'],
  circlet: ['critRate', 'critDmg', 'atkPct'],
}
const MAIN_VALUES: Partial<Record<GenshinStatKey, number>> = {
  hp: 4780,
  atk: 311,
  atkPct: 46.6,
  hpPct: 46.6,
  energyRecharge: 51.8,
  elementalMastery: 187,
  electroDmg: 46.6,
  critRate: 31.1,
  critDmg: 62.2,
}
const SUBS: GenshinStatKey[] = ['critRate', 'critDmg', 'atkPct', 'energyRecharge', 'atk', 'elementalMastery', 'hpPct', 'def']
const SETS = ['EmblemOfSeveredFate', 'GladiatorsFinale', 'NoblesseOblige', 'ThunderingFury']

// A small made-up inventory, the same every run
function inventory(perSlot: number): Artifact[] {
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]
  return ARTIFACT_SLOTS.flatMap((slot) =>
    Array.from({ length: perSlot }, (_, i) => {
      const main = pick(MAINS[slot])
      const subs = SUBS.filter((s) => s !== main).sort(() => random() - 0.5).slice(0, 4)
      return {
        id: `${slot}-${i}`,
        slot,
        setId: pick(SETS),
        setName: 'set',
        rarity: 5,
        level: 20,
        main: { stat: main, value: MAIN_VALUES[main]! },
        substats: subs.map((stat) => ({ stat, value: Math.round(random() * 150) / 10, rolls: 1 })),
      }
    })
  )
}

// Every combination, scored the slow way
function bruteForce(artifacts: Artifact[], target: OptimizerTarget, minStats: Partial<Record<GenshinStatKey, number>>, filters: OptimizerFilters) {
  const pools = ARTIFACT_SLOTS.map((slot) => artifacts.filter((a) => a.slot === slot))
  const scores: number[] = []
  const walk = (depth: number, chosen: Artifact[]) => {
    if (depth === 5) {
      const count = (id: string) => chosen.filter((a) => a.setId === id).length
      if (filters.fourPieceSet && count(filters.fourPieceSet) < 4) return
      if (filters.twoPieceSets.some((id) => count(id) < 2)) return
      const { stats } = computeGenshinStats(raiden, chosen)
      if (Object.entries(minStats).some(([stat, min]) => (stats[stat as GenshinStatKey] ?? 0) < min)) return
      scores.push(scoreStats(stats, target))
      return
    }
    for (const artifact of pools[depth]) walk(depth + 1, [...chosen, artifact])
  }
  walk(0, [])
  return scores.sort((a, b) => b - a)
}

const noFilters: OptimizerFilters = { mainStats: {}, twoPieceSets: [], excludeEquippedByOthers: false }

describe('optimizeArtifacts', () => {
  const artifacts = inventory(7)
  const cases: [string, OptimizerTarget, Partial<Record<GenshinStatKey, number>>, OptimizerFilters][] = [
    ['ATK', { kind: 'stat', stat: 'atk' }, {}, noFilters],
    ['Crit Value with 4-piece Emblem', { kind: 'critValue' }, {}, { ...noFilters, fourPieceSet: 'EmblemOfSeveredFate' }],
    ['average ATK hit with 250% ER', { kind: 'averageHit', stat: 'atk' }, { energyRecharge: 250 }, noFilters],
    ['Electro DMG with 2+2', { kind: 'stat', stat: 'electroDmg' }, {}, { ...noFilters, twoPieceSets: ['GladiatorsFinale', 'ThunderingFury'] }],
  ]

  for (const [name, target, minStats, filters] of cases) {
    it(`finds the same top 5 as trying every combination: ${name}`, () => {
      const outcome = optimizeArtifacts({ character: raiden, artifacts, filters, minStats, target, limit: 5 })
      if (!outcome.ok) throw new Error(outcome.reason)
      const expected = bruteForce(artifacts, target, minStats, filters).slice(0, 5)

      expect(outcome.truncated).toBe(false)
      expect(outcome.builds.map((b) => b.score)).toEqual(expected.map((score) => expect.closeTo(score, 6)))
      expect(outcome.visited).toBeLessThan(7 ** 5)
    })
  }

  it('respects main stat filters and leaves out artifacts others wear', () => {
    const worn = artifacts.map((a) => (a.slot === 'circlet' ? { ...a, equippedBy: 'Bennett' } : a))
    const filters: OptimizerFilters = { mainStats: { sands: ['energyRecharge'] }, twoPieceSets: [], excludeEquippedByOthers: true }
    const blocked = optimizeArtifacts({ character: raiden, artifacts: worn, filters, minStats: {}, target: { kind: 'critValue' }, limit: 3 })
    expect(blocked).toEqual({ ok: false, reason: 'No circlet left with these filters' })

    const outcome = optimizeArtifacts({ character: raiden, artifacts, filters, minStats: {}, target: { kind: 'critValue' }, limit: 3 })
    if (!outcome.ok) throw new Error(outcome.reason)
    expect(outcome.builds.every((b) => b.artifacts[2].main.stat === 'energyRecharge')).toBe(true)
  })

  it('explains impossible set choices', () => {
    const request = { character: raiden, artifacts, minStats: {}, target: { kind: 'critValue' } as const, limit: 3 }
    const four = optimizeArtifacts({ ...request, filters: { ...noFilters, fourPieceSet: 'NoblesseOblige', twoPieceSets: ['GladiatorsFinale'] } })
    expect(four).toMatchObject({ ok: false })
  })
})
