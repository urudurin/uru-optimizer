import talentData from 'lib/games/genshin/data/generated/talents.json'
import {
  type Element,
  ELEMENT_DMG_STAT,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'

// Genshin damage, after genshin-optimizer's formula (https://github.com/frzyc/genshin-optimizer, MIT, Copyright (c) 2020
// frzyc). One hit is
//   (multiplier x scaling stat, summed over its terms) x (1 + DMG Bonus) x CRIT (average) x DEF x RES x amplifying
// with
//   DEF = (character level + 100) / ((character level + 100) + (enemy level + 100) x (1 - DEF shred))
//   RES = 1 - res / 2 below 0, 1 - res below 75%, 1 / (4 res + 1) above
//   amplifying (Vaporize, Melt) = reaction multiplier x (1 + 2.78 EM / (EM + 1400)), on the share of hits that react
// Aggravate and Spread add flat damage to each hit that triggers them, before the DMG Bonus, CRIT, DEF and RES:
//   1.15 (Aggravate) or 1.25 (Spread) x level multiplier x (1 + 5 EM / (EM + 1200))
// as genshin-optimizer's formula/src/data/common/reaction.ts has it (its transLvlMultis table, 1446.85 at level 90),
// checked against the KQM library's Additive and Amplifying Reactions pages (library.keqingmains.com).
// The DMG Bonus is the hit's element's (Physical or the character's) plus all-element DMG Bonus. Talent multipliers
// come from data/generated/talents.json (src/scripts/genshin/extractTalents.mjs).
//
// A rotation is a count of each talent hit. Every hit of one element shares the multipliers after the first bracket, so
// the rotation's damage is, per element and scaling stat, the sum of count x multiplier, times that stat, times the rest.
// Not yet: transformative reactions (Bloom, Hyperbloom, Burgeon...), self-buffs from the character's own
// kit (Hu Tao's ATK from HP, Raiden's Resolve), skill-type DMG Bonuses and hits that only some of a talent's levels have.
// Personal, non-commercial use.

export type ScalingStat = 'atk' | 'hp' | 'def' | 'elementalMastery'
export type Talent = 'auto' | 'skill' | 'burst'
export type TalentLevels = Record<Talent, number>

export type TalentHit = {
  key: string,
  label: string,
  talent: Talent,
  category: 'normal' | 'charged' | 'plunging' | 'skill' | 'burst',
  // [scaling stat, percent at talent levels 1-15]
  terms: [ScalingStat, number[]][],
  // A plain normal, charged or plunging attack: Physical unless the character is a catalyst user or infused
  physical: boolean,
}

type TalentFile = {
  characters: Record<string, {
    c3: 'skill' | 'burst',
    catalyst?: boolean,
    hits: { label: string, talent: string, category: string, terms: (string | number[])[][], physical?: boolean }[],
  }>,
}
const DATA = (talentData as unknown as TalentFile).characters

export type EnemySettings = {
  level: number,
  // Percent, the same for every element
  res: number,
}

// genshin-optimizer's default enemy
export const DEFAULT_ENEMY: EnemySettings = { level: 100, res: 10 }

export type DamageElement = Element | 'Physical'

// What the team does to the enemy (team/teamBuffs.ts), in percent
export type EnemyDebuffs = {
  defShred: number,
  // By element, plus 'all' for every element (Zhongli)
  resShred: Partial<Record<DamageElement | 'all', number>>,
}

export const NO_DEBUFFS: EnemyDebuffs = { defShred: 0, resShred: {} }

export type Reaction = 'none' | 'vaporize' | 'melt' | 'aggravate' | 'spread'

export type Rotation = {
  // Times each hit lands, by hit key
  counts: Record<string, number>,
  // Talent levels with constellation boosts; missing means the character's own
  talents?: TalentLevels,
  // Normal, charged and plunging attacks deal the character's element (an infusion such as Hu Tao's skill)
  infusion: boolean,
  reaction: Reaction,
  // Percent of the character's elemental hits that trigger the reaction
  reactionShare: number,
}

export type DamageSetup = {
  characterId: string,
  characterLevel: number,
  element?: Element,
  rotation: Rotation,
  talents: TalentLevels,
  enemy: EnemySettings,
  debuffs: EnemyDebuffs,
}

function characterData(characterId: string) {
  return DATA[characterId]
}

export function hasTalentData(characterId: string): boolean {
  return characterData(characterId) !== undefined
}

export function characterHits(characterId: string): TalentHit[] {
  const data = characterData(characterId)
  if (!data) return []
  return data.hits.map((hit, i) => ({
    key: `${hit.talent}:${i}`,
    label: hit.label,
    talent: hit.talent as Talent,
    category: hit.category as TalentHit['category'],
    terms: hit.terms as [ScalingStat, number[]][],
    physical: !!hit.physical && !data.catalyst,
  }))
}

// Talent levels with the constellations that add 3 levels (C3 to one of skill and burst, C5 to the other)
export function boostedTalents(character: GenshinCharacter): TalentLevels {
  const base = character.talents ?? { auto: 9, skill: 9, burst: 9 }
  const c3 = characterData(character.id)?.c3 ?? 'skill'
  const c5 = c3 === 'skill' ? 'burst' : 'skill'
  const boost = (talent: Talent) => (character.constellation >= 3 && talent === c3) || (character.constellation >= 5 && talent === c5) ? 3 : 0
  return {
    auto: Math.min(15, base.auto),
    skill: Math.min(15, base.skill + boost('skill')),
    burst: Math.min(15, base.burst + boost('burst')),
  }
}

export function rotationTalents(character: GenshinCharacter, rotation: Rotation): TalentLevels {
  return rotation.talents ?? boostedTalents(character)
}

// Every Elemental Skill and Burst hit once
export function defaultRotation(characterId: string): Rotation {
  const counts: Record<string, number> = {}
  for (const hit of characterHits(characterId)) if (hit.talent !== 'auto') counts[hit.key] = 1
  return { counts, infusion: false, reaction: 'none', reactionShare: 100 }
}

export function hitMultiplier(hit: TalentHit, levels: TalentLevels): Partial<Record<ScalingStat, number>> {
  const level = Math.max(1, Math.min(15, levels[hit.talent]))
  const result: Partial<Record<ScalingStat, number>> = {}
  for (const [stat, values] of hit.terms) result[stat] = (result[stat] ?? 0) + (values[level - 1] ?? 0)
  return result
}

// "176% ATK + 352% EM"
export function describeMultiplier(multiplier: Partial<Record<ScalingStat, number>>): string {
  const names: Record<ScalingStat, string> = { atk: 'ATK', hp: 'HP', def: 'DEF', elementalMastery: 'EM' }
  return (Object.entries(multiplier) as [ScalingStat, number][]).map(([stat, value]) => `${value.toFixed(1)}% ${names[stat]}`).join(' + ')
}

export const AMPLIFYING: Record<'vaporize' | 'melt', Partial<Record<Element, number>>> = {
  vaporize: { Pyro: 1.5, Hydro: 2 },
  melt: { Pyro: 2, Cryo: 1.5 },
}

// Aggravate and Spread: the element that triggers them and their reaction multiplier
export const CATALYZE: Record<'aggravate' | 'spread', Partial<Record<Element, number>>> = {
  aggravate: { Electro: 1.15 },
  spread: { Dendro: 1.25 },
}

const REACTION_TABLES = { ...AMPLIFYING, ...CATALYZE }

export function reactionsFor(element: Element | undefined): Reaction[] {
  return (['vaporize', 'melt', 'aggravate', 'spread'] as const).filter((reaction) => element && REACTION_TABLES[reaction][element])
}

// genshin-optimizer's transLvlMultis (the game's level multiplier for reactions), by character level 1-90
const REACTION_LEVEL_MULTIPLIER = [
  Number.NaN,
  17.165606,
  18.535048,
  19.904854,
  21.274902,
  22.6454,
  24.649612,
  26.640642,
  28.868587,
  31.36768,
  34.143345,
  37.201,
  40.66,
  44.446667,
  48.56352,
  53.74848,
  59.081898,
  64.420044,
  69.72446,
  75.12314,
  80.58478,
  86.11203,
  91.70374,
  97.24463,
  102.812645,
  108.40956,
  113.20169,
  118.102905,
  122.97932,
  129.72733,
  136.29291,
  142.67085,
  149.02902,
  155.41699,
  161.8255,
  169.10631,
  176.51808,
  184.07274,
  191.70952,
  199.55692,
  207.38205,
  215.3989,
  224.16566,
  233.50217,
  243.35057,
  256.06308,
  268.5435,
  281.52606,
  295.01364,
  309.0672,
  323.6016,
  336.75754,
  350.5303,
  364.4827,
  378.61917,
  398.6004,
  416.39825,
  434.387,
  452.95105,
  472.60623,
  492.8849,
  513.56854,
  539.1032,
  565.51056,
  592.53876,
  624.4434,
  651.47015,
  679.4968,
  707.79407,
  736.67145,
  765.64026,
  794.7734,
  824.67737,
  851.1578,
  877.74207,
  914.2291,
  946.74677,
  979.4114,
  1011.223,
  1044.7917,
  1077.4437,
  1109.9976,
  1142.9766,
  1176.3695,
  1210.1844,
  1253.8357,
  1288.9528,
  1325.4841,
  1363.4569,
  1405.0974,
  1446.8535,
]

export function reactionLevelMultiplier(level: number): number {
  return REACTION_LEVEL_MULTIPLIER[Math.max(1, Math.min(90, Math.round(level)))]
}

// Per element: the summed multipliers (percent) of each scaling stat over the whole rotation
// catalyze: Aggravate or Spread's flat damage per reacting hit before Elemental Mastery; hits: how many hits the group has
type ElementTerms = {
  element: DamageElement,
  terms: [ScalingStat, number][],
  dmgStat?: GenshinStatKey,
  res: number,
  amplifies: number,
  catalyze: number,
  hits: number,
}

export type PreparedDamage = { groups: ElementTerms[], def: number, reactionShare: number }

function resMultiplier(res: number): number {
  if (res < 0) return 1 - res / 2
  if (res < 0.75) return 1 - res
  return 1 / (4 * res + 1)
}

// Everything that's the same for every build, worked out once
export function prepareDamage(setup: DamageSetup): PreparedDamage {
  const { rotation, enemy, debuffs, element } = setup
  const byElement = new Map<DamageElement, Map<ScalingStat, number>>()
  // Hits per element, for Aggravate and Spread's flat damage on each (a line landing several times counts once)
  const hitCounts = new Map<DamageElement, number>()
  for (const hit of characterHits(setup.characterId)) {
    const count = rotation.counts[hit.key] ?? 0
    if (count <= 0) continue
    const hitElement: DamageElement = hit.physical && !rotation.infusion ? 'Physical' : (element ?? 'Physical')
    const terms = byElement.get(hitElement) ?? new Map<ScalingStat, number>()
    for (const [stat, value] of Object.entries(hitMultiplier(hit, setup.talents)) as [ScalingStat, number][]) {
      terms.set(stat, (terms.get(stat) ?? 0) + count * value)
    }
    byElement.set(hitElement, terms)
    hitCounts.set(hitElement, (hitCounts.get(hitElement) ?? 0) + count)
  }
  const groups = [...byElement].map(([hitElement, terms]): ElementTerms => {
    const shred = (debuffs.resShred[hitElement] ?? 0) + (debuffs.resShred.all ?? 0)
    const reacts = hitElement !== 'Physical'
    const amplifies = reacts && (rotation.reaction === 'vaporize' || rotation.reaction === 'melt') ? AMPLIFYING[rotation.reaction][hitElement] ?? 0 : 0
    const catalyzeMultiplier = reacts && (rotation.reaction === 'aggravate' || rotation.reaction === 'spread')
      ? CATALYZE[rotation.reaction][hitElement] ?? 0
      : 0
    return {
      element: hitElement,
      terms: [...terms],
      dmgStat: hitElement === 'Physical' ? 'physicalDmg' : ELEMENT_DMG_STAT[hitElement],
      res: resMultiplier((enemy.res - shred) / 100),
      amplifies,
      catalyze: catalyzeMultiplier * reactionLevelMultiplier(setup.characterLevel),
      hits: hitCounts.get(hitElement) ?? 0,
    }
  })
  const characterFactor = setup.characterLevel + 100
  const def = characterFactor / (characterFactor + (enemy.level + 100) * Math.max(0, 1 - debuffs.defShred / 100))
  return { groups, def, reactionShare: Math.max(0, Math.min(100, rotation.reactionShare)) / 100 }
}

// The rotation's damage from final stats; get reads a stat (a record or the optimizer's vectors)
export function preparedDamage(prepared: PreparedDamage, get: (stat: GenshinStatKey) => number): number {
  const crit = 1 + Math.min(Math.max(get('critRate'), 0), 100) / 100 * get('critDmg') / 100
  const allDmg = get('allDmg')
  let total = 0
  for (const group of prepared.groups) {
    let base = 0
    for (const [stat, multiplier] of group.terms) base += multiplier / 100 * get(stat)
    if (group.catalyze > 0) {
      const em = get('elementalMastery')
      base += prepared.reactionShare * group.hits * group.catalyze * (1 + 5 * em / (em + 1200))
    }
    let amplify = 1
    if (group.amplifies > 0) {
      const em = get('elementalMastery')
      amplify = 1 + prepared.reactionShare * (group.amplifies * (1 + 2.78 * em / (em + 1400)) - 1)
    }
    total += base * (1 + ((group.dmgStat ? get(group.dmgStat) : 0) + allDmg) / 100) * group.res * amplify
  }
  return total * crit * prepared.def
}

export function rotationDamage(stats: Partial<Record<GenshinStatKey, number>>, setup: DamageSetup): number {
  return preparedDamage(prepareDamage(setup), (stat) => stats[stat] ?? 0)
}
