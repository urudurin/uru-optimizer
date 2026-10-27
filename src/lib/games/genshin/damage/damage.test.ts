import {
  boostedTalents,
  characterHits,
  type DamageSetup,
  DEFAULT_ENEMY,
  defaultRotation,
  hitMultiplier,
  NO_DEBUFFS,
  polestarDmgBonus,
  polestarMultiplier,
  reactionLevelMultiplier,
  reactionsFor,
  rotationDamage,
  teamReactions,
  transformativeLines,
} from 'lib/games/genshin/damage/damage'
import type {
  GenshinCharacter,
  GenshinStatKey,
} from 'lib/games/genshin/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const character = (id: string, parts: Partial<GenshinCharacter> = {}): GenshinCharacter => ({
  id,
  name: id,
  level: 90,
  ascension: 6,
  constellation: 0,
  talents: { auto: 9, skill: 9, burst: 9 },
  artifactIds: {},
  stats: {},
  statsDate: '',
  ...parts,
})

const LEVEL_9 = { auto: 9, skill: 9, burst: 9 }
const stats: Partial<Record<GenshinStatKey, number>> = {
  atk: 2000,
  hp: 30000,
  elementalMastery: 200,
  critRate: 60,
  critDmg: 150,
  pyroDmg: 46.6,
  physicalDmg: 20,
}

const hit = (id: string, label: string) => characterHits(id).find((h) => h.label === label)!

// One hit of Xiangling's Guoba (skill) through the whole formula, against the default enemy
function setup(parts: Partial<DamageSetup> = {}): DamageSetup {
  return {
    characterId: 'Xiangling',
    characterLevel: 90,
    element: 'Pyro',
    rotation: { counts: { [hit('Xiangling', 'Flame DMG').key]: 1 }, infusion: false, reaction: 'none', reactionShare: 100 },
    talents: LEVEL_9,
    enemy: DEFAULT_ENEMY,
    debuffs: NO_DEBUFFS,
    ...parts,
  }
}

describe('Genshin damage', () => {
  it('reads talent multipliers by level, with every scaling term', () => {
    expect(hitMultiplier(hit('Xiangling', 'Flame DMG'), LEVEL_9).atk).toBeCloseTo(189.176, 3)
    // Nahida's Tri-Karma Purification scales on ATK and Elemental Mastery
    expect(hitMultiplier(hit('Nahida', 'Tri-Karma Purification DMG'), LEVEL_9)).toEqual({
      atk: expect.closeTo(175.44, 2),
      elementalMastery: expect.closeTo(350.88, 2),
    })
    expect(hitMultiplier(hit('Neuvillette', 'Charged Attack: Equitable Judgment'), LEVEL_9).hp).toBeGreaterThan(0)
    // Xiangling's 4th normal attack lands 4 times
    expect(hit('Xiangling', '4-Hit DMG ×4').physical).toBe(true)
    // Catalyst normal attacks are elemental
    expect(hit('Nahida', '1-Hit DMG').physical).toBe(false)
  })

  it('adds 3 talent levels at C3 and C5 to the right talents', () => {
    // Furina's C3 raises her Burst, C5 her Skill
    expect(boostedTalents(character('Furina', { constellation: 3 }))).toEqual({ auto: 9, skill: 9, burst: 12 })
    expect(boostedTalents(character('Furina', { constellation: 5 }))).toEqual({ auto: 9, skill: 12, burst: 12 })
    expect(Object.keys(defaultRotation('Furina').counts).every((key) => !key.startsWith('auto'))).toBe(true)
  })

  it('multiplies every factor like genshin-optimizer\'s formula', () => {
    const crit = 1 + 0.6 * 1.5
    const def = 190 / (190 + 200)
    const base = 2000 * 1.89176 * 1.466 * crit * def * 0.9
    expect(rotationDamage(stats, setup())).toBeCloseTo(base, 6)

    // RES below 0 counts half; DEF shred; Vaporize with Elemental Mastery, on half the hits
    expect(rotationDamage(stats, setup({ debuffs: { defShred: 0, resShred: { Pyro: 40 } } }))).toBeCloseTo(base / 0.9 * 1.15, 6)
    expect(rotationDamage(stats, setup({ debuffs: { defShred: 30, resShred: {} } }))).toBeCloseTo(base / def * 190 / (190 + 200 * 0.7), 6)
    const vaporize = 1.5 * (1 + 2.78 * 200 / 1600)
    const reacting = setup({ rotation: { ...setup().rotation, reaction: 'vaporize', reactionShare: 50 } })
    expect(rotationDamage(stats, reacting)).toBeCloseTo(base * (1 + 0.5 * (vaporize - 1)), 6)
  })

  it('deals physical hits with the Physical DMG Bonus unless infused', () => {
    const normal = hit('Xiangling', '1-Hit DMG')
    const rotation = { counts: { [normal.key]: 1 }, infusion: false, reaction: 'none' as const, reactionShare: 100 }
    const physical = rotationDamage(stats, setup({ rotation }))
    const infused = rotationDamage(stats, setup({ rotation: { ...rotation, infusion: true } }))
    expect(infused / physical).toBeCloseTo(1.466 / 1.2, 6)
    // Physical hits don't vaporize
    expect(rotationDamage(stats, setup({ rotation: { ...rotation, reaction: 'vaporize' } }))).toBeCloseTo(physical, 6)
  })

  it('adds Aggravate and Spread as flat damage on each reacting hit, before the DMG Bonus and CRIT', () => {
    expect(reactionLevelMultiplier(90)).toBeCloseTo(1446.8535, 4)
    expect(reactionsFor('Electro')).toEqual(['aggravate'])
    expect(reactionsFor('Dendro')).toEqual(['spread'])
    expect(reactionsFor('Pyro')).toEqual(['vaporize', 'melt'])

    // Nahida's Tri-Karma once, against the default enemy, with and without Spread on half the hits
    const tkp = hit('Nahida', 'Tri-Karma Purification DMG')
    const nahida = { ...stats, dendroDmg: 46.6, pyroDmg: 0 }
    const rotation = { counts: { [tkp.key]: 2 }, infusion: false, reaction: 'none' as const, reactionShare: 50 }
    const base: DamageSetup = { ...setup(), characterId: 'Nahida', element: 'Dendro', rotation }
    const plain = rotationDamage(nahida, base)
    const spread = rotationDamage(nahida, { ...base, rotation: { ...rotation, reaction: 'spread' } })
    const flat = 1.25 * 1446.8535 * (1 + 5 * 200 / 1400)
    const perPoint = plain / (2 * (2000 * 1.7544 + 200 * 3.5088))
    expect(spread - plain).toBeCloseTo(perPoint * 0.5 * 2 * flat, 0)
  })

  it('counts a line that lands several times once per hit for Aggravate and Spread', () => {
    expect(hit('Xiangling', '4-Hit DMG ×4').times).toBe(4)
    expect(hit('Xiangling', '1-Hit DMG').times).toBe(1)
  })

  it('works out transformative reactions from Elemental Mastery, level and RES, without DEF or CRIT', () => {
    expect(transformativeLines('Anemo').map((line) => line.key)).toEqual([
      'reaction:swirl:Pyro',
      'reaction:swirl:Hydro',
      'reaction:swirl:Electro',
      'reaction:swirl:Cryo',
      'reaction:stellarswirl',
      'reaction:stellarvortex1',
      'reaction:stellarvortex2',
    ])
    expect(transformativeLines('Electro').map((line) => line.reaction)).toEqual(['overloaded', 'electrocharged', 'superconduct', 'hyperbloom', 'lunarcharged'])
    // Lunar and Stellar lines only when the team can trigger them
    expect(transformativeLines('Electro', []).map((line) => line.reaction)).not.toContain('lunarcharged')
    expect(transformativeLines('Anemo', teamReactions(['KaedeharaKazuha'])).map((line) => line.reaction)).toEqual(['swirl', 'swirl', 'swirl', 'swirl'])
    expect(transformativeLines('Anemo', teamReactions(['KaedeharaKazuha', 'Sandrone'])).map((line) => line.reaction)).toContain('stellarvortex2')

    const nahida = { ...stats, elementalMastery: 800 }
    const rotation = { counts: { 'reaction:bloom': 3 }, infusion: false, reaction: 'none' as const, reactionShare: 100 }
    const bloom: DamageSetup = { ...setup(), characterId: 'Nahida', element: 'Dendro', rotation }
    const expected = 3 * 2 * 1446.8535 * (1 + 16 * 800 / 2800) * 0.9
    expect(rotationDamage(nahida, bloom)).toBeCloseTo(expected, 3)
    // CRIT and ATK don't change it; VV-style shred on the swirled element does
    expect(rotationDamage({ ...nahida, critDmg: 300, atk: 9999 }, bloom)).toBeCloseTo(expected, 3)
    const swirl: DamageSetup = { ...setup(), characterId: 'KaedeharaKazuha', element: 'Anemo', rotation: { ...rotation, counts: { 'reaction:swirl:Pyro': 1 } } }
    const shredded = rotationDamage(stats, { ...swirl, debuffs: { defShred: 0, resShred: { Pyro: 40 } } })
    expect(shredded / rotationDamage(stats, swirl)).toBeCloseTo(1.15 / 0.9, 6)
  })

  it('works out Lunar and Stellar damage: no DEF or DMG Bonus, the smaller EM bracket, and CRIT', () => {
    const crit = 1 + 0.6 * 1.5
    const em = 6 * 200 / 2200
    // Lunar-Charged as a reaction: 1.8 x level multiplier, Electro RES
    const lunar: DamageSetup = {
      ...setup(),
      characterId: 'Flins',
      element: 'Electro',
      rotation: { counts: { 'reaction:lunarcharged': 2 }, infusion: false, reaction: 'none', reactionShare: 100 },
    }
    // Flins's own passive: Lunar-Charged Base DMG +0.7% per 100 ATK, capped at 14% (2,000 ATK)
    expect(rotationDamage(stats, lunar)).toBeCloseTo(2 * 1.8 * 1446.8535 * 1.14 * (1 + em) * crit * 0.9, 3)
    expect(rotationDamage({ ...stats, electroDmg: 99 }, lunar)).toBeCloseTo(rotationDamage(stats, lunar), 6)

    // Flins's Burst line deals Lunar-Charged directly: ATK x multiplier x 3
    const final = hit('Flins', 'Final Phase Lunar-Charged DMG')
    expect(final.special).toBe('lunarcharged')
    const direct: DamageSetup = { ...lunar, rotation: { ...lunar.rotation, counts: { [final.key]: 1 } } }
    const multiplier = final.terms[0][1][8] / 100
    expect(rotationDamage(stats, direct)).toBeCloseTo(2000 * multiplier * 3 * 1.14 * (1 + em) * crit * 0.9, 3)
    // A teammate's bigger base increase wins over the character's own
    expect(rotationDamage(stats, { ...direct, baseBonus: { lunarcharged: 20 } }) / rotationDamage(stats, direct)).toBeCloseTo(1.2 / 1.14, 6)
    // Set bonuses for the kind add inside the EM bracket
    expect(rotationDamage(stats, { ...direct, reactionBonus: { lunarcharged: 20 } }) / rotationDamage(stats, direct)).toBeCloseTo((1.2 + em) / (1 + em), 6)

    // Stellar lines are found by name too
    const sandrone = hit('Sandrone', 'Prism Shot Stellar-Conduct DMG')
    expect(sandrone.special).toBe('stellarconduct')
  })

  it('knows who enables Lunar and Stellar reactions', () => {
    expect(teamReactions(['Flins'])).toEqual(['lunarcharged'])
    expect(teamReactions(['Ineffa', 'Lauma']).sort()).toEqual(['lunarbloom', 'lunarcharged'])
    expect(teamReactions(['Sandrone']).sort()).toEqual(['stellarconduct', 'stellarswirl'])
    expect(teamReactions(['Xiangling', 'Bennett'])).toEqual([])
  })

  it('scales Stellar-Conduct with the Polestar Field and gives Cryo and Electro DMG inside it', () => {
    expect(polestarMultiplier(0)).toBe(1)
    expect(polestarMultiplier(1)).toBeCloseTo(1.45, 6)
    expect(polestarMultiplier(12)).toBeCloseTo(2, 6)
    expect(polestarDmgBonus(0)).toBe(20)
    expect(polestarDmgBonus(12)).toBe(40)

    const conduct = hit('Sandrone', 'Prism Shot Stellar-Conduct DMG')
    const base: DamageSetup = {
      ...setup(),
      characterId: 'Sandrone',
      element: 'Electro',
      rotation: { counts: { [conduct.key]: 1 }, infusion: false, reaction: 'none', reactionShare: 100 },
      teamReactions: ['stellarconduct', 'stellarswirl'],
    }
    const outside = rotationDamage(stats, base)
    const field = { ...base, rotation: { ...base.rotation, polestar: { active: true, hits: 6 } } }
    expect(rotationDamage(stats, field) / outside).toBeCloseTo(1.7, 6)
    // Without someone to make the field, it doesn't count
    expect(rotationDamage(stats, { ...field, teamReactions: [] })).toBeCloseTo(outside, 6)

    // A regular Electro hit gets the field's DMG Bonus: 34% at 6 hits
    const normal = hit('Sandrone', '1-Hit DMG')
    if (!normal) return
    const plain: DamageSetup = { ...base, rotation: { ...base.rotation, counts: { [normal.key]: 1 }, infusion: true } }
    const inField = { ...plain, rotation: { ...plain.rotation, polestar: { active: true, hits: 6 } } }
    expect(rotationDamage(stats, inField) / rotationDamage(stats, plain)).toBeCloseTo(1.34, 6)
  })
})
