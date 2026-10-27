import { resolveZzzCombat } from 'lib/games/zzz/damage/combatEffects'
import {
  agentHits,
  anomalyHits,
  anomalyLevelMultiplier,
  anomalyMultiplier,
  DEFAULT_ENEMY,
  defaultRotation,
  hitKind,
  hitMultiplier,
  levelFactor,
  NO_DEBUFFS,
  rotationAnomalyMultiplier,
  rotationBonusMultiplier,
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
    // Whole ticks left only, like the wiki: Burn ticks every half second, Shock every second
    expect(anomalyMultiplier('x', 'Fire', 'disorder', 3.7)).toBe(450 + Math.floor(6.3 * 2) * 50)
    expect(anomalyMultiplier('x', 'Electric', 'disorder', 3.7)).toBe(450 + 6 * 125)
    expect(anomalyMultiplier('x', 'Ether', 'disorder', 0)).toBe(450 + 20 * 62.5)
    expect(anomalyMultiplier('x', 'Physical', 'disorder', 2)).toBe(450 + 8 * 7.5)
    // Level multiplier truncated to 4 decimals
    expect(anomalyLevelMultiplier(50)).toBe(1.8305)
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

  it('reads what each hit counts as from its skill, and adds kit DMG Bonuses to those hits only', () => {
    expect(hitKind('UltimateLingeringSnow', 'chain')).toBe('ult')
    expect(hitKind('ChainAttackSpringsCall', 'chain')).toBe('chain')
    expect(hitKind('EXSpecialAttackHisetsu', 'special')).toBe('exSpecial')
    expect(hitKind('SpecialAttackMiyuki', 'special')).toBe('special')
    expect(hitKind('DodgeCounterKanSuzume', 'dodge')).toBe('dodgeCounter')
    expect(hitKind('FrostsCrushing', 'basic')).toBe('basic')

    // An Ultimate +60% bonus reaches the Ultimate and nothing else
    const rotation = { counts: { 'UltimateLingeringSnow:0': 1, 'EXSpecialAttackHisetsu:0': 1 }, skillLevel: 12 }
    const ult = agentHits(MIYABI.id).find((hit) => hit.skill === 'UltimateLingeringSnow')!
    expect(rotationBonusMultiplier(MIYABI.id, rotation, { ult: 60 }, {})).toBeCloseTo(hitMultiplier(ult, 12) * 0.6, 6)

    // The bonus adds to the Element DMG Bonus of those hits: (1 + E) per hit, plus its own share
    const setup = { multiplier: 100, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const base = rotationDamage(stats, setup)
    const withBonus = rotationDamage(stats, { ...setup, bonusMultiplier: 50 })
    expect(withBonus / base).toBeCloseTo((1 + stats.elementDmg / 100 + 0.5) / (1 + stats.elementDmg / 100), 6)
  })

  it('resolves kit effects by Mindscape and toggles', () => {
    const miyabi = resolveZzzCombat(MIYABI.id, 0, {})
    expect(miyabi.skillBonus).toEqual({ BasicAttackShimotsuki: 60 })
    expect(miyabi.statEffects.map((e) => e.value)).toEqual([30])
    // Mindscape 2 isn't reached at M0
    expect(miyabi.applied.find((a) => a.effect.id === 'miyabi-m2')?.counted).toBe(false)
    expect(resolveZzzCombat(MIYABI.id, 2, {}).kindBonus).toEqual({ dodgeCounter: 30 })
    expect(resolveZzzCombat(MIYABI.id, 0, { 'miyabi-ult-ice': false }).statEffects).toEqual([])
  })

  it('works out Armorer agents\' Sharp damage from DEF, with Laceration instead of CRIT DMG', () => {
    const setup = { multiplier: 100, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS, scaling: 'sharp' as const }
    const def = 794 / (794 + Math.max(0, 635 * (1 - stats.penRatio / 100) - stats.pen))
    const bonus = 1 + stats.elementDmg / 100
    // 60% CRIT Rate, 150% Laceration: 1 + 0.6 x 1.5
    const at60 = { ...stats, def: 2000, critRate: 60 }
    expect(rotationDamage(at60, setup)).toBeCloseTo(2000 * bonus * def * 1.9, 6)
    // CRIT DMG doesn't count by itself
    expect(rotationDamage({ ...at60, critDmg: 300 }, setup)).toBeCloseTo(rotationDamage(at60, setup), 6)
    // CRIT Rate above 100% adds a second Laceration multiplier: 130% -> 2.5 x 1.45
    expect(rotationDamage({ ...at60, critRate: 130 }, setup)).toBeCloseTo(2000 * bonus * def * 2.5 * 1.45, 6)
    // Claret's conversion and Laceration bonus: 60% + 0.35 x 100% CRIT DMG = 95% CRIT Rate, 175% Laceration
    const claret = { ...setup, critRateFromCritDmg: 0.35, lacerationDmg: 175 }
    expect(rotationDamage({ ...at60, critDmg: 100 }, claret)).toBeCloseTo(2000 * bonus * def * (1 + 0.95 * 1.75), 6)
  })

  it('works out Rupture agents\' Sheer damage from Sheer Force, without the DEF multiplier', () => {
    const sheer = { ...stats, sheerForce: 2696 }
    const setup = { multiplier: 100, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS, scaling: 'sheer' as const }
    const crit = 1 + (Math.min(100, stats.critRate) / 100) * (stats.critDmg / 100)
    expect(rotationDamage(sheer, setup)).toBeCloseTo(2696 * (1 + stats.elementDmg / 100) * crit, 6)
    // HP raises it through Sheer Force; DEF shred and PEN don't change it
    expect(rotationDamage({ ...sheer, atk: 99999 }, setup)).toBeCloseTo(rotationDamage(sheer, setup), 6)
    expect(rotationDamage(sheer, { ...setup, debuffs: { ...NO_DEBUFFS, defShred: 50 } })).toBeCloseTo(rotationDamage(sheer, setup), 6)
    // Their anomalies stay ATK-based with DEF
    const anomaly = { ...setup, multiplier: 0, anomalyMultiplier: 500 }
    expect(rotationDamage(sheer, anomaly)).toBeCloseTo(rotationDamage(sheer, { ...anomaly, scaling: 'atk' }), 6)
  })
})
