import { YE_SHUNGUANG } from 'lib/games/zzz/data/agents'
import { CLOUDCLEAVE_RADIANCE } from 'lib/games/zzz/data/wEngines'
import {
  type ComputeInput,
  computeStats,
  defaultConditions,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import type {
  Disc,
  DiscSlot,
  DiscSubstat,
} from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

function disc(
  slot: DiscSlot,
  setId: string,
  setName: string,
  main: Disc['main'],
  substats: DiscSubstat[],
): Disc {
  return { id: `d${slot}`, slot, setId, setName, rarity: 'S', level: 15, main, substats, locked: false }
}

const WWB = ['white-water-ballad', 'White Water Ballad'] as const
const BBS = ['branch-blade-song', 'Branch & Blade Song'] as const

// The six discs of a real Ye Shunguang build, her max HP of 10564 on the in-game screen was read from this build
const YE_DISCS: Disc[] = [
  disc(1, ...WWB, { stat: 'HP', value: 2200 }, [
    { stat: 'CRIT Rate', rolls: 1 },
    { stat: 'HP%', rolls: 1 },
    { stat: 'ATK%', rolls: 3 },
    { stat: 'CRIT DMG', rolls: 4 },
  ]),
  disc(2, ...BBS, { stat: 'ATK', value: 316 }, [
    { stat: 'CRIT Rate', rolls: 2 },
    { stat: 'Anomaly Proficiency', rolls: 1 },
    { stat: 'CRIT DMG', rolls: 3 },
    { stat: 'ATK%', rolls: 2 },
  ]),
  disc(3, ...BBS, { stat: 'DEF', value: 184 }, [
    { stat: 'ATK%', rolls: 3 },
    { stat: 'CRIT DMG', rolls: 2 },
    { stat: 'CRIT Rate', rolls: 2 },
    { stat: 'HP%', rolls: 2 },
  ]),
  disc(4, ...WWB, { stat: 'ATK%', value: 30 }, [
    { stat: 'CRIT Rate', rolls: 1 },
    { stat: 'CRIT DMG', rolls: 3 },
    { stat: 'DEF', rolls: 3 },
    { stat: 'DEF%', rolls: 1 },
  ]),
  disc(5, ...WWB, { stat: 'ATK%', value: 30 }, [
    { stat: 'CRIT Rate', rolls: 2 },
    { stat: 'Anomaly Proficiency', rolls: 1 },
    { stat: 'CRIT DMG', rolls: 4 },
    { stat: 'ATK', rolls: 2 },
  ]),
  disc(6, ...WWB, { stat: 'ATK%', value: 30 }, [
    { stat: 'CRIT Rate', rolls: 3 },
    { stat: 'CRIT DMG', rolls: 2 },
    { stat: 'ATK', rolls: 1 },
    { stat: 'Anomaly Proficiency', rolls: 2 },
  ]),
]

function makeInput(overrides: Partial<ComputeInput> = {}): ComputeInput {
  return {
    agent: YE_SHUNGUANG,
    wEngine: CLOUDCLEAVE_RADIANCE,
    wEngineRefinement: 1,
    coreSkillLevel: 6,
    discs: YE_DISCS,
    conditions: { onField: true, inEtherVeil: true, veilTriggered: true },
    ...overrides,
  }
}

describe('computeStats for Ye Shunguang', () => {
  it('matches every value on the in-game stat screen (screenshot)', () => {
    const stats = toDisplayStats(computeStats(makeInput({ conditions: statScreenConditions() })).stats)

    expect(stats).toEqual({
      hp: 10564,
      atk: 3970,
      def: 864,
      impact: 83,
      anomalyMastery: 94,
      anomalyProficiency: 129,
      critRate: 45.8,
      critDmg: 200.4,
      penRatio: 0,
      pen: 0,
      energyRegen: 1.2,
      elementDmg: 10,
      sheerForce: 0,
    })
  })

  it('matches the max HP shown in game (10564)', () => {
    const result = computeStats(makeInput())

    expect(toDisplayStats(result.stats).hp).toBe(10564)
  })

  it('reproduces every value of the user export that is not double counted', () => {
    const result = computeStats(makeInput())
    const stats = toDisplayStats(result.stats)

    expect(stats.critRate).toBe(95.8)
    expect(stats.critDmg).toBe(225.4)
    expect(stats.anomalyProficiency).toBe(129)
    expect(stats.impact).toBe(83)
    expect(stats.anomalyMastery).toBe(94)
    expect(stats.energyRegen).toBe(1.2)
    expect(stats.pen).toBe(0)
    expect(stats.penRatio).toBe(0)
  })

  it('counts percent bonuses once for ATK and DEF', () => {
    const stats = toDisplayStats(computeStats(makeInput()).stats)

    // (938 + 743) x (1 + 114% discs + 10% set) + 373 flat. Not yet checked against the in-game screen
    expect(stats.atk).toBe(4138)
    expect(stats.def).toBe(864)
  })

  it('gives the Physical DMG bonus of the 2-piece to a Physical agent only', () => {
    expect(toDisplayStats(computeStats(makeInput()).stats).elementDmg).toBe(10)

    const fireAgent = { ...YE_SHUNGUANG, element: 'Fire' }
    expect(toDisplayStats(computeStats(makeInput({ agent: fireAgent })).stats).elementDmg).toBe(0)
  })

  it('drops conditional effects when their condition is off', () => {
    const noVeil = toDisplayStats(computeStats(makeInput({ conditions: defaultConditions() })).stats)

    // 19.4 base + 26.4 discs + 30 Unity, no 4-piece CRIT Rate
    expect(noVeil.critRate).toBe(75.8)
    // 50 base + 86.4 discs + 48 engine + 16 set, no W-Engine passive
    expect(noVeil.critDmg).toBe(200.4)
    // Only the 114% from discs, no 10% from the 4-piece
    expect(noVeil.atk).toBe(3970)

    const offField = toDisplayStats(
      computeStats(makeInput({
        conditions: { onField: false, inEtherVeil: true, veilTriggered: true },
      })).stats,
    )
    expect(offField.critRate).toBe(65.8)
  })

  it('skips Attack-only effects for other specialties', () => {
    const stunAgent = { ...YE_SHUNGUANG, specialty: 'Stun' as const }
    const stats = toDisplayStats(computeStats(makeInput({ agent: stunAgent })).stats)

    // Only the in-Veil 10 remains, the 10 for activating and the ATK 10% are Attack-only
    expect(stats.critRate).toBe(85.8)
    expect(stats.atk).toBe(3970)
  })

  it('uses the refinement of the W-Engine passive', () => {
    const r5 = toDisplayStats(computeStats(makeInput({ wEngineRefinement: 5 })).stats)

    expect(r5.critDmg).toBe(240.4)
  })

  it('scales Unity with the Core Skill level', () => {
    const coreA = toDisplayStats(computeStats(makeInput({ coreSkillLevel: 1 })).stats)

    expect(coreA.critRate).toBe(83.3)
  })

  it('reports where each point came from', () => {
    const result = computeStats(makeInput())
    const atkPercent = result.contributions.filter((c) => c.stat === 'ATK%')

    expect(atkPercent.reduce((sum, c) => sum + c.value, 0)).toBe(124)
    expect(result.contributions.some((c) => c.source === 'Core Skill: Unity' && c.value === 30)).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('warns instead of silently ignoring unknown sets and unmodeled 4-pieces', () => {
    const unknownPair = [
      disc(1, 'mystery-set', 'Mystery Set', { stat: 'HP', value: 2200 }, []),
      disc(2, 'mystery-set', 'Mystery Set', { stat: 'ATK', value: 316 }, []),
    ]
    const unknown = computeStats(makeInput({ discs: unknownPair }))
    expect(unknown.warnings).toEqual(['No set data for "Mystery Set", its bonuses are left out'])

    const fourBbs = [1, 2, 3, 4].map((slot) => disc(slot as DiscSlot, ...BBS, { stat: 'HP', value: 1 }, []))
    const four = computeStats(makeInput({ discs: fourBbs }))
    expect(four.warnings).toEqual(['Branch & Blade Song 4-piece effects aren\'t modeled yet'])
  })

  it('warns about substats it has no roll value for', () => {
    const aRank: Disc = { ...disc(1, ...WWB, { stat: 'HP', value: 1 }, [{ stat: 'ATK%', rolls: 1 }]), rarity: 'A' }
    const result = computeStats(makeInput({ discs: [aRank] }))

    expect(result.warnings).toEqual(['Disc 1: no roll value known for A-rank ATK%, substat left out'])
  })
})
