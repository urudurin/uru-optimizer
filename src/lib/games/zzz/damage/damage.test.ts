import { splitDamage } from 'lib/games/shared/damageBreakdown'
import { resolveZzzCombat } from 'lib/games/zzz/damage/combatEffects'
import {
  hitKey,
  type Rotation,
  rotationLines,
  singleLineRotation,
} from 'lib/games/zzz/damage/damage'
import {
  abloomShareMultiplier,
  agentHits,
  anomalyHits,
  anomalyLevelMultiplier,
  anomalyMultiplier,
  ariaAbloomPerAm,
  DEFAULT_ENEMY,
  defaultRotation,
  hitKind,
  hitMultiplier,
  levelFactor,
  NO_DEBUFFS,
  rotationAnomaly,
  rotationAnomalyMultiplier,
  rotationBonusMultiplier,
  rotationDamage,
  rotationMultiplier,
  rotationSkills,
} from 'lib/games/zzz/damage/damage'
import { MIYABI } from 'lib/games/zzz/data/agents'
import { SETS } from 'lib/games/zzz/data/sets'
import { W_ENGINE_PASSIVES } from 'lib/games/zzz/data/wEnginePassives'
import { HAILSTORM_SHRINE } from 'lib/games/zzz/data/wEngines'
import {
  computeStats,
  defaultConditions,
  metThresholds,
} from 'lib/games/zzz/stats/computeStats'
import { ZzzStats } from 'lib/games/zzz/types'
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

  it('marks Aftershock hits and gives them their own bonuses, CRIT DMG and DEF ignore', () => {
    const ORPHIE = '1301'
    const aftershock = agentHits(ORPHIE).filter((hit) => hit.aftershock).map((hit) => `${hit.skill}:${hit.index}`)
    expect(aftershock).toContain('BasicAttackHighPressureFlamethrower:5')
    expect(aftershock).not.toContain('BasicAttackHighPressureFlamethrower:0')
    const counts = { 'BasicAttackHighPressureFlamethrower:5': 1, 'BasicAttackHighPressureFlamethrower:0': 1 }
    const rotation = { counts, skillLevel: 12 }
    const [plain, shot] = ['BasicAttackHighPressureFlamethrower:0', 'BasicAttackHighPressureFlamethrower:5']
      .map((key) => hitMultiplier(agentHits(ORPHIE).find((hit) => `${hit.skill}:${hit.index}` === key)!, 12))
    // Aftershock DMG +85% reaches only the Aftershock hit
    expect(rotationBonusMultiplier(ORPHIE, rotation, { aftershock: 85 }, {})).toBeCloseTo(shot * 0.85, 6)

    // CRIT DMG or DEF ignore of their own split them off; the rest keeps the shared multipliers
    const split = rotationSkills(ORPHIE, rotation, {}, {}, { critDmgFromCritDmg: 0.35, defIgnore: 25 })
    expect(split.multiplier).toBeCloseTo(plain, 6)
    expect(split.aftershock?.multiplier).toBeCloseTo(shot, 6)
    const base = { agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const crit = 1 + (Math.min(100, stats.critRate) / 100) * (stats.critDmg / 100) * 1.35
    const def = 794 / (794 + Math.max(0, 635 * 0.75 * (1 - stats.penRatio / 100) - stats.pen))
    const onlyShot = { ...base, multiplier: 0, aftershock: { multiplier: 100, bonusMultiplier: 0, critDmgFromCritDmg: 0.35, defIgnore: 25 } }
    expect(rotationDamage(stats, onlyShot)).toBeCloseTo(stats.atk * (1 + stats.elementDmg / 100) * crit * def, 6)
    // Without them, everything stays in one group
    expect(rotationSkills(ORPHIE, rotation, {}, {}).aftershock).toBeUndefined()
    expect(resolveZzzCombat(ORPHIE, 0, {})).toMatchObject({ kindBonus: { aftershock: 85 }, aftershockDefIgnore: 25 })
    expect(resolveZzzCombat('1381', 0, {}).aftershockCritDmg).toBeCloseTo(0.35, 6)
  })

  it('adds the Wind anomaly and Vortex, and Windswept and Frostbite', () => {
    expect(anomalyHits('x', 'Wind').map((hit) => hit.key)).toEqual([
      'anomaly:wind',
      'anomaly:disorder',
      'anomaly:vortex:Physical',
      'anomaly:vortex:Fire',
      'anomaly:vortex:Ice',
      'anomaly:vortex:Electric',
      'anomaly:vortex:Ether',
      'anomaly:vortex:Frost',
    ])
    expect(anomalyMultiplier('x', 'Wind', 'wind')).toBe(1250)
    expect(anomalyMultiplier('x', 'Wind', 'disorder', 3)).toBe(100)
    // Vortex: base + time multiplier x seconds left of 30
    expect(anomalyMultiplier('x', 'Wind', 'vortex', 10, 'Fire')).toBe(900 + 100 * 20)
    expect(anomalyMultiplier('x', 'Wind', 'vortex', 0, 'Ice')).toBe(1300 + 7.5 * 30)
    // Others only set off their own Vortex, and only with a Wind agent in the squad
    expect(anomalyHits('x', 'Fire').some((hit) => hit.kind === 'vortex')).toBe(false)
    expect(anomalyHits(MIYABI.id, 'Ice', ['Ice', 'Wind']).at(-1)).toMatchObject({ key: 'anomaly:vortex:Frost', attribute: 'Frost' })

    const setup = { multiplier: 100, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const base = rotationDamage(stats, setup)
    expect(rotationDamage(stats, { ...setup, enemy: { ...DEFAULT_ENEMY, windswept: true } })).toBeCloseTo(base * 1.1, 6)
    // Windswept is direct DMG only: anomalies don't get it
    const anomaly = { ...setup, multiplier: 0, anomalyMultiplier: 500 }
    expect(rotationDamage(stats, { ...anomaly, enemy: { ...DEFAULT_ENEMY, windswept: true } })).toBeCloseTo(rotationDamage(stats, anomaly), 6)
    const critRate = Math.min(100, stats.critRate) / 100
    expect(rotationDamage(stats, { ...setup, enemy: { ...DEFAULT_ENEMY, frostbite: true } }))
      .toBeCloseTo(base / (1 + critRate * stats.critDmg / 100) * (1 + critRate * (stats.critDmg + 10) / 100), 6)
  })

  it('counts gear effects on some hits for the set filter\'s sets and an engine of the agent\'s specialty', () => {
    const gear = { refinement: 1, sets: [], specialty: 'Attack', element: 'Ice' }
    // Puffer Electro's Ultimate DMG only with it as the 4-piece; Shadow Harmony's 2-piece with either filter
    expect(resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, sets: [{ setId: 'puffer-electro', pieces: 2 }] }).kindBonus.ult).toBeUndefined()
    expect(resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, sets: [{ setId: 'puffer-electro', pieces: 4 }] }).kindBonus.ult).toBe(20)
    expect(resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, sets: [{ setId: 'shadow-harmony', pieces: 4 }] }).kindBonus).toMatchObject({
      dash: 15,
      aftershock: 15,
    })
    // Gilded Blossom's EX Special DMG by refinement, for Attack agents only
    expect(resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, wEngineId: '13013', refinement: 5 }).kindBonus.exSpecial).toBe(24)
    const stun = resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, wEngineId: '13013', specialty: 'Stun' })
    expect(stun.kindBonus.exSpecial).toBeUndefined()
    expect(stun.applied.find((a) => a.effect.id === 'gilded-blossom-ex')?.reason).toBe('Only for Attack agents')
  })

  it('has data for every disc set and the W-Engines from Enka only', () => {
    const slugs = [
      'astral-voice',
      'branch-blade-song',
      'bunny-in-wonderland',
      'chaos-jazz',
      'chaotic-metal',
      'dawns-bloom',
      'fanged-metal',
      'feathered-fate',
      'freedom-blues',
      'hormone-punk',
      'inferno-metal',
      'king-of-the-summit',
      'moonlight-lullaby',
      'notes-from-the-chained',
      'phaethons-melody',
      'polar-metal',
      'proto-punk',
      'puffer-electro',
      'shadow-harmony',
      'shining-aria',
      'shockstar-disco',
      'soul-rock',
      'swing-jazz',
      'the-sky-ablaze',
      'thorned-rose',
      'thunder-metal',
      'white-water-ballad',
      'woodpecker-electro',
      'wuthering-salon',
      'yunkui-tales',
    ]
    expect(slugs.filter((slug) => !SETS[slug])).toEqual([])
    expect(SETS['chaos-jazz'].twoPiece).toMatchObject([{ stat: ZzzStats.ANOMALY_PROFICIENCY, value: 30 }])
    // Passives count in combat, for the engine's specialty
    expect(W_ENGINE_PASSIVES['13013'](1)).toMatchObject([{ stat: ZzzStats.ATK_P, value: 6, when: 'onField', specialty: 'Attack' }])
    expect(W_ENGINE_PASSIVES['14151'](5).find((e) => e.stat === ZzzStats.ELEMENT_DMG)?.value).toBe(48)
  })

  it('counts anomaly-only DMG Bonus, multipliers of their own, extra Disorder and Assault CRIT', () => {
    const rotation = { counts: { 'anomaly:shock': 1, 'anomaly:disorder': 1 }, skillLevel: 12 }
    const shock = 1250
    const disorder = anomalyMultiplier('x', 'Electric', 'disorder')
    const plain = rotationAnomaly('x', 'Electric', rotation)
    expect(plain.anomalyMultiplier).toBe(shock + disorder)
    // Grace's Shock DMG +36% reaches Shock, not Disorder
    expect(rotationAnomaly('x', 'Electric', rotation, [], { shock: { dmg: 36 } }).anomalyBonusMultiplier).toBeCloseTo(shock * 0.36, 6)
    // Yanagi's +250% Disorder multiplier, and a multiplier of its own (Vivian's +12%)
    expect(rotationAnomaly('x', 'Electric', rotation, [], { disorder: { add: 250 } }).anomalyMultiplier).toBe(shock + disorder + 250)
    expect(rotationAnomaly('x', 'Electric', rotation, [], { anomaly: { buff: 12 } }).anomalyMultiplier).toBeCloseTo(shock * 1.12 + disorder, 6)

    // Jane's Assault CRIT: 40% + 0.16% per Anomaly Proficiency, 50% CRIT DMG
    const assault = rotationAnomaly('x', 'Physical', { counts: { 'anomaly:assault': 1 }, skillLevel: 12 }, [], resolveZzzCombat('1261', 0, {}).anomalyBonus)
    expect(assault.anomalyCrits).toEqual([{ multiplier: 713, bonusMultiplier: 0, critRate: 40, critRatePerAp: 0.16, critDmg: 50 }])
    const setup = { multiplier: 0, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const rate = Math.min(1, (40 + 0.16 * stats.anomalyProficiency) / 100)
    expect(rotationDamage(stats, { ...setup, ...assault }) / rotationDamage(stats, { ...setup, anomalyMultiplier: 713 })).toBeCloseTo(1 + rate * 0.5, 6)
  })

  it('has passives for the other W-Engines, gated by specialty and attribute', () => {
    expect(Object.keys(W_ENGINE_PASSIVES).length).toBeGreaterThan(70)
    expect(W_ENGINE_PASSIVES['14129'](1)).toMatchObject([{ stat: ZzzStats.CRIT_DMG, value: 45, specialty: 'Attack' }])
    expect(W_ENGINE_PASSIVES['14126'](1)[0]).toMatchObject({ value: 36, element: 'Physical' })

    // Chief Sidekick ignores Fire RES for Fire agents only; Jane's Mindscape 2 ignores DEF
    const gear = { wEngineId: '14157', refinement: 1, sets: [], specialty: 'Stun', element: 'Fire' }
    expect(resolveZzzCombat(MIYABI.id, 0, {}, gear).resIgnore).toBe(15)
    expect(resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, element: 'Ice' }).resIgnore).toBe(0)
    expect(resolveZzzCombat('1261', 2, {}).defIgnore).toBe(15)
    expect(resolveZzzCombat('1261', 1, {}).defIgnore).toBe(0)
    // Timeweaver's Disorder multiplier and Crimson Thirst's Sharp DMG
    const timeweaver = resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, wEngineId: '14122', specialty: 'Anomaly' })
    expect(timeweaver.anomalyBonus.disorder).toEqual({ buff: 25 })
    expect(resolveZzzCombat(MIYABI.id, 0, {}, { ...gear, wEngineId: '14161', specialty: 'Armorer', element: 'Electric' }).sharpDmg).toBe(10)
  })

  it('applies Sheer and Sharp DMG as multipliers of their own', () => {
    const sheer = { multiplier: 100, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS, scaling: 'sheer' as const }
    const rupture = { ...stats, sheerForce: 3000 }
    expect(rotationDamage(rupture, { ...sheer, sheerDmg: 10 }) / rotationDamage(rupture, sheer)).toBeCloseTo(1.1, 6)
    const sharp = { ...sheer, scaling: 'sharp' as const }
    expect(rotationDamage(stats, { ...sharp, sharpDmg: 20 }) / rotationDamage(stats, sharp)).toBeCloseTo(1.2, 6)
    // Sheer DMG doesn't touch ATK-scaling agents
    expect(rotationDamage(stats, { ...sheer, scaling: 'atk', sheerDmg: 10 })).toBeCloseTo(rotationDamage(stats, { ...sheer, scaling: 'atk' }), 6)
  })

  it('works out stat-based effects per build (Orphie\'s ATK from Energy Regen)', () => {
    const input = { agent: MIYABI, wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: defaultConditions() }
    const zeroedIn = resolveZzzCombat('1301', 0, {}).statEffects.find((e) => e.fromStat)!
    const plain = computeStats(input).stats
    const withEffect = computeStats({ ...input, teamEffects: [zeroedIn] }).stats
    const expected = Math.min(700, 280 + 200 * Math.max(0, plain.energyRegen - 1.6))
    expect(withEffect.atk - plain.atk).toBeCloseTo(expected, 0)
    // Enough Energy Regen reaches the cap
    expect(
      computeStats({ ...input, teamEffects: [zeroedIn, { stat: ZzzStats.ENERGY_REGEN, value: 500, source: 't', confidence: 'sourced' }] }).stats.atk
        - computeStats({ ...input, teamEffects: [{ stat: ZzzStats.ENERGY_REGEN, value: 500, source: 't', confidence: 'sourced' }] }).stats.atk,
    )
      .toBeCloseTo(700, 0)
  })

  it('adds Alice\'s Disorder bonus per second left, Vivian\'s Abloom and Yanagi\'s Polarity Disorder', () => {
    const disorder = { counts: { 'anomaly:disorder': 1 }, skillLevel: 12, disorderAfter: 4 }
    const alice = rotationAnomaly('1401', 'Physical', disorder, [], resolveZzzCombat('1401', 0, {}).anomalyBonus)
    expect(alice.anomalyMultiplier).toBeCloseTo(anomalyMultiplier('1401', 'Physical', 'disorder', 4) + 18 * 6, 6)

    // Abloom grows with Anomaly Proficiency: its damage goes with AP squared
    const abloom = rotationAnomaly('1331', 'Ether', { counts: { 'anomaly:abloom:Ether': 1 }, skillLevel: 12 })
    expect(abloom.anomalyPerAp?.atk).toBeCloseTo(62.5 * 0.0615 / 10, 9)
    const setup = { multiplier: 0, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS, ...abloom }
    const doubled = { ...stats, anomalyProficiency: stats.anomalyProficiency * 2 }
    expect(rotationDamage(doubled, setup) / rotationDamage(stats, setup)).toBeCloseTo(4, 6)

    // Polarity Disorder: 15% of Disorder plus (5 + 2.25 x skill level) x AP of flat damage
    expect(anomalyHits('1221', 'Electric').some((hit) => hit.key === 'anomaly:polarity')).toBe(true)
    const polarity = rotationAnomaly('1221', 'Electric', { counts: { 'anomaly:polarity': 1 }, skillLevel: 12 })
    expect(polarity.anomalyMultiplier).toBeCloseTo(0.15 * anomalyMultiplier('1221', 'Electric', 'disorder', 0), 6)
    expect(polarity.anomalyPerAp?.flat).toBe(32)
  })

  it('splits rotation damage by line, the parts adding up to the whole', () => {
    const hits = agentHits(MIYABI.id)
    const rotation: Rotation = { counts: { [hitKey(hits[0])]: 3, [hitKey(hits[5])]: 1, 'anomaly:shatter': 2, 'anomaly:disorder': 1 }, skillLevel: 12 }
    const setupFor = (r: Rotation) => ({
      ...rotationSkills(MIYABI.id, r, { ult: 30 }, {}),
      ...rotationAnomaly(MIYABI.id, 'Ice', r),
      agentLevel: 60,
      enemy: DEFAULT_ENEMY,
      debuffs: NO_DEBUFFS,
    })
    const parts = splitDamage(rotationLines(MIYABI.id, 'Ice', rotation), (line) => rotationDamage(stats, setupFor(singleLineRotation(rotation, line))))
    expect(parts.map((p) => p.key).sort()).toEqual(Object.keys(rotation.counts).sort())
    expect(parts.reduce((sum, p) => sum + p.damage, 0)).toBeCloseTo(rotationDamage(stats, setupFor(rotation)), 4)
    expect(parts.find((p) => p.key === 'anomaly:shatter')?.group).toBe('Attribute Anomaly')
  })

  it('Aria: Abloom per point of Anomaly Mastery, +50% on a stunned enemy, and longer Corruption', () => {
    const ARIA = '1501'
    expect(anomalyHits(ARIA, 'Ether').filter((hit) => hit.kind === 'abloom').map((hit) => hit.attribute))
      .toEqual(['Physical', 'Fire', 'Ice', 'Electric', 'Ether', 'Wind'])
    // 27.5% of Corruption's 62.5% tick per 10 Anomaly Mastery
    expect(ariaAbloomPerAm('Ether')).toBeCloseTo(62.5 * 0.275 / 10, 9)
    const rotation: Rotation = { counts: { 'anomaly:abloom:Ether': 2 }, skillLevel: 12 }
    const plain = rotationAnomaly(ARIA, 'Ether', rotation)
    expect(plain.anomalyPerAm?.atk).toBeCloseTo(2 * ariaAbloomPerAm('Ether'), 9)
    expect(plain.anomalyPerAp).toBeUndefined()

    const setup = { multiplier: 0, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS, ...plain }
    const def = 794 / (794 + Math.max(0, 635 * (1 - stats.penRatio / 100) - stats.pen))
    const expected = stats.atk * 2 * ariaAbloomPerAm('Ether') * stats.anomalyMastery / 100 * (1 + stats.elementDmg / 100) * def
      * (stats.anomalyProficiency / 100) * 2
    expect(rotationDamage(stats, setup)).toBeCloseTo(expected, 4)

    // The stunned bonus follows the Enemy card; the Additional Ability adds 6 Corruption ticks
    expect(resolveZzzCombat(ARIA, 0, {}, undefined, false).anomalyBonus).toEqual({ corruption: { add: 375 } })
    const stunned = resolveZzzCombat(ARIA, 0, {}, undefined, true).anomalyBonus
    expect(rotationAnomaly(ARIA, 'Ether', rotation, [], stunned).anomalyPerAm?.atk).toBeCloseTo(2 * ariaAbloomPerAm('Ether') * 1.5, 9)
    expect(rotationAnomaly(ARIA, 'Ether', { counts: { 'anomaly:corruption': 1 }, skillLevel: 12 }, [], stunned).anomalyMultiplier).toBe(1250 + 375)
  })

  it('Velina: fixed-share Abloom, Energy Regen scaling up to its caps, Windbite and her squad bonus', () => {
    const VELINA = '1561'
    const abloom = anomalyHits(VELINA, 'Wind').filter((hit) => hit.kind === 'abloom')
    expect(abloom.map((hit) => [hit.key, abloomShareMultiplier(hit)])).toEqual([
      ['anomaly:abloom:condensed', 1.45 * 1250],
      ['anomaly:abloom:sweeping', 2.55 * 1250],
      ['anomaly:abloom:ultimate', 6.8 * 1250],
    ])
    const kit = resolveZzzCombat(VELINA, 0, {})
    const rotation: Rotation = { counts: { 'anomaly:abloom:sweeping': 1, 'anomaly:wind': 1, 'anomaly:vortex:Fire': 1 }, skillLevel: 12 }
    const anomaly = rotationAnomaly(VELINA, 'Wind', rotation, [], kit.anomalyBonus)
    const vortex = anomalyMultiplier(VELINA, 'Wind', 'vortex', 0, 'Fire') + 50
    expect(anomaly.anomalyMultiplier).toBeCloseTo(2.55 * 1250 + 1250 + vortex, 6)
    // +10% DMG on Windswept and Vortex only, not the Abloom
    expect(anomaly.anomalyBonusMultiplier).toBeCloseTo((1250 + vortex) * 0.1, 6)

    // DMG +0.21% and Anomaly Mastery +0.5 per 0.01 Energy Regen above 1.2, worked out from the stats like minStat
    const [dmg, mastery] = kit.statEffects
    expect(metThresholds({ ...stats, energyRegen: 1.5 }, [dmg, mastery]).map((e) => e.value)).toEqual([
      expect.closeTo(6.3, 6),
      expect.closeTo(15, 6),
    ])
    expect(metThresholds({ ...stats, energyRegen: 3 }, [dmg, mastery]).map((e) => e.value)).toEqual([35, 84])
    // Flat Anomaly Mastery goes on top of the percent from discs
    const input = { agent: MIYABI, wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: defaultConditions() }
    const flat = computeStats({ ...input, teamEffects: [{ stat: ZzzStats.ANOMALY_MASTERY_FLAT, value: 84, source: 'test', confidence: 'sourced' }] })
    expect(flat.stats.anomalyMastery - computeStats(input).stats.anomalyMastery).toBeCloseTo(84, 6)
  })

  it('Nangong Yu: Vibrato Abloom, 25% Polarity Disorder and Misstep on the stun multiplier', () => {
    const NANGONG = '1511'
    const vibrato = anomalyHits(NANGONG, 'Ether').filter((hit) => hit.kind === 'abloom')
    // Every attribute's share comes to 450% of ATK (of its single-hit anomaly multiplier)
    expect(vibrato.map((hit) => Math.round(abloomShareMultiplier(hit)))).toEqual([449, 450, 450, 450, 450, 450])
    const kit = resolveZzzCombat(NANGONG, 0, {})
    const rotation: Rotation = { counts: { 'anomaly:abloom:vibrato:Ether': 1, 'anomaly:polarity': 2 }, skillLevel: 12 }
    const anomaly = rotationAnomaly(NANGONG, 'Ether', rotation, [], kit.anomalyBonus)
    // 4 Vibrato stacks: +100% on the Abloom; Polarity Disorder is 25% of her Disorder with nothing flat
    expect(anomaly.anomalyMultiplier).toBeCloseTo(450 * 2 + 2 * 0.25 * anomalyMultiplier(NANGONG, 'Ether', 'disorder'), 6)
    expect(anomaly.anomalyPerAp).toBeUndefined()

    // Misstep: +30 points on the stun multiplier while stunned
    expect(kit.stunBonus).toBe(30)
    const base = { multiplier: 100, agentLevel: 60, enemy: { ...DEFAULT_ENEMY, stunned: true }, debuffs: NO_DEBUFFS }
    expect(rotationDamage(stats, { ...base, debuffs: { ...NO_DEBUFFS, stunBonus: 30 } }) / rotationDamage(stats, base)).toBeCloseTo(1.8 / 1.5, 6)
    // Not stunned: no stun multiplier at all
    const awake = { ...base, enemy: DEFAULT_ENEMY }
    expect(rotationDamage(stats, { ...awake, debuffs: { ...NO_DEBUFFS, stunBonus: 30 } })).toBeCloseTo(rotationDamage(stats, awake), 6)
  })

  it('Norma: CRIT DMG from CRIT Rate above 50%, Tech Divide on the stun multiplier, En-Nah Barrage', () => {
    const kit = resolveZzzCombat('1571', 0, {})
    expect(kit.stunBonus).toBe(30)
    expect(resolveZzzCombat('1571', 0, { 'norma-ability-tech-divide': 4 }).stunBonus).toBe(12)
    const critDmg = kit.statEffects.find((e) => e.fromStat)!
    expect(metThresholds({ ...stats, critRate: 70 }, [critDmg])[0].value).toBeCloseTo(34, 6)
    expect(metThresholds({ ...stats, critRate: 100 }, [critDmg])[0].value).toBe(85)
    expect(metThresholds({ ...stats, critRate: 40 }, [critDmg])[0].value).toBe(0)
    expect(kit.statEffects.filter((e) => !e.fromStat).map((e) => [e.stat, e.value])).toEqual([[ZzzStats.ATK, 870], [ZzzStats.ELEMENT_DMG, 20]])
  })

  it('Ye Shunguang: Ether Veil vulnerability, Mindscape 1 DEF ignore and Mindscape 2 EX Special / Ultimate DEF ignore', () => {
    const YE = '1431'
    const base = { multiplier: 100, agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const plain = rotationDamage(stats, base)
    // The stun multiplier counts without a stun, up to 100% + the cap (GO's veilVulnerabilityCap_)
    expect(rotationDamage(stats, { ...base, veilVulnerabilityCap: 110 })).toBeCloseTo(plain * 1.5, 6)
    expect(rotationDamage(stats, { ...base, veilVulnerabilityCap: 110, enemy: { ...DEFAULT_ENEMY, stunMultiplier: 250 } })).toBeCloseTo(plain * 2.1, 6)

    const kit = (mindscape: number) => resolveZzzCombat(YE, mindscape, {})
    expect(kit(0)).toMatchObject({ veilVulnerabilityCap: 110, defIgnore: 0, kindDefIgnore: {} })
    expect(kit(1)).toMatchObject({ defIgnore: 20 })
    expect(kit(4)).toMatchObject({ veilVulnerabilityCap: 200, kindDefIgnore: { exSpecial: 40, ult: 40 } })
    expect(resolveZzzCombat(YE, 0, { 'ye-core-vulnerability': false }).veilVulnerabilityCap).toBe(0)

    // EX Special and Ultimate hits get a group of their own with 40% DEF ignore; the Basic Attack stays shared
    const rotation: Rotation = { counts: { 'BasicAttackSwiftedge:0': 2, 'EXSpecialAttackGaleSuppression:0': 1, 'UltimateChasingStorms:0': 1 }, skillLevel: 12 }
    const skills = rotationSkills(YE, rotation, {}, {}, undefined, kit(2).kindDefIgnore)
    const hit = (key: string) => hitMultiplier(agentHits(YE).find((h) => hitKey(h) === key)!, 12)
    expect(skills.multiplier).toBeCloseTo(2 * hit('BasicAttackSwiftedge:0'), 6)
    expect(skills.hitGroups).toEqual([{
      multiplier: expect.closeTo(hit('EXSpecialAttackGaleSuppression:0') + hit('UltimateChasingStorms:0'), 6),
      bonusMultiplier: 0,
      defIgnore: 40,
      critDmg: 0,
    }])
    const total = rotationDamage(stats, { ...base, ...skills })
    const unignored = rotationDamage(stats, { ...base, ...rotationSkills(YE, rotation, {}, {}) })
    expect(total).toBeGreaterThan(unignored)
    const def = (ignore: number) => 794 / (794 + Math.max(0, 635 * (1 - ignore) * (1 - stats.penRatio / 100) - stats.pen))
    const oneHit = stats.atk * (1 + stats.elementDmg / 100) * (1 + (Math.min(100, stats.critRate) / 100) * (stats.critDmg / 100)) / 100
    expect(total).toBeCloseTo(oneHit * (skills.multiplier * def(0) + skills.hitGroups![0].multiplier * def(0.4)), 4)
  })
  it('Pyrois: Mirage Ultimate CRIT DMG on a stunned enemy, Sunflare, her squad CRIT DMG, M1, and her extra Ultimate hits', () => {
    const PYROIS = '1551'
    expect(resolveZzzCombat(PYROIS, 0, {}).kindCritDmg).toEqual({})
    const kit = resolveZzzCombat(PYROIS, 0, {}, undefined, true)
    expect(kit.kindCritDmg).toEqual({ ult: 40 })
    expect(kit.statEffects.map((e) => [e.stat, e.value])).toEqual([[ZzzStats.ELEMENT_DMG, 40], [ZzzStats.CRIT_DMG, 40]])
    expect(resolveZzzCombat(PYROIS, 1, {}).statEffects.map((e) => e.stat)).toContain(ZzzStats.CRIT_RATE)

    // Contaminated and Totalize hits: fixed 900% / 2250%, Ultimate hits, not in the default rotation
    const hit = (key: string) => agentHits(PYROIS).find((h) => hitKey(h) === key)!
    expect(hitMultiplier(hit('UltimateUnboundSwordstormContaminated:0'), 12)).toBe(900)
    expect(hitMultiplier(hit('UltimateEternalImprisonmentTotalize:0'), 16)).toBe(2250)
    expect(hit('UltimateEternalImprisonmentTotalize:0').kind).toBe('ult')
    expect(defaultRotation(PYROIS).counts['UltimateEternalImprisonmentTotalize:0']).toBeUndefined()
    expect(defaultRotation(PYROIS).counts['UltimateEternalImprisonment:0']).toBe(1)

    // Ultimate hits get a group with +40% CRIT DMG; the Chain Attack stays shared
    const rotation: Rotation = {
      counts: { 'ChainAttackCeremonialMarch:0': 1, 'UltimateEternalImprisonment:0': 1, 'UltimateEternalImprisonmentTotalize:0': 1 },
      skillLevel: 12,
    }
    const skills = rotationSkills(PYROIS, rotation, {}, {}, undefined, {}, kit.kindCritDmg)
    expect(skills.multiplier).toBeCloseTo(hitMultiplier(hit('ChainAttackCeremonialMarch:0'), 12), 6)
    expect(skills.hitGroups).toEqual([{
      multiplier: expect.closeTo(hitMultiplier(hit('UltimateEternalImprisonment:0'), 12) + 2250, 6),
      bonusMultiplier: 0,
      defIgnore: 0,
      critDmg: 40,
    }])
    const base = { agentLevel: 60, enemy: DEFAULT_ENEMY, debuffs: NO_DEBUFFS }
    const cr = Math.min(100, stats.critRate) / 100
    const ratio = rotationDamage(stats, { ...base, ...skills, multiplier: 0 })
      / rotationDamage(stats, { ...base, multiplier: skills.hitGroups![0].multiplier })
    expect(ratio).toBeCloseTo((1 + cr * (stats.critDmg + 40) / 100) / (1 + cr * stats.critDmg / 100), 6)
  })
})
