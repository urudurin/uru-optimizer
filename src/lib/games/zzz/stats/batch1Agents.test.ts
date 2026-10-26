import { YIXUAN } from 'lib/games/zzz/data/agents'
import { QINGMING_BIRDCAGE } from 'lib/games/zzz/data/wEngines'
import { parseZzzBuildsExport } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  computeStats,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import exportFixture from 'lib/games/zzz/stats/fixtures/batch1Builds.json'
import { resolveBuild } from 'lib/games/zzz/stats/resolveBuild'
import type {
  Disc,
  DiscSlot,
} from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// Three real builds from a user export. The export's calculatedStats include every conditional effect at full stacks
// and double count percent bonuses, so only CRIT, Anomaly, Impact, PEN and Energy Regen are compared against it
const parsed = parseZzzBuildsExport(exportFixture)

function statsFor(agentId: string, conditions = { onField: true, inEtherVeil: true, veilTriggered: true, freezeOrShatter: true }) {
  const build = parsed.builds.find((b) => b.agentId === agentId)
  if (!build) throw new Error(`No build for ${agentId} in the fixture`)
  const resolved = resolveBuild(build, parsed.discs)
  if (!resolved.ok) throw new Error(resolved.reason)
  const result = computeStats({ ...resolved.build, coreSkillLevel: 6, conditions })
  return { result, stats: toDisplayStats(result.stats), exported: exportFixture.builds.find((b) => b.agentId === agentId)!.calculatedStats }
}

describe('batch 1 agents against a user export', () => {
  it('parses the fixture without warnings', () => {
    expect(parsed.warnings).toEqual([])
    expect(parsed.builds).toHaveLength(3)
  })

  it('Soldier 0 - Anby matches every export value that is not double counted', () => {
    const { stats, exported, result } = statsFor('1381')

    expect(stats.critRate).toBe(exported.critRate)
    expect(stats.critDmg).toBe(exported.critDmg)
    expect(stats.impact).toBe(exported.impact)
    expect(stats.anomalyMastery).toBe(exported.anomalyMastery)
    expect(stats.anomalyProficiency).toBe(exported.anomalyProficiency)
    expect(stats.pen).toBe(exported.pen)
    expect(stats.energyRegen).toBe(exported.energyRegen)
    expect(result.warnings).toEqual([])
  })

  it('Yixuan matches every export value that is not double counted', () => {
    const { stats, exported } = statsFor('1371')

    expect(stats.critRate).toBe(exported.critRate)
    expect(stats.critDmg).toBe(exported.critDmg)
    expect(stats.impact).toBe(exported.impact)
    expect(stats.anomalyMastery).toBe(exported.anomalyMastery)
    expect(stats.anomalyProficiency).toBe(exported.anomalyProficiency)
    expect(stats.pen).toBe(exported.pen)
    expect(stats.energyRegen).toBe(exported.energyRegen)
  })

  it('Miyabi matches the export, Branch & Blade Song 4-piece included', () => {
    const { stats, exported, result } = statsFor('1091')

    // HP has no percent bonuses on this build, so the export's double counting doesn't affect it
    expect(stats.hp).toBe(exported.hp)
    expect(stats.impact).toBe(exported.impact)
    expect(stats.anomalyMastery).toBe(exported.anomalyMastery)
    expect(stats.anomalyProficiency).toBe(exported.anomalyProficiency)
    expect(stats.penRatio).toBe(exported.penRatio)
    expect(stats.energyRegen).toBe(exported.energyRegen)
    // The 4-piece gives CRIT Rate +12 (Freeze or Shatter) and CRIT DMG +30 (her Anomaly Mastery is 116, at least 115)
    expect(stats.critRate).toBe(exported.critRate)
    expect(stats.critDmg).toBe(roundTo1(exported.critDmg))
    expect(result.warnings).toEqual([])
  })

  // Yixuan's discs changed after this export (slots 2 and 3), so her current discs were read from in-game screenshots
  it('Yixuan matches every value on the in-game stat screen (screenshot)', () => {
    const yunkui = { setId: 'yunkui-tales', setName: 'Yunkui Tales' }
    const woodpecker = { setId: 'woodpecker-electro', setName: 'Woodpecker Electro' }
    const disc = (slot: DiscSlot, set: typeof yunkui, main: Disc['main'], substats: Disc['substats']): Disc => ({
      id: `yixuan-${slot}`,
      slot,
      ...set,
      rarity: 'S',
      level: 15,
      main,
      substats,
      locked: true,
    })
    const discs = [
      disc(1, yunkui, { stat: 'HP', value: 2200 }, [
        { stat: 'CRIT Rate', rolls: 1 },
        { stat: 'CRIT DMG', rolls: 3 },
        { stat: 'HP%', rolls: 3 },
        { stat: 'PEN', rolls: 2 },
      ]),
      disc(2, woodpecker, { stat: 'ATK', value: 316 }, [
        { stat: 'ATK%', rolls: 1 },
        { stat: 'CRIT DMG', rolls: 2 },
        { stat: 'CRIT Rate', rolls: 2 },
        { stat: 'HP%', rolls: 3 },
      ]),
      disc(3, yunkui, { stat: 'DEF', value: 184 }, [
        { stat: 'ATK%', rolls: 1 },
        { stat: 'CRIT DMG', rolls: 2 },
        { stat: 'HP%', rolls: 4 },
        { stat: 'DEF%', rolls: 1 },
      ]),
      disc(4, yunkui, { stat: 'CRIT Rate', value: 24 }, [
        { stat: 'HP%', rolls: 4 },
        { stat: 'DEF', rolls: 1 },
        { stat: 'CRIT DMG', rolls: 2 },
        { stat: 'ATK%', rolls: 1 },
      ]),
      disc(5, woodpecker, { stat: 'Element DMG%', value: 30 }, [
        { stat: 'CRIT DMG', rolls: 2 },
        { stat: 'HP%', rolls: 2 },
        { stat: 'Anomaly Proficiency', rolls: 3 },
        { stat: 'CRIT Rate', rolls: 2 },
      ]),
      disc(6, yunkui, { stat: 'HP%', value: 30 }, [
        { stat: 'CRIT Rate', rolls: 3 },
        { stat: 'ATK%', rolls: 2 },
        { stat: 'PEN', rolls: 1 },
        { stat: 'Anomaly Proficiency', rolls: 2 },
      ]),
    ]

    const result = computeStats({
      agent: YIXUAN,
      wEngine: QINGMING_BIRDCAGE,
      wEngineRefinement: 1,
      coreSkillLevel: 6,
      discs,
      conditions: statScreenConditions(),
    })

    expect(toDisplayStats(result.stats)).toEqual({
      hp: 20454,
      atk: 2173,
      def: 661,
      impact: 93,
      anomalyMastery: 92,
      anomalyProficiency: 135,
      // No Qingming Birdcage passive and no Yunkui Tales stacks
      critRate: 70.6,
      critDmg: 102.8,
      penRatio: 0,
      pen: 27,
      energyRegen: 1.2,
      elementDmg: 30,
      sheerForce: 2696,
    })
    expect(result.warnings).toEqual([])
  })

  it('Miyabi matches every value on the in-game stat screen (screenshot)', () => {
    const { stats } = statsFor('1091', statScreenConditions())

    expect(stats).toEqual({
      hp: 10433,
      atk: 3010,
      def: 880,
      impact: 86,
      anomalyMastery: 116,
      anomalyProficiency: 274,
      critRate: 85,
      // No Hailstorm Shrine passive: W-Engine passives don't show on the stat screen
      critDmg: 123.6,
      penRatio: 24,
      pen: 0,
      energyRegen: 1.2,
      elementDmg: 0,
      sheerForce: 0,
    })
  })

  it('Soldier 0 - Anby matches every value on the in-game stat screen (screenshot)', () => {
    const { stats } = statsFor('1381', statScreenConditions())

    expect(stats).toEqual({
      hp: 11255,
      atk: 3166,
      def: 972,
      impact: 93,
      anomalyMastery: 94,
      anomalyProficiency: 93,
      critRate: 70.6,
      // No Severed Innocence passive, no Voltage Surge and no Shadow Harmony stacks
      critDmg: 141.2,
      penRatio: 0,
      // PEN isn't on the screen, 18 is from her discs
      pen: 18,
      energyRegen: 1.2,
      elementDmg: 30,
      sheerForce: 0,
    })
  })
})

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10
}
