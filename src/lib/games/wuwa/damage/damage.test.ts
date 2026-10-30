import { resolveWuwaCombat } from 'lib/games/wuwa/damage/combatEffects'
import {
  characterHits,
  type DamageSetup,
  DEFAULT_ENEMY,
  defaultRotation,
  echoSkillHits,
  echoSkillText,
  hasSkillData,
  hitMultiplier,
  mainEchoBonus,
  migrateRotationCounts,
  rotationDamage,
} from 'lib/games/wuwa/damage/damage'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import type { WuwaStats } from 'lib/games/wuwa/stats/computeStats'
import {
  describe,
  expect,
  it,
} from 'vitest'

const stats: WuwaStats = {
  hp: 15000,
  atk: 2000,
  def: 1200,
  critRate: 60,
  critDmg: 250,
  energyRegen: 120,
  healingBonus: 0,
  elementDmg: 40,
  basicDmg: 10,
  heavyDmg: 0,
  skillDmg: 30,
  libDmg: 20,
}

const hit = (charId: string, label: string) => characterHits(charId).find((h) => h.label === label)!

function setup(charId: string, label: string, parts: Partial<DamageSetup> = {}): DamageSetup {
  return { charId, characterLevel: 90, rotation: { counts: { [hit(charId, label).key]: 1 }, skillLevel: 10 }, enemy: DEFAULT_ENEMY, ...parts }
}

describe('WuWa damage', () => {
  it('has skill data for every Resonator', () => {
    expect(Object.keys(CHARACTER_INFO).filter((id) => !hasSkillData(id))).toEqual([])
  })

  it('reads multipliers by skill level, every part of a line added up', () => {
    // Hsin's Basic Attack Stage 2: 15.15% x 2 + 68.14% + 53.00% at level 10
    const stage2 = hit('hsin', 'Basic Attack - Answering Form Stage 2 DMG')
    expect(hitMultiplier(stage2, 10)).toBeCloseTo(15.15 * 2 + 68.14 + 53, 6)
    expect(hitMultiplier(stage2, 1)).toBeLessThan(hitMultiplier(stage2, 10))
    // What a line counts as and scales on comes from the datamine's damage entries
    expect(hit('cartethyia', 'Blade of Howling Squall DMG').terms[0].slice(0, 2)).toEqual(['liberation', 'hp'])
    expect(hit('yuanwu', 'Thunder Wedge Coordinated Attack DMG').terms[0].slice(0, 2)).toEqual(['skill', 'def'])
    expect(hit('encore', 'Cosmos: Frolicking Stage 1 DMG').terms[0][0]).toBe('basic')
    expect(Object.keys(defaultRotation('hsin').counts).every((key) => /^(skill|liberation):/.test(key))).toBe(true)
  })

  it('multiplies every factor of the damage formula', () => {
    const line = hit('encore', 'Energetic Welcome Damage')
    const crit = 1 + 0.6 * 1.5
    const def = (800 + 720) / (800 + 720 + 8 * 100 + 792)
    const base = 2000 * hitMultiplier(line, 10) / 100 * (1 + (40 + 30) / 100) * crit * def * 0.9
    const one = setup('encore', 'Energetic Welcome Damage')
    expect(rotationDamage(stats, one)).toBeCloseTo(base, 6)

    // RES below 0 counts half; DEF ignore; DMG Amplified; HP and DEF scalers
    expect(rotationDamage(stats, { ...one, enemy: { ...DEFAULT_ENEMY, resShred: 30 } })).toBeCloseTo(base / 0.9 * 1.1, 6)
    expect(rotationDamage(stats, { ...one, enemy: { ...DEFAULT_ENEMY, defIgnore: 50 } }))
      .toBeCloseTo(base / def * 1520 / (1520 + 1592 * 0.5), 6)
    expect(rotationDamage(stats, { ...one, enemy: { ...DEFAULT_ENEMY, amplify: 25 } })).toBeCloseTo(base * 1.25, 6)
    const cartethyia = setup('cartethyia', 'Blade of Howling Squall DMG')
    expect(rotationDamage(stats, cartethyia) / rotationDamage({ ...stats, hp: 30000 }, cartethyia)).toBeCloseTo(0.5, 6)
  })

  it('adds Echo Skill hits, with the element DMG Bonus only for an echo of the Resonator\'s element', () => {
    expect(echoSkillHits('nightmare-inferno-rider').map((hit) => hit.multiplier)).toEqual([405, 283.5])
    expect(echoSkillText('nightmare-inferno-rider')).toContain('405.00%')
    const echo = { id: 'nightmare-inferno-rider', counts: { '0': 1 } }
    const fusion: DamageSetup = {
      charId: 'changli',
      characterLevel: 90,
      rotation: { counts: {}, skillLevel: 10, echo },
      enemy: DEFAULT_ENEMY,
      element: 'fusionDmg',
    }
    const def = (800 + 720) / (800 + 720 + 8 * 100 + 792)
    expect(rotationDamage(stats, fusion)).toBeCloseTo(2000 * 4.05 * (1 + 40 / 100) * (1 + 0.6 * 1.5) * def * 0.9, 6)
    // An Electro Resonator with a Fusion echo gets no element DMG Bonus on it
    expect(rotationDamage(stats, { ...fusion, element: 'electroDmg' })).toBeCloseTo(2000 * 4.05 * (1 + 0.6 * 1.5) * def * 0.9, 6)
  })

  it('amplifies by kind of hit on top of the enemy card', () => {
    const one = setup('encore', 'Energetic Welcome Damage')
    const base = rotationDamage(stats, one)
    expect(rotationDamage(stats, { ...one, amplify: { skill: 20 } })).toBeCloseTo(base * 1.2, 6)
    expect(rotationDamage(stats, { ...one, amplify: { liberation: 20 } })).toBeCloseTo(base, 6)
    expect(rotationDamage(stats, { ...one, enemy: { ...DEFAULT_ENEMY, amplify: 10 }, amplify: { all: 15, skill: 5 } })).toBeCloseTo(base * 1.3, 6)
  })

  it('resolves kit effects with toggles and modes', () => {
    const hsin = resolveWuwaCombat('hsin', 0, {})
    // Unison's ATK on, Electro Flare's off by default
    expect(hsin.bonus).toEqual({ atkPct: 50 })
    expect(resolveWuwaCombat('hsin', 0, { 'hsin-tides-electro': 2 }).bonus).toEqual({ atkPct: 50, electroDmg: 50 })
    expect(resolveWuwaCombat('changli', 0, {}).defIgnore).toBe(15)
    expect(resolveWuwaCombat('cartethyia', 0, {}).amplify).toEqual({ all: 60 })
    expect(resolveWuwaCombat('cartethyia', 0, { 'cartethyia-imprint': 2 }).amplify).toEqual({ all: 30 })
  })

  it('keys lines by section and name, and turns old position keys into them', () => {
    expect(characterHits('hsin')[0].key).toBe('normal:Basic Attack - Answering Form Stage 1 DMG')
    expect(migrateRotationCounts('hsin', { 'normal:0': 3, 'skill:0': 1 })).toEqual({ 'normal:Basic Attack - Answering Form Stage 1 DMG': 3, 'skill:0': 1 })
  })

  it('reads what an echo gives in the main slot, leaving out conditional parts, and named Resonators\' parts for them only', () => {
    expect(mainEchoBonus('nightmare-inferno-rider')).toEqual({ stats: { fusionDmg: 12, skillDmg: 12 }, echoDmg: 0, coordinatedDmg: 0 })
    expect(mainEchoBonus('corrosaurus')).toEqual({ stats: { fusionDmg: 12 }, echoDmg: 20, coordinatedDmg: 0 })
    // "additionally gains 10% ... when inflicting Tune Strain" is conditional
    expect(mainEchoBonus('calamity-effigy').stats).toEqual({ aeroDmg: 10 })
    // Only for Aemeath; Adam Smasher's Crit Rate only for Lucy and Rebecca
    expect(mainEchoBonus('phantom-sigillum').stats).toEqual({})
    expect(mainEchoBonus('phantom-sigillum', 'aemeath').stats).toEqual({ libDmg: 25 })
    expect(mainEchoBonus('reminiscence-nightmare-adam-smasher', 'lucy').stats).toEqual({ critRate: 15 })
    expect(mainEchoBonus('reminiscence-nightmare-adam-smasher', 'hsin').stats).toEqual({})
    // Coordinated Attack DMG stays out of the stats
    expect(mainEchoBonus('hecate')).toEqual({ stats: {}, echoDmg: 0, coordinatedDmg: 40 })
    expect(mainEchoBonus(undefined)).toEqual({ stats: {}, echoDmg: 0, coordinatedDmg: 0 })
  })

  it('adds Coordinated Attack DMG to Coordinated Attack lines only', () => {
    const coordinated = hit('verina', 'Coordinated Attack DMG')
    const other = characterHits('verina').find((h) => h.section === 'liberation' && !h.label.includes('Coordinated'))!
    const one = (key: string): DamageSetup => ({
      charId: 'verina',
      characterLevel: 90,
      rotation: { counts: { [key]: 1 }, skillLevel: 10 },
      enemy: DEFAULT_ENEMY,
    })
    const base = rotationDamage(stats, one(coordinated.key))
    // Liberation DMG 20% + element 40%, then +40% Coordinated Attack DMG
    expect(rotationDamage(stats, { ...one(coordinated.key), coordinatedDmg: 40 }) / base).toBeCloseTo((1 + 1) / (1 + 0.6), 6)
    expect(rotationDamage(stats, { ...one(other.key), coordinatedDmg: 40 })).toBeCloseTo(rotationDamage(stats, one(other.key)), 6)
  })

  it('resolves the newer kits: amplify by kind, RES ignore and line boosts', () => {
    expect(resolveWuwaCombat('galbrena', 0, {}).amplify).toMatchObject({ basic: 20, liberation: 20 })
    expect(resolveWuwaCombat('galbrena', 0, {}).amplify.echo).toBeUndefined()
    expect(resolveWuwaCombat('lupa', 0, {}).resShred).toBe(15)
    expect(resolveWuwaCombat('lupa', 0, { 'lupa-glory': 1 }).resShred).toBe(6)
    expect(resolveWuwaCombat('lingyang', 0, {}).lineScale).toEqual([{ section: 'intro', scale: 0.5 }])
    expect(resolveWuwaCombat('xiangli-yao', 0, {}).bonus).toEqual({ electroDmg: 20 })
  })

  it('adds Echo Skill DMG Bonus to Echo Skill hits only, and raises some lines\' multipliers', () => {
    const echo = { id: 'nightmare-inferno-rider', counts: { '0': 1 } }
    const echoOnly: DamageSetup = {
      charId: 'changli',
      characterLevel: 90,
      rotation: { counts: {}, skillLevel: 10, echo },
      enemy: DEFAULT_ENEMY,
      element: 'fusionDmg',
    }
    expect(rotationDamage(stats, { ...echoOnly, typeBonus: { echo: 20 } }) / rotationDamage(stats, echoOnly)).toBeCloseTo(1.6 / 1.4, 6)

    // Jinhsi's Intro +50%
    const intro = characterHits('jinhsi').find((hit) => hit.section === 'intro')!
    const jinhsi: DamageSetup = { charId: 'jinhsi', characterLevel: 90, rotation: { counts: { [intro.key]: 1 }, skillLevel: 10 }, enemy: DEFAULT_ENEMY }
    const kit = resolveWuwaCombat('jinhsi', 0, {})
    expect(rotationDamage(stats, { ...jinhsi, lineScale: kit.lineScale }) / rotationDamage(stats, jinhsi)).toBeCloseTo(1.5, 6)

    // Suoming's Seal Master doubles Basic Attack - Unfurled Canopy lines, not her Dodge Counter
    const seal = resolveWuwaCombat('suoming', 0, { 'suoming-seal-master': true }).lineScale
    const stage1 = characterHits('suoming').find((hit) => hit.label === 'Basic Attack - Unfurled Canopy Stage 1 DMG')!
    const dodge = characterHits('suoming').find((hit) => hit.label === 'Dodge Counter - Unfurled Canopy DMG')!
    const one = (key: string): DamageSetup => ({
      charId: 'suoming',
      characterLevel: 90,
      rotation: { counts: { [key]: 1 }, skillLevel: 10 },
      enemy: DEFAULT_ENEMY,
    })
    expect(rotationDamage(stats, { ...one(stage1.key), lineScale: seal }) / rotationDamage(stats, one(stage1.key))).toBeCloseTo(2, 6)
    expect(rotationDamage(stats, { ...one(dodge.key), lineScale: seal })).toBeCloseTo(rotationDamage(stats, one(dodge.key)), 6)
  })
})
