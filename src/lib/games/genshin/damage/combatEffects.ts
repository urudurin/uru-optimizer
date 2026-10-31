import type {
  HitBuff,
  SpecialKind,
} from 'lib/games/genshin/damage/damage'
import type { ScreenStats } from 'lib/games/genshin/data/screenPassives'
import type { BuffSetting } from 'lib/games/genshin/team/buffs'
import {
  type Element,
  ELEMENT_DMG_STAT,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'

// Effects a character gets in combat from their own kit and artifact sets, on top of the stat screen: what makes the
// rotation damage line up with the game when the character is fighting. Only the optimizer counts them (the Characters
// page stays a stat screen). Each effect gives
//   - premod: bonuses known up front (ATK%, a DMG Bonus), added with the other bonuses
//   - final: bonuses worked out from the build's final stats (Hu Tao's ATK from HP, Emblem's Burst DMG from ER)
//   - reactions: reaction DMG bonuses (Crimson Witch, Thundering Fury), in percent, the same for every build
//   - debuffs: what the wearer does to the enemy (Deepwood Memories)
//   - hits: buffs to some hits only (Raiden's Resolve, Nahida's Tri-Karma bonus), as damage/damage.ts HitBuffs
// Weapon effects use the weapon's refinement; most grow by a quarter of the R1 value per refinement.
// 4-piece effects count for the set picked in the optimizer's 4-piece filter (every build then has it); combat-only
// 2-piece bonuses (Noblesse Oblige's Burst DMG...) count wherever the set has 2 pieces.
// Values from the in-game descriptions, the scalings checked against genshin-optimizer's sheets and skillParam data
// (https://github.com/frzyc/genshin-optimizer, MIT). Personal, non-commercial use.

type Stats = Partial<Record<GenshinStatKey, number>>

export type EffectToggle =
  | { kind: 'switch', label: string }
  | { kind: 'stacks', label: string, max: number }

export type ReactionBonusKey =
  | 'vaporize'
  | 'melt'
  | 'aggravate'
  | 'spread'
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
  | 'lunarbloom'
  | 'lunarcrystallize'
  | 'stellarconduct'
  | 'stellarswirl'

export type CombatContext = {
  character: GenshinCharacter,
  // The weapon's refinement, 1-5
  refinement: number,
  // true/false for a switch, the stack count for stacks
  setting: BuffSetting,
  // Hexerei characters in the party, the character included
  hexerei: number,
}

export type CombatEffect = {
  id: string,
  label: string,
  toggle?: EffectToggle,
  premod?: (context: CombatContext) => Stats,
  final?: (stats: ScreenStats, context: CombatContext) => Stats,
  reactions?: (context: CombatContext) => Partial<Record<ReactionBonusKey, number>>,
  debuffs?: (context: CombatContext) => { defShred?: number, resShred?: Partial<Record<Element | 'Physical', number>> },
  hits?: (context: CombatContext) => HitBuff[],
  // Elevation of Lunar or Stellar kinds, in percent (damage/damage.ts DamageSetup.elevation)
  elevation?: (context: CombatContext) => Partial<Record<SpecialKind, number>>,
  // Reaction DMG Bonus per point of Elemental Mastery, in percent (damage/damage.ts DamageSetup.reactionBonusPerEm)
  reactionsPerEm?: (context: CombatContext) => Partial<Record<ReactionBonusKey, number>>,
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

const stacks = (setting: BuffSetting) => (typeof setting === 'number' ? setting : 0)
const on = (setting: BuffSetting) => setting !== false

// Combat-only 2-piece bonuses: the screen doesn't list them, so data/setBonuses.ts leaves them out
export const COMBAT_2PC_BONUSES: Record<string, Stats> = {
  NoblesseOblige: { burstDmg: 20 },
  GoldenTroupe: { skillDmg: 20 },
  MarechausseeHunter: { normalDmg: 15, chargedDmg: 15 },
  LongNightsOath: { plungingDmg: 25 },
}

// By GOOD set key
const lunar = (bonus: number): Partial<Record<ReactionBonusKey, number>> => ({ lunarcharged: bonus, lunarbloom: bonus, lunarcrystallize: bonus })

export const SET_4PC_EFFECTS: Record<string, CombatEffect[]> = {
  NightOfTheSkysUnveiling: [
    {
      id: 'night-sky-crit',
      label: 'Gleaming Moon: Intent: CRIT Rate +15% (Nascent Gleam) or +30% (Ascendant Gleam) on the field after a Lunar Reaction',
      toggle: { kind: 'stacks', label: '1 Nascent, 2 Ascendant', max: 2 },
      premod: ({ setting }) => ({ critRate: 15 * stacks(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'night-sky-lunar',
      label: 'Lunar Reaction DMG +10% per different Gleaming Moon effect in the party (Intent, Devotion)',
      toggle: { kind: 'stacks', label: 'Gleaming Moon effects', max: 2 },
      reactions: ({ setting }) => lunar(10 * stacks(setting)),
      confidence: 'sourced',
    },
  ],
  SilkenMoonsSerenade: [
    {
      id: 'silken-moon-em',
      label: 'Gleaming Moon: Devotion: Elemental Mastery +60 (Nascent Gleam) or +120 (Ascendant Gleam) after dealing Elemental DMG',
      toggle: { kind: 'stacks', label: '1 Nascent, 2 Ascendant', max: 2 },
      premod: ({ setting }) => ({ elementalMastery: 60 * stacks(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'silken-moon-lunar',
      label: 'Lunar Reaction DMG +10% per different Gleaming Moon effect in the party (Intent, Devotion)',
      toggle: { kind: 'stacks', label: 'Gleaming Moon effects', max: 2 },
      reactions: ({ setting }) => lunar(10 * stacks(setting)),
      confidence: 'sourced',
    },
  ],
  AubadeOfMorningstarAndMoon: [{
    id: 'aubade-lunar',
    label: 'Lunar Reaction DMG +20% while off-field, +40% more at Ascendant Gleam (gone 3s after taking the field)',
    toggle: { kind: 'stacks', label: '1 off-field, 2 + Ascendant', max: 2 },
    reactions: ({ setting }) => lunar([0, 20, 60][stacks(setting)] ?? 0),
    confidence: 'sourced',
  }],
  GladiatorsFinale: [{
    id: 'gladiator-4pc',
    label: 'Normal Attack DMG +35% (sword, claymore or polearm)',
    toggle: { kind: 'switch', label: 'Wields a sword, claymore or polearm' },
    premod: () => ({ normalDmg: 35 }),
    confidence: 'sourced',
  }],
  WanderersTroupe: [{
    id: 'wanderers-troupe-4pc',
    label: 'Charged Attack DMG +35% (catalyst or bow)',
    toggle: { kind: 'switch', label: 'Wields a catalyst or bow' },
    premod: () => ({ chargedDmg: 35 }),
    confidence: 'sourced',
  }],
  ShimenawasReminiscence: [{
    id: 'shimenawa-4pc',
    label: 'Normal, Charged and Plunging Attack DMG +50% after spending 15 Energy on the Skill',
    toggle: { kind: 'switch', label: 'After the Skill' },
    premod: () => ({ normalDmg: 50, chargedDmg: 50, plungingDmg: 50 }),
    confidence: 'sourced',
  }],
  EmblemOfSeveredFate: [{
    id: 'emblem-4pc',
    label: 'Elemental Burst DMG +25% of Energy Recharge (max 75%)',
    final: (s) => ({ burstDmg: Math.min(75, (s.energyRecharge ?? 100) * 0.25) }),
    confidence: 'sourced',
  }],
  CrimsonWitchOfFlames: [
    {
      id: 'crimson-witch-stacks',
      label: 'Pyro DMG +7.5% per Skill use, up to 3 stacks',
      toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
      premod: ({ setting }) => ({ pyroDmg: 7.5 * stacks(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'crimson-witch-reactions',
      label: 'Vaporize and Melt DMG +15%; Overloaded, Burning and Burgeon DMG +40%',
      reactions: () => ({ vaporize: 15, melt: 15, overloaded: 40, burning: 40, burgeon: 40 }),
      confidence: 'sourced',
    },
  ],
  ThunderingFury: [{
    id: 'thundering-fury-reactions',
    label: 'Overloaded, Electro-Charged, Superconduct and Hyperbloom DMG +40%; Aggravate +20%',
    reactions: () => ({ overloaded: 40, electrocharged: 40, superconduct: 40, hyperbloom: 40, aggravate: 20 }),
    confidence: 'sourced',
  }],
  ViridescentVenerer: [{
    id: 'vv-swirl',
    label: 'Swirl DMG +60%',
    reactions: () => ({ swirl: 60 }),
    confidence: 'sourced',
  }],
  FlowerOfParadiseLost: [{
    id: 'paradise-lost-reactions',
    label: 'Bloom, Hyperbloom and Burgeon DMG +40%, and a quarter more per stack up to 4',
    toggle: { kind: 'stacks', label: 'Stacks', max: 4 },
    reactions: ({ setting }) => {
      const bonus = 40 * (1 + 0.25 * stacks(setting))
      return { bloom: bonus, hyperbloom: bonus, burgeon: bonus }
    },
    confidence: 'sourced',
  }],
  NoblesseOblige: [{
    id: 'noblesse-4pc-self',
    label: 'ATK +20% after the Burst (the wearer too)',
    toggle: { kind: 'switch', label: 'After the Burst' },
    premod: () => ({ atkPct: 20 }),
    confidence: 'sourced',
  }],
  TenacityOfTheMillelith: [{
    id: 'millelith-4pc-self',
    label: 'ATK +20% when the Skill hits (the wearer too)',
    toggle: { kind: 'switch', label: 'After the Skill hits' },
    premod: () => ({ atkPct: 20 }),
    confidence: 'sourced',
  }],
  BlizzardStrayer: [{
    id: 'blizzard-strayer-4pc',
    label: 'CRIT Rate +20% against Cryo-affected enemies, +20% more if Frozen',
    toggle: { kind: 'stacks', label: '1 Cryo, 2 Frozen', max: 2 },
    premod: ({ setting }) => ({ critRate: 20 * stacks(setting) }),
    confidence: 'sourced',
  }],
  HeartOfDepth: [{
    id: 'heart-of-depth-4pc',
    label: 'Normal and Charged Attack DMG +30% after the Skill',
    toggle: { kind: 'switch', label: 'After the Skill' },
    premod: () => ({ normalDmg: 30, chargedDmg: 30 }),
    confidence: 'sourced',
  }],
  PaleFlame: [{
    id: 'pale-flame-4pc',
    label: 'ATK +9% per stack (2); at 2 stacks Physical DMG +25% more',
    toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
    premod: ({ setting }) => ({ atkPct: 9 * stacks(setting), physicalDmg: stacks(setting) >= 2 ? 25 : 0 }),
    confidence: 'sourced',
  }],
  VermillionHereafter: [{
    id: 'vermillion-4pc',
    label: 'ATK +8% after the Burst, +10% more per stack up to 4',
    toggle: { kind: 'stacks', label: 'Stacks', max: 4 },
    premod: ({ setting }) => ({ atkPct: 8 + 10 * stacks(setting) }),
    confidence: 'sourced',
  }],
  HuskOfOpulentDreams: [{
    id: 'husk-4pc',
    label: 'DEF +6% and Geo DMG +6% per Curiosity stack, up to 4',
    toggle: { kind: 'stacks', label: 'Stacks', max: 4 },
    premod: ({ setting }) => ({ defPct: 6 * stacks(setting), geoDmg: 6 * stacks(setting) }),
    confidence: 'sourced',
  }],
  NymphsDream: [{
    id: 'nymphs-dream-4pc',
    label: 'ATK +7/16/25% and Hydro DMG +4/9/15% for 1/2/3 stacks',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    premod: ({ setting }) => {
      const n = stacks(setting)
      return { atkPct: [0, 7, 16, 25][n] ?? 0, hydroDmg: [0, 4, 9, 15][n] ?? 0 }
    },
    confidence: 'sourced',
  }],
  DesertPavilionChronicle: [{
    id: 'desert-pavilion-4pc',
    label: 'Normal, Charged and Plunging Attack DMG +40% after a Charged Attack hits',
    toggle: { kind: 'switch', label: 'After a Charged Attack' },
    premod: () => ({ normalDmg: 40, chargedDmg: 40, plungingDmg: 40 }),
    confidence: 'sourced',
  }],
  MarechausseeHunter: [{
    id: 'marechaussee-4pc',
    label: 'CRIT Rate +12% per stack when HP changes, up to 3',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    premod: ({ setting }) => ({ critRate: 12 * stacks(setting) }),
    confidence: 'sourced',
  }],
  GoldenTroupe: [{
    id: 'golden-troupe-4pc',
    label: 'Elemental Skill DMG +25%, +25% more while off-field',
    toggle: { kind: 'stacks', label: '1 on field, 2 off-field', max: 2 },
    premod: ({ setting }) => ({ skillDmg: 25 * stacks(setting) }),
    confidence: 'sourced',
  }],
  NighttimeWhispersInTheEchoingWoods: [{
    id: 'nighttime-whispers-4pc',
    label: 'Geo DMG +20% after the Skill, 50% while shielded by Crystallize',
    toggle: { kind: 'stacks', label: '1 Skill, 2 Crystallize shield', max: 2 },
    premod: ({ setting }) => ({ geoDmg: [0, 20, 50][stacks(setting)] ?? 0 }),
    confidence: 'sourced',
  }],
  FragmentOfHarmonicWhimsy: [{
    id: 'harmonic-whimsy-4pc',
    label: 'DMG +18% per Bond of Life change, up to 3',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    premod: ({ setting }) => ({ allDmg: 18 * stacks(setting) }),
    confidence: 'sourced',
  }],
  UnfinishedReverie: [{
    id: 'unfinished-reverie-4pc',
    label: 'DMG +10% per stack near Burning enemies, up to 5',
    toggle: { kind: 'stacks', label: 'Stacks', max: 5 },
    premod: ({ setting }) => ({ allDmg: 10 * stacks(setting) }),
    confidence: 'sourced',
  }],
  ObsidianCodex: [{
    id: 'obsidian-codex-4pc',
    label: 'CRIT Rate +40% after spending Nightsoul points',
    toggle: { kind: 'switch', label: 'After spending Nightsoul' },
    premod: () => ({ critRate: 40 }),
    confidence: 'sourced',
  }],
  ADayCarvedFromRisingWinds: [{
    id: 'rising-winds-4pc',
    label: 'ATK +25% after hitting, CRIT Rate +20% more with Witch\'s Homework',
    toggle: { kind: 'stacks', label: '1 hit, 2 Homework', max: 2 },
    premod: ({ setting }) => ({ atkPct: stacks(setting) >= 1 ? 25 : 0, critRate: stacks(setting) >= 2 ? 20 : 0 }),
    confidence: 'sourced',
  }],
  DeepwoodMemories: [{
    id: 'deepwood-4pc',
    label: 'Enemy Dendro RES -30% after the wearer\'s Dendro hits',
    toggle: { kind: 'switch', label: 'Enemy hit by Dendro' },
    debuffs: () => ({ resShred: { Dendro: 30 } }),
    confidence: 'sourced',
  }],
}

// Hu Tao's Guide to Afterlife: ATK from Max HP by Skill level 1-15 (genshin-optimizer skillParam), at most 400% of base ATK
const HU_TAO_ATK_FROM_HP = [3.841, 4.071, 4.301, 4.6, 4.83, 5.06, 5.359, 5.658, 5.957, 6.256, 6.555, 6.854, 7.153, 7.452, 7.751]

function skillLevel(character: GenshinCharacter, boostedAt: 3 | 5): number {
  return Math.min(15, (character.talents?.skill ?? 9) + (character.constellation >= boostedAt ? 3 : 0))
}

function burstLevel(character: GenshinCharacter, boostedAt: 3 | 5): number {
  return Math.min(15, (character.talents?.burst ?? 9) + (character.constellation >= boostedAt ? 3 : 0))
}

const ascended = (character: GenshinCharacter, level: number) => (character.ascension ?? 6) >= level

function autoLevel(character: GenshinCharacter, boostedAt: 3 | 5): number {
  return Math.min(15, (character.talents?.auto ?? 9) + (character.constellation >= boostedAt ? 3 : 0))
}

// Talent scalings by level 1-15 (genshin-optimizer skillParam): Itto's ATK from DEF in his Burst, Ayato's Shunsuiken DMG
// per Namisen stack (percent of HP) and his Burst's Normal Attack DMG, Arlecchino's Normal Attack DMG per Bond of Life
// (percent of ATK at 100% Bond)
const ITTO_BURST_DEF_TO_ATK = [57.6, 61.92, 66.24, 72, 76.32, 80.64, 86.4, 92.16, 97.92, 103.68, 109.44, 115.2, 122.4, 129.6, 136.8]
const AYATO_NAMISEN_HP = [0.561, 0.607, 0.652, 0.718, 0.763, 0.816, 0.887, 0.959, 1.031, 1.109, 1.187, 1.266, 1.344, 1.422, 1.5]
const AYATO_BURST_NORMAL = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20, 20, 20, 20]
const ARLECCHINO_BOND_ATK = [120.4, 130.2, 140, 154, 163.8, 175, 190.4, 205.8, 221.2, 238, 254.8, 271.6, 288.4, 305.2, 322]
const AYATO_SHUNSUIKEN = ['Shunsuiken 1-Hit DMG', 'Shunsuiken 2-Hit DMG', 'Shunsuiken 3-Hit DMG']
// Noelle's ATK from DEF in her Burst; Mavuika's DMG per Fighting Spirit point (Sunfell Slice, Flamestrider Normal and
// Charged Attacks, percent of ATK); Skirk's Serpent's Subtlety DMG per point over 50 (percent of ATK) and her Normal
// Attack DMG Bonus by Void Rifts absorbed (1-3)
const NOELLE_BURST_DEF_TO_ATK = [40, 43, 46, 50, 53, 56, 60, 64, 68, 72, 76, 80, 85, 90, 95]
const MAVUIKA_SUNFELL = [1.6, 1.72, 1.84, 2, 2.12, 2.24, 2.4, 2.56, 2.72, 2.88, 3.04, 3.2, 3.4, 3.6, 3.8]
const MAVUIKA_FLAME_NORMAL = [0.258, 0.279, 0.3, 0.33, 0.351, 0.375, 0.408, 0.441, 0.474, 0.51, 0.546, 0.582, 0.618, 0.654, 0.69]
const MAVUIKA_FLAME_CHARGED = [0.516, 0.558, 0.6, 0.66, 0.702, 0.75, 0.816, 0.882, 0.948, 1.02, 1.092, 1.164, 1.236, 1.308, 1.38]
const SKIRK_SERPENT = [19.323, 20.773, 22.222, 24.154, 25.603, 27.053, 28.985, 30.917, 32.85, 34.782, 36.714, 38.647, 41.062, 43.478, 45.893]
const SKIRK_VOID_NORMAL = [
  [6.6, 7.2, 7.8, 8.4, 9, 9.6, 10.2, 10.8, 11.4, 12, 12.6, 13.2, 13.8, 14.4, 15],
  [8.8, 9.6, 10.4, 11.2, 12, 12.8, 13.6, 14.4, 15.2, 16, 16.8, 17.6, 18.4, 19.2, 20],
  [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
]
// Kokomi's Burst bonuses to Normal and Charged Attacks and Bake-Kurage (percent of HP), Alyosha's ATK% per Precision stack
const KOKOMI_BURST_NORMAL = [4.84, 5.203, 5.566, 6.05, 6.413, 6.776, 7.26, 7.744, 8.228, 8.712, 9.196, 9.68, 10.285, 10.89, 11.495]
const KOKOMI_BURST_CHARGED = [6.776, 7.284, 7.792, 8.47, 8.978, 9.486, 10.164, 10.842, 11.519, 12.197, 12.874, 13.552, 14.399, 15.246, 16.093]
const KOKOMI_BURST_SKILL = [7.096, 7.629, 8.161, 8.87, 9.403, 9.935, 10.644, 11.354, 12.064, 12.773, 13.483, 14.193, 15.08, 15.967, 16.854]
const ALYOSHA_PRECISION_ATK = [11.66, 12.72, 13.78, 14.84, 15.9, 16.96, 18.02, 19.08, 20.14, 21.2, 22.472, 23.744, 25.016, 26.288, 27.56]
// Nefer's Burst DMG per Veil of Falsehood consumed (genshin-optimizer skillParam; the in-game Skill Attributes), and her
// Phantasm Performance hits (Veil of Falsehood: +8% per stack, the user's screenshot)
const NEFER_BURST_PER_VEIL = [13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55]
const NEFER_PHANTASM = [
  'Phantasm Performance 1-Hit DMG (Nefer)',
  'Phantasm Performance 2-Hit DMG (Nefer)',
  'Phantasm Performance 1-Hit DMG (Shades)',
  'Phantasm Performance 2-Hit DMG (Shades)',
  'Phantasm Performance 3-Hit DMG (Shades)',
]
// Odette's Snow Swan's Dream Stellar Glimmer DMG Bonus by Burst level (genshin-optimizer skillParam; the effect itself
// matches the user's screenshot of her Burst)
const ODETTE_SNOW_SWAN = [14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70]
// Mizuki's Dreamdrifter Swirl DMG Bonus per point of Elemental Mastery, percent by Skill level (genshin-optimizer
// skillParam; Stellar Swirl gets a tenth of it)
const MIZUKI_SWIRL_PER_EM = [0.18, 0.21, 0.24, 0.27, 0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.48, 0.51, 0.54, 0.57, 0.6]
// Durin's dark-form Burst hits (the user's screenshots: multipliers match the talent data at Burst level 9)
const DURIN_DARK_BURST = [
  'Principle of Darkness: As the Stars Smolder DMG (1)',
  'Principle of Darkness: As the Stars Smolder DMG (2)',
  'Principle of Darkness: As the Stars Smolder DMG (3)',
  'Dragon of Dark Decay DMG',
]
const MAVUIKA_FLAMESTRIDER_NORMAL = [1, 2, 3, 4, 5].map((n) => `Flamestrider Normal Attack ${n}-Hit DMG`)
const MAVUIKA_FLAMESTRIDER_CHARGED = ['Flamestrider Charged Attack Cyclic DMG', 'Flamestrider Charged Attack Final DMG']

// Raiden's Resolve bonus per stack by Burst level 1-15, in percent of ATK (genshin-optimizer skillParam): the initial
// slash (Musou no Hitotachi) and Musou Isshin's attacks
const RAIDEN_INITIAL = 'Musou no Hitotachi Base DMG'
const RAIDEN_RESOLVE_INITIAL = [3.888, 4.1796, 4.4712, 4.86, 5.1516, 5.4432, 5.832, 6.2208, 6.6096, 6.9984, 7.3872, 7.776, 8.262, 8.748, 9.234]
const RAIDEN_RESOLVE_ISSHIN = [0.7262, 0.7806, 0.8351, 0.9077, 0.9622, 1.0166, 1.0892, 1.1619, 1.2345, 1.3071, 1.3797, 1.4523, 1.5431, 1.6339, 1.7246]

// Furina's DMG Bonus per Fanfare point by Burst level 1-15, as in team/buffs.ts
const FURINA_DMG_PER_FANFARE = [0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.23, 0.25, 0.27, 0.29, 0.31, 0.33, 0.35]

// By GOOD character key
export const KIT_EFFECTS: Record<string, CombatEffect[]> = {
  // From here to Hu Tao: genshin-optimizer's sheets (Oct 26 2026), read by hand
  // Lunar and Stellar characters: their Lunar or Stellar bonuses to the party are in team/buffs.ts; these are their own
  Aino: [
    {
      id: 'aino-a4',
      label: 'A4: Burst hits add 50% of Elemental Mastery',
      hits: ({ character }) => (ascended(character, 4) ? [{ categories: ['burst'], addTerms: { elementalMastery: 50 } }] : []),
      confidence: 'sourced',
    },
    {
      id: 'aino-c1',
      label: 'C1: Elemental Mastery +80 after her Skill or Burst',
      toggle: { kind: 'switch', label: 'After her Skill or Burst' },
      premod: ({ character }) => (character.constellation >= 1 ? { elementalMastery: 80 } : {}),
      confidence: 'sourced',
    },
  ],
  Columbina: [
    {
      id: 'columbina-a1',
      label: 'A1: CRIT Rate +5% per stack (up to 3)',
      toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
      premod: ({ character, setting }) => (ascended(character, 1) ? { critRate: 5 * stacks(setting) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'columbina-c2',
      label: 'C2: Max HP +40% with Brilliance',
      toggle: { kind: 'switch', label: 'Brilliance' },
      premod: ({ character }) => (character.constellation >= 2 ? { hpPct: 40 } : {}),
      confidence: 'sourced',
    },
  ],
  Flins: [
    {
      id: 'flins-a1',
      label: 'A1: Lunar-Charged DMG +20% at Moonsign: Ascendant Gleam',
      toggle: { kind: 'switch', label: 'Ascendant Gleam' },
      reactions: ({ character }) => (ascended(character, 1) ? { lunarcharged: 20 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'flins-a4',
      label: 'A4: Elemental Mastery +8% of ATK (up to 160; 10% and 220 at C4)',
      final: (s, { character }) => {
        if (!ascended(character, 4)) return {}
        const c4 = character.constellation >= 4
        return { elementalMastery: Math.min(c4 ? 220 : 160, (s.atk ?? 0) * (c4 ? 0.1 : 0.08)) }
      },
      confidence: 'sourced',
    },
    {
      id: 'flins-c4',
      label: 'C4: ATK +20%',
      premod: ({ character }) => (character.constellation >= 4 ? { atkPct: 20 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'flins-c6',
      label: 'C6: Lunar-Charged DMG elevated by 35%',
      elevation: ({ character }) => (character.constellation >= 6 ? { lunarcharged: 35 } : {}),
      confidence: 'sourced',
    },
  ],
  Lauma: [{
    id: 'lauma-a4',
    label: 'A4: Skill DMG +0.04% per Elemental Mastery (up to 32%)',
    final: (s, { character }) => (ascended(character, 4) ? { skillDmg: Math.min(32, (s.elementalMastery ?? 0) * 0.04) } : {}),
    confidence: 'sourced',
  }],
  Linnea: [
    {
      id: 'linnea-a4',
      label: 'A4: Elemental Mastery +5% of DEF while the active member isn\'t a Moonsign character',
      toggle: { kind: 'switch', label: 'Active member isn\'t Moonsign' },
      final: (s, { character }) => (ascended(character, 4) ? { elementalMastery: (s.def ?? 0) * 0.05 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'linnea-c4',
      label: 'C4: DEF +25%',
      premod: ({ character }) => (character.constellation >= 4 ? { defPct: 25 } : {}),
      confidence: 'sourced',
    },
  ],
  Nefer: [
    {
      id: 'nefer-a1',
      label:
        'A Wager of Moonlight: Veils of Falsehood (3, 5 from C2) at Moonsign: Ascendant Gleam: Phantasm Performance x(1 + 8% per Veil), Elemental Mastery +100 at 3 (+200 at 5); her Burst consumes them for Burst DMG per Veil',
      toggle: { kind: 'stacks', label: 'Veils', max: 5 },
      premod: ({ character, setting }) => {
        if (!ascended(character, 1)) return {}
        const veils = Math.min(stacks(setting), character.constellation >= 2 ? 5 : 3)
        return {
          elementalMastery: veils >= 5 ? 200 : veils >= 3 ? 100 : 0,
          burstDmg: veils * NEFER_BURST_PER_VEIL[burstLevel(character, 5) - 1],
        }
      },
      hits: ({ character, setting }) => {
        const veils = Math.min(stacks(setting), character.constellation >= 2 ? 5 : 3)
        return ascended(character, 1) && veils > 0 ? [{ labels: NEFER_PHANTASM, scale: 0.08 * veils }] : []
      },
      confidence: 'confirmed',
    },
    {
      id: 'nefer-c6',
      label: 'C6: Lunar-Bloom DMG elevated by 15% at Moonsign: Ascendant Gleam',
      elevation: ({ character }) => (character.constellation >= 6 ? { lunarbloom: 15 } : {}),
      confidence: 'sourced',
    },
  ],
  Odette: [{
    id: 'odette-snow-swan',
    label: 'Presto: Bluebird Finale: Snow Swan\'s Dream, Stellar Glimmer (Stellar-Conduct and Stellar Swirl) DMG she deals is increased',
    toggle: { kind: 'switch', label: 'Snow Swan\'s Dream' },
    reactions: ({ character }) => {
      const bonus = ODETTE_SNOW_SWAN[burstLevel(character, 5) - 1]
      return { stellarconduct: bonus, stellarswirl: bonus }
    },
    confidence: 'confirmed',
  }, {
    id: 'odette-c2',
    label:
      'C2: ATK +7% per Marvelous Splendor stack (4, 8 from C1); in Radiance: Stellar Glimmer with her Solo Dance Double out, the enemy\'s Cryo RES -20% (and Electro or Anemo, by the Radiance)',
    toggle: { kind: 'stacks', label: 'Marvelous Splendor stacks', max: 8 },
    premod: ({ character, setting }) => character.constellation >= 2 ? { atkPct: 7 * Math.min(stacks(setting), character.constellation >= 1 ? 8 : 4) } : {},
    debuffs: ({ character }) => (character.constellation >= 2 ? { resShred: { Cryo: 20 } } : {}),
    confidence: 'confirmed',
  }],
  Sandrone: [
    {
      id: 'sandrone-a4',
      label: 'A4: Elemental Mastery +8% of ATK (up to 160)',
      final: (s, { character }) => (ascended(character, 4) ? { elementalMastery: Math.min(160, (s.atk ?? 0) * 0.08) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'sandrone-c6',
      label: 'C6: Stellar Reaction DMG elevated by 20%',
      elevation: ({ character }) => (character.constellation >= 6 ? { stellarconduct: 20, stellarswirl: 20 } : {}),
      confidence: 'sourced',
    },
  ],
  Vesna: [
    {
      id: 'vesna-a4-atk',
      label: 'A4: with Stellar Swirl Radiance, ATK +6% per Anemo or Cryo member (x3 at C4)',
      toggle: { kind: 'stacks', label: 'Anemo and Cryo members', max: 4 },
      premod: ({ character, setting }) => (ascended(character, 4) ? { atkPct: 6 * stacks(setting) * (character.constellation >= 4 ? 3 : 1) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'vesna-a4-em',
      label: 'A4: with Stellar Swirl Radiance, Elemental Mastery +25 per member of another element (x3 at C4)',
      toggle: { kind: 'stacks', label: 'Other members', max: 3 },
      premod: ({ character, setting }) => ascended(character, 4) ? { elementalMastery: 25 * stacks(setting) * (character.constellation >= 4 ? 3 : 1) } : {},
      confidence: 'sourced',
    },
    {
      id: 'vesna-c1',
      label: 'C1: Stellar Swirl DMG +20% while her Skill is armed',
      toggle: { kind: 'switch', label: 'Skill armed' },
      reactions: ({ character }) => (character.constellation >= 1 ? { stellarswirl: 20 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'vesna-c6',
      label: 'C6: Stellar Swirl DMG elevated by 20%',
      elevation: ({ character }) => (character.constellation >= 6 ? { stellarswirl: 20 } : {}),
      confidence: 'sourced',
    },
  ],
  Vodyanitsa: [{
    id: 'vodyanitsa-c4',
    label: 'C4: Max HP +20% per state level (up to 3)',
    toggle: { kind: 'stacks', label: 'State level', max: 3 },
    premod: ({ character, setting }) => (character.constellation >= 4 ? { hpPct: 20 * stacks(setting) } : {}),
    confidence: 'sourced',
  }],
  Zibai: [
    {
      id: 'zibai-a4-geo',
      label: 'A4: DEF +15% per other Geo member',
      toggle: { kind: 'stacks', label: 'Other Geo members', max: 3 },
      premod: ({ character, setting }) => (ascended(character, 4) ? { defPct: 15 * stacks(setting) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'zibai-a4-hydro',
      label: 'A4: Elemental Mastery +60 per Hydro member',
      toggle: { kind: 'stacks', label: 'Hydro members', max: 3 },
      premod: ({ character, setting }) => (ascended(character, 4) ? { elementalMastery: 60 * stacks(setting) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'zibai-c6',
      label: 'C6: Lunar-Crystallize DMG elevated by 1.6% per point (up to 30)',
      toggle: { kind: 'stacks', label: 'Points', max: 30 },
      elevation: ({ character, setting }) => (character.constellation >= 6 ? { lunarcrystallize: 1.6 * stacks(setting) } : {}),
      confidence: 'sourced',
    },
  ],
  Albedo: [
    {
      id: 'albedo-hexerei',
      label: 'Hexerei: with 2 Hexerei in the party, DMG +4% per 1,000 DEF (up to 12%), and +10% more per 1,000 DEF for himself as a Hexerei member (up to 30%)',
      toggle: { kind: 'switch', label: 'After his Skill creates a Solar or Silver Isotoma' },
      final: (s, { hexerei }) => (hexerei >= 2 ? { allDmg: Math.min(12, (s.def ?? 0) / 1000 * 4) + Math.min(30, (s.def ?? 0) / 1000 * 10) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'albedo-a1',
      label: 'Calcite Might: Transient Blossom DMG +25% against enemies below 50% HP',
      toggle: { kind: 'switch', label: 'Enemy below 50% HP' },
      hits: ({ character }) => (ascended(character, 1) ? [{ labels: ['Transient Blossom DMG'], dmgBonus: 25 }] : []),
      confidence: 'sourced',
    },
    {
      id: 'albedo-c2',
      label: 'C2: Burst hits add 30% of DEF per Fatal Reckoning stack (up to 4)',
      toggle: { kind: 'stacks', label: 'Fatal Reckoning stacks', max: 4 },
      hits: ({ character, setting }) => (character.constellation >= 2 ? [{ categories: ['burst'], addTerms: { def: 30 * stacks(setting) } }] : []),
      confidence: 'sourced',
    },
  ],
  Alyosha: [
    {
      id: 'alyosha-precision',
      label: 'Skill: ATK% per Precision stack while he is on the field (1, 2 at C6)',
      toggle: { kind: 'stacks', label: 'Precision stacks', max: 2 },
      premod: ({ character, setting }) => ({
        atkPct: Math.min(stacks(setting), character.constellation >= 6 ? 2 : 1) * ALYOSHA_PRECISION_ATK[skillLevel(character, 3) - 1],
      }),
      confidence: 'sourced',
    },
    {
      id: 'alyosha-a4',
      label: 'A4: Skill and Burst DMG +0.35% per 1% Energy Recharge (counted up to 200%)',
      final: (s, { character }) => {
        if (!ascended(character, 4)) return {}
        const bonus = 0.35 * Math.min(200, s.energyRecharge ?? 0)
        return { skillDmg: bonus, burstDmg: bonus }
      },
      confidence: 'sourced',
    },
  ],
  Chongyun: [
    {
      id: 'chongyun-a4',
      label: 'Rimechaser Blade: the enemy\'s Cryo RES -10% after the Skill field ends',
      toggle: { kind: 'switch', label: 'Hit by the field\'s blade' },
      debuffs: ({ character }) => (ascended(character, 4) ? { resShred: { Cryo: 10 } } : {}),
      confidence: 'sourced',
    },
    {
      id: 'chongyun-c6',
      label: 'C6: Burst DMG +15% against enemies with a lower HP percentage than his',
      toggle: { kind: 'switch', label: 'Enemy at a lower HP %' },
      premod: ({ character }) => (character.constellation >= 6 ? { burstDmg: 15 } : {}),
      confidence: 'sourced',
    },
  ],
  Dehya: [
    {
      id: 'dehya-c1',
      label: 'C1: Max HP +20%; Skill DMG +3.6% and Burst DMG +6% of Max HP',
      premod: ({ character }) => (character.constellation >= 1 ? { hpPct: 20 } : {}),
      hits: ({ character }) =>
        character.constellation >= 1 ? [{ categories: ['skill'], addTerms: { hp: 3.6 } }, { categories: ['burst'], addTerms: { hp: 6 } }] : [],
      confidence: 'sourced',
    },
    {
      id: 'dehya-c2',
      label: 'C2: Fiery Sanctum field DMG +50% while she is in it',
      toggle: { kind: 'switch', label: 'In the field' },
      hits: ({ character }) => (character.constellation >= 2 ? [{ labels: ['Field DMG'], dmgBonus: 50 }] : []),
      confidence: 'sourced',
    },
    {
      id: 'dehya-c6',
      label: 'C6: Burst CRIT Rate +10%, CRIT DMG +15% per stack (up to 4)',
      toggle: { kind: 'stacks', label: 'Stacks', max: 4 },
      hits: ({ character, setting }) => character.constellation >= 6 ? [{ categories: ['burst'], critRate: 10, critDmg: 15 * stacks(setting) }] : [],
      confidence: 'sourced',
    },
  ],
  Emilie: [
    {
      id: 'emilie-a4',
      label: 'Rectification: DMG +15% per 1,000 ATK against burning enemies (up to 36%)',
      toggle: { kind: 'switch', label: 'Enemy burning' },
      final: (s, { character }) => (ascended(character, 4) ? { allDmg: Math.min(36, (s.atk ?? 0) / 1000 * 15) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'emilie-c1',
      label: 'C1: Skill DMG +20%',
      premod: ({ character }) => (character.constellation >= 1 ? { skillDmg: 20 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'emilie-c2',
      label: 'C2: the enemy\'s Dendro RES -30% after her attacks hit',
      toggle: { kind: 'switch', label: 'Her attacks hit' },
      debuffs: ({ character }) => (character.constellation >= 2 ? { resShred: { Dendro: 30 } } : {}),
      confidence: 'sourced',
    },
  ],
  Gaming: [
    {
      id: 'gaming-a4',
      label: 'Air of Prosperity: Charmed Cloudstrider DMG +20% at 50% HP or more',
      toggle: { kind: 'switch', label: 'At 50% HP or more' },
      hits: ({ character }) => (ascended(character, 4) ? [{ labels: ['Plunging Attack: Charmed Cloudstrider DMG'], dmgBonus: 20 }] : []),
      confidence: 'sourced',
    },
    {
      id: 'gaming-c2',
      label: 'C2: ATK +20% after he is healed past Max HP',
      toggle: { kind: 'switch', label: 'Overhealed' },
      premod: ({ character }) => (character.constellation >= 2 ? { atkPct: 20 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'gaming-c6',
      label: 'C6: Charmed Cloudstrider CRIT Rate +20% and CRIT DMG +40%',
      hits: ({ character }) => character.constellation >= 6 ? [{ labels: ['Plunging Attack: Charmed Cloudstrider DMG'], critRate: 20, critDmg: 40 }] : [],
      confidence: 'sourced',
    },
  ],
  Fischl: [{
    id: 'fischl-hexerei',
    label: 'Hexerei: with 2 Hexerei in the party, ATK +22.5% after Overloaded, or Elemental Mastery +90 after Electro-Charged or Lunar-Charged (x2 at C6)',
    toggle: { kind: 'stacks', label: '1 ATK (Overloaded), 2 EM (Electro-Charged)', max: 2 },
    premod: ({ character, setting, hexerei }) => {
      if (hexerei < 2) return {}
      const c6 = character.constellation >= 6 ? 2 : 1
      return stacks(setting) === 1 ? { atkPct: 22.5 * c6 } : { elementalMastery: 90 * c6 }
    },
    confidence: 'sourced',
  }],
  Kinich: [
    {
      id: 'kinich-a4',
      label: 'Hail to the Almighty Dragonlord: Scalespiker Cannon adds 320% of ATK per stack (up to 2)',
      toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
      hits: ({ character, setting }) => ascended(character, 4) ? [{ labels: ['Scalespiker Cannon DMG'], addTerms: { atk: 320 * stacks(setting) } }] : [],
      confidence: 'sourced',
    },
    {
      id: 'kinich-c1',
      label: 'C1: Scalespiker Cannon CRIT DMG +100%',
      hits: ({ character }) => (character.constellation >= 1 ? [{ labels: ['Scalespiker Cannon DMG'], critDmg: 100 }] : []),
      confidence: 'sourced',
    },
    {
      id: 'kinich-c2',
      label: 'C2: the enemy\'s Dendro RES -30% after the Cannon hits',
      toggle: { kind: 'switch', label: 'Cannon hit' },
      debuffs: ({ character }) => (character.constellation >= 2 ? { resShred: { Dendro: 30 } } : {}),
      confidence: 'sourced',
    },
    {
      id: 'kinich-c4',
      label: 'C4: Burst DMG +70%',
      premod: ({ character }) => (character.constellation >= 4 ? { burstDmg: 70 } : {}),
      confidence: 'sourced',
    },
  ],
  Mavuika: [
    {
      id: 'mavuika-spirit',
      label:
        'Hour of Burning Skies: Sunfell Slice and Flamestrider Normal and Charged Attacks add a share of ATK per Fighting Spirit point (100-200); A4: DMG +0.2% per point right after the Burst',
      toggle: { kind: 'stacks', label: 'Fighting Spirit spent', max: 200 },
      hits: ({ character, setting }) => {
        const spirit = stacks(setting)
        const level = burstLevel(character, 3) - 1
        return [
          { categories: ['burst'], addTerms: { atk: MAVUIKA_SUNFELL[level] * spirit } },
          { labels: MAVUIKA_FLAMESTRIDER_NORMAL, addTerms: { atk: MAVUIKA_FLAME_NORMAL[level] * spirit } },
          { labels: MAVUIKA_FLAMESTRIDER_CHARGED, addTerms: { atk: MAVUIKA_FLAME_CHARGED[level] * spirit } },
        ]
      },
      premod: ({ character, setting }) => (ascended(character, 4) ? { allDmg: 0.2 * stacks(setting) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'mavuika-a1',
      label: 'Gift of Flaming Flowers: ATK +30% after a Nightsoul Burst',
      toggle: { kind: 'switch', label: 'After a Nightsoul Burst' },
      premod: ({ character }) => (ascended(character, 1) ? { atkPct: 30 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'mavuika-c1',
      label: 'C1: ATK +40% after gaining Fighting Spirit; C2: base ATK +200 (counted as flat ATK)',
      toggle: { kind: 'switch', label: 'After gaining Fighting Spirit' },
      premod: ({ character }) => ({
        ...(character.constellation >= 1 ? { atkPct: 40 } : {}),
        ...(character.constellation >= 2 ? { atk: 200 } : {}),
      }),
      confidence: 'sourced',
    },
  ],
  Nilou: [
    {
      id: 'nilou-c4',
      label: 'C4: Burst DMG +50% after the third dance step of Pirouette hits',
      toggle: { kind: 'switch', label: 'After Pirouette' },
      premod: ({ character }) => (character.constellation >= 4 ? { burstDmg: 50 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'nilou-c6',
      label: 'C6: CRIT Rate +0.6% and CRIT DMG +1.2% per 1,000 Max HP (up to 30% / 60%)',
      final: (s, { character }) =>
        character.constellation >= 6 ? { critRate: Math.min(30, (s.hp ?? 0) / 1000 * 0.6), critDmg: Math.min(60, (s.hp ?? 0) / 1000 * 1.2) } : {},
      confidence: 'sourced',
    },
  ],
  Noelle: [
    {
      id: 'noelle-burst',
      label: 'Sweeping Time: ATK from DEF (+50% of DEF more at C6)',
      toggle: { kind: 'switch', label: 'During the Burst' },
      final: (s, { character }) => ({
        atk: (s.def ?? 0) * (NOELLE_BURST_DEF_TO_ATK[burstLevel(character, 5) - 1] + (character.constellation >= 6 ? 50 : 0)) / 100,
      }),
      confidence: 'sourced',
    },
    {
      id: 'noelle-c2',
      label: 'C2: Charged Attack DMG +15%',
      premod: ({ character }) => (character.constellation >= 2 ? { chargedDmg: 15 } : {}),
      confidence: 'sourced',
    },
  ],
  SangonomiyaKokomi: [
    {
      id: 'kokomi-burst',
      label: 'Nereid\'s Ascension: Normal and Charged Attacks and Bake-Kurage add a share of Max HP (A4 adds 15% of her 25% Healing Bonus to the first two)',
      toggle: { kind: 'switch', label: 'During the Burst' },
      hits: ({ character }) => {
        const level = burstLevel(character, 3) - 1
        const a4 = ascended(character, 4) ? 0.15 * 25 : 0
        return [
          { categories: ['normal'], addTerms: { hp: KOKOMI_BURST_NORMAL[level] + a4 } },
          { categories: ['charged'], addTerms: { hp: KOKOMI_BURST_CHARGED[level] + a4 } },
          { labels: ['Ripple DMG'], addTerms: { hp: KOKOMI_BURST_SKILL[level] } },
        ]
      },
      confidence: 'sourced',
    },
    {
      id: 'kokomi-c6',
      label: 'C6: Hydro DMG +40% after healing a member above 80% HP with a Normal or Charged Attack',
      toggle: { kind: 'switch', label: 'After such a heal' },
      premod: ({ character }) => (character.constellation >= 6 ? { hydroDmg: 40 } : {}),
      confidence: 'sourced',
    },
  ],
  Razor: [
    {
      id: 'razor-c1',
      label: 'C1: DMG +10% after picking up an Elemental Orb or Particle',
      toggle: { kind: 'switch', label: 'Picked up energy' },
      premod: ({ character }) => (character.constellation >= 1 ? { allDmg: 10 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'razor-c2',
      label: 'C2: CRIT Rate +10% against enemies below 30% HP',
      toggle: { kind: 'switch', label: 'Enemy below 30% HP' },
      premod: ({ character }) => (character.constellation >= 2 ? { critRate: 10 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'razor-c4',
      label: 'C4: the enemy\'s DEF -15% after the Skill press hits',
      toggle: { kind: 'switch', label: 'Skill press hit' },
      debuffs: ({ character }) => (character.constellation >= 4 ? { defShred: 15 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'razor-hexerei',
      label: 'Hexerei: his Burst\'s companion hits add 70% of ATK',
      hits: () => [{ categories: ['burst'], addTerms: { atk: 70 } }],
      confidence: 'sourced',
    },
  ],
  Skirk: [
    {
      id: 'skirk-void',
      label: 'Havoc: Ruin: Normal Attack DMG Bonus (her Seven-Phase Flash attacks too) by Void Rifts absorbed (1-3)',
      toggle: { kind: 'stacks', label: 'Void Rifts absorbed', max: 3 },
      hits: ({ character, setting }) => {
        const n = stacks(setting)
        return n > 0 ? [{ categories: ['normal', 'skill'], dmgBonus: SKIRK_VOID_NORMAL[n - 1][burstLevel(character, 3) - 1] }] : []
      },
      confidence: 'sourced',
    },
    {
      id: 'skirk-serpent',
      label: 'Havoc: Ruin: Burst hits add a share of ATK per Serpent\'s Subtlety point over 50 (up to 12, 22 at C2)',
      toggle: { kind: 'stacks', label: 'Points over 50', max: 22 },
      hits: ({ character, setting }) => [{
        categories: ['burst'],
        addTerms: { atk: Math.min(stacks(setting), character.constellation >= 2 ? 22 : 12) * SKIRK_SERPENT[burstLevel(character, 3) - 1] },
      }],
      confidence: 'sourced',
    },
    {
      id: 'skirk-a4',
      label: 'Return to Oblivion: Seven-Phase Flash hits x1.1/1.2/1.7 and Burst x1.05/1.15/1.6 with 1/2/3 Death\'s Crossing stacks; C4: ATK +10/20/40%',
      toggle: { kind: 'stacks', label: 'Death\'s Crossing stacks', max: 3 },
      hits: ({ character, setting }) => {
        const n = stacks(setting)
        if (!ascended(character, 4) || n === 0) return []
        return [{ categories: ['skill'], scale: [0.1, 0.2, 0.7][n - 1] }, { categories: ['burst'], scale: [0.05, 0.15, 0.6][n - 1] }]
      },
      premod: ({ character, setting }) => character.constellation >= 4 && ascended(character, 4) ? { atkPct: [0, 10, 20, 40][stacks(setting)] ?? 0 } : {},
      confidence: 'sourced',
    },
  ],
  Xingqiu: [{
    id: 'xingqiu-a4',
    label: 'Blades Amidst Raindrops: Hydro DMG +20%',
    premod: ({ character }) => (ascended(character, 4) ? { hydroDmg: 20 } : {}),
    confidence: 'sourced',
  }],
  YumemizukiMizuki: [{
    id: 'mizuki-a4',
    label: 'Thoughts by Day Bring Dreams by Night: in Dreamdrifter, Elemental Mastery +100 when other members hit with Pyro, Hydro, Cryo or Electro attacks',
    toggle: { kind: 'switch', label: 'Teammates\' elemental hits' },
    premod: ({ character }) => (ascended(character, 4) ? { elementalMastery: 100 } : {}),
    confidence: 'confirmed',
  }, {
    id: 'mizuki-dreamdrifter',
    label:
      'Aisa Utamakura Pilgrimage: in Dreamdrifter, Swirl and Stellar Swirl DMG + a share per point of her Elemental Mastery (0.42% / 0.042% at Skill level 9)',
    toggle: { kind: 'switch', label: 'Dreamdrifter' },
    reactionsPerEm: ({ character }) => {
      const level = skillLevel(character, 3) - 1
      return { swirl: MIZUKI_SWIRL_PER_EM[level], stellarswirl: MIZUKI_SWIRL_PER_EM[level] / 10 }
    },
    confidence: 'confirmed',
  }],
  Durin: [
    {
      id: 'durin-a1-dark',
      label: 'A1: in his dark form, Vaporize and Melt DMG +40% (+30% more with 2 Hexerei in the party)',
      toggle: { kind: 'switch', label: 'Dark form' },
      reactions: ({ character, hexerei }) => {
        if (!ascended(character, 1)) return {}
        const bonus = 40 + (hexerei >= 2 ? 30 : 0)
        return { vaporize: bonus, melt: bonus }
      },
      confidence: 'sourced',
    },
    {
      id: 'durin-c1-dark',
      label: 'C1: in his dark form, Burst hits add 150% of ATK',
      toggle: { kind: 'switch', label: 'Dark form' },
      hits: ({ character }) => (character.constellation >= 1 ? [{ categories: ['burst'], addTerms: { atk: 150 } }] : []),
      confidence: 'sourced',
    },
    {
      id: 'durin-c4',
      label: 'C4: Burst DMG +40%',
      premod: ({ character }) => (character.constellation >= 4 ? { burstDmg: 40 } : {}),
      confidence: 'sourced',
    },
    {
      // From the user's screenshot of his C6 (Oct 30 2026)
      id: 'durin-c6',
      label: 'C6: Burst DMG ignores 30% of DEF; his dark-form Burst (Stars Smolder, Dragon of Dark Decay) ignores 40% more',
      hits: ({ character }) =>
        character.constellation >= 6
          ? [
            { categories: ['burst'], defIgnore: 30 },
            { labels: DURIN_DARK_BURST, defIgnore: 40 },
          ]
          : [],
      confidence: 'confirmed',
    },
    {
      id: 'durin-c6-light',
      label: 'C6: in his light form, the enemy\'s DEF -30% after his Burst and Dragon of White Flame hit',
      toggle: { kind: 'switch', label: 'Light form, hit' },
      debuffs: ({ character }) => (character.constellation >= 6 ? { defShred: 30 } : {}),
      confidence: 'confirmed',
    },
  ],
  Venti: [{
    id: 'venti-hexerei',
    label: 'Hexerei: with 2 Hexerei in the party, after his Burst swirls, it deals x1.35 and he gets DMG +50% while on the field',
    toggle: { kind: 'switch', label: 'Burst swirled an element' },
    hits: ({ hexerei }) => (hexerei >= 2 ? [{ categories: ['burst'], scale: 0.35 }] : []),
    premod: ({ hexerei }) => (hexerei >= 2 ? { allDmg: 50 } : {}),
    confidence: 'sourced',
  }],
  Varesa: [
    {
      id: 'varesa-a1',
      label: 'Rainbow Crash: Plunging Attack ground impacts add 50% of ATK (180% from C1)',
      toggle: { kind: 'switch', label: 'Rainbow Crash' },
      hits: ({ character }) =>
        ascended(character, 1)
          ? [{
            labels: ['Low Plunge DMG', 'High Plunge DMG', 'Fiery Passion Low Plunge DMG'],
            addTerms: { atk: character.constellation >= 1 ? 180 : 50 },
          }]
          : [],
      confidence: 'sourced',
    },
    {
      id: 'varesa-a4',
      label: 'Arising From the Ashes: ATK +35% per Nightsoul Burst stack (up to 2)',
      toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
      premod: ({ character, setting }) => (ascended(character, 4) ? { atkPct: 35 * stacks(setting) } : {}),
      confidence: 'sourced',
    },
  ],
  Xiangling: [
    {
      id: 'xiangling-a4',
      label: 'Beware, It\'s Super Hot!: ATK +10% after picking up a chili pepper',
      toggle: { kind: 'switch', label: 'Picked up the chili' },
      premod: ({ character }) => (ascended(character, 4) ? { atkPct: 10 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'xiangling-c1',
      label: 'C1: the enemy\'s Pyro RES -15% after Guoba hits',
      toggle: { kind: 'switch', label: 'Guoba hit' },
      debuffs: ({ character }) => (character.constellation >= 1 ? { resShred: { Pyro: 15 } } : {}),
      confidence: 'sourced',
    },
    {
      id: 'xiangling-c6',
      label: 'C6: Pyro DMG +15% during Pyronado (genshin-optimizer leaves it off her first two Burst swings and Pyronado itself)',
      toggle: { kind: 'switch', label: 'During Pyronado' },
      premod: ({ character }) => (character.constellation >= 6 ? { pyroDmg: 15 } : {}),
      hits: ({ character }) => character.constellation >= 6 ? [{ labels: ['1-Hit Swing DMG', '2-Hit Swing DMG', 'Pyronado DMG'], dmgBonus: -15 }] : [],
      confidence: 'sourced',
    },
  ],
  Beidou: [
    {
      id: 'beidou-a4',
      label: 'Lightning Storm: Normal and Charged Attack DMG +15% after a full-power Tidecaller',
      toggle: { kind: 'switch', label: 'After a full-power Tidecaller' },
      premod: ({ character }) => (ascended(character, 4) ? { normalDmg: 15, chargedDmg: 15 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'beidou-c6',
      label: 'C6: the enemy\'s Electro RES -15% during Stormbreaker',
      toggle: { kind: 'switch', label: 'During Stormbreaker' },
      debuffs: ({ character }) => (character.constellation >= 6 ? { resShred: { Electro: 15 } } : {}),
      confidence: 'sourced',
    },
  ],
  KamisatoAyato: [
    {
      id: 'ayato-namisen',
      label: 'Kamisato Art: Kyouka: Shunsuiken hits add a share of Max HP per Namisen stack (4, 5 at C2)',
      toggle: { kind: 'stacks', label: 'Namisen stacks', max: 5 },
      hits: ({ character, setting }) => [{
        labels: AYATO_SHUNSUIKEN,
        addTerms: { hp: Math.min(stacks(setting), character.constellation >= 2 ? 5 : 4) * AYATO_NAMISEN_HP[skillLevel(character, 3) - 1] },
      }],
      premod: ({ character, setting }) => (character.constellation >= 2 && stacks(setting) >= 3 ? { hpPct: 50 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'ayato-burst',
      label: 'Kamisato Art: Suiyuu: Normal Attack DMG Bonus in the Burst field',
      toggle: { kind: 'switch', label: 'In the Burst field' },
      premod: ({ character }) => ({ normalDmg: AYATO_BURST_NORMAL[burstLevel(character, 5) - 1] }),
      confidence: 'sourced',
    },
    {
      id: 'ayato-c1',
      label: 'C1: Shunsuiken DMG +40% against enemies at or below 50% HP',
      toggle: { kind: 'switch', label: 'Enemy at or below 50% HP' },
      hits: ({ character }) => (character.constellation >= 1 ? [{ labels: AYATO_SHUNSUIKEN, dmgBonus: 40 }] : []),
      confidence: 'sourced',
    },
  ],
  AratakiItto: [
    {
      id: 'itto-burst',
      label: 'Royal Descent: Behold, Itto the Evil!: ATK from DEF',
      toggle: { kind: 'switch', label: 'During the Burst' },
      final: (s, { character }) => ({ atk: (s.def ?? 0) * ITTO_BURST_DEF_TO_ATK[burstLevel(character, 5) - 1] / 100 }),
      confidence: 'sourced',
    },
    {
      id: 'itto-a4',
      label: 'Bloodline of the Crimson Oni: Arataki Kesagiri adds 35% of DEF',
      hits: ({ character }) =>
        ascended(character, 4) ? [{ labels: ['Arataki Kesagiri Combo Slash DMG', 'Arataki Kesagiri Final Slash DMG'], addTerms: { def: 35 } }] : [],
      confidence: 'sourced',
    },
    {
      id: 'itto-c4',
      label: 'C4: ATK +20% and DEF +20% after the Burst ends',
      toggle: { kind: 'switch', label: 'After the Burst' },
      premod: ({ character }) => (character.constellation >= 4 ? { atkPct: 20, defPct: 20 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'itto-c6',
      label: 'C6: Charged Attack CRIT DMG +70%',
      hits: ({ character }) => (character.constellation >= 6 ? [{ categories: ['charged'], critDmg: 70 }] : []),
      confidence: 'sourced',
    },
  ],
  Yelan: [{
    id: 'yelan-a1',
    label: 'Turn Control: Max HP +6/12/18/30% with 1/2/3/4 elements in the party',
    toggle: { kind: 'stacks', label: 'Elements in the party', max: 4 },
    premod: ({ character, setting }) => (ascended(character, 1) ? { hpPct: [0, 6, 12, 18, 30][stacks(setting)] ?? 0 } : {}),
    confidence: 'sourced',
  }],
  Navia: [
    {
      id: 'navia-a1',
      label: 'Undisclosed Distribution Channels: Normal, Charged and Plunging Attack DMG +40% after the Skill (with a Geo infusion)',
      toggle: { kind: 'switch', label: 'After the Skill' },
      premod: ({ character }) => (ascended(character, 1) ? { normalDmg: 40, chargedDmg: 40, plungingDmg: 40 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'navia-a4',
      label: 'Mutual Assistance Network: ATK +20% per Pyro, Electro, Cryo or Hydro teammate (up to 2)',
      toggle: { kind: 'stacks', label: 'Such teammates', max: 2 },
      premod: ({ character, setting }) => (ascended(character, 4) ? { atkPct: 20 * stacks(setting) } : {}),
      confidence: 'sourced',
    },
    {
      id: 'navia-skill-charges',
      label: 'Ceremonial Crystalshot: Skill DMG +15% per Crystal Shrapnel charge above 3 (up to 6); C2: Rosula Shardshot CRIT Rate +12% per charge (up to 3)',
      toggle: { kind: 'stacks', label: 'Crystal Shrapnel charges', max: 6 },
      premod: ({ setting }) => ({ skillDmg: 15 * Math.max(0, stacks(setting) - 3) }),
      hits: ({ character, setting }) =>
        character.constellation >= 2 ? [{ labels: ['Rosula Shardshot Base DMG'], critRate: 12 * Math.min(3, stacks(setting)) }] : [],
      confidence: 'sourced',
    },
    {
      id: 'navia-c4',
      label: 'C4: the enemy\'s Geo RES -20% after the Burst hits',
      toggle: { kind: 'switch', label: 'Burst hit' },
      debuffs: ({ character }) => (character.constellation >= 4 ? { resShred: { Geo: 20 } } : {}),
      confidence: 'sourced',
    },
  ],
  Arlecchino: [
    {
      id: 'arlecchino-bond',
      label: 'Masque of the Red Death: Normal Attacks add a share of ATK per Bond of Life (Pyro infusion from 30%); C1 adds 100% more',
      toggle: { kind: 'stacks', label: 'Bond of Life (% of Max HP)', max: 200 },
      hits: ({ character, setting }) => {
        const bond = stacks(setting) / 100
        const share = ARLECCHINO_BOND_ATK[autoLevel(character, 3) - 1] + (character.constellation >= 1 ? 100 : 0)
        return [{ categories: ['normal'], addTerms: { atk: share * bond } }]
      },
      confidence: 'sourced',
    },
    {
      id: 'arlecchino-pyro',
      label: 'Manifest Flame: Pyro DMG +40%',
      premod: () => ({ pyroDmg: 40 }),
      confidence: 'sourced',
    },
    {
      id: 'arlecchino-c6',
      label: 'C6: Normal Attack and Burst CRIT Rate +10% and CRIT DMG +70% after the Skill',
      toggle: { kind: 'switch', label: 'After the Skill' },
      hits: ({ character }) => (character.constellation >= 6 ? [{ categories: ['normal', 'burst'], critRate: 10, critDmg: 70 }] : []),
      confidence: 'sourced',
    },
  ],
  HuTao: [
    {
      id: 'hutao-skill-atk',
      label: 'Guide to Afterlife: ATK from Max HP (at most 400% of base ATK)',
      toggle: { kind: 'switch', label: 'In Paramita Papilio' },
      final: (s, { character }) => ({
        atk: Math.min((s.hp ?? 0) * HU_TAO_ATK_FROM_HP[skillLevel(character, 3) - 1] / 100, s.baseAtk * 4),
      }),
      confidence: 'sourced',
    },
    {
      id: 'hutao-a4',
      label: 'Sanguine Rouge: Pyro DMG +33% at or below 50% HP',
      toggle: { kind: 'switch', label: 'At or below 50% HP' },
      premod: ({ character }) => (ascended(character, 4) ? { pyroDmg: 33 } : {}),
      confidence: 'sourced',
    },
  ],
  Furina: [{
    id: 'furina-fanfare-self',
    label: 'Let the People Rejoice: DMG Bonus per Fanfare point, for Furina too (300 points, 400 at C1)',
    toggle: { kind: 'stacks', label: 'Fanfare points', max: 400 },
    premod: ({ character, setting }) => ({
      allDmg: Math.min(stacks(setting), character.constellation >= 1 ? 400 : 300) * FURINA_DMG_PER_FANFARE[burstLevel(character, 3) - 1],
    }),
    confidence: 'sourced',
  }],
  Neuvillette: [{
    id: 'neuvillette-a1',
    label: 'Heir to the Ancient Sea: Equitable Judgment DMG x110/125/160% at 1/2/3 Past Draconic Glories',
    toggle: { kind: 'stacks', label: 'Draconic Glories', max: 3 },
    hits: ({ character, setting }) =>
      ascended(character, 1) ? [{ labels: ['Charged Attack: Equitable Judgment'], scale: [0, 0.1, 0.25, 0.6][stacks(setting)] ?? 0 }] : [],
    confidence: 'sourced',
  }, {
    id: 'neuvillette-a4',
    label: 'Discipline of the Supreme Arbitration: Hydro DMG +0.6% per 1% HP above 30%, at most 30% (from 80% HP)',
    toggle: { kind: 'switch', label: 'At 80% HP or more' },
    premod: ({ character }) => (ascended(character, 4) ? { hydroDmg: 30 } : {}),
    confidence: 'sourced',
  }],
  Diluc: [{
    id: 'diluc-a4',
    label: 'Blessing of Phoenix: Pyro DMG +20% during Dawn\'s infusion',
    toggle: { kind: 'switch', label: 'During the Burst infusion' },
    premod: ({ character }) => (ascended(character, 4) ? { pyroDmg: 20 } : {}),
    confidence: 'sourced',
  }],
  Keqing: [{
    id: 'keqing-a4',
    label: 'Aristocratic Dignity: CRIT Rate and Energy Recharge +15% after the Burst',
    toggle: { kind: 'switch', label: 'After the Burst' },
    premod: ({ character }) => (ascended(character, 4) ? { critRate: 15, energyRecharge: 15 } : {}),
    confidence: 'sourced',
  }],
  Tighnari: [{
    id: 'tighnari-a4',
    label: 'Scholarly Blade: Charged Attack and Burst DMG +0.06% per Elemental Mastery (max 60%)',
    final: (s, { character }) => {
      if (!ascended(character, 4)) return {}
      const bonus = Math.min(60, (s.elementalMastery ?? 0) * 0.06)
      return { chargedDmg: bonus, burstDmg: bonus }
    },
    confidence: 'sourced',
  }],
  Yoimiya: [{
    id: 'yoimiya-a1',
    label: 'Tricks of the Trouble-Maker: Pyro DMG +2% per Normal Attack hit in the Skill, up to 10 stacks',
    toggle: { kind: 'stacks', label: 'Stacks', max: 10 },
    premod: ({ character, setting }) => (ascended(character, 1) ? { pyroDmg: 2 * stacks(setting) } : {}),
    confidence: 'sourced',
  }],
  Cyno: [{
    id: 'cyno-a1',
    label: 'Featherfall Judgment: Elemental Skill DMG +35% in Endseer stance',
    toggle: { kind: 'switch', label: 'Endseer stance' },
    premod: ({ character }) => (ascended(character, 1) ? { skillDmg: 35 } : {}),
    confidence: 'sourced',
  }],
  Nahida: [{
    id: 'nahida-a4',
    label: 'Awakening Elucidated: Tri-Karma Purification DMG +0.1% and CRIT Rate +0.03% per Elemental Mastery above 200 (max 80% / 24%)',
    hits: ({ character }) =>
      ascended(character, 4)
        ? [{ labels: ['Tri-Karma Purification DMG'], fromEm: { over: 200, dmgPer: 0.1, dmgCap: 80, critPer: 0.03, critCap: 24 } }]
        : [],
    confidence: 'sourced',
  }],
  RaidenShogun: [{
    id: 'raiden-resolve',
    label: 'Musou Shinsetsu: Resolve stacks add ATK to the initial slash and to Musou Isshin hits (60 at most)',
    toggle: { kind: 'stacks', label: 'Resolve stacks', max: 60 },
    hits: ({ character, setting }) => {
      const level = burstLevel(character, 3) - 1
      const n = stacks(setting)
      return [
        { labels: [RAIDEN_INITIAL], addTerms: { atk: n * RAIDEN_RESOLVE_INITIAL[level] } },
        { categories: ['burst'], excludeLabels: [RAIDEN_INITIAL], addTerms: { atk: n * RAIDEN_RESOLVE_ISSHIN[level] } },
      ]
    },
    confidence: 'sourced',
  }],
  Ganyu: [{
    id: 'ganyu-a4',
    label: 'Harmony between Heaven and Earth: Cryo DMG +20% in the Burst field',
    toggle: { kind: 'switch', label: 'In the Burst field' },
    premod: ({ character }) => (ascended(character, 4) ? { cryoDmg: 20 } : {}),
    confidence: 'sourced',
  }],
  KamisatoAyaka: [
    {
      id: 'ayaka-a1',
      label: 'Amatsumi Kunitsumi Sanctification: Normal and Charged Attack DMG +30% after the Skill',
      toggle: { kind: 'switch', label: 'After the Skill' },
      premod: ({ character }) => (ascended(character, 1) ? { normalDmg: 30, chargedDmg: 30 } : {}),
      confidence: 'sourced',
    },
    {
      id: 'ayaka-a4',
      label: 'Kanten Senmyou Blessing: Cryo DMG +18% after the sprint',
      toggle: { kind: 'switch', label: 'After the sprint' },
      premod: ({ character }) => (ascended(character, 4) ? { cryoDmg: 18 } : {}),
      confidence: 'sourced',
    },
  ],
}

// R1 value plus a quarter of it per refinement above 1
const refined = (r1: number, refinement: number) => r1 * (1 + 0.25 * (refinement - 1))
const ownElementDmg = (character: GenshinCharacter, value: number): Stats => (character.element ? { [ELEMENT_DMG_STAT[character.element]]: value } : {})

// By GOOD weapon key: combat effects that don't show on the stat screen (the always-on ones are in the stat data)
export const WEAPON_EFFECTS: Record<string, CombatEffect[]> = {
  MistsplitterReforged: [{
    id: 'mistsplitter',
    label: 'Mistsplitter\'s Emblem: elemental DMG +8/16/28% at 1/2/3 stacks',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    premod: ({ character, setting, refinement }) => ownElementDmg(character, refined([0, 8, 16, 28][stacks(setting)] ?? 0, refinement)),
    confidence: 'sourced',
  }],
  StaffOfHoma: [{
    id: 'homa-low-hp',
    label: 'Reckless Cinnabar: ATK +1% of Max HP more below 50% HP',
    toggle: { kind: 'switch', label: 'Below 50% HP' },
    final: (s, { refinement }) => ({ atk: (s.hp ?? 0) * (1 + 0.2 * (refinement - 1)) / 100 }),
    confidence: 'sourced',
  }],
  EngulfingLightning: [{
    id: 'engulfing-burst',
    label: 'Timeless Dream: Energy Recharge +30% after the Burst',
    toggle: { kind: 'switch', label: 'After the Burst' },
    premod: ({ refinement }) => ({ energyRecharge: 30 + 5 * (refinement - 1) }),
    confidence: 'sourced',
  }],
  PrimordialJadeWingedSpear: [{
    id: 'jade-spear',
    label: 'Eagle Spear of Justice: ATK +3.2% per stack (7); at 7 stacks DMG +12%',
    toggle: { kind: 'stacks', label: 'Stacks', max: 7 },
    premod: ({ setting, refinement }) => ({
      atkPct: stacks(setting) * (3.2 + 0.7 * (refinement - 1)),
      allDmg: stacks(setting) >= 7 ? refined(12, refinement) : 0,
    }),
    confidence: 'sourced',
  }],
  ThunderingPulse: [{
    id: 'thundering-pulse',
    label: 'Rule by Thunder: Normal Attack DMG +12/24/40% at 1/2/3 Thunder Emblems',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    premod: ({ setting, refinement }) => ({ normalDmg: refined([0, 12, 24, 40][stacks(setting)] ?? 0, refinement) }),
    confidence: 'sourced',
  }],
  AquaSimulacra: [{
    id: 'aqua-simulacra',
    label: 'The Cleansing Form: DMG +20% with enemies nearby',
    toggle: { kind: 'switch', label: 'Enemies nearby' },
    premod: ({ refinement }) => ({ allDmg: refined(20, refinement) }),
    confidence: 'sourced',
  }],
  LostPrayerToTheSacredWinds: [{
    id: 'lost-prayer',
    label: 'Boundless Blessing: elemental DMG +8% per 4 seconds on the field, up to 4 stacks',
    toggle: { kind: 'stacks', label: 'Stacks', max: 4 },
    premod: ({ character, setting, refinement }) => ownElementDmg(character, stacks(setting) * refined(8, refinement)),
    confidence: 'sourced',
  }],
  KagurasVerity: [{
    id: 'kaguras-verity',
    label: 'Kagura Dance of the Sacred Sakura: Skill DMG +12% per stack (3); at 3 elemental DMG +12%',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    premod: ({ character, setting, refinement }) => ({
      skillDmg: stacks(setting) * refined(12, refinement),
      ...(stacks(setting) >= 3 ? ownElementDmg(character, refined(12, refinement)) : {}),
    }),
    confidence: 'sourced',
  }],
  CalamityQueller: [{
    id: 'calamity-queller',
    label: 'Extinguishing Precept: ATK +3.2% per second after the Skill, up to 6 (doubled off-field, so up to 12)',
    toggle: { kind: 'stacks', label: 'Stacks (12 off-field)', max: 12 },
    premod: ({ setting, refinement }) => ({ atkPct: stacks(setting) * refined(3.2, refinement) }),
    confidence: 'sourced',
  }],
  AmosBow: [{
    id: 'amos-bow',
    label: 'Strong-Willed: Normal and Charged Attack DMG +12%, +8% more per 0.1s of arrow flight (up to 5)',
    toggle: { kind: 'stacks', label: 'Flight stacks', max: 5 },
    premod: ({ setting, refinement }) => {
      const bonus = refined(12, refinement) + stacks(setting) * refined(8, refinement)
      return { normalDmg: bonus, chargedDmg: bonus }
    },
    confidence: 'sourced',
  }],
  HaranGeppakuFutsu: [{
    id: 'haran',
    label: 'Honed Flow: Normal Attack DMG +20% per Wavespike stack, up to 2',
    toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
    premod: ({ setting, refinement }) => ({ normalDmg: stacks(setting) * refined(20, refinement) }),
    confidence: 'sourced',
  }],
  TheCatch: [{
    id: 'the-catch',
    label: 'Shanty: Burst DMG +16% and Burst CRIT Rate +6%',
    premod: ({ refinement }) => ({ burstDmg: refined(16, refinement) }),
    hits: ({ refinement }) => [{ categories: ['burst'], critRate: refined(6, refinement) }],
    confidence: 'sourced',
  }],
  RedhornStonethresher: [{
    id: 'redhorn',
    label: 'Gokadaiou Otogibanashi: Normal and Charged Attacks deal extra DMG of 40% of DEF',
    hits: ({ refinement }) => [{ categories: ['normal', 'charged'], addTerms: { def: refined(40, refinement) } }],
    confidence: 'sourced',
  }],
  CinnabarSpindle: [{
    id: 'cinnabar',
    label: 'Spotless Heart: Skill DMG gains 40% of DEF as extra DMG',
    toggle: { kind: 'switch', label: 'Active' },
    hits: ({ refinement }) => [{ categories: ['skill'], addTerms: { def: refined(40, refinement) } }],
    confidence: 'sourced',
  }],
  LightOfFoliarIncision: [{
    id: 'foliar-incision',
    label: 'Whitemoon Bristle: Normal Attack and Skill hits deal extra DMG of 120% of Elemental Mastery (28 hits per proc)',
    toggle: { kind: 'switch', label: 'Thorny Benevolence active' },
    hits: ({ refinement }) => [{ categories: ['normal', 'skill'], addTerms: { elementalMastery: refined(120, refinement) } }],
    confidence: 'sourced',
  }],
  KeyOfKhajNisut: [{
    id: 'khaj-nisut',
    label: 'Sunken Song of the Sands: Elemental Mastery +0.12% of Max HP per Grand Hymn stack, up to 3',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    final: (s, { setting, refinement }) => ({ elementalMastery: (s.hp ?? 0) * stacks(setting) * refined(0.12, refinement) / 100 }),
    confidence: 'sourced',
  }],
  FreedomSworn: [{
    id: 'freedom-sworn-self',
    label: 'Revolutionary Chorale: DMG +10%',
    premod: ({ refinement }) => ({ allDmg: refined(10, refinement) }),
    confidence: 'sourced',
  }],
}

// Which sets' 4-piece effects count, and the toggles, saved with the optimizer settings
export type CombatSetup = {
  sets: string[],
  settings: Record<string, BuffSetting>,
  // Hexerei characters in the party (damage/damage.ts hexereiCount), for Hexerei effects
  hexerei?: number,
}

export type AppliedEffect = { effect: CombatEffect, sourceName: string, setting: BuffSetting, counted: boolean }

export type ResolvedCombat = {
  applied: AppliedEffect[],
  premod: Stats,
  // Bonuses from the final stats, added after everything else
  finals: ((stats: ScreenStats) => Stats)[],
  reactions: Partial<Record<ReactionBonusKey, number>>,
  debuffs: { defShred: number, resShred: Partial<Record<Element | 'Physical', number>> },
  hitBuffs: HitBuff[],
  elevation: Partial<Record<SpecialKind, number>>,
  reactionsPerEm: Partial<Record<ReactionBonusKey, number>>,
}

export function defaultEffectSetting(effect: CombatEffect): BuffSetting {
  return effect.toggle?.kind === 'stacks' ? effect.toggle.max : true
}

// The effects that count for this character: their kit, and 4-piece sets in combat.sets that the artifacts have 4 of
// (setCounts; the optimizer passes the 4-piece filter's set with 4)
export function resolveCombat(character: GenshinCharacter, combat: CombatSetup, setCounts: Map<string, number>): ResolvedCombat {
  const candidates: { effect: CombatEffect, sourceName: string }[] = [
    ...(KIT_EFFECTS[character.id] ?? []).map((effect) => ({ effect, sourceName: character.name })),
    ...(WEAPON_EFFECTS[character.weapon?.id ?? ''] ?? []).map((effect) => ({ effect, sourceName: character.weapon?.name ?? 'Weapon' })),
    ...combat.sets.filter((id) => (setCounts.get(id) ?? 0) >= 4).flatMap((id) =>
      (SET_4PC_EFFECTS[id] ?? []).map((effect) => ({ effect, sourceName: '4-piece set' }))
    ),
  ]
  const resolved: ResolvedCombat = {
    applied: [],
    premod: {},
    finals: [],
    reactions: {},
    debuffs: { defShred: 0, resShred: {} },
    hitBuffs: [],
    elevation: {},
    reactionsPerEm: {},
  }
  for (const { effect, sourceName } of candidates) {
    const setting = combat.settings[effect.id] ?? defaultEffectSetting(effect)
    const counted = on(setting) && !(effect.toggle?.kind === 'stacks' && stacks(setting) === 0)
    resolved.applied.push({ effect, sourceName, setting, counted })
    if (!counted) continue
    const context = { character, setting, refinement: character.weapon?.refinement ?? 1, hexerei: combat.hexerei ?? 0 }
    for (const [stat, value] of Object.entries(effect.premod?.(context) ?? {}) as [GenshinStatKey, number][]) {
      resolved.premod[stat] = (resolved.premod[stat] ?? 0) + value
    }
    const final = effect.final
    if (final) resolved.finals.push((stats) => final(stats, context))
    for (const [reaction, value] of Object.entries(effect.reactions?.(context) ?? {}) as [ReactionBonusKey, number][]) {
      resolved.reactions[reaction] = (resolved.reactions[reaction] ?? 0) + value
    }
    resolved.hitBuffs.push(...(effect.hits?.(context) ?? []))
    for (const [key, value] of Object.entries(effect.reactionsPerEm?.(context) ?? {}) as [ReactionBonusKey, number][]) {
      resolved.reactionsPerEm[key] = (resolved.reactionsPerEm[key] ?? 0) + value
    }
    for (const [kind, value] of Object.entries(effect.elevation?.(context) ?? {}) as [SpecialKind, number][]) {
      resolved.elevation[kind] = (resolved.elevation[kind] ?? 0) + value
    }
    const debuffs = effect.debuffs?.(context)
    resolved.debuffs.defShred += debuffs?.defShred ?? 0
    for (const [element, value] of Object.entries(debuffs?.resShred ?? {}) as [Element | 'Physical', number][]) {
      resolved.debuffs.resShred[element] = (resolved.debuffs.resShred[element] ?? 0) + value
    }
  }
  return resolved
}

export function setCountsOf(setIds: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of setIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}
