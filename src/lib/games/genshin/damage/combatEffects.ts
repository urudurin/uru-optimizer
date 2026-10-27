import type { ScreenStats } from 'lib/games/genshin/data/screenPassives'
import type { BuffSetting } from 'lib/games/genshin/team/buffs'
import type {
  Element,
  GenshinCharacter,
  GenshinStatKey,
} from 'lib/games/genshin/types'

// Effects a character gets in combat from their own kit and artifact sets, on top of the stat screen: what makes the
// rotation damage line up with the game when the character is fighting. Only the optimizer counts them (the Characters
// page stays a stat screen). Each effect gives
//   - premod: bonuses known up front (ATK%, a DMG Bonus), added with the other bonuses
//   - final: bonuses worked out from the build's final stats (Hu Tao's ATK from HP, Emblem's Burst DMG from ER)
//   - reactions: reaction DMG bonuses (Crimson Witch, Thundering Fury), in percent, the same for every build
//   - debuffs: what the wearer does to the enemy (Deepwood Memories)
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

export type CombatContext = {
  character: GenshinCharacter,
  // true/false for a switch, the stack count for stacks
  setting: BuffSetting,
}

export type CombatEffect = {
  id: string,
  label: string,
  toggle?: EffectToggle,
  premod?: (context: CombatContext) => Stats,
  final?: (stats: ScreenStats, context: CombatContext) => Stats,
  reactions?: (context: CombatContext) => Partial<Record<ReactionBonusKey, number>>,
  debuffs?: (context: CombatContext) => { defShred?: number, resShred?: Partial<Record<Element | 'Physical', number>> },
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
export const SET_4PC_EFFECTS: Record<string, CombatEffect[]> = {
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

// Furina's DMG Bonus per Fanfare point by Burst level 1-15, as in team/buffs.ts
const FURINA_DMG_PER_FANFARE = [0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21, 0.23, 0.25, 0.27, 0.29, 0.31, 0.33, 0.35]

// By GOOD character key
export const KIT_EFFECTS: Record<string, CombatEffect[]> = {
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

// Which sets' 4-piece effects count, and the toggles, saved with the optimizer settings
export type CombatSetup = {
  sets: string[],
  settings: Record<string, BuffSetting>,
}

export type AppliedEffect = { effect: CombatEffect, sourceName: string, setting: BuffSetting, counted: boolean }

export type ResolvedCombat = {
  applied: AppliedEffect[],
  premod: Stats,
  // Bonuses from the final stats, added after everything else
  finals: ((stats: ScreenStats) => Stats)[],
  reactions: Partial<Record<ReactionBonusKey, number>>,
  debuffs: { defShred: number, resShred: Partial<Record<Element | 'Physical', number>> },
}

export function defaultEffectSetting(effect: CombatEffect): BuffSetting {
  return effect.toggle?.kind === 'stacks' ? effect.toggle.max : true
}

// The effects that count for this character: their kit, and 4-piece sets in combat.sets that the artifacts have 4 of
// (setCounts; the optimizer passes the 4-piece filter's set with 4)
export function resolveCombat(character: GenshinCharacter, combat: CombatSetup, setCounts: Map<string, number>): ResolvedCombat {
  const candidates: { effect: CombatEffect, sourceName: string }[] = [
    ...(KIT_EFFECTS[character.id] ?? []).map((effect) => ({ effect, sourceName: character.name })),
    ...combat.sets.filter((id) => (setCounts.get(id) ?? 0) >= 4).flatMap((id) =>
      (SET_4PC_EFFECTS[id] ?? []).map((effect) => ({ effect, sourceName: '4-piece set' }))
    ),
  ]
  const resolved: ResolvedCombat = { applied: [], premod: {}, finals: [], reactions: {}, debuffs: { defShred: 0, resShred: {} } }
  for (const { effect, sourceName } of candidates) {
    const setting = combat.settings[effect.id] ?? defaultEffectSetting(effect)
    const counted = on(setting) && !(effect.toggle?.kind === 'stacks' && stacks(setting) === 0)
    resolved.applied.push({ effect, sourceName, setting, counted })
    if (!counted) continue
    const context = { character, setting }
    for (const [stat, value] of Object.entries(effect.premod?.(context) ?? {}) as [GenshinStatKey, number][]) {
      resolved.premod[stat] = (resolved.premod[stat] ?? 0) + value
    }
    const final = effect.final
    if (final) resolved.finals.push((stats) => final(stats, context))
    for (const [reaction, value] of Object.entries(effect.reactions?.(context) ?? {}) as [ReactionBonusKey, number][]) {
      resolved.reactions[reaction] = (resolved.reactions[reaction] ?? 0) + value
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
