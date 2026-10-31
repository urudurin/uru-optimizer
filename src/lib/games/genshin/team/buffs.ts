import {
  type DamageElement,
  HEXEREI,
  type SpecialKind,
} from 'lib/games/genshin/damage/damage'
import { inferAscension } from 'lib/games/genshin/stats/computeStats'
import {
  type Element,
  ELEMENT_DMG_STAT,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'

// Buffs one character's kit, weapon or artifact set gives the team, after Genshin Optimizer's teamBuff model: each is
// a formula over the giver (their own stats, levels, constellation) and the receiver, with an optional toggle or stack
// count. Values come from the in-game descriptions; talent scalings and passive numbers were checked against
// genshin-optimizer's generated stat data and character sheets (https://github.com/frzyc/genshin-optimizer, MIT).
// Personal, non-commercial use.
// Phase 1 covers stats the calculator has, plus enemy DEF and RES shred for the rotation damage (damage/damage.ts).

export type BuffTarget =
  // every member, the giver included
  | 'team'
  // everyone but the giver
  | 'others'
  // only the character on the field
  | 'active'
  // the character switched in after the giver (Thrilling Tales)
  | 'next'

export type BuffToggle =
  // offByDefault: starts off (it depends on something the page can't tell, like who is a Moonsign character)
  | { kind: 'switch', label: string, offByDefault?: boolean }
  // A count from 0 to max (Fanfare points)
  | { kind: 'stacks', label: string, max: (giver: GenshinCharacter) => number, step: number }
  // Which element, for swirl and crystallize effects
  | { kind: 'element', label: string, options: Element[] }

export type BuffSetting = boolean | number | string

// What a buff changes on the enemy instead of the receiver: DEF shred, or RES shred of one element or all of them
export type EnemyDebuffKey = 'defShred' | `resShred:${DamageElement | 'all'}`
// lunarBonus: Lunar Reaction DMG Bonus for every Lunar kind (Moonsign: Ascendant Gleam), for the rotation damage. For
// one Lunar or Stellar kind: its DMG Bonus, flat DMG added to each of its hits (genshin-optimizer's <kind>_dmgInc), and
// CRIT Rate and CRIT DMG for it only
export type SpecialStat =
  | `special:${SpecialKind}`
  | `specialFlat:${SpecialKind}`
  | `specialCritRate:${SpecialKind}`
  | `specialCritDmg:${SpecialKind}`
// bloomBonus: Bloom DMG Bonus for the receiver's Bloom reactions (Nilou's Bountiful Cores count as Bloom DMG)
// hitFlat: flat DMG added to each of the receiver's hits of flatElements, for as many hits as a stacks toggle says (no
// stacks: every hit) (Shenhe's Icy Quill, Vodyanitsa's Lead Vocal)
// vaporizeBonus: Vaporize DMG Bonus for the receiver's Vaporize reactions (Mona's Hexerei Astral Glow of Mercury)
export type BuffStat = GenshinStatKey | EnemyDebuffKey | 'lunarBonus' | 'bloomBonus' | 'vaporizeBonus' | 'hitFlat' | SpecialStat

export function isSpecialStat(stat: BuffStat): stat is SpecialStat {
  return stat.startsWith('special')
}

export function isDebuff(stat: BuffStat): stat is EnemyDebuffKey {
  return stat === 'defShred' || stat.startsWith('resShred:')
}

export function debuffLabel(stat: EnemyDebuffKey): string {
  if (stat === 'defShred') return 'enemy DEF shred'
  const element = stat.slice('resShred:'.length)
  return element === 'all' ? 'enemy RES shred (all)' : `enemy ${element} RES shred`
}

export type BuffContext = {
  giver: GenshinCharacter,
  // The giver's own stats (stat screen, no other buffs) and base ATK (character + weapon)
  giverStats: Partial<Record<GenshinStatKey, number>>,
  giverBaseAtk: number,
  receiver: GenshinCharacter,
  // The toggle's value: true/false, a stack count, or an element
  setting: BuffSetting,
  // Highest Elemental Mastery among the teammates
  teamMaxElementalMastery: number,
  // Hexerei characters in the party (damage/damage.ts hexereiCount), the receiver included
  hexerei: number,
}

export type TeamBuff = {
  id: string,
  label: string,
  target: BuffTarget,
  // 'premod': added with the other bonuses (HP/ATK/DEF% scale the base); 'total': added to the final stat
  stage: 'premod' | 'total',
  stat: BuffStat | ((context: BuffContext) => BuffStat | undefined),
  // 0 when it doesn't apply (constellation too low, wrong element...), in display units (20 = 20%)
  value: (context: BuffContext) => number,
  // Why it doesn't apply, when value is 0 for a reason other than the toggle
  blockedBy?: (context: BuffContext) => string | undefined,
  toggle?: BuffToggle,
  // Buffs in the same group don't stack: only the biggest counts (two Noblesse Oblige wearers)
  nonStacking?: string,
  // For hitFlat: the elements of the hits it reaches, and a fixed hit count when its stacks toggle counts something else
  flatElements?: DamageElement[],
  flatTriggers?: number,
  // For specialFlat: its stacks toggle is how many hits get the flat DMG (Lauma's Pale Hymn, Illuga's Nightingale's Song)
  capsHits?: boolean,
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

export type BuffSource = { name: string, buffs: TeamBuff[] }

const SWIRL_ELEMENTS: Element[] = ['Pyro', 'Hydro', 'Electro', 'Cryo']

function ascensionOf(character: GenshinCharacter): number {
  return character.ascension ?? inferAscension(character.level)
}

// The burst's level with the constellation that adds 3 levels to it
function burstLevel(character: GenshinCharacter, boostedAt: 3 | 5): number {
  const level = character.talents?.burst ?? 9
  return Math.min(15, level + (character.constellation >= boostedAt ? 3 : 0))
}

function skillLevel(character: GenshinCharacter, boostedAt: 3 | 5): number {
  return Math.min(15, (character.talents?.skill ?? 9) + (character.constellation >= boostedAt ? 3 : 0))
}

// The receiver's own element when it is one of these (shreds and bonuses that only reach some elements)
const receiverElement = (context: BuffContext, elements: Element[]) =>
  context.receiver.element && elements.includes(context.receiver.element) ? context.receiver.element : undefined
const onlyFor = (elements: Element[]) => (context: BuffContext) => receiverElement(context, elements) ? undefined : `Only for ${elements.join(' and ')} members`

// Talent scalings by level 1-15 (genshin-optimizer skillParam): Shenhe's Burst Cryo and Physical RES shred, Xilonen's
// Skill RES shred, Faruzan's Burst Anemo DMG Bonus, Gorou's Skill DEF, Iansan's Burst ATK cap
const SHENHE_BURST_RES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 15, 15, 15, 15]
const XILONEN_SKILL_RES = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51]
const FARUZAN_BURST_ANEMO = [18, 19.35, 20.7, 22.5, 23.85, 25.2, 27, 28.8, 30.6, 32.4, 34.2, 36, 38.25, 40.5, 42.75]
const GOROU_SKILL_DEF = [206.16, 221.622, 237.084, 257.7, 273.162, 288.624, 309.24, 329.856, 350.472, 371.088, 391.704, 412.32, 438.09, 463.86, 489.63]
// Shenhe's Icy Quill DMG Bonus, percent of her ATK by Skill level (the user's screenshot: 82.2% at level 10)
const SHENHE_QUILL_ATK = [45.66, 49.08, 52.5, 57.07, 60.49, 63.92, 68.48, 73.05, 77.62, 82.18, 86.75, 91.31, 97.02, 102.73, 108.43]
const IANSAN_BURST_ATK_CAP = [330, 370, 410, 450, 490, 530, 570, 610, 650, 690, 730, 770, 810, 850, 890]

const needsAscension = (level: number) => (context: BuffContext) =>
  ascensionOf(context.giver) < level ? `Needs ${context.giver.name} at ascension ${level}` : undefined
const needsConstellation = (level: number) => (context: BuffContext) =>
  context.giver.constellation < level ? `Needs ${context.giver.name} at C${level}` : undefined

// By level 1-15, from genshin-optimizer's skillParam data
const BENNETT_BURST_ATK = [0.56, 0.602, 0.644, 0.7, 0.742, 0.784, 0.84, 0.896, 0.952, 1.008, 1.064, 1.12, 1.19, 1.26, 1.33]
const FURINA_DMG_PER_FANFARE = [0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.23, 0.25, 0.27, 0.29, 0.31, 0.33, 0.35]

// By GOOD character key
// Lunar and Stellar buffs from kits, after genshin-optimizer's character sheets (Columbina, Lauma, Aino, Baizhu, Linnea,
// Illuga, Mona, Ifa) with values from its allStat_gen skillParam: DMG Bonus for one kind (or every Lunar kind), flat DMG
// added to each hit of a kind (a share of the giver's own stat), and CRIT for one kind. Talent-scaled ones use the
// giver's burst level, raised by 3 at the constellation genshin-optimizer gives
const COLUMBINA_LUNAR_DMG = [13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55]
const LAUMA_PALE_HYMN_EM = [2.2224, 2.38908, 2.55576, 2.778, 2.94468, 3.11136, 3.3336, 3.55584, 3.77808, 4.00032, 4.22256, 4.4448, 4.7226, 5.0004, 5.2782]
// Nightingale's Song on other Geo hits: percent of his Elemental Mastery by Burst level (genshin-optimizer skillParam)
const ILLUGA_SONG_GEO_EM = [33.6, 36.12, 38.64, 42, 44.52, 47.04, 50.4, 53.76, 57.12, 60.48, 63.84, 67.2, 71.4, 75.6, 79.8]
const ILLUGA_SONG_EM = [2.2592, 2.42864, 2.59808, 2.824, 2.99344, 3.16288, 3.3888, 3.61472, 3.84064, 4.06656, 4.29248, 4.5184, 4.8008, 5.0832, 5.3656]

const LUNAR_KIT_BUFFS: Record<string, TeamBuff[]> = {
  Columbina: [{
    id: 'columbina-burst-lunar',
    label: 'Burst domain: Lunar Reaction DMG Bonus by her burst level',
    target: 'team',
    stage: 'premod',
    stat: 'lunarBonus',
    value: ({ giver }) => COLUMBINA_LUNAR_DMG[burstLevel(giver, 5) - 1] ?? 0,
    toggle: { kind: 'switch', label: 'In her burst domain' },
    confidence: 'sourced',
  }],
  Lauma: [
    {
      id: 'lauma-pale-hymn',
      capsHits: true,
      label:
        'Pale Hymn: Lunar-Bloom DMG added per hit, a share of her Elemental Mastery by her burst level; one stack per Lunar-Bloom hit (18 from her Burst, 18 more from her hold Skill)',
      target: 'team',
      stage: 'premod',
      stat: 'specialFlat:lunarbloom',
      value: ({ giver, giverStats, setting }) => setting === 0 ? 0 : (LAUMA_PALE_HYMN_EM[burstLevel(giver, 3) - 1] ?? 0) * (giverStats.elementalMastery ?? 0),
      toggle: { kind: 'stacks', label: 'Pale Hymn stacks', max: () => 36, step: 1 },
      confidence: 'sourced',
    },
    {
      id: 'lauma-c2-pale-hymn',
      label: 'C2: Pale Hymn adds 400% of her Elemental Mastery more per Lunar-Bloom hit',
      target: 'team',
      stage: 'premod',
      stat: 'specialFlat:lunarbloom',
      value: ({ giver, giverStats }) => (giver.constellation >= 2 ? 4 * (giverStats.elementalMastery ?? 0) : 0),
      blockedBy: needsConstellation(2),
      toggle: { kind: 'switch', label: 'Pale Hymn stacks' },
      confidence: 'sourced',
    },
    {
      id: 'lauma-c2-lunarbloom-dmg',
      label: 'C2: Lunar-Bloom DMG +40% (Moonsign: Ascendant Gleam)',
      target: 'team',
      stage: 'premod',
      stat: 'special:lunarbloom',
      value: ({ giver }) => (giver.constellation >= 2 ? 40 : 0),
      blockedBy: needsConstellation(2),
      confidence: 'sourced',
    },
    {
      id: 'lauma-a1-crit-rate',
      label: 'A1: Lunar-Bloom CRIT Rate +10% after her Skill (Moonsign: Ascendant Gleam)',
      target: 'team',
      stage: 'premod',
      stat: 'specialCritRate:lunarbloom',
      value: ({ giver }) => (ascensionOf(giver) >= 1 ? 10 : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'switch', label: 'After her Skill' },
      confidence: 'sourced',
    },
    {
      id: 'lauma-a1-crit-dmg',
      label: 'A1: Lunar-Bloom CRIT DMG +20% after her Skill (Moonsign: Ascendant Gleam)',
      target: 'team',
      stage: 'premod',
      stat: 'specialCritDmg:lunarbloom',
      value: ({ giver }) => (ascensionOf(giver) >= 1 ? 20 : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'switch', label: 'After her Skill' },
      confidence: 'sourced',
    },
  ],
  Aino: [
    {
      id: 'aino-c6-lunar',
      label: 'C6: Lunar Reaction DMG +15% for the active character after her Burst',
      target: 'active',
      stage: 'premod',
      stat: 'lunarBonus',
      value: ({ giver }) => (giver.constellation >= 6 ? 15 : 0),
      blockedBy: needsConstellation(6),
      toggle: { kind: 'switch', label: 'After her Burst' },
      confidence: 'sourced',
    },
    {
      id: 'aino-c6-lunar-gleam',
      label: 'C6: another +20% with Moonsign: Ascendant Gleam',
      target: 'active',
      stage: 'premod',
      stat: 'lunarBonus',
      value: ({ giver }) => (giver.constellation >= 6 ? 20 : 0),
      blockedBy: needsConstellation(6),
      toggle: { kind: 'switch', label: 'Ascendant Gleam' },
      confidence: 'sourced',
    },
  ],
  Baizhu: [{
    id: 'baizhu-a4-lunarbloom',
    label: 'A4: Lunar-Bloom DMG +0.7% per 1,000 of his max HP (up to 50,000 HP) after his healing',
    target: 'team',
    stage: 'premod',
    stat: 'special:lunarbloom',
    value: ({ giver, giverStats }) => (ascensionOf(giver) >= 4 ? Math.min(50, (giverStats.hp ?? 0) / 1000) * 0.7 : 0),
    blockedBy: needsAscension(4),
    toggle: { kind: 'switch', label: 'After his healing' },
    confidence: 'sourced',
  }],
  Linnea: [{
    id: 'linnea-c1-lunarcrystallize',
    label: 'C1: Lunar-Crystallize DMG added per hit, 75% of her DEF',
    target: 'team',
    stage: 'premod',
    stat: 'specialFlat:lunarcrystallize',
    value: ({ giver, giverStats }) => (giver.constellation >= 1 ? 0.75 * (giverStats.def ?? 0) : 0),
    blockedBy: needsConstellation(1),
    toggle: { kind: 'switch', label: 'C1 stacks' },
    confidence: 'sourced',
  }],
  Illuga: [{
    id: 'illuga-burst-lunarcrystallize',
    label:
      'Shadowless Reflection: Nightingale\'s Song, the active member\'s Lunar-Crystallize hits add a share of his Elemental Mastery by Burst level, one stack each (21, up to 15 more from Geo Constructs)',
    target: 'team',
    stage: 'premod',
    stat: 'specialFlat:lunarcrystallize',
    capsHits: true,
    value: ({ giver, giverStats, setting }) => setting === 0 ? 0 : (ILLUGA_SONG_EM[burstLevel(giver, 3) - 1] ?? 0) * (giverStats.elementalMastery ?? 0),
    toggle: { kind: 'stacks', label: 'Nightingale\'s Song stacks', max: () => 36, step: 1 },
    confidence: 'confirmed',
  }, {
    // The user's screenshots of his whole kit (Oct 30 2026); amounts by Burst level from genshin-optimizer
    id: 'illuga-burst-geo',
    label:
      'Shadowless Reflection: Nightingale\'s Song, the active member\'s Geo hits add a share of his Elemental Mastery by Burst level, one stack each (21, up to 15 more from Geo Constructs)',
    target: 'team',
    stage: 'premod',
    stat: 'hitFlat',
    flatElements: ['Geo'],
    value: ({ giver, giverStats }) => (ILLUGA_SONG_GEO_EM[burstLevel(giver, 3) - 1] ?? 0) / 100 * (giverStats.elementalMastery ?? 0),
    toggle: { kind: 'stacks', label: 'Nightingale\'s Song stacks', max: () => 36, step: 1 },
    confidence: 'confirmed',
  }, {
    id: 'illuga-a4-geo',
    label:
      'Demonhunter\'s Dusk: Nightingale\'s Song adds 7/14/24% more of his Elemental Mastery to Geo hits with 1/2/3 Hydro or Geo members (counted for the 21 Burst stacks)',
    target: 'team',
    stage: 'premod',
    stat: 'hitFlat',
    flatElements: ['Geo'],
    flatTriggers: 21,
    value: ({ giver, giverStats, setting }) =>
      ascensionOf(giver) >= 4 && typeof setting === 'number' ? ([0, 0.07, 0.14, 0.24][setting] ?? 0) * (giverStats.elementalMastery ?? 0) : 0,
    blockedBy: needsAscension(4),
    toggle: { kind: 'stacks', label: 'Hydro and Geo members', max: () => 3, step: 1 },
    confidence: 'confirmed',
  }, {
    // The A1 and A4 below are from the user's in-game screenshots (Oct 30 2026)
    id: 'illuga-a4-lunarcrystallize',
    label: 'Demonhunter\'s Dusk: Nightingale\'s Song adds 48/96/160% more of his Elemental Mastery to Lunar-Crystallize hits with 1/2/3 Hydro or Geo members',
    target: 'team',
    stage: 'premod',
    stat: 'specialFlat:lunarcrystallize',
    value: ({ giver, giverStats, setting }) =>
      ascensionOf(giver) >= 4 && typeof setting === 'number' ? ([0, 0.48, 0.96, 1.6][setting] ?? 0) * (giverStats.elementalMastery ?? 0) : 0,
    blockedBy: needsAscension(4),
    toggle: { kind: 'stacks', label: 'Hydro and Geo members', max: () => 3, step: 1 },
    confidence: 'confirmed',
  }, {
    id: 'illuga-a1-crit',
    label: 'Torchforger\'s Covenant: Lightkeeper\'s Oath, Geo DMG CRIT Rate +5% and CRIT DMG +10% after his Skill or Burst',
    target: 'others',
    stage: 'premod',
    stat: 'critRate',
    value: (c) => (ascensionOf(c.giver) >= 1 && c.receiver.element === 'Geo' ? 5 : 0),
    blockedBy: (c) => needsAscension(1)(c) ?? (c.receiver.element === 'Geo' ? undefined : 'Only for Geo DMG (Geo members)'),
    toggle: { kind: 'switch', label: 'Lightkeeper\'s Oath' },
    confidence: 'confirmed',
  }, {
    id: 'illuga-a1-crit-dmg',
    label: 'Torchforger\'s Covenant: Lightkeeper\'s Oath, Geo DMG CRIT DMG +10%',
    target: 'others',
    stage: 'premod',
    stat: 'critDmg',
    value: (c) => (ascensionOf(c.giver) >= 1 && c.receiver.element === 'Geo' ? 10 : 0),
    blockedBy: (c) => needsAscension(1)(c) ?? (c.receiver.element === 'Geo' ? undefined : 'Only for Geo DMG (Geo members)'),
    toggle: { kind: 'switch', label: 'Lightkeeper\'s Oath' },
    confidence: 'confirmed',
  }, {
    id: 'illuga-a1-em',
    label: 'Torchforger\'s Covenant: at Moonsign: Ascendant Gleam, Lightkeeper\'s Oath also gives Elemental Mastery +50',
    target: 'others',
    stage: 'premod',
    stat: 'elementalMastery',
    value: ({ giver }) => (ascensionOf(giver) >= 1 ? 50 : 0),
    blockedBy: needsAscension(1),
    toggle: { kind: 'switch', label: 'Lightkeeper\'s Oath at Ascendant Gleam' },
    confidence: 'confirmed',
  }],
  Mona: [
    {
      id: 'mona-c1-lunarcharged',
      label: 'C1: Lunar-Charged DMG +15% against Omen-affected enemies',
      target: 'team',
      stage: 'premod',
      stat: 'special:lunarcharged',
      value: ({ giver }) => (giver.constellation >= 1 ? 15 : 0),
      blockedBy: needsConstellation(1),
      toggle: { kind: 'switch', label: 'Enemy with Omen' },
      confidence: 'sourced',
    },
    {
      id: 'mona-c1-lunarcrystallize',
      label: 'C1: Lunar-Crystallize DMG +15% against Omen-affected enemies',
      target: 'team',
      stage: 'premod',
      stat: 'special:lunarcrystallize',
      value: ({ giver }) => (giver.constellation >= 1 ? 15 : 0),
      blockedBy: needsConstellation(1),
      toggle: { kind: 'switch', label: 'Enemy with Omen' },
      confidence: 'sourced',
    },
  ],
  Ifa: [
    {
      id: 'ifa-a1-lunarcharged',
      label: 'A1: Lunar-Charged DMG +0.2% per Rescue Essential (up to 150)',
      target: 'team',
      stage: 'premod',
      stat: 'special:lunarcharged',
      value: ({ giver, setting }) => (ascensionOf(giver) >= 1 && typeof setting === 'number' ? 0.2 * setting : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'stacks', label: 'Rescue Essentials', max: () => 150, step: 10 },
      confidence: 'sourced',
    },
    {
      id: 'ifa-a1-stellarswirl',
      label: 'A1: Stellar Swirl DMG +0.24% per Rescue Essential (up to 150)',
      target: 'team',
      stage: 'premod',
      stat: 'special:stellarswirl',
      value: ({ giver, setting }) => (ascensionOf(giver) >= 1 && typeof setting === 'number' ? 0.24 * setting : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'stacks', label: 'Rescue Essentials', max: () => 150, step: 10 },
      confidence: 'sourced',
    },
  ],
}

export const CHARACTER_BUFFS: Record<string, TeamBuff[]> = {
  // Mona's Hexerei: Secret Rite, from the user's screenshots (Oct 30 2026)
  Mona: [{
    id: 'mona-hexerei',
    label:
      'Hexerei: Secret Rite, with 2 Hexerei in the party, other members\' Vaporize DMG +5% per Astral Glow of Mercury stack (up to 3, from her Normal and Charged Attacks)',
    target: 'others',
    stage: 'premod',
    stat: 'vaporizeBonus',
    value: ({ setting, hexerei }) => (hexerei >= 2 && typeof setting === 'number' ? 5 * setting : 0),
    blockedBy: ({ hexerei }) => (hexerei < 2 ? 'Needs 2 Hexerei characters in the party' : undefined),
    toggle: { kind: 'stacks', label: 'Astral Glow of Mercury stacks', max: () => 3, step: 1 },
    confidence: 'confirmed',
  }],
  Bennett: [
    {
      id: 'bennett-burst-atk',
      label: 'Fantastic Voyage: ATK bonus from Bennett\'s base ATK',
      target: 'active',
      stage: 'total',
      stat: 'atk',
      value: ({ giver, giverBaseAtk }) => giverBaseAtk * (BENNETT_BURST_ATK[burstLevel(giver, 5) - 1] + (giver.constellation >= 1 ? 0.2 : 0)),
      toggle: { kind: 'switch', label: 'In Bennett\'s Burst field' },
      confidence: 'sourced',
    },
  ],
  KaedeharaKazuha: [
    {
      id: 'kazuha-a4',
      label: 'Poetics of Fuubutsu: 0.04% DMG Bonus per point of Kazuha\'s Elemental Mastery',
      target: 'team',
      stage: 'premod',
      stat: ({ setting }) => (typeof setting === 'string' && SWIRL_ELEMENTS.includes(setting as Element) ? ELEMENT_DMG_STAT[setting as Element] : undefined),
      value: ({ giver, giverStats }) => (ascensionOf(giver) >= 4 ? (giverStats.elementalMastery ?? 0) * 0.04 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'element', label: 'Swirled element', options: SWIRL_ELEMENTS },
      confidence: 'sourced',
    },
    {
      id: 'kazuha-c2',
      label: 'C2: Elemental Mastery +200 in Kazuha\'s Burst field',
      target: 'active',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ giver }) => (giver.constellation >= 2 ? 200 : 0),
      blockedBy: needsConstellation(2),
      toggle: { kind: 'switch', label: 'In Kazuha\'s Burst field' },
      confidence: 'sourced',
    },
  ],
  Sucrose: [
    {
      id: 'sucrose-hexerei',
      label: 'Hexerei: with 2 Hexerei in the party, Normal, Charged, Plunging, Skill and Burst DMG +5.71% after her Skill, +7.14% after her Burst',
      target: 'team',
      stage: 'premod',
      stat: 'allDmg',
      value: ({ setting, hexerei }) => (hexerei < 2 ? 0 : setting === 2 ? 7.1429 : setting === 1 ? 5.7143 : 0),
      blockedBy: ({ hexerei }) => (hexerei < 2 ? 'Needs 2 Hexerei characters in the party' : undefined),
      toggle: { kind: 'stacks', label: '1 after her Skill, 2 after her Burst', max: () => 2, step: 1 },
      confidence: 'sourced',
    },
    {
      id: 'sucrose-a1',
      label: 'Catalyst Conversion: Elemental Mastery +50 for members of the swirled element',
      target: 'others',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ giver, receiver, setting }) => (ascensionOf(giver) >= 1 && receiver.element === setting ? 50 : 0),
      blockedBy: (context) =>
        needsAscension(1)(context) ?? (context.receiver.element !== context.setting ? `Only for ${String(context.setting)} members` : undefined),
      toggle: { kind: 'element', label: 'Swirled element', options: SWIRL_ELEMENTS },
      confidence: 'sourced',
    },
    {
      id: 'sucrose-a4',
      label: 'Mollis Favonius: 20% of Sucrose\'s Elemental Mastery',
      target: 'others',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ giver, giverStats }) => (ascensionOf(giver) >= 4 ? (giverStats.elementalMastery ?? 0) * 0.2 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'After Sucrose\'s Skill or Burst hits' },
      confidence: 'sourced',
    },
    {
      id: 'sucrose-c6',
      label: 'C6: DMG Bonus +20% of the swirled element after her Burst',
      target: 'team',
      stage: 'premod',
      stat: ({ setting }) => (typeof setting === 'string' && SWIRL_ELEMENTS.includes(setting as Element) ? ELEMENT_DMG_STAT[setting as Element] : undefined),
      value: ({ giver }) => (giver.constellation >= 6 ? 20 : 0),
      blockedBy: needsConstellation(6),
      toggle: { kind: 'element', label: 'Swirled element', options: SWIRL_ELEMENTS },
      confidence: 'sourced',
    },
  ],
  Furina: [
    {
      id: 'furina-fanfare',
      label: 'Let the People Rejoice: DMG Bonus per Fanfare point',
      target: 'team',
      stage: 'premod',
      stat: 'allDmg',
      value: ({ giver, setting }) => (typeof setting === 'number' ? setting * FURINA_DMG_PER_FANFARE[burstLevel(giver, 3) - 1] : 0),
      toggle: { kind: 'stacks', label: 'Fanfare points', max: (giver) => (giver.constellation >= 1 ? 400 : 300), step: 50 },
      confidence: 'sourced',
    },
  ],
  // From here to Zhongli: genshin-optimizer's sheets (Oct 26 2026). The squad's make-up isn't known here, so party
  // conditions are switches or stack counts; element-gated shreds go by the receiver's element (always in the party)
  Albedo: [
    {
      id: 'albedo-hexerei',
      label:
        'Hexerei: with 2 Hexerei in the party, Normal, Charged, Plunging, Skill and Burst DMG +4% per 1,000 of his DEF (up to 12%; +10% more per 1,000 for Hexerei members, up to 30%)',
      target: 'others',
      stage: 'premod',
      stat: 'allDmg',
      value: ({ giverStats, receiver, hexerei }) => {
        if (hexerei < 2) return 0
        const def = giverStats.def ?? 0
        return Math.min(12, def / 1000 * 4) + (HEXEREI.has(receiver.id) ? Math.min(30, def / 1000 * 10) : 0)
      },
      blockedBy: ({ hexerei }) => (hexerei < 2 ? 'Needs 2 Hexerei characters in the party' : undefined),
      toggle: { kind: 'switch', label: 'After his Skill creates a Solar or Silver Isotoma' },
      confidence: 'sourced',
    },
    {
      id: 'albedo-a4',
      label: 'Homuncular Nature: Elemental Mastery +125 after his Burst',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ giver }) => (ascensionOf(giver) >= 4 ? 125 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'After Albedo\'s Burst' },
      confidence: 'sourced',
    },
    {
      id: 'albedo-c6',
      label: 'C6: DMG +17% for shielded members in his Solar Isotoma field',
      target: 'team',
      stage: 'premod',
      stat: 'allDmg',
      value: ({ giver }) => (giver.constellation >= 6 ? 17 : 0),
      blockedBy: needsConstellation(6),
      toggle: { kind: 'switch', label: 'Shielded, in the field' },
      confidence: 'sourced',
    },
  ],
  Barbara: [{
    id: 'barbara-c2',
    label: 'C2: Hydro DMG +15% for the active member during her Skill',
    target: 'active',
    stage: 'premod',
    stat: 'hydroDmg',
    value: ({ giver }) => (giver.constellation >= 2 ? 15 : 0),
    blockedBy: needsConstellation(2),
    toggle: { kind: 'switch', label: 'During Barbara\'s Skill' },
    confidence: 'sourced',
  }],
  Chevreuse: [
    {
      id: 'chevreuse-a1',
      label: 'Vanguard\'s Coordinated Tactics: the enemy\'s Pyro and Electro RES -40% after Overloaded, in a Pyro + Electro party',
      target: 'team',
      stage: 'premod',
      stat: (c) => (receiverElement(c, ['Pyro', 'Electro']) ? `resShred:${receiverElement(c, ['Pyro', 'Electro'])}` as EnemyDebuffKey : undefined),
      value: ({ giver }) => (ascensionOf(giver) >= 1 ? 40 : 0),
      blockedBy: (c) => needsAscension(1)(c) ?? onlyFor(['Pyro', 'Electro'])(c),
      toggle: { kind: 'switch', label: 'After Overloaded (Pyro + Electro party only)' },
      confidence: 'sourced',
    },
    {
      id: 'chevreuse-a4',
      label: 'Vertical Force Coordination: Pyro and Electro members\' ATK +1% per 1,000 of her Max HP (up to 40%)',
      target: 'team',
      stage: 'premod',
      stat: 'atkPct',
      value: (c) => (ascensionOf(c.giver) >= 4 && receiverElement(c, ['Pyro', 'Electro']) ? Math.min(40, (c.giverStats.hp ?? 0) / 1000) : 0),
      blockedBy: (c) => needsAscension(4)(c) ?? onlyFor(['Pyro', 'Electro'])(c),
      toggle: { kind: 'switch', label: 'After her Overcharged Ball' },
      confidence: 'sourced',
    },
  ],
  Citlali: [{
    // From the user's screenshot of her C1 (Oct 30 2026)
    id: 'citlali-c1',
    label:
      'C1: Opalstar Vestments, the active member\'s Normal, Charged, Plunging, Skill and Burst hits add 200% of her Elemental Mastery, one Stellar Blade each (10, 3 more after Frozen or Melt)',
    target: 'others',
    stage: 'premod',
    stat: 'hitFlat',
    flatElements: ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro', 'Physical'],
    value: ({ giver, giverStats }) => (giver.constellation >= 1 ? 2 * (giverStats.elementalMastery ?? 0) : 0),
    blockedBy: needsConstellation(1),
    toggle: { kind: 'stacks', label: 'Stellar Blades (10, +3 after Frozen or Melt)', max: () => 13, step: 1 },
    confidence: 'confirmed',
  }, {
    id: 'citlali-a1',
    label: 'Itzpapa\'s Hymn: the enemy\'s Pyro and Hydro RES -20% after Frozen or Melt (-40% at C2)',
    target: 'team',
    stage: 'premod',
    stat: (c) => (receiverElement(c, ['Pyro', 'Hydro']) ? `resShred:${receiverElement(c, ['Pyro', 'Hydro'])}` as EnemyDebuffKey : undefined),
    value: ({ giver }) => (ascensionOf(giver) >= 1 ? (giver.constellation >= 2 ? 40 : 20) : 0),
    blockedBy: (c) => needsAscension(1)(c) ?? onlyFor(['Pyro', 'Hydro'])(c),
    toggle: { kind: 'switch', label: 'After Frozen or Melt' },
    confidence: 'sourced',
  }],
  Diona: [{
    id: 'diona-c6',
    label: 'C6: Elemental Mastery +200 above 50% HP in her Burst field',
    target: 'active',
    stage: 'premod',
    stat: 'elementalMastery',
    value: ({ giver }) => (giver.constellation >= 6 ? 200 : 0),
    blockedBy: needsConstellation(6),
    toggle: { kind: 'switch', label: 'In the field above 50% HP' },
    confidence: 'sourced',
  }],
  Escoffier: [{
    id: 'escoffier-a4',
    label: 'Inspiration-Immersed Seasoning: the enemy\'s Cryo and Hydro RES -5/10/15/55% with 1/2/3/4 Hydro or Cryo members',
    target: 'team',
    stage: 'premod',
    stat: (c) => (receiverElement(c, ['Cryo', 'Hydro']) ? `resShred:${receiverElement(c, ['Cryo', 'Hydro'])}` as EnemyDebuffKey : undefined),
    value: ({ giver, setting }) => (ascensionOf(giver) >= 4 && typeof setting === 'number' ? [0, 5, 10, 15, 55][setting] ?? 0 : 0),
    blockedBy: (c) => needsAscension(4)(c) ?? onlyFor(['Cryo', 'Hydro'])(c),
    toggle: { kind: 'stacks', label: 'Hydro and Cryo members', max: () => 4, step: 1 },
    confidence: 'sourced',
  }],
  Faruzan: [
    {
      id: 'faruzan-burst',
      label: 'The Wind\'s Secret Ways: Anemo DMG Bonus (Prayerful Wind\'s Benefit) and the enemy\'s Anemo RES -30%',
      target: 'team',
      stage: 'premod',
      stat: 'anemoDmg',
      value: ({ giver }) => FARUZAN_BURST_ANEMO[burstLevel(giver, 5) - 1],
      toggle: { kind: 'switch', label: 'Prayerful Wind\'s Benefit' },
      confidence: 'sourced',
    },
    {
      id: 'faruzan-burst-shred',
      label: 'The Wind\'s Secret Ways: the enemy\'s Anemo RES -30% after the Burst or Pressurized Collapse hits',
      target: 'team',
      stage: 'premod',
      stat: 'resShred:Anemo',
      value: () => 30,
      toggle: { kind: 'switch', label: 'Enemy hit' },
      confidence: 'sourced',
    },
    {
      id: 'faruzan-c6',
      label: 'C6: Anemo CRIT DMG +40% with Prayerful Wind\'s Benefit',
      target: 'team',
      stage: 'premod',
      stat: 'critDmg',
      value: (c) => (c.giver.constellation >= 6 && c.receiver.element === 'Anemo' ? 40 : 0),
      blockedBy: (c) => needsConstellation(6)(c) ?? onlyFor(['Anemo'])(c),
      toggle: { kind: 'switch', label: 'Prayerful Wind\'s Benefit' },
      confidence: 'sourced',
    },
  ],
  Fischl: [{
    id: 'fischl-hexerei',
    label:
      'Hexerei: with 2 Hexerei in the party, the active member\'s ATK +22.5% after Overloaded or Elemental Mastery +90 after Electro-Charged or Lunar-Charged (x2 at C6)',
    target: 'active',
    stage: 'premod',
    stat: ({ setting }) => (setting === 1 ? 'atkPct' : setting === 2 ? 'elementalMastery' : undefined),
    value: ({ giver, setting, hexerei }) => (hexerei < 2 ? 0 : (setting === 1 ? 22.5 : 90) * (giver.constellation >= 6 ? 2 : 1)),
    blockedBy: ({ hexerei }) => (hexerei < 2 ? 'Needs 2 Hexerei characters in the party' : undefined),
    toggle: { kind: 'stacks', label: '1 ATK (Overloaded), 2 EM (Electro-Charged)', max: () => 2, step: 1 },
    confidence: 'sourced',
  }],
  Gorou: [
    {
      id: 'gorou-skill-def',
      label: 'Inuzaka All-Round Defense: DEF bonus in his field (Geo DMG +15% with 3 Geo members)',
      target: 'active',
      stage: 'premod',
      stat: 'def',
      value: ({ giver }) => GOROU_SKILL_DEF[skillLevel(giver, 3) - 1],
      toggle: { kind: 'switch', label: 'In Gorou\'s field' },
      confidence: 'sourced',
    },
    {
      id: 'gorou-skill-geo',
      label: 'Inuzaka All-Round Defense: Geo DMG +15% in his field with 3 Geo members',
      target: 'active',
      stage: 'premod',
      stat: 'geoDmg',
      value: () => 15,
      toggle: { kind: 'switch', label: '3 Geo members, in the field', offByDefault: true },
      confidence: 'sourced',
    },
    {
      id: 'gorou-a1',
      label: 'Rewards for Valor: DEF +25% after his Burst',
      target: 'team',
      stage: 'premod',
      stat: 'defPct',
      value: ({ giver }) => (ascensionOf(giver) >= 1 ? 25 : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'switch', label: 'After Gorou\'s Burst' },
      confidence: 'sourced',
    },
    {
      id: 'gorou-c6',
      label: 'C6: Geo CRIT DMG +10/20/40% with 1/2/3 Geo members, after his Skill or Burst',
      target: 'team',
      stage: 'premod',
      stat: 'critDmg',
      value: (c) => (c.giver.constellation >= 6 && c.receiver.element === 'Geo' && typeof c.setting === 'number' ? [0, 10, 20, 40][c.setting] ?? 0 : 0),
      blockedBy: (c) => needsConstellation(6)(c) ?? onlyFor(['Geo'])(c),
      toggle: { kind: 'stacks', label: 'Geo members', max: () => 3, step: 1 },
      confidence: 'sourced',
    },
  ],
  Iansan: [
    {
      id: 'iansan-burst-atk',
      label: 'The Three Principles of Power: ATK +27% of her ATK at 42 Nightsoul points (capped by Burst level)',
      target: 'active',
      stage: 'total',
      stat: 'atk',
      value: ({ giver, giverStats }) => Math.min(IANSAN_BURST_ATK_CAP[burstLevel(giver, 5) - 1], 0.27 * (giverStats.atk ?? 0)),
      toggle: { kind: 'switch', label: 'Kinetic Energy at 42' },
      confidence: 'sourced',
    },
    {
      id: 'iansan-c2',
      label: 'C2: ATK +30% for the active member while she is off-field',
      target: 'active',
      stage: 'premod',
      stat: 'atkPct',
      value: ({ giver }) => (giver.constellation >= 2 ? 30 : 0),
      blockedBy: needsConstellation(2),
      toggle: { kind: 'switch', label: 'Precise Movement, Iansan off-field' },
      confidence: 'sourced',
    },
    {
      id: 'iansan-c6',
      label: 'C6: DMG +25% for the active member (Extreme Force)',
      target: 'active',
      stage: 'premod',
      stat: 'allDmg',
      value: ({ giver }) => (giver.constellation >= 6 ? 25 : 0),
      blockedBy: needsConstellation(6),
      toggle: { kind: 'switch', label: 'Extreme Force' },
      confidence: 'sourced',
    },
  ],
  Shenhe: [
    {
      id: 'shenhe-quill',
      label: 'Spring Spirit Summoning: Icy Quill, Cryo hits add a share of Shenhe\'s ATK (82.2% at Skill level 10), for 5 hits after a press or 7 after a hold',
      target: 'team',
      stage: 'premod',
      stat: 'hitFlat',
      flatElements: ['Cryo'],
      value: ({ giver, giverStats }) => (giverStats.atk ?? 0) * SHENHE_QUILL_ATK[skillLevel(giver, 3) - 1] / 100,
      toggle: { kind: 'stacks', label: 'Quill hits (5 press, 7 hold)', max: () => 7, step: 1 },
      confidence: 'confirmed',
    },
    {
      id: 'shenhe-a4-hold',
      label: 'Spirit Communion Seal: Normal, Charged and Plunging Attack DMG +15% after her Skill hold',
      target: 'team',
      stage: 'premod',
      stat: 'normalDmg',
      value: ({ giver }) => (ascensionOf(giver) >= 4 ? 15 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'After her Skill hold', offByDefault: true },
      confidence: 'confirmed',
    },
    {
      id: 'shenhe-a4-hold-charged',
      label: 'Spirit Communion Seal: Charged Attack DMG +15% after her Skill hold',
      target: 'team',
      stage: 'premod',
      stat: 'chargedDmg',
      value: ({ giver }) => (ascensionOf(giver) >= 4 ? 15 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'After her Skill hold', offByDefault: true },
      confidence: 'confirmed',
    },
    {
      id: 'shenhe-a4-hold-plunging',
      label: 'Spirit Communion Seal: Plunging Attack DMG +15% after her Skill hold',
      target: 'team',
      stage: 'premod',
      stat: 'plungingDmg',
      value: ({ giver }) => (ascensionOf(giver) >= 4 ? 15 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'After her Skill hold', offByDefault: true },
      confidence: 'confirmed',
    },
    {
      id: 'shenhe-burst-shred',
      label: 'Divine Maiden\'s Deliverance: the enemy\'s Cryo and Physical RES shred in her field (her Icy Quill\'s flat DMG isn\'t counted)',
      target: 'team',
      stage: 'premod',
      stat: (c) => (c.receiver.element === 'Cryo' ? 'resShred:Cryo' : 'resShred:Physical'),
      value: ({ giver }) => SHENHE_BURST_RES[burstLevel(giver, 5) - 1],
      toggle: { kind: 'switch', label: 'In Shenhe\'s Burst field' },
      confidence: 'sourced',
    },
    {
      id: 'shenhe-a1',
      label: 'Deific Embrace: Cryo DMG +15% in her Burst field (+15% Cryo CRIT DMG at C2)',
      target: 'active',
      stage: 'premod',
      stat: 'cryoDmg',
      value: ({ giver }) => (ascensionOf(giver) >= 1 ? 15 : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'switch', label: 'In Shenhe\'s Burst field' },
      confidence: 'sourced',
    },
    {
      id: 'shenhe-c2',
      label: 'C2: Cryo CRIT DMG +15% in her Burst field',
      target: 'active',
      stage: 'premod',
      stat: 'critDmg',
      value: (c) => (c.giver.constellation >= 2 && c.receiver.element === 'Cryo' ? 15 : 0),
      blockedBy: (c) => needsConstellation(2)(c) ?? onlyFor(['Cryo'])(c),
      toggle: { kind: 'switch', label: 'In Shenhe\'s Burst field' },
      confidence: 'sourced',
    },
    {
      id: 'shenhe-a4-press',
      label: 'Spirit Communion Seal: Skill and Burst DMG +15% after her Skill press',
      target: 'team',
      stage: 'premod',
      stat: 'skillDmg',
      value: ({ giver }) => (ascensionOf(giver) >= 4 ? 15 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'After her Skill press' },
      confidence: 'sourced',
    },
    {
      id: 'shenhe-a4-press-burst',
      label: 'Spirit Communion Seal: Burst DMG +15% after her Skill press',
      target: 'team',
      stage: 'premod',
      stat: 'burstDmg',
      value: ({ giver }) => (ascensionOf(giver) >= 4 ? 15 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'After her Skill press' },
      confidence: 'sourced',
    },
  ],
  Venti: [
    {
      id: 'venti-hexerei',
      label: 'Hexerei: with 2 Hexerei in the party, the active member\'s DMG +50% after his Burst swirls an element',
      target: 'active',
      stage: 'premod',
      stat: 'allDmg',
      value: ({ hexerei }) => (hexerei >= 2 ? 50 : 0),
      blockedBy: ({ hexerei }) => (hexerei < 2 ? 'Needs 2 Hexerei characters in the party' : undefined),
      toggle: { kind: 'switch', label: 'Burst swirled an element' },
      confidence: 'sourced',
    },
    {
      id: 'venti-c2',
      label: 'C2: the enemy\'s Anemo and Physical RES -12% after his Skill hits',
      target: 'team',
      stage: 'premod',
      stat: (c) => (c.receiver.element === 'Anemo' ? 'resShred:Anemo' : 'resShred:Physical'),
      value: ({ giver }) => (giver.constellation >= 2 ? 12 : 0),
      blockedBy: needsConstellation(2),
      toggle: { kind: 'switch', label: 'Hit by his Skill' },
      confidence: 'sourced',
    },
    {
      id: 'venti-c6',
      label: 'C6: the enemy\'s Anemo RES -20%, and RES of the absorbed element -20%, in his Burst',
      target: 'team',
      stage: 'premod',
      stat: (c) => (c.receiver.element ? `resShred:${c.receiver.element}` as EnemyDebuffKey : undefined),
      value: ({ giver }) => (giver.constellation >= 6 ? 20 : 0),
      blockedBy: needsConstellation(6),
      toggle: { kind: 'switch', label: 'In his Burst (Anemo or the absorbed element)' },
      confidence: 'sourced',
    },
  ],
  Vodyanitsa: [
    {
      id: 'vodyanitsa-lead-vocal',
      label:
        'Dirge of the Fandyr: Lead Vocal, the active member\'s Hydro and Cryo hits add 140 DMG per 1,000 of her Max HP above 40,000 (up to 3,500), for 25 hits',
      target: 'active',
      stage: 'premod',
      stat: 'hitFlat',
      flatElements: ['Hydro', 'Cryo'],
      value: ({ giver, giverStats }) => (ascensionOf(giver) >= 4 ? Math.min(3500, Math.max(0, (giverStats.hp ?? 0) - 40000) / 1000 * 140) : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'stacks', label: 'Lead Vocal hits', max: () => 25, step: 1 },
      confidence: 'confirmed',
    },
    {
      id: 'vodyanitsa-lead-vocal-swirl',
      label: 'Dirge of the Fandyr: with a Wandering Vortex, Lead Vocal adds 260 Stellar Swirl DMG per 1,000 of her Max HP above 40,000 (up to 6,500) instead',
      target: 'active',
      stage: 'premod',
      stat: 'specialFlat:stellarswirl',
      value: ({ giver, giverStats }) => (ascensionOf(giver) >= 4 ? Math.min(6500, Math.max(0, (giverStats.hp ?? 0) - 40000) / 1000 * 260) : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'Wandering Vortex', offByDefault: true },
      confidence: 'confirmed',
    },
    {
      id: 'vodyanitsa-a1-anemo',
      label: 'The Last Djeguako Songstress: generating or detonating a Wandering Vortex lowers the enemy\'s Anemo RES by 35%',
      target: 'team',
      stage: 'premod',
      stat: 'resShred:Anemo',
      value: ({ giver }) => (ascensionOf(giver) >= 1 ? 35 : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'switch', label: 'Wandering Vortex', offByDefault: true },
      confidence: 'confirmed',
    },
  ],
  YumemizukiMizuki: [{
    id: 'mizuki-vast-dream',
    label: 'Vast Be the Dream: in her Dreamdrifter state, Elemental Mastery +10% of hers for the other members',
    target: 'others',
    stage: 'premod',
    stat: 'elementalMastery',
    value: ({ giverStats }) => 0.1 * (giverStats.elementalMastery ?? 0),
    toggle: { kind: 'switch', label: 'Mizuki in Dreamdrifter' },
    confidence: 'confirmed',
  }],
  Xilonen: [{
    id: 'xilonen-skill-shred',
    label: 'Yohual\'s Scratch: the enemy\'s RES shred for the party\'s Pyro, Hydro, Cryo, Electro (and Geo) elements while a Source Sample is active',
    target: 'team',
    stage: 'premod',
    stat: (
      c,
    ) => (c.receiver.element && c.receiver.element !== 'Anemo' && c.receiver.element !== 'Dendro'
      ? `resShred:${c.receiver.element}` as EnemyDebuffKey
      : undefined),
    value: ({ giver }) => XILONEN_SKILL_RES[skillLevel(giver, 3) - 1],
    blockedBy: (c) => (c.receiver.element === 'Anemo' || c.receiver.element === 'Dendro' ? 'Not for Anemo or Dendro members' : undefined),
    toggle: { kind: 'switch', label: 'Source Sample active' },
    confidence: 'sourced',
  }],
  Xingqiu: [{
    id: 'xingqiu-c2',
    label: 'C2: the enemy\'s Hydro RES -15% after his rain swords hit',
    target: 'team',
    stage: 'premod',
    stat: 'resShred:Hydro',
    value: ({ giver }) => (giver.constellation >= 2 ? 15 : 0),
    blockedBy: needsConstellation(2),
    toggle: { kind: 'switch', label: 'Hit by rain swords' },
    confidence: 'sourced',
  }],
  Yaoyao: [{
    id: 'yaoyao-c1',
    label: 'C1: Dendro DMG +15% after a Radish explodes',
    target: 'active',
    stage: 'premod',
    stat: 'dendroDmg',
    value: ({ giver }) => (giver.constellation >= 1 ? 15 : 0),
    blockedBy: needsConstellation(1),
    toggle: { kind: 'switch', label: 'Hit by a Radish' },
    confidence: 'sourced',
  }],
  Yelan: [{
    id: 'yelan-a4',
    label: 'Adapt With Ease: DMG +1%, +3.5% per second in her Burst (up to 50%), for the active member',
    target: 'active',
    stage: 'premod',
    stat: 'allDmg',
    value: ({ giver, setting }) => (ascensionOf(giver) >= 4 && typeof setting === 'number' ? Math.min(50, 1 + 3.5 * setting) : 0),
    blockedBy: needsAscension(4),
    toggle: { kind: 'stacks', label: 'Seconds into her Burst', max: () => 14, step: 1 },
    confidence: 'sourced',
  }],
  Nilou: [
    {
      id: 'nilou-a1-em',
      label: 'Court of Dancing Petals: Golden Chalice\'s Bounty, Elemental Mastery +100 after being hit by Dendro attacks (Dendro and Hydro party only)',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ giver }) => (ascensionOf(giver) >= 1 ? 100 : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'switch', label: 'Golden Chalice\'s Bounty, hit by Dendro', offByDefault: true },
      confidence: 'confirmed',
    },
    {
      id: 'nilou-a4-bloom',
      label: 'Dreamy Dance of Aeons: Bountiful Core (Bloom) DMG +9% per 1,000 of Nilou\'s Max HP above 30,000 (up to 400%)',
      target: 'team',
      stage: 'premod',
      stat: 'bloomBonus',
      value: ({ giver, giverStats }) => ascensionOf(giver) >= 4 ? Math.min(400, Math.max(0, (giverStats.hp ?? 0) - 30000) / 1000 * 9) : 0,
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'Golden Chalice\'s Bounty (Dendro and Hydro party)', offByDefault: true },
      confidence: 'confirmed',
    },
  ],
  Zhongli: [
    {
      id: 'zhongli-shield-shred',
      label: 'Jade Shield: Elemental and Physical RES -20% for enemies near the shielded character',
      target: 'team',
      stage: 'premod',
      stat: 'resShred:all',
      value: () => 20,
      toggle: { kind: 'switch', label: 'Protected by the Jade Shield' },
      confidence: 'sourced',
    },
  ],
  Lisa: [
    {
      id: 'lisa-a4',
      label: 'Static Electricity Field: enemies hit by Lightning Rose have DEF -15%',
      target: 'team',
      stage: 'premod',
      stat: 'defShred',
      value: ({ giver }) => (ascensionOf(giver) >= 4 ? 15 : 0),
      blockedBy: needsAscension(4),
      toggle: { kind: 'switch', label: 'Enemy hit by Lightning Rose' },
      confidence: 'sourced',
    },
  ],
  Nahida: [
    {
      id: 'nahida-a1',
      label: 'Compassion Illuminated: 25% of the team\'s highest Elemental Mastery (max 250)',
      target: 'active',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ giver, teamMaxElementalMastery }) => (ascensionOf(giver) >= 1 ? Math.min(250, teamMaxElementalMastery * 0.25) : 0),
      blockedBy: needsAscension(1),
      toggle: { kind: 'switch', label: 'In Nahida\'s Burst field' },
      confidence: 'sourced',
    },
    {
      id: 'nahida-c2-lunarbloom-crit-rate',
      label: 'C2: Lunar-Bloom CRIT Rate +20%',
      target: 'team',
      stage: 'premod',
      stat: 'specialCritRate:lunarbloom',
      value: ({ giver }) => (giver.constellation >= 2 ? 20 : 0),
      blockedBy: needsConstellation(2),
      confidence: 'sourced',
    },
    {
      id: 'nahida-c2-lunarbloom-crit-dmg',
      label: 'C2: Lunar-Bloom CRIT DMG +30%',
      target: 'team',
      stage: 'premod',
      stat: 'specialCritDmg:lunarbloom',
      value: ({ giver }) => (giver.constellation >= 2 ? 30 : 0),
      blockedBy: needsConstellation(2),
      confidence: 'sourced',
    },
  ],
}

// The Lunar characters' buffs go with any others they have (Mona's Hexerei is in the list above)
for (const [id, buffs] of Object.entries(LUNAR_KIT_BUFFS)) CHARACTER_BUFFS[id] = [...(CHARACTER_BUFFS[id] ?? []), ...buffs]

const byRefinement = (r1: number, step: number) => (giver: GenshinCharacter) => r1 + step * ((giver.weapon?.refinement ?? 1) - 1)

// By GOOD weapon key
export const WEAPON_BUFFS: Record<string, TeamBuff[]> = {
  ThrillingTalesOfDragonSlayers: [
    {
      id: 'ttds',
      label: 'Thrilling Tales of Dragon Slayers: ATK% for the next character on the field',
      target: 'next',
      stage: 'premod',
      stat: 'atkPct',
      value: ({ giver }) => byRefinement(24, 6)(giver),
      toggle: { kind: 'switch', label: 'Switched in after the wearer' },
      nonStacking: 'ttds',
      confidence: 'sourced',
    },
  ],
  FreedomSworn: [
    {
      id: 'freedom-sworn-atk',
      label: 'Freedom-Sworn: Millennial Movement ATK%',
      target: 'team',
      stage: 'premod',
      stat: 'atkPct',
      value: ({ giver }) => byRefinement(20, 5)(giver),
      toggle: { kind: 'switch', label: 'Millennial Movement active' },
      nonStacking: 'millennial-movement-atk',
      confidence: 'sourced',
    },
  ],
  SongOfBrokenPines: [
    {
      id: 'song-of-broken-pines-atk',
      label: 'Song of Broken Pines: Millennial Movement ATK%',
      target: 'team',
      stage: 'premod',
      stat: 'atkPct',
      value: ({ giver }) => byRefinement(20, 5)(giver),
      toggle: { kind: 'switch', label: 'Millennial Movement active' },
      nonStacking: 'millennial-movement-atk',
      confidence: 'sourced',
    },
  ],
  ElegyForTheEnd: [
    {
      id: 'elegy-em',
      label: 'Elegy for the End: Millennial Movement Elemental Mastery',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ giver }) => byRefinement(100, 25)(giver),
      toggle: { kind: 'switch', label: 'Millennial Movement active' },
      nonStacking: 'millennial-movement-em',
      confidence: 'sourced',
    },
    {
      id: 'elegy-atk',
      label: 'Elegy for the End: Millennial Movement ATK%',
      target: 'team',
      stage: 'premod',
      stat: 'atkPct',
      value: ({ giver }) => byRefinement(20, 5)(giver),
      toggle: { kind: 'switch', label: 'Millennial Movement active' },
      nonStacking: 'millennial-movement-atk',
      confidence: 'sourced',
    },
  ],
}

// By GOOD set key, for a wearer with 4 pieces
export const SET_4PC_BUFFS: Record<string, TeamBuff[]> = {
  SilkenMoonsSerenade: [
    {
      id: 'silken-moon-em-team',
      label: 'Gleaming Moon: Devotion: Elemental Mastery +60 (Nascent Gleam) or +120 (Ascendant Gleam)',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: ({ setting }) => (typeof setting === 'number' ? 60 * setting : 0),
      toggle: { kind: 'stacks', label: '1 Nascent, 2 Ascendant', max: () => 2, step: 1 },
      nonStacking: 'gleaming-moon-devotion',
      confidence: 'sourced',
    },
    {
      id: 'silken-moon-lunar-team',
      label: 'Lunar Reaction DMG +10% per different Gleaming Moon effect in the party',
      target: 'team',
      stage: 'premod',
      stat: 'lunarBonus',
      value: ({ setting }) => (typeof setting === 'number' ? 10 * setting : 0),
      toggle: { kind: 'stacks', label: 'Gleaming Moon effects', max: () => 2, step: 1 },
      nonStacking: 'gleaming-moon-lunar',
      confidence: 'sourced',
    },
  ],
  NightOfTheSkysUnveiling: [{
    id: 'night-sky-lunar-team',
    label: 'Lunar Reaction DMG +10% per different Gleaming Moon effect in the party',
    target: 'team',
    stage: 'premod',
    stat: 'lunarBonus',
    value: ({ setting }) => (typeof setting === 'number' ? 10 * setting : 0),
    toggle: { kind: 'stacks', label: 'Gleaming Moon effects', max: () => 2, step: 1 },
    nonStacking: 'gleaming-moon-lunar',
    confidence: 'sourced',
  }],
  ViridescentVenerer: [
    {
      id: 'vv-4pc-shred',
      label: 'Viridescent Venerer 4-piece: RES -40% to the swirled element',
      target: 'team',
      stage: 'premod',
      stat: ({ setting }) => (typeof setting === 'string' && SWIRL_ELEMENTS.includes(setting as Element) ? `resShred:${setting as Element}` : undefined),
      value: () => 40,
      toggle: { kind: 'element', label: 'Swirled element', options: SWIRL_ELEMENTS },
      nonStacking: 'vv-4pc',
      confidence: 'sourced',
    },
  ],
  NoblesseOblige: [
    {
      id: 'noblesse-4pc',
      label: 'Noblesse Oblige 4-piece: ATK +20% for the team',
      target: 'team',
      stage: 'premod',
      stat: 'atkPct',
      value: () => 20,
      toggle: { kind: 'switch', label: 'After the wearer\'s Burst' },
      nonStacking: 'noblesse',
      confidence: 'sourced',
    },
  ],
  Instructor: [
    {
      id: 'instructor-4pc',
      label: 'Instructor 4-piece: Elemental Mastery +120 for the team',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: () => 120,
      toggle: { kind: 'switch', label: 'After the wearer triggers a reaction' },
      nonStacking: 'instructor',
      confidence: 'sourced',
    },
  ],
  TenacityOfTheMillelith: [
    {
      id: 'millelith-4pc',
      label: 'Tenacity of the Millelith 4-piece: ATK +20% for the team',
      target: 'team',
      stage: 'premod',
      stat: 'atkPct',
      value: () => 20,
      toggle: { kind: 'switch', label: 'After the wearer\'s Skill hits' },
      nonStacking: 'millelith',
      confidence: 'sourced',
    },
  ],
  ArchaicPetra: [
    {
      id: 'petra-4pc',
      label: 'Archaic Petra 4-piece: DMG Bonus +35% for the crystallized element',
      target: 'team',
      stage: 'premod',
      stat: ({ setting }) => (typeof setting === 'string' && SWIRL_ELEMENTS.includes(setting as Element) ? ELEMENT_DMG_STAT[setting as Element] : undefined),
      value: () => 35,
      toggle: { kind: 'element', label: 'Crystallized element', options: SWIRL_ELEMENTS },
      nonStacking: 'petra',
      confidence: 'sourced',
    },
  ],
}

// Elemental resonance: a team of 4 with at least 2 members of an element. The giver is the team, not a member
// Lunar Reaction DMG per point of the giver's stat for Moonsign: Ascendant Gleam, by the giver's element, up to 36%
const ASCENDANT_GLEAM: Record<Element, { stat: GenshinStatKey, perPoint: number }> = {
  Pyro: { stat: 'atk', perPoint: 0.009 },
  Electro: { stat: 'atk', perPoint: 0.009 },
  Cryo: { stat: 'atk', perPoint: 0.009 },
  Hydro: { stat: 'hp', perPoint: 0.0006 },
  Geo: { stat: 'def', perPoint: 0.01 },
  Anemo: { stat: 'elementalMastery', perPoint: 0.0225 },
  Dendro: { stat: 'elementalMastery', perPoint: 0.0225 },
}

// Buffs any teammate can give, whoever they are
export const ANY_MEMBER_BUFFS: TeamBuff[] = [
  {
    id: 'moonsign-ascendant-gleam',
    label:
      'Moonsign: Ascendant Gleam: for 20s after a non-Moonsign teammate\'s Skill or Burst, Lunar Reaction DMG up by their stat (ATK, HP, DEF or EM by element), up to 36%',
    target: 'team',
    stage: 'premod',
    stat: 'lunarBonus',
    value: ({ giver, giverStats }) => {
      const scaling = giver.element ? ASCENDANT_GLEAM[giver.element] : undefined
      return scaling ? Math.min(36, (giverStats[scaling.stat] ?? 0) * scaling.perPoint) : 0
    },
    toggle: { kind: 'switch', label: 'Cast a Skill or Burst in the last 20s' },
    nonStacking: 'moonsign-ascendant-gleam',
    confidence: 'sourced',
  },
]

export const RESONANCE_BUFFS: Partial<Record<Element, TeamBuff[]>> = {
  Pyro: [{ id: 'resonance-pyro', label: 'Fervent Flames: ATK +25%', target: 'team', stage: 'premod', stat: 'atkPct', value: () => 25, confidence: 'sourced' }],
  Hydro: [{
    id: 'resonance-hydro',
    label: 'Soothing Water: Max HP +25%',
    target: 'team',
    stage: 'premod',
    stat: 'hpPct',
    value: () => 25,
    confidence: 'sourced',
  }],
  Cryo: [
    {
      id: 'resonance-cryo',
      label: 'Shattering Ice: CRIT Rate +15%',
      target: 'team',
      stage: 'premod',
      stat: 'critRate',
      value: () => 15,
      toggle: { kind: 'switch', label: 'Against Frozen or Cryo-affected enemies' },
      confidence: 'sourced',
    },
  ],
  Geo: [
    {
      id: 'resonance-geo',
      label: 'Enduring Rock: DMG Bonus +15%',
      target: 'team',
      stage: 'premod',
      stat: 'allDmg',
      value: () => 15,
      toggle: { kind: 'switch', label: 'Protected by a shield' },
      confidence: 'sourced',
    },
  ],
  Dendro: [
    {
      id: 'resonance-dendro',
      label: 'Sprawling Greenery: Elemental Mastery +50',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: () => 50,
      confidence: 'sourced',
    },
    {
      id: 'resonance-dendro-burning',
      label: 'Sprawling Greenery: Elemental Mastery +30',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: () => 30,
      toggle: { kind: 'switch', label: 'After Burning, Quicken or Bloom' },
      confidence: 'sourced',
    },
    {
      id: 'resonance-dendro-aggravate',
      label: 'Sprawling Greenery: Elemental Mastery +20',
      target: 'team',
      stage: 'premod',
      stat: 'elementalMastery',
      value: () => 20,
      toggle: { kind: 'switch', label: 'After Aggravate, Spread, Hyperbloom or Burgeon' },
      confidence: 'sourced',
    },
  ],
}
