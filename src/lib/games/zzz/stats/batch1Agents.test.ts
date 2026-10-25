import { parseZzzBuildsExport } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  computeStats,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import exportFixture from 'lib/games/zzz/stats/fixtures/batch1Builds.json'
import { resolveBuild } from 'lib/games/zzz/stats/resolveBuild'
import {
  describe,
  expect,
  it,
} from 'vitest'

// Three real builds from a user export. The export's calculatedStats include every conditional effect at full stacks
// and double count percent bonuses, so only CRIT, Anomaly, Impact, PEN and Energy Regen are compared against it
const parsed = parseZzzBuildsExport(exportFixture)

function statsFor(agentId: string, conditions = { onField: true, inEtherVeil: true, veilTriggered: true }) {
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

  it('Miyabi matches the export except for the unmodeled Branch & Blade Song 4-piece', () => {
    const { stats, exported, result } = statsFor('1091')

    // HP has no percent bonuses on this build, so the export's double counting doesn't affect it
    expect(stats.hp).toBe(exported.hp)
    expect(stats.impact).toBe(exported.impact)
    expect(stats.anomalyMastery).toBe(exported.anomalyMastery)
    expect(stats.anomalyProficiency).toBe(exported.anomalyProficiency)
    expect(stats.penRatio).toBe(exported.penRatio)
    expect(stats.energyRegen).toBe(exported.energyRegen)
    // The 4-piece gives CRIT Rate +12 (Freeze or Shatter) and CRIT DMG +30 (Anomaly Mastery 115 or more)
    expect(stats.critRate).toBe(exported.critRate - 12)
    expect(stats.critDmg).toBe(roundTo1(exported.critDmg - 30))
    expect(result.warnings).toEqual(['Branch & Blade Song 4-piece effects aren\'t modeled yet'])
  })

  // Predictions for the in-game stat screen, to be checked against screenshots before tagging anything 'confirmed'
  it('predicts the stat screen values', () => {
    const anby = statsFor('1381', statScreenConditions()).stats
    expect([anby.hp, anby.atk, anby.def, anby.critRate, anby.critDmg]).toEqual([11254, 3167, 973, 70.6, 171.2])

    const yixuan = statsFor('1371', statScreenConditions()).stats
    expect([yixuan.hp, yixuan.atk, yixuan.critRate, yixuan.critDmg, yixuan.sheerForce]).toEqual([19560, 2076, 93, 102.8, 2579])

    const miyabi = statsFor('1091', statScreenConditions()).stats
    expect([miyabi.hp, miyabi.atk, miyabi.critRate, miyabi.critDmg]).toEqual([10433, 3010, 85, 173.6])
  })
})

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10
}
