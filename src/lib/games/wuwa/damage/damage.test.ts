import {
  characterHits,
  type DamageSetup,
  DEFAULT_ENEMY,
  defaultRotation,
  hasSkillData,
  hitMultiplier,
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
})
