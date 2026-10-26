import type { GenshinStatKey } from 'lib/games/genshin/types'

// Always-on character and weapon passives that show on the character screen, worked out after the other stats.
// Conditional passives (on hit, while on field, stacking) don't show and aren't here. Weapons with a flat always-on
// bonus (Aquila Favonia ATK%, Skyward Harp CRIT DMG...) come with the stat data instead (refinement bonuses).
// Confidence: 'confirmed' matched an in-game stat screen through Enka; 'sourced' is from the in-game description.
// Personal, non-commercial use.

export type ScreenStats = Partial<Record<GenshinStatKey, number>> & { baseAtk: number }

export type ScreenPassive = {
  confidence: 'confirmed' | 'sourced' | 'unverified',
  // Bonuses to add, given the stats so far and the weapon's refinement (1-5)
  apply: (stats: ScreenStats, refinement: number) => Partial<Record<GenshinStatKey, number>>,
}

const ELEMENT_DMG: GenshinStatKey[] = ['pyroDmg', 'hydroDmg', 'anemoDmg', 'electroDmg', 'dendroDmg', 'cryoDmg', 'geoDmg']
const byRefinement = (r1: number, step: number, refinement: number) => r1 + step * (refinement - 1)
const overEr = (stats: ScreenStats) => Math.max(0, (stats.energyRecharge ?? 100) - 100)

// "Gain 12% All Elemental DMG Bonus", 15/18/21/24% at higher refinements
const allElemental: ScreenPassive = {
  confidence: 'sourced',
  apply: (_, r) => Object.fromEntries(ELEMENT_DMG.map((stat) => [stat, byRefinement(12, 3, r)])),
}

// By GOOD character key
export const CHARACTER_SCREEN_PASSIVES: Record<string, ScreenPassive> = {
  // Enlightened One: 0.4% Electro DMG Bonus per 1% Energy Recharge above 100%
  RaidenShogun: { confidence: 'confirmed', apply: (s) => ({ electroDmg: overEr(s) * 0.4 }) },
  // Waterborne Destiny: Hydro DMG Bonus of 20% of Energy Recharge
  Mona: { confidence: 'sourced', apply: (s) => ({ hydroDmg: (s.energyRecharge ?? 100) * 0.2 }) },
  // Flawless Strategy: CRIT Rate -100%, Healing Bonus +25%
  SangonomiyaKokomi: { confidence: 'sourced', apply: () => ({ critRate: -100, healingBonus: 25 }) },
}

// By GOOD weapon key
export const WEAPON_SCREEN_PASSIVES: Record<string, ScreenPassive> = {
  // ATK of 28% of Energy Recharge above 100% (max 80%), as a percent of base ATK
  EngulfingLightning: {
    confidence: 'confirmed',
    apply: (s, r) => ({ atk: s.baseAtk * Math.min(overEr(s) * byRefinement(28, 7, r) / 100, byRefinement(80, 10, r)) / 100 }),
  },
  // ATK bonus of 1.2% of Max HP
  PrimordialJadeCutter: { confidence: 'sourced', apply: (s, r) => ({ atk: (s.hp ?? 0) * byRefinement(1.2, 0.3, r) / 100 }) },
  // ATK bonus of 0.8% of Max HP
  StaffOfHoma: { confidence: 'sourced', apply: (s, r) => ({ atk: (s.hp ?? 0) * byRefinement(0.8, 0.2, r) / 100 }) },
  MistsplitterReforged: allElemental,
  SkywardAtlas: allElemental,
  CalamityQueller: allElemental,
  HaranGeppakuFutsu: allElemental,
  HuntersPath: allElemental,
}
