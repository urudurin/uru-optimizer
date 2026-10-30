import type {
  DamageElement,
  SpecialKind,
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
export type BuffStat = GenshinStatKey | EnemyDebuffKey | 'lunarBonus' | SpecialStat

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
      label: 'Pale Hymn: Lunar-Bloom DMG added per hit, a share of her Elemental Mastery by her burst level',
      target: 'team',
      stage: 'premod',
      stat: 'specialFlat:lunarbloom',
      value: ({ giver, giverStats }) => (LAUMA_PALE_HYMN_EM[burstLevel(giver, 3) - 1] ?? 0) * (giverStats.elementalMastery ?? 0),
      toggle: { kind: 'switch', label: 'Pale Hymn stacks' },
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
    label: 'Burst: Lunar-Crystallize DMG added per hit, a share of his Elemental Mastery by his burst level',
    target: 'team',
    stage: 'premod',
    stat: 'specialFlat:lunarcrystallize',
    value: ({ giver, giverStats }) => (ILLUGA_SONG_EM[burstLevel(giver, 3) - 1] ?? 0) * (giverStats.elementalMastery ?? 0),
    toggle: { kind: 'switch', label: 'During his Burst' },
    confidence: 'sourced',
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
  ...LUNAR_KIT_BUFFS,
}

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
