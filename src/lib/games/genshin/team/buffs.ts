import type { DamageElement } from 'lib/games/genshin/damage/damage'
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
  | { kind: 'switch', label: string }
  // A count from 0 to max (Fanfare points)
  | { kind: 'stacks', label: string, max: (giver: GenshinCharacter) => number, step: number }
  // Which element, for swirl and crystallize effects
  | { kind: 'element', label: string, options: Element[] }

export type BuffSetting = boolean | number | string

// What a buff changes on the enemy instead of the receiver: DEF shred, or RES shred of one element or all of them
export type EnemyDebuffKey = 'defShred' | `resShred:${DamageElement | 'all'}`
export type BuffStat = GenshinStatKey | EnemyDebuffKey

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
  ],
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
