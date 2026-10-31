import type { ReactionBonusKey } from 'lib/games/genshin/damage/combatEffects'
import talentData from 'lib/games/genshin/data/generated/talents.json'
import {
  type Element,
  ELEMENT_DMG_STAT,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'
import type { DamageLine } from 'lib/games/shared/damageBreakdown'

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
// The DMG Bonus is the hit's element's (Physical or the character's) plus all-element DMG Bonus plus its kind's
// (Normal, Charged, Plunging Attack, Elemental Skill or Burst DMG Bonus). Reaction DMG bonuses (Crimson Witch...) add
// inside each reaction's Elemental Mastery bracket. Talent multipliers
// come from data/generated/talents.json (src/scripts/genshin/extractTalents.mjs).
//
// A rotation is a count of each talent hit. Every hit of one element shares the multipliers after the first bracket, so
// the rotation's damage is, per element and scaling stat, the sum of count x multiplier, times that stat, times the rest.
// Transformative reactions (Bloom, Hyperbloom, Swirl, Overloaded...) are counted as triggers, each
//   reaction multiplier x level multiplier x (1 + 16 EM / (EM + 2000)) x RES of the reaction's element
// with no DEF and no CRIT, after genshin-optimizer's reaction.ts (transInfo multipliers, transBase).
// Lunar and Stellar damage (Lunar-Charged, Lunar-Bloom, Lunar-Crystallize, Stellar-Conduct, Stellar Swirl) follows
// genshin-optimizer's wr/src/reaction/special.ts: no DEF and no DMG Bonus, but it can CRIT:
//   multiplier x (stat, or the level multiplier for a reaction) x reaction factor x (1 + 6 EM / (EM + 2000) + bonus)
//   x CRIT x RES
// Talent lines named Lunar-... or Stellar... deal it directly (factor 3 Lunar-Charged, 1 Lunar-Bloom, 1.6
// Lunar-Crystallize, 1 Stellar); Lunar-Charged (1.8) and Stellar Swirl (0.75) are also reactions with rotation lines.
// Teammates can add flat damage to each Lunar or Stellar hit (genshin-optimizer's <kind>_dmgInc: Lauma's Pale Hymn,
// Linnea, Illuga), after the Base DMG increase and before the EM bracket, and CRIT for one kind only (Nahida C2, Lauma).
// Stellar Swirl contribution (KQM's Stellar Glimmer guide, the user's link): each contributing character's damage is
// ranked, the highest counts in full, the second at 1/2 and the rest at 1/12. The rotation counts the character's own
// share at their rank against the teammates who can trigger it (Anemo and Cryo), compared by level multiplier, EM bracket
// and CRIT (DamageSetup.stellarContributors). Personal, non-commercial use.

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
  // Times the line lands ("4-Hit DMG ×4"), for reactions that apply per hit
  times: number,
  // Lunar or Stellar damage instead of a standard hit, from the line's name
  special?: SpecialKind,
}

// Lunar and Stellar damage dealt directly by talents: the reaction it counts as, its factor and the RES it uses
export type SpecialKind = 'lunarcharged' | 'lunarbloom' | 'lunarcrystallize' | 'stellarconduct' | 'stellarswirl'
const SPECIAL: Record<SpecialKind, { pattern: RegExp, factor: number, resist?: DamageElement }> = {
  lunarcharged: { pattern: /Lunar-Charged/, factor: 3, resist: 'Electro' },
  lunarbloom: { pattern: /Lunar-Bloom/, factor: 1, resist: 'Dendro' },
  lunarcrystallize: { pattern: /Lunar-Crystallize/, factor: 1.6, resist: 'Geo' },
  // Stellar damage uses the character's own element's RES
  stellarconduct: { pattern: /Stellar-Conduct/, factor: 1 },
  stellarswirl: { pattern: /Stellar Swirl/, factor: 1 },
}

// The characters whose passive (Moonsign Benediction, Stellar Jubilee) turns reactions into Lunar or Stellar ones, and
// the Base DMG increase they give those reactions from their own stat, in percent per point, up to a cap. From the
// in-game passive descriptions the user pasted. The Lunar seven also raise the party's Moonsign level by one each
export type Benediction = { kinds: SpecialKind[], stat: GenshinStatKey, perPoint: number, cap: number }
const LUNAR_ALL: SpecialKind[] = ['lunarcharged', 'lunarbloom', 'lunarcrystallize']
const STELLAR_BOTH: SpecialKind[] = ['stellarconduct', 'stellarswirl']
export const BENEDICTIONS: Record<string, Benediction> = {
  Ineffa: { kinds: ['lunarcharged'], stat: 'atk', perPoint: 0.007, cap: 14 },
  Flins: { kinds: ['lunarcharged'], stat: 'atk', perPoint: 0.007, cap: 14 },
  Nefer: { kinds: ['lunarbloom'], stat: 'elementalMastery', perPoint: 0.0175, cap: 14 },
  Lauma: { kinds: ['lunarbloom'], stat: 'elementalMastery', perPoint: 0.0175, cap: 14 },
  Linnea: { kinds: ['lunarcrystallize'], stat: 'def', perPoint: 0.007, cap: 14 },
  Zibai: { kinds: ['lunarcrystallize'], stat: 'def', perPoint: 0.007, cap: 14 },
  Columbina: { kinds: LUNAR_ALL, stat: 'hp', perPoint: 0.0002, cap: 7 },
  Sandrone: { kinds: STELLAR_BOTH, stat: 'atk', perPoint: 0.007, cap: 14 },
  Odette: { kinds: STELLAR_BOTH, stat: 'atk', perPoint: 0.007, cap: 14 },
  TravelerCryo: { kinds: STELLAR_BOTH, stat: 'atk', perPoint: 0.0035, cap: 7 },
  Vesna: { kinds: ['stellarswirl'], stat: 'atk', perPoint: 0.007, cap: 14 },
}

export function benedictionValue(benediction: Benediction, stats: Partial<Record<GenshinStatKey, number>>): number {
  return Math.min(benediction.cap, (stats[benediction.stat] ?? 0) * benediction.perPoint)
}

// The Lunar and Stellar kinds a team (character ids, the receiver included) can trigger
export function teamReactions(ids: string[]): SpecialKind[] {
  return [...new Set(ids.flatMap((id) => BENEDICTIONS[id]?.kinds ?? []))]
}

// The party's Moonsign level: one per Lunar character (1 Nascent Gleam, 2+ Ascendant Gleam)
export function moonsignLevel(ids: string[]): number {
  return ids.filter((id) => BENEDICTIONS[id]?.kinds.some((kind) => kind.startsWith('lunar'))).length
}

// Stellar-Conduct's Polestar Field by its recorded hits (0-12, KQM): the multiplier on Stellar-Conduct damage and the
// Cryo and Electro DMG Bonus it gives characters inside it
export function polestarMultiplier(hits: number): number {
  const n = Math.max(0, Math.min(12, Math.round(hits)))
  return n === 0 ? 1 : 1.4 + 0.05 * n
}
export function polestarDmgBonus(hits: number): number {
  const n = Math.max(0, Math.min(12, Math.round(hits)))
  return n === 0 ? 20 : 28 + n
}

function specialKind(label: string): SpecialKind | undefined {
  return (Object.entries(SPECIAL) as [SpecialKind, (typeof SPECIAL)[SpecialKind]][]).find(([, info]) => info.pattern.test(label))?.[0]
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
  // Inside a Stellar-Conduct Polestar Field, and the hits it has recorded (0-12)
  polestar?: { active: boolean, hits: number },
}

export type DamageSetup = {
  characterId: string,
  characterLevel: number,
  element?: Element,
  rotation: Rotation,
  talents: TalentLevels,
  enemy: EnemySettings,
  debuffs: EnemyDebuffs,
  // Reaction DMG bonuses from sets (damage/combatEffects.ts), in percent
  reactionBonus?: Partial<Record<ReactionBonusKey, number>>,
  // Buffs to some hits only (Raiden's Resolve, Nahida's Tri-Karma bonus), from damage/combatEffects.ts
  hitBuffs?: HitBuff[],
  // The Lunar and Stellar kinds the team can trigger (teamReactions); missing means every kind
  teamReactions?: SpecialKind[],
  // Base DMG increase per Lunar or Stellar kind from teammates' passives (team/teamBuffs.ts), in percent. The character's
  // own passive is worked out from their stats; they add up
  baseBonus?: Partial<Record<SpecialKind, number>>,
  // Per Lunar or Stellar kind: flat damage added to each hit, and CRIT Rate / CRIT DMG for it, from teammates
  specialFlat?: Partial<Record<SpecialKind, number>>,
  specialCrit?: Partial<Record<SpecialKind, { rate: number, dmg: number }>>,
  // Stellar Swirl contribution scores of the teammates who can trigger it (stellarContribution)
  stellarContributors?: number[],
}

// Stellar Swirl contribution weights by rank: the highest counts in full, the second at 1/2, the rest at 1/12
const CONTRIBUTION_WEIGHTS = [1, 1 / 2, 1 / 12]

// How much a character's Stellar Swirl hit deals, for ranking contributions: level multiplier x EM bracket x CRIT
export function stellarContribution(level: number, stats: Partial<Record<GenshinStatKey, number>>, bonus = 0): number {
  const em = stats.elementalMastery ?? 0
  const crit = 1 + Math.min(Math.max(stats.critRate ?? 0, 0), 100) / 100 * (stats.critDmg ?? 0) / 100
  return reactionLevelMultiplier(level) * (1 + 6 * em / (em + 2000) + bonus) * crit
}

// A buff to some hits only, as data (it goes to the search's worker)
export type HitBuff = {
  // The hits it reaches: by label, by kind, or both (a hit matches either), minus excluded labels
  labels?: string[],
  categories?: TalentHit['category'][],
  excludeLabels?: string[],
  // Raises the hit's own multiplier by this fraction (Neuvillette's Judgment x160% is 0.6)
  scale?: number,
  // Adds percent of a stat to each hit (Raiden's Resolve, Redhorn's DEF)
  addTerms?: Partial<Record<ScalingStat, number>>,
  // DMG Bonus, CRIT Rate and CRIT DMG for these hits, in percent
  dmgBonus?: number,
  critRate?: number,
  critDmg?: number,
  // DMG Bonus and CRIT Rate per point of Elemental Mastery above a floor, up to caps (Nahida's A4)
  fromEm?: { over: number, dmgPer?: number, dmgCap?: number, critPer?: number, critCap?: number },
}

function buffReaches(buff: HitBuff, hit: TalentHit): boolean {
  if (buff.excludeLabels?.includes(hit.label)) return false
  return !!buff.labels?.includes(hit.label) || !!buff.categories?.includes(hit.category)
}

// The DMG Bonus stat for each kind of hit
const CATEGORY_DMG: Record<TalentHit['category'], GenshinStatKey> = {
  normal: 'normalDmg',
  charged: 'chargedDmg',
  plunging: 'plungingDmg',
  skill: 'skillDmg',
  burst: 'burstDmg',
}

function characterData(characterId: string) {
  return DATA[characterId]
}

export function hasTalentData(characterId: string): boolean {
  return characterData(characterId) !== undefined
}

// A hit's key: its talent and name, with " #2" and so on when a name repeats, so saved rotations survive the data being
// regenerated (keys used to be the hit's position in the data file, "talent:12")
function hitKeys(hits: { talent: string, label: string }[]): string[] {
  const seen = new Map<string, number>()
  return hits.map((hit) => {
    const base = `${hit.talent}:${hit.label}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n > 1 ? `${base} #${n}` : base
  })
}

// Saved rotation counts with old position keys ("talent:12") turned into name keys; other keys stay as they are
export function migrateRotationCounts(id: string, counts: Record<string, number>): Record<string, number> {
  const hits = characterData(id)?.hits ?? []
  const keys = hitKeys(hits)
  return Object.fromEntries(
    Object.entries(counts).map(([key, count]) => {
      const old = /^(\w+):(\d+)$/.exec(key)
      const index = old ? Number(old[2]) : -1
      return [old && hits[index]?.talent === old[1] ? keys[index] : key, count]
    }),
  )
}

export function characterHits(characterId: string): TalentHit[] {
  const data = characterData(characterId)
  if (!data) return []
  const keys = hitKeys(data.hits)
  return data.hits.map((hit, i) => ({
    key: keys[i],
    label: hit.label,
    talent: hit.talent as Talent,
    category: hit.category as TalentHit['category'],
    terms: hit.terms as [ScalingStat, number[]][],
    physical: !!hit.physical && !data.catalyst,
    times: Number(/×(\d+)$/.exec(hit.label)?.[1] ?? 1),
    special: specialKind(hit.label),
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
  // The hit kind's DMG Bonus (Normal Attack DMG...)
  typeStat: GenshinStatKey,
  terms: [ScalingStat, number][],
  dmgStat?: GenshinStatKey,
  res: number,
  amplifies: number,
  // The reaction's DMG bonus from sets, as a fraction
  reactionBonus: number,
  catalyze: number,
  hits: number,
  // From hit-specific buffs, in percent
  dmgBonus: number,
  critRate: number,
  critDmg: number,
  fromEm: NonNullable<HitBuff['fromEm']>[],
}

// transformative: summed reaction multiplier x level multiplier x RES over the rotation, before Elemental Mastery
// transformative: per reaction, the summed multiplier x level multiplier x RES and the reaction's DMG bonus (a fraction);
// special ones (Lunar, Stellar) can CRIT and take the smaller EM bracket.
// special: direct Lunar and Stellar talent damage, the summed multipliers per stat x factor x RES
export type PreparedDamage = {
  groups: ElementTerms[],
  def: number,
  reactionShare: number,
  // count and res for flat damage per hit; contribution for Stellar Swirl lines
  transformative: { base: number, bonus: number, special: boolean, kind?: SpecialKind, count: number, res: number, contribution: boolean }[],
  special: { terms: [ScalingStat, number][], bonus: number, kind: SpecialKind, hits: number, res: number }[],
  specialFlat: Partial<Record<SpecialKind, number>>,
  specialCrit: Partial<Record<SpecialKind, { rate: number, dmg: number }>>,
  stellarContributors: number[],
  characterLevel: number,
  // The Base DMG increase per Lunar or Stellar kind: from teammates, and the character's own passive
  baseBonus: Partial<Record<SpecialKind, number>>,
  ownBenediction?: Benediction,
}

// Transformative reactions: genshin-optimizer's transInfo multipliers, which elements trigger them, and the element
// the damage is (Swirl takes the swirled element's)
// Lunar-Charged and Stellar Swirl are 'special': they can CRIT and take 6 EM / (EM + 2000) instead of 16 EM / (EM + 2000)
export type TransformativeReaction =
  | 'overloaded'
  | 'electrocharged'
  | 'superconduct'
  | 'shattered'
  | 'swirl'
  | 'burning'
  | 'bloom'
  | 'hyperbloom'
  | 'burgeon'
  | 'lunarcharged'
  | 'stellarswirl'
  | 'stellarvortex1'
  | 'stellarvortex2'
const TRANSFORMATIVE: Record<
  TransformativeReaction,
  { label: string, multiplier: number, triggeredBy: Element[], variants: DamageElement[], special?: boolean }
> = {
  overloaded: { label: 'Overloaded', multiplier: 2, triggeredBy: ['Pyro', 'Electro'], variants: ['Pyro'] },
  electrocharged: { label: 'Electro-Charged', multiplier: 1.2, triggeredBy: ['Electro', 'Hydro'], variants: ['Electro'] },
  superconduct: { label: 'Superconduct', multiplier: 0.5, triggeredBy: ['Cryo', 'Electro'], variants: ['Cryo'] },
  shattered: { label: 'Shattered', multiplier: 1.5, triggeredBy: ['Geo'], variants: ['Physical'] },
  swirl: { label: 'Swirl', multiplier: 0.6, triggeredBy: ['Anemo'], variants: ['Pyro', 'Hydro', 'Electro', 'Cryo'] },
  burning: { label: 'Burning (per tick)', multiplier: 0.25, triggeredBy: ['Pyro', 'Dendro'], variants: ['Pyro'] },
  bloom: { label: 'Bloom (per Dendro Core)', multiplier: 2, triggeredBy: ['Dendro', 'Hydro'], variants: ['Dendro'] },
  hyperbloom: { label: 'Hyperbloom (per Sprawling Shot)', multiplier: 3, triggeredBy: ['Electro'], variants: ['Dendro'] },
  burgeon: { label: 'Burgeon (per Dendro Core)', multiplier: 3, triggeredBy: ['Pyro'], variants: ['Dendro'] },
  lunarcharged: { label: 'Lunar-Charged', multiplier: 1.8, triggeredBy: ['Electro'], variants: ['Electro'], special: true },
  // Stellar Swirl's first Anemo hit, then its Vortex's Cryo explosion (x2 at level 1, x3 at level 2; KQM)
  stellarswirl: { label: 'Stellar Swirl (Anemo hit)', multiplier: 0.75, triggeredBy: ['Anemo'], variants: ['Anemo'], special: true },
  stellarvortex1: { label: 'Stellar Vortex explosion, level 1', multiplier: 2, triggeredBy: ['Anemo', 'Cryo'], variants: ['Cryo'], special: true },
  stellarvortex2: { label: 'Stellar Vortex explosion, level 2', multiplier: 3, triggeredBy: ['Anemo', 'Cryo'], variants: ['Cryo'], special: true },
}

export type TransformativeLine = { key: string, label: string, reaction: TransformativeReaction, variant: DamageElement }

// The Lunar or Stellar kind a reaction needs someone in the team to enable
const NEEDS: Partial<Record<TransformativeReaction, SpecialKind>> = {
  lunarcharged: 'lunarcharged',
  stellarswirl: 'stellarswirl',
  stellarvortex1: 'stellarswirl',
  stellarvortex2: 'stellarswirl',
}

// The reaction DMG bonus each reaction takes
const BONUS_KEY: Partial<Record<TransformativeReaction, ReactionBonusKey>> = { stellarvortex1: 'stellarswirl', stellarvortex2: 'stellarswirl' }

// The transformative reactions a character of this element triggers, as rotation lines ('reaction:swirl:Pyro'). Lunar and
// Stellar ones only when the team can trigger them (team: teamReactions; missing means every kind)
export function transformativeLines(element: Element | undefined, team?: SpecialKind[]): TransformativeLine[] {
  if (!element) return []
  return (Object.entries(TRANSFORMATIVE) as [TransformativeReaction, (typeof TRANSFORMATIVE)[TransformativeReaction]][])
    .filter(([reaction, info]) => info.triggeredBy.includes(element) && (!team || !NEEDS[reaction] || team.includes(NEEDS[reaction])))
    .flatMap(([reaction, info]) =>
      info.variants.map((variant) => ({
        key: info.variants.length > 1 ? `reaction:${reaction}:${variant}` : `reaction:${reaction}`,
        label: info.variants.length > 1 ? `${info.label} (${variant})` : info.label,
        reaction,
        variant,
      }))
    )
}

// One trigger's damage before Elemental Mastery and RES, for showing on the Rotation card
export function transformativeBase(reaction: TransformativeReaction, characterLevel: number): number {
  return TRANSFORMATIVE[reaction].multiplier * reactionLevelMultiplier(characterLevel)
}

function resMultiplier(res: number): number {
  if (res < 0) return 1 - res / 2
  if (res < 0.75) return 1 - res
  return 1 / (4 * res + 1)
}

// Everything that's the same for every build, worked out once
export function prepareDamage(setup: DamageSetup): PreparedDamage {
  const { rotation, enemy, element } = setup
  // Inside a Polestar Field (when the team can make one): Cryo and Electro DMG Bonus, and Physical RES -40%
  const polestar = rotation.polestar?.active && (!setup.teamReactions || setup.teamReactions.includes('stellarconduct')) ? rotation.polestar : undefined
  const debuffs = polestar
    ? { ...setup.debuffs, resShred: { ...setup.debuffs.resShred, Physical: (setup.debuffs.resShred.Physical ?? 0) + 40 } }
    : setup.debuffs
  const fieldDmg = polestar && (element === 'Cryo' || element === 'Electro') ? polestarDmgBonus(polestar.hits) : 0
  // By element, hit kind and the hit-specific buffs that reach it ("Pyro|skillDmg|0,2")
  const byElement = new Map<string, Map<ScalingStat, number>>()
  // Hits per group, for Aggravate and Spread's flat damage on each
  const hitCounts = new Map<string, number>()
  const hitBuffs = setup.hitBuffs ?? []
  const reactionBonus = (key: ReactionBonusKey) => (setup.reactionBonus?.[key] ?? 0) / 100
  // Direct Lunar and Stellar damage, by kind
  const special = new Map<SpecialKind, Map<ScalingStat, number>>()
  // Direct Lunar and Stellar hits per kind, for flat damage added to each
  const specialHits = new Map<SpecialKind, number>()
  for (const hit of characterHits(setup.characterId)) {
    const count = rotation.counts[hit.key] ?? 0
    if (count <= 0) continue
    if (hit.special) {
      const terms = special.get(hit.special) ?? new Map<ScalingStat, number>()
      for (const [stat, value] of Object.entries(hitMultiplier(hit, setup.talents)) as [ScalingStat, number][]) {
        terms.set(stat, (terms.get(stat) ?? 0) + count * value)
      }
      special.set(hit.special, terms)
      specialHits.set(hit.special, (specialHits.get(hit.special) ?? 0) + count * (hit.times ?? 1))
      continue
    }
    const hitElement: DamageElement = hit.physical && !rotation.infusion ? 'Physical' : (element ?? 'Physical')
    const reaching = hitBuffs.flatMap((buff, i) => (buffReaches(buff, hit) ? [i] : []))
    const key = `${hitElement}|${CATEGORY_DMG[hit.category]}|${reaching.join(',')}`
    const terms = byElement.get(key) ?? new Map<ScalingStat, number>()
    const scale = 1 + reaching.reduce((sum, i) => sum + (hitBuffs[i].scale ?? 0), 0)
    for (const [stat, value] of Object.entries(hitMultiplier(hit, setup.talents)) as [ScalingStat, number][]) {
      terms.set(stat, (terms.get(stat) ?? 0) + count * value * scale)
    }
    // Added terms land on each hit of the line
    for (const i of reaching) {
      for (const [stat, value] of Object.entries(hitBuffs[i].addTerms ?? {}) as [ScalingStat, number][]) {
        terms.set(stat, (terms.get(stat) ?? 0) + count * hit.times * value)
      }
    }
    byElement.set(key, terms)
    hitCounts.set(key, (hitCounts.get(key) ?? 0) + count * hit.times)
  }
  const groups = [...byElement].map(([key, terms]): ElementTerms => {
    const [hitElement, typeStat, reachingText] = key.split('|') as [DamageElement, GenshinStatKey, string]
    const reaching = reachingText ? reachingText.split(',').map((i) => hitBuffs[Number(i)]) : []
    const shred = (debuffs.resShred[hitElement] ?? 0) + (debuffs.resShred.all ?? 0)
    const reacts = hitElement !== 'Physical'
    const amplifies = reacts && (rotation.reaction === 'vaporize' || rotation.reaction === 'melt') ? AMPLIFYING[rotation.reaction][hitElement] ?? 0 : 0
    const catalyzeMultiplier = reacts && (rotation.reaction === 'aggravate' || rotation.reaction === 'spread')
      ? CATALYZE[rotation.reaction][hitElement] ?? 0
      : 0
    return {
      element: hitElement,
      typeStat,
      terms: [...terms],
      dmgStat: hitElement === 'Physical' ? 'physicalDmg' : ELEMENT_DMG_STAT[hitElement],
      res: resMultiplier((enemy.res - shred) / 100),
      amplifies,
      reactionBonus: rotation.reaction === 'none' ? 0 : reactionBonus(rotation.reaction),
      catalyze: catalyzeMultiplier * reactionLevelMultiplier(setup.characterLevel),
      hits: hitCounts.get(key) ?? 0,
      dmgBonus: reaching.reduce((sum, buff) => sum + (buff.dmgBonus ?? 0), 0) + (hitElement === element ? fieldDmg : 0),
      critRate: reaching.reduce((sum, buff) => sum + (buff.critRate ?? 0), 0),
      critDmg: reaching.reduce((sum, buff) => sum + (buff.critDmg ?? 0), 0),
      fromEm: reaching.flatMap((buff) => (buff.fromEm ? [buff.fromEm] : [])),
    }
  })
  const characterFactor = setup.characterLevel + 100
  const def = characterFactor / (characterFactor + (enemy.level + 100) * Math.max(0, 1 - debuffs.defShred / 100))
  const transformative: PreparedDamage['transformative'] = []
  for (const line of transformativeLines(element, setup.teamReactions)) {
    const count = rotation.counts[line.key] ?? 0
    if (count <= 0) continue
    const shred = (debuffs.resShred[line.variant] ?? 0) + (debuffs.resShred.all ?? 0)
    const res = resMultiplier((enemy.res - shred) / 100)
    const base = count * transformativeBase(line.reaction, setup.characterLevel) * res
    const bonusKey = BONUS_KEY[line.reaction] ?? (line.reaction as ReactionBonusKey)
    const kind = NEEDS[line.reaction]
    transformative.push({
      base,
      bonus: reactionBonus(bonusKey),
      special: !!TRANSFORMATIVE[line.reaction].special,
      kind,
      count,
      res,
      contribution: kind === 'stellarswirl',
    })
  }
  const specialGroups = [...special].map(([kind, terms]) => {
    const resist = SPECIAL[kind].resist ?? element ?? 'Physical'
    const shred = (debuffs.resShred[resist] ?? 0) + (debuffs.resShred.all ?? 0)
    // Stellar-Conduct damage grows with the Polestar Field's recorded hits
    const field = kind === 'stellarconduct' && polestar ? polestarMultiplier(polestar.hits) : 1
    const res = resMultiplier((enemy.res - shred) / 100)
    const scale = SPECIAL[kind].factor * field * res
    return {
      terms: [...terms].map(([stat, value]): [ScalingStat, number] => [stat, value * scale]),
      bonus: reactionBonus(kind),
      kind,
      hits: specialHits.get(kind) ?? 0,
      res,
    }
  })
  return {
    groups,
    def,
    reactionShare: Math.max(0, Math.min(100, rotation.reactionShare)) / 100,
    transformative,
    special: specialGroups,
    baseBonus: setup.baseBonus ?? {},
    ownBenediction: BENEDICTIONS[setup.characterId],
    specialFlat: setup.specialFlat ?? {},
    specialCrit: setup.specialCrit ?? {},
    stellarContributors: setup.stellarContributors ?? [],
    characterLevel: setup.characterLevel,
  }
}

// The rotation's damage from final stats; get reads a stat (a record or the optimizer's vectors)
export function preparedDamage(prepared: PreparedDamage, get: (stat: GenshinStatKey) => number): number {
  const critRate = get('critRate')
  const critDmg = get('critDmg')
  const allDmg = get('allDmg')
  let total = 0
  for (const group of prepared.groups) {
    let base = 0
    for (const [stat, multiplier] of group.terms) base += multiplier / 100 * get(stat)
    if (group.catalyze > 0) {
      const em = get('elementalMastery')
      base += prepared.reactionShare * group.hits * group.catalyze * (1 + 5 * em / (em + 1200) + group.reactionBonus)
    }
    let amplify = 1
    if (group.amplifies > 0) {
      const em = get('elementalMastery')
      amplify = 1 + prepared.reactionShare * (group.amplifies * (1 + 2.78 * em / (em + 1400) + group.reactionBonus) - 1)
    }
    let dmgBonus = group.dmgBonus
    let groupCrit = critRate + group.critRate
    for (const fromEm of group.fromEm) {
      const over = Math.max(0, get('elementalMastery') - fromEm.over)
      dmgBonus += Math.min(fromEm.dmgCap ?? Infinity, over * (fromEm.dmgPer ?? 0))
      groupCrit += Math.min(fromEm.critCap ?? Infinity, over * (fromEm.critPer ?? 0))
    }
    const crit = 1 + Math.min(Math.max(groupCrit, 0), 100) / 100 * (critDmg + group.critDmg) / 100
    total += base * (1 + ((group.dmgStat ? get(group.dmgStat) : 0) + get(group.typeStat) + allDmg + dmgBonus) / 100) * group.res * amplify * crit
  }
  let transformative = 0
  if (prepared.transformative.length > 0 || prepared.special.length > 0) {
    const em = get('elementalMastery')
    const fromEm = 16 * em / (em + 2000)
    const specialFromEm = 6 * em / (em + 2000)
    const crit = 1 + Math.min(Math.max(critRate, 0), 100) / 100 * critDmg / 100
    // Lunar and Stellar Base DMG increase: the teammates' plus the character's own passive
    const own = prepared.ownBenediction
    const ownValue = own ? Math.min(own.cap, get(own.stat) * own.perPoint) : 0
    const baseFactor = (kind: SpecialKind | undefined) => {
      if (!kind) return 1
      return 1 + ((prepared.baseBonus[kind] ?? 0) + (own?.kinds.includes(kind) ? ownValue : 0)) / 100
    }
    // CRIT with a kind's own CRIT Rate and CRIT DMG on top
    const critFor = (kind: SpecialKind | undefined) => {
      const extra = kind ? prepared.specialCrit[kind] : undefined
      if (!extra) return crit
      return 1 + Math.min(Math.max(critRate + extra.rate, 0), 100) / 100 * (critDmg + extra.dmg) / 100
    }
    const flatFor = (kind: SpecialKind | undefined) => (kind ? prepared.specialFlat[kind] ?? 0 : 0)
    for (const reaction of prepared.transformative) {
      if (!reaction.special) {
        transformative += reaction.base * (1 + fromEm + reaction.bonus)
        continue
      }
      const multiplier = 1 + specialFromEm + reaction.bonus
      let value = (reaction.base * baseFactor(reaction.kind) + flatFor(reaction.kind) * reaction.count * reaction.res) * multiplier
        * critFor(reaction.kind)
      if (reaction.contribution && prepared.stellarContributors.length > 0) {
        // The character's share at their rank among the teammates who also contribute
        const own = reactionLevelMultiplier(prepared.characterLevel) * baseFactor(reaction.kind) * multiplier * critFor(reaction.kind)
        const rank = prepared.stellarContributors.filter((other) => other > own).length
        value *= CONTRIBUTION_WEIGHTS[Math.min(rank, CONTRIBUTION_WEIGHTS.length - 1)]
      }
      transformative += value
    }
    for (const group of prepared.special) {
      let base = 0
      for (const [stat, multiplier] of group.terms) base += multiplier / 100 * get(stat)
      transformative += (base * baseFactor(group.kind) + flatFor(group.kind) * group.hits * group.res) * (1 + specialFromEm + group.bonus)
        * critFor(group.kind)
    }
  }
  return total * prepared.def + transformative
}

export function rotationDamage(stats: Partial<Record<GenshinStatKey, number>>, setup: DamageSetup): number {
  return preparedDamage(prepareDamage(setup), (stat) => stats[stat] ?? 0)
}

// What a hit's attack category is called, for the Rotation card and the damage breakdown
export const HIT_CATEGORY_LABELS: Record<string, string> = {
  normal: 'Normal Attack',
  charged: 'Charged Attack',
  plunging: 'Plunging Attack',
  skill: 'Elemental Skill',
  burst: 'Elemental Burst',
}

// The rotation's counted lines, talent hits and reactions, for the damage breakdown (shared/damageBreakdown.ts)
export function rotationLines(characterId: string, element: Element | undefined, rotation: Rotation, team?: SpecialKind[]): DamageLine[] {
  return [
    ...characterHits(characterId).map((hit) => ({
      key: hit.key,
      label: hit.label,
      group: HIT_CATEGORY_LABELS[hit.category] ?? hit.category,
      count: rotation.counts[hit.key] ?? 0,
    })),
    ...transformativeLines(element, team).map((line) => ({ key: line.key, label: line.label, group: 'Reactions', count: rotation.counts[line.key] ?? 0 })),
  ]
}

// The rotation with only one line in it
export function singleLineRotation(rotation: Rotation, line: DamageLine): Rotation {
  return { ...rotation, counts: { [line.key]: line.count } }
}
