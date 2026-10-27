import {
  agentHits,
  anomalyHits,
  anomalyLevelMultiplier,
  anomalyMultiplier,
  DEFAULT_ENEMY,
  defaultRotation,
  hitMultiplier,
  levelFactor,
  NO_DEBUFFS,
  rotationAnomalyMultiplier,
  rotationDamage,
  rotationMultiplier,
} from 'lib/games/zzz/damage/damage'
import { MIYABI } from 'lib/games/zzz/data/agents'
import { HAILSTORM_SHRINE } from 'lib/games/zzz/data/wEngines'
import {
  computeStats,
  defaultConditions,
} from 'lib/games/zzz/stats/computeStats'
import {
  describe,
  expect,
  it,
} from 'vitest'

const stats =
  computeStats({ agent: MIYABI, wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: defaultConditions() }).stats

describe('ZZZ damage', () => {
  it('reads skill multipliers by level', () => {
    const ultimate = agentHits(MIYABI.id).find((hit) => hit.skill === 'UltimateLingeringSnow')!
    expect(hitMultiplier(ultimate, 1)).toBeCloseTo(2388, 6)
    expect(hitMultiplier(ultimate, 12)).toBeCloseTo(2388 + 217.1 * 11, 6)
    expect(rotationMultiplier(MIYABI.id, { counts: { 'UltimateLingeringSnow:0': 2 }, skillLevel: 12 })).toBeCloseTo(2 * (2388 + 217.1 * 11), 6)
    expect(Object.keys(defaultRotation(MIYABI.id).counts).length).toBeGreaterThan(0)
  })

  it('multiplies every factor like genshin-optimizer\'s formula', () => {
    const setup = { multiplier: 100, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const crit = 1 + (Math.min(100, stats.critRate) / 100) * (stats.critDmg / 100)
    const def = 794 / (794 + Math.max(0, 635 * (1 - stats.penRatio / 100) - stats.pen))
    expect(levelFactor(60)).toBe(794)
    expect(rotationDamage(stats, setup)).toBeCloseTo(stats.atk * (1 + stats.elementDmg / 100) * crit * def, 6)

    // DEF shred and stun raise it; RES lowers it
    const base = rotationDamage(stats, setup)
    expect(rotationDamage(stats, { ...setup, debuffs: { ...NO_DEBUFFS, defShred: 40 } })).toBeGreaterThan(base)
    expect(rotationDamage(stats, { ...setup, enemy: { ...DEFAULT_ENEMY, stunned: true } })).toBeCloseTo(base * 1.5, 6)
    expect(rotationDamage(stats, { ...setup, enemy: { ...DEFAULT_ENEMY, res: 20 } })).toBeCloseTo(base * 0.8, 6)
    expect(rotationDamage(stats, { ...setup, debuffs: { ...NO_DEBUFFS, dmgTaken: 25 } })).toBeCloseTo(base * 1.25, 6)
  })

  it('works out Attribute Anomaly damage like genshin-optimizer: no CRIT, Anomaly Proficiency and level multipliers', () => {
    expect(anomalyLevelMultiplier(60)).toBe(2)
    expect(anomalyLevelMultiplier(1)).toBe(1)
    // Each attribute's anomaly, with Burn, Shock and Corruption over their 10 seconds of ticks
    expect(anomalyHits('x', 'Physical').map((hit) => hit.kind)).toEqual(['assault', 'disorder'])
    expect(anomalyMultiplier('x', 'Physical', 'assault')).toBe(713)
    expect(anomalyMultiplier('x', 'Fire', 'burn')).toBe(1000)
    expect(anomalyMultiplier('x', 'Electric', 'shock')).toBe(1250)
    expect(anomalyMultiplier('x', 'Ether', 'corruption')).toBe(1250)
    // Disorder: 450% plus the time left of the anomaly it ends; Miyabi's Frostbite has its own numbers
    expect(anomalyMultiplier('x', 'Fire', 'disorder', 0)).toBe(450 + 100 * 10)
    expect(anomalyMultiplier('x', 'Fire', 'disorder', 4)).toBe(450 + 100 * 6)
    expect(anomalyMultiplier(MIYABI.id, 'Ice', 'disorder', 0)).toBe(600 + 75 * 20)
    expect(rotationAnomalyMultiplier(MIYABI.id, 'Ice', { counts: { 'anomaly:shatter': 2, 'anomaly:disorder': 1 }, skillLevel: 12 })).toBe(2 * 500 + 2100)

    const setup = { multiplier: 0, anomalyMultiplier: 500, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const def = 794 / (794 + Math.max(0, 635 * (1 - stats.penRatio / 100) - stats.pen))
    const expected = stats.atk * 5 * (1 + stats.elementDmg / 100) * def * (stats.anomalyProficiency / 100) * 2
    expect(rotationDamage(stats, setup)).toBeCloseTo(expected, 6)
    // Standard hits and anomalies add up; CRIT only touches the standard part
    const both = rotationDamage(stats, { ...setup, multiplier: 100 })
    expect(both - rotationDamage(stats, setup)).toBeCloseTo(rotationDamage(stats, { ...setup, anomalyMultiplier: 0, multiplier: 100 }), 6)
    expect(rotationDamage({ ...stats, critDmg: stats.critDmg + 50 }, setup)).toBeCloseTo(expected, 6)
  })
})
