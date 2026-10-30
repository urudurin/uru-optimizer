import type { Faction } from 'lib/games/zzz/data/factions'
import type { FinalStats } from 'lib/games/zzz/stats/computeStats'
import {
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Buffs a ZZZ agent's kit or 4-piece disc set gives the squad, like genshin/team/buffs.ts. Formulas and numbers follow
// genshin-optimizer's ZZZ character and disc sheets and its generated stat data (libs/zzz/formula/src/data/char/sheets,
// libs/zzz/formula/src/data/disc/sheets, libs/zzz/stats/src/allStat_gen.json; https://github.com/frzyc/genshin-optimizer,
// MIT, Copyright (c) 2020 frzyc). Personal, non-commercial use.
//
// Covered: ATK, CRIT, PEN Ratio, Anomaly Proficiency and DMG Bonus on the agent, and DEF shred, RES shred and DMG taken
// on the enemy (they count in rotation damage, damage/damage.ts). All-type DMG Bonus is counted as Element DMG, the same
// multiplier in ZZZ. Teammates' W-Engines (W_ENGINE_TEAM_BUFFS) count at the refinement in their saved build, and
// Aftershock DMG goes to rotation damage only. Not yet: Daze, Anomaly buildup,
// buffs a character gives only themselves, and agents whose genshin-optimizer sheets are still templates
// (Nangong Yu, Norma, Velina, Sunna). Saved builds don't record skill or Core Skill levels, so every giver is taken at
// skill level 12 and Core Skill F; Mindscape comes from their saved build.

export type ZzzBuffToggle =
  | { kind: 'switch', label: string }
  | { kind: 'stacks', label: string, max: (giver: SquadMember) => number }

export type ZzzBuffSetting = boolean | number

export type SquadMember = {
  agentId: string,
  name: string,
  element: string,
  specialty: string,
  faction?: Faction,
  mindscape: number,
}

export type ZzzBuffContext = {
  giver: SquadMember,
  // The giver's stat screen (their saved build, out of combat): what "initial ATK" means in the game
  giverStats: FinalStats,
  receiver: SquadMember,
  // The giver, the receiver and the other teammate
  squad: SquadMember[],
  // The giver's W-Engine refinement (1-5), for W_ENGINE_TEAM_BUFFS
  refinement: number,
  setting: ZzzBuffSetting,
}

// Effects on the enemy rather than the agent, in percent (damage/damage.ts EnemyDebuffs)
export type EnemyDebuffKey = 'defShred' | 'resShred' | 'dmgTaken' | 'stunBonus'

export const DEBUFF_LABELS: Record<EnemyDebuffKey, string> = {
  defShred: 'enemy DEF shred',
  resShred: 'enemy RES shred',
  dmgTaken: 'enemy DMG taken',
  stunBonus: 'enemy stun multiplier',
}

// DMG Bonus for some hits only, counted in rotation damage (damage/damage.ts KindBonus)
// Sheer DMG Bonus (its own multiplier on Rupture agents' hits) too
export type HitBonusKey = 'aftershockDmg' | 'sheerDmg'

export type ZzzTeamBuff = {
  id: string,
  label: string,
  stat: ZzzStatsValues | EnemyDebuffKey | HitBonusKey,
  // Only for agents of this element (Ice DMG), all of them when left out
  element?: string,
  // In display units (25 = 25%); 0 when it doesn't apply
  value: (context: ZzzBuffContext) => number,
  blockedBy?: (context: ZzzBuffContext) => string | undefined,
  toggle?: ZzzBuffToggle,
  // Buffs in one group don't stack, only the biggest counts (two Swing Jazz wearers)
  nonStacking?: string,
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

// What genshin-optimizer assumes when the levels aren't known
export const ASSUMED_SKILL_LEVEL = 12
export const ASSUMED_CORE = 6

// Additional Abilities count squad members of an element plus those of a faction (an agent who is both counts twice)
function abilityCount(squad: SquadMember[], element: string, faction?: Faction, specialties: string[] = []): number {
  return squad.filter((m) => m.element === element).length
    + (faction ? squad.filter((m) => m.faction === faction).length : 0)
    + squad.filter((m) => specialties.includes(m.specialty)).length
}

const needsSquad = (element: string, faction: Faction | undefined, label: string) => (context: ZzzBuffContext) =>
  abilityCount(context.squad, element, faction) < 3 ? `Needs a squad with another ${label}` : undefined

const needsMindscape = (level: number) => (context: ZzzBuffContext) =>
  context.giver.mindscape < level ? `Needs ${context.giver.name} at Mindscape ${level}` : undefined

const switchOn = (context: ZzzBuffContext) => context.setting !== false

// By agent id
export const AGENT_BUFFS: Record<string, ZzzTeamBuff[]> = {
  // Astra Yao: Idyllic Cadenza after her EX Special or Chain Attack
  '1311': [
    {
      id: 'idyllic-atk',
      label: 'Core Skill: ATK from her initial ATK (Idyllic Cadenza)',
      stat: ZzzStats.ATK,
      toggle: { kind: 'switch', label: 'Idyllic Cadenza' },
      value: (c) => {
        if (!switchOn(c)) return 0
        const m2 = c.giver.mindscape >= 2
        const cap = 1200 + (m2 ? 400 : 0)
        const atkShare = [0.22, 0.24, 0.26, 0.28, 0.3, 0.32, 0.35][ASSUMED_CORE] * (1 + (m2 ? 0.19 : 0))
        return Math.min(cap, c.giverStats.atk * atkShare)
      },
      confidence: 'sourced',
    },
    {
      id: 'idyllic-crit-dmg',
      label: 'EX Special: CRIT DMG (Idyllic Cadenza)',
      stat: ZzzStats.CRIT_DMG,
      toggle: { kind: 'switch', label: 'Idyllic Cadenza' },
      value: (c) => (switchOn(c) ? 7 + 1.5 * ASSUMED_SKILL_LEVEL : 0),
      confidence: 'sourced',
    },
    {
      id: 'idyllic-dmg',
      label: 'EX Special: DMG Bonus (Idyllic Cadenza)',
      stat: ZzzStats.ELEMENT_DMG,
      toggle: { kind: 'switch', label: 'Idyllic Cadenza' },
      value: (c) => (switchOn(c) ? 8 + ASSUMED_SKILL_LEVEL : 0),
      confidence: 'sourced',
    },
    {
      id: 'm1-res-shred',
      label: 'Mindscape 1: enemy RES shred per hit (up to 3)',
      stat: 'resShred',
      toggle: { kind: 'stacks', label: 'Hits (max 3)', max: () => 3 },
      value: (c) => (c.giver.mindscape >= 1 && typeof c.setting === 'number' ? 6 * c.setting : 0),
      blockedBy: needsMindscape(1),
      confidence: 'sourced',
    },
  ],
  // Lucy: Cheer On! from her EX Special
  '1151': [
    {
      id: 'cheer-on-atk',
      label: 'EX Special: ATK from her initial ATK (Cheer On!)',
      stat: ZzzStats.ATK,
      toggle: { kind: 'switch', label: 'Cheer On!' },
      value: (c) => (switchOn(c) ? Math.min(600, (0.13 + 0.008 * ASSUMED_SKILL_LEVEL) * c.giverStats.atk + 40 + 4 * ASSUMED_SKILL_LEVEL) : 0),
      confidence: 'sourced',
    },
    {
      id: 'm4-crit-dmg',
      label: 'Mindscape 4: CRIT DMG with Cheer On!',
      stat: ZzzStats.CRIT_DMG,
      toggle: { kind: 'switch', label: 'Cheer On!' },
      value: (c) => (switchOn(c) && c.giver.mindscape >= 4 ? 10 : 0),
      blockedBy: needsMindscape(4),
      confidence: 'sourced',
    },
  ],
  // Soukaku: Fly the Flag
  '1131': [
    {
      id: 'fly-the-flag-atk',
      label: 'Core Skill: ATK from her initial ATK (Fly the Flag; doubled after consuming Vortex)',
      stat: ZzzStats.ATK,
      toggle: { kind: 'stacks', label: 'Vortex consumed (0 or 1)', max: () => 1 },
      value: (c) => {
        const doubled = c.setting === 1
        const share = [0.1, 0.125, 0.15, 0.17, 0.18, 0.19, 0.2][ASSUMED_CORE] * (doubled ? 2 : 1)
        return Math.min(doubled ? 1000 : 500, c.giverStats.atk * share)
      },
      confidence: 'sourced',
    },
    {
      id: 'ability-ice-dmg',
      label: 'Additional Ability: Ice DMG after consuming Vortex',
      stat: ZzzStats.ELEMENT_DMG,
      element: 'Ice',
      toggle: { kind: 'switch', label: 'Vortex consumed' },
      value: (c) => (switchOn(c) && abilityCount(c.squad, 'Ice', 'HollowSpecialOoperationsSection6') >= 3 ? 20 : 0),
      blockedBy: needsSquad('Ice', 'HollowSpecialOoperationsSection6', 'Ice agent or Section 6 member'),
      confidence: 'sourced',
    },
  ],
  // Caesar: Radiant Aegis on her shield
  '1071': [
    {
      id: 'radiant-aegis-atk',
      label: 'Core Skill: ATK while shielded (Radiant Aegis)',
      stat: ZzzStats.ATK,
      toggle: { kind: 'switch', label: 'Shielded by Caesar' },
      value: (c) => (switchOn(c) ? [40, 135, 240, 400, 650, 900, 1000][ASSUMED_CORE] * (c.giver.mindscape >= 2 ? 1.5 : 1) : 0),
      confidence: 'sourced',
    },
    {
      id: 'ability-dmg-taken',
      label: 'Additional Ability: enemy takes more DMG (after her Defensive Assist, or with another Sons of Calydon member)',
      stat: 'dmgTaken',
      toggle: { kind: 'switch', label: 'Debuff on the enemy' },
      value: (c) => (switchOn(c) ? 25 : 0),
      confidence: 'sourced',
    },
  ],
  // Rina: PEN Ratio while Drusilla or Anastella are on the field
  '1211': [
    {
      id: 'core-pen-ratio',
      label: 'Core Skill: PEN Ratio from her own (bangboo on the field)',
      stat: ZzzStats.PEN_RATIO,
      toggle: { kind: 'switch', label: 'Bangboo on the field' },
      value: (c) => {
        if (!switchOn(c)) return 0
        // Mindscape 1: 30% more within 10m
        const boost = c.giver.mindscape >= 1 ? 1.3 : 1
        const core = [0.06, 0.075, 0.09, 0.102, 0.108, 0.114, 0.12][ASSUMED_CORE] * 100
        return Math.min(30 * boost, (c.giverStats.penRatio * 0.25 + core) * boost)
      },
      confidence: 'sourced',
    },
    {
      id: 'ability-electric-dmg',
      label: 'Additional Ability: Electric DMG against Shocked enemies',
      stat: ZzzStats.ELEMENT_DMG,
      element: 'Electric',
      toggle: { kind: 'switch', label: 'Enemy Shocked' },
      value: (c) => (switchOn(c) && abilityCount(c.squad, 'Electric', 'VictoriaHousekeepingCo') >= 3 ? 10 : 0),
      blockedBy: needsSquad('Electric', 'VictoriaHousekeepingCo', 'Electric agent or Victoria Housekeeping member'),
      confidence: 'sourced',
    },
  ],
  // Nicole
  '1031': [
    {
      id: 'core-def-shred',
      label: 'Core Skill: enemy DEF shred after her EX Special or field hits',
      stat: 'defShred',
      toggle: { kind: 'switch', label: 'Enemy hit by her field' },
      value: (c) => (switchOn(c) ? [20, 25, 30, 34, 36, 38, 40][ASSUMED_CORE] : 0),
      confidence: 'sourced',
    },
    {
      id: 'ability-ether-dmg',
      label: 'Additional Ability: Ether DMG when her EX Special or field hits',
      stat: ZzzStats.ELEMENT_DMG,
      element: 'Ether',
      toggle: { kind: 'switch', label: 'Hit by her field' },
      value: (c) => (switchOn(c) && abilityCount(c.squad, 'Ether', 'CunningHares') >= 3 ? 25 : 0),
      blockedBy: needsSquad('Ether', 'CunningHares', 'Ether agent or Cunning Hares member'),
      confidence: 'sourced',
    },
    {
      id: 'm6-crit-rate',
      label: 'Mindscape 6: CRIT Rate per field hit',
      stat: ZzzStats.CRIT_RATE,
      toggle: { kind: 'stacks', label: 'Field hits (max 10)', max: () => 10 },
      value: (c) => (c.giver.mindscape >= 6 && typeof c.setting === 'number' ? 1.5 * c.setting : 0),
      blockedBy: needsMindscape(6),
      confidence: 'sourced',
    },
  ],
  // Trigger
  '1361': [
    {
      id: 'm2-crit-dmg',
      label: 'Mindscape 2: CRIT DMG per Hunter\'s Gaze stack',
      stat: ZzzStats.CRIT_DMG,
      toggle: { kind: 'stacks', label: 'Hunter\'s Gaze (max 4)', max: () => 4 },
      value: (c) => (c.giver.mindscape >= 2 && typeof c.setting === 'number' ? 6 * c.setting : 0),
      blockedBy: needsMindscape(2),
      confidence: 'sourced',
    },
  ],
  // Pulchra: her Additional Ability (genshin-optimizer's Pulchra sheet; at Mindscape 6 it becomes all-type DMG)
  '1351': [
    {
      id: 'ability-aftershock-dmg',
      label: 'Additional Ability: Aftershock DMG while the enemy is in her Binding Trap',
      stat: 'aftershockDmg',
      toggle: { kind: 'switch', label: 'Binding Trap' },
      value: (c) => (switchOn(c) ? 30 : 0),
      confidence: 'sourced',
    },
  ],
  // Nangong Yu: in-game text at Core Skill level 7 (the user's screenshots); GO's sheet is a placeholder
  '1511': [
    {
      id: 'nangong-squad-dmg',
      label: 'Core Skill: squad DMG +25% for 30s after her Basic Attack: Adorable Explosive Impact or EX Special hits',
      stat: ZzzStats.ELEMENT_DMG,
      toggle: { kind: 'switch', label: 'After her Basic or EX Special' },
      value: (c) => (switchOn(c) ? 25 : 0),
      confidence: 'confirmed',
    },
    {
      id: 'nangong-misstep',
      label: 'Additional Ability: Misstep, the enemy\'s stun multiplier +30% (after her Basic Attack\'s third hit or Ultimate)',
      stat: 'stunBonus',
      toggle: { kind: 'switch', label: 'Misstep' },
      value: (c) => (switchOn(c) ? 30 : 0),
      confidence: 'confirmed',
    },
  ],
  // Norma: in-game text at Core Skill level 7 (the user's screenshots); GO's sheet is a placeholder. Her Additional
  // Ability needs an Attack or Rupture agent or her faction in the squad
  '1571': [
    {
      id: 'norma-tech-divide',
      label: 'Additional Ability: Tech Divide, the enemy\'s stun multiplier +3% per stack (up to 10)',
      stat: 'stunBonus',
      toggle: { kind: 'stacks', label: 'Tech Divide stacks (max 10)', max: () => 10 },
      value: (c) => (typeof c.setting === 'number' ? 3 * c.setting : 0),
      confidence: 'confirmed',
    },
    {
      id: 'norma-barrage-dmg',
      label: 'Additional Ability: squad DMG +20% during her En-Nah Barrage',
      stat: ZzzStats.ELEMENT_DMG,
      toggle: { kind: 'switch', label: 'En-Nah Barrage' },
      value: (c) => (switchOn(c) ? 20 : 0),
      confidence: 'confirmed',
    },
  ],
  // Seth
  '1271': [
    {
      id: 'core-anomaly-proficiency',
      label: 'Core Skill: Anomaly Proficiency while shielded (Shield of Resolve)',
      stat: ZzzStats.ANOMALY_PROFICIENCY,
      toggle: { kind: 'switch', label: 'Shielded by Seth' },
      value: (c) => (switchOn(c) ? [50, 62, 75, 85, 90, 95, 100][ASSUMED_CORE] : 0),
      confidence: 'sourced',
    },
  ],
}

// By disc set id (the slugified name, data/sets.ts)
export const SET_4PC_BUFFS: Record<string, ZzzTeamBuff[]> = {
  'swing-jazz': [{
    id: 'swing-jazz',
    label: 'Swing Jazz 4-piece: DMG Bonus after a Chain Attack or Ultimate',
    stat: ZzzStats.ELEMENT_DMG,
    toggle: { kind: 'switch', label: 'After a Chain Attack or Ultimate' },
    value: (c) => (switchOn(c) ? 15 : 0),
    nonStacking: 'swing-jazz',
    confidence: 'sourced',
  }],
  'astral-voice': [{
    id: 'astral-voice',
    label: 'Astral Voice 4-piece: DMG Bonus per Astral stack',
    stat: ZzzStats.ELEMENT_DMG,
    toggle: { kind: 'stacks', label: 'Astral stacks (max 3)', max: () => 3 },
    value: (c) => (typeof c.setting === 'number' ? 8 * c.setting : 0),
    nonStacking: 'astral-voice',
    confidence: 'sourced',
  }],
  'moonlight-lullaby': [{
    id: 'moonlight-lullaby',
    label: 'Moonlight Lullaby 4-piece: DMG Bonus after a Support\'s EX Special or Ultimate',
    stat: ZzzStats.ELEMENT_DMG,
    toggle: { kind: 'switch', label: 'After their EX Special or Ultimate' },
    value: (c) => (switchOn(c) && c.giver.specialty === 'Support' ? 18 : 0),
    blockedBy: (c) => (c.giver.specialty !== 'Support' ? 'Only when a Support wears it' : undefined),
    nonStacking: 'moonlight-lullaby',
    confidence: 'sourced',
  }],
  'king-of-the-summit': [{
    id: 'king-of-the-summit',
    label: 'King of the Summit 4-piece: CRIT DMG after a Stun agent\'s EX Special or Chain Attack (doubled at 50%+ CRIT Rate)',
    stat: ZzzStats.CRIT_DMG,
    toggle: { kind: 'switch', label: 'After their EX Special or Chain Attack' },
    value: (c) => (switchOn(c) && c.giver.specialty === 'Stun' ? (c.giverStats.critRate >= 50 ? 30 : 15) : 0),
    blockedBy: (c) => (c.giver.specialty !== 'Stun' ? 'Only when a Stun agent wears it' : undefined),
    nonStacking: 'king-of-the-summit',
    confidence: 'sourced',
  }],
  'yunkui-tales': [{
    id: 'yunkui-tales-sheer',
    label: 'Yunkui Tales 4-piece: Sheer DMG at 3 stacks',
    stat: 'sheerDmg',
    toggle: { kind: 'switch', label: '3 stacks' },
    value: (c) => (switchOn(c) ? 10 : 0),
    nonStacking: 'yunkui-tales',
    confidence: 'sourced',
  }],
  'bunny-in-wonderland': [{
    id: 'bunny-in-wonderland',
    label: 'Bunny in Wonderland 4-piece: DMG Bonus per Defense agent\'s EX Special or Assist (3 stacks)',
    stat: ZzzStats.ELEMENT_DMG,
    toggle: { kind: 'stacks', label: 'Stacks (max 3)', max: () => 3 },
    value: (c) => (c.giver.specialty === 'Defense' && typeof c.setting === 'number' ? 6 * c.setting : 0),
    blockedBy: (c) => (c.giver.specialty !== 'Defense' ? 'Only when a Defense agent wears it' : undefined),
    nonStacking: 'bunny-in-wonderland',
    confidence: 'sourced',
  }],
}

// What a teammate's W-Engine gives the squad, by W-Engine id, from genshin-optimizer's W-Engine sheets with the R1-R5
// values from its generated stats (libs/zzz/formula/src/data/wengine/sheets, libs/zzz/stats/src/allStat_gen.json).
// Only when the wearer is of the engine's specialty, like the game (GO's cmpSpecialtyAndEquipped); the refinement comes
// from their saved build. Two of the same engine don't stack
type EngineBuff = Omit<ZzzTeamBuff, 'value' | 'nonStacking' | 'confidence'> & {
  // R1-R5, times the stack count for stacks
  values: number[],
  // The wearer must be of this attribute (Chief Sidekick, Joyau Dore)
  giverElement?: string,
}

function engineBuffs(name: string, specialty: string, buffs: EngineBuff[]): ZzzTeamBuff[] {
  return buffs.map(({ values, giverElement, ...buff }) => ({
    ...buff,
    label: `${name}: ${buff.label}`,
    value: (c) => {
      if (c.giver.specialty !== specialty || (giverElement && c.giver.element !== giverElement) || c.setting === false) return 0
      const value = values[Math.min(5, Math.max(1, c.refinement)) - 1] ?? 0
      return buff.toggle?.kind === 'stacks' ? value * Number(c.setting) : value
    },
    blockedBy: (c) =>
      c.giver.specialty !== specialty
        ? `Only when a ${specialty} agent wears it`
        : giverElement && c.giver.element !== giverElement
        ? `Only when a ${giverElement} agent wears it`
        : undefined,
    nonStacking: `${name}:${buff.id}`,
    confidence: 'sourced',
  }))
}

const stacks = (label: string, max: number): ZzzBuffToggle => ({ kind: 'stacks', label: `${label} (max ${max})`, max: () => max })
const after = (label: string): ZzzBuffToggle => ({ kind: 'switch', label })

export const W_ENGINE_TEAM_BUFFS: Record<string, ZzzTeamBuff[]> = {
  '12005': engineBuffs('Reverb Mark II', 'Support', [
    {
      id: 'ap',
      label: 'Anomaly Proficiency after an EX Special or Chain Attack',
      stat: ZzzStats.ANOMALY_PROFICIENCY,
      toggle: after('After EX Special or Chain'),
      values: [10, 12, 13, 15, 16],
    },
  ]),
  '12006': engineBuffs('Reverb Mark III', 'Support', [
    { id: 'atk', label: 'ATK after a Chain Attack or Ultimate', stat: ZzzStats.ATK_P, toggle: after('After Chain or Ultimate'), values: [8, 9, 10, 11, 12] },
  ]),
  '13103': engineBuffs('The Vault', 'Support', [
    { id: 'dmg', label: 'DMG Bonus after an Ether hit', stat: ZzzStats.ELEMENT_DMG, toggle: after('After an Ether hit'), values: [15, 17.5, 20, 22, 24] },
  ]),
  '13113': engineBuffs('Bashful Demon', 'Support', [
    { id: 'atk', label: 'ATK per EX Special', stat: ZzzStats.ATK_P, toggle: stacks('EX Specials', 4), values: [2, 2.3, 2.6, 2.9, 3.2] },
  ]),
  '13115': engineBuffs('Kaboom the Cannon', 'Support', [
    { id: 'atk', label: 'ATK per squad hit', stat: ZzzStats.ATK_P, toggle: stacks('Stacks', 4), values: [2.5, 2.8, 3.2, 3.6, 4] },
  ]),
  '14107': engineBuffs('Tusks of Fury', 'Defense', [
    {
      id: 'dmg',
      label: 'DMG Bonus after an Interrupt or Perfect Dodge',
      stat: ZzzStats.ELEMENT_DMG,
      toggle: after('After Interrupt or Perfect Dodge'),
      values: [18, 22.5, 27, 31.5, 36],
    },
  ]),
  '14116': engineBuffs('Blazing Laurel', 'Stun', [
    {
      id: 'crit-dmg-ice',
      label: 'Ice CRIT DMG per Wilt stack',
      stat: ZzzStats.CRIT_DMG,
      element: 'Ice',
      toggle: stacks('Wilt', 20),
      values: [1.5, 1.72, 1.95, 2.17, 2.4],
    },
    {
      id: 'crit-dmg-fire',
      label: 'Fire CRIT DMG per Wilt stack',
      stat: ZzzStats.CRIT_DMG,
      element: 'Fire',
      toggle: stacks('Wilt', 20),
      values: [1.5, 1.72, 1.95, 2.17, 2.4],
    },
  ]),
  '14125': engineBuffs('Ice-Jade Teapot', 'Stun', [
    { id: 'dmg', label: 'DMG Bonus at 15+ Tea-riffic stacks', stat: ZzzStats.ELEMENT_DMG, toggle: after('15+ stacks'), values: [20, 23, 26, 29, 32] },
  ]),
  '14131': engineBuffs('Elegant Vanity', 'Support', [
    { id: 'dmg', label: 'DMG Bonus per 25 Energy spent', stat: ZzzStats.ELEMENT_DMG, toggle: stacks('Stacks', 2), values: [10, 11.5, 13, 14.5, 16] },
  ]),
  '14134': engineBuffs('Half-Sugar Bunny', 'Defense', [
    { id: 'atk', label: 'ATK', stat: ZzzStats.ATK_P, values: [10, 11.5, 13, 14.5, 16] },
    { id: 'hp', label: 'HP', stat: ZzzStats.HP_P, values: [10, 11.5, 13, 14.5, 16] },
    {
      id: 'crit-dmg',
      label: 'CRIT DMG after activating or extending the Ether Veil',
      stat: ZzzStats.CRIT_DMG,
      toggle: after('Ether Veil'),
      values: [30, 34.5, 39, 43.5, 48],
    },
  ]),
  '14139': engineBuffs('Roaring Furnace', 'Stun', [
    {
      id: 'fire-dmg',
      label: 'Fire DMG per Chain Attack or Ultimate',
      stat: ZzzStats.ELEMENT_DMG,
      element: 'Fire',
      toggle: stacks('Stacks', 2),
      values: [10, 11.5, 13, 14.5, 16],
    },
  ]),
  '14141': engineBuffs('Metanukimorphosis', 'Support', [
    {
      id: 'ap',
      label: 'Anomaly Proficiency after an Aftershock',
      stat: ZzzStats.ANOMALY_PROFICIENCY,
      toggle: after('After an Aftershock'),
      values: [60, 69, 78, 87, 96],
    },
  ]),
  '14145': engineBuffs('Dreamlit Hearth', 'Support', [
    { id: 'dmg', label: 'DMG Bonus in the Ether Veil', stat: ZzzStats.ELEMENT_DMG, toggle: after('Ether Veil'), values: [25, 28.8, 32.5, 36.3, 40] },
    { id: 'hp', label: 'HP in the Ether Veil', stat: ZzzStats.HP_P, toggle: after('Ether Veil'), values: [15, 17.3, 19.5, 21.8, 24] },
  ]),
  '14148': engineBuffs('Yesterday Calls', 'Stun', [
    { id: 'crit-dmg', label: 'CRIT DMG at 3 Physical EX Special stacks', stat: ZzzStats.CRIT_DMG, toggle: after('3 stacks'), values: [30, 34.5, 39, 43.5, 48] },
  ]),
  '14149': engineBuffs('Thoughtbop', 'Support', [
    { id: 'dmg', label: 'DMG Bonus per Physical EX Special', stat: ZzzStats.ELEMENT_DMG, toggle: stacks('Stacks', 2), values: [12.5, 14.3, 16.1, 17.9, 20] },
    { id: 'atk', label: 'ATK at 2 stacks', stat: ZzzStats.ATK_P, toggle: after('2 stacks'), values: [10, 11.5, 13, 14.5, 16] },
  ]),
  '14151': engineBuffs('Neon Fantasies', 'Stun', [
    {
      id: 'dmg',
      label: 'DMG Bonus per Ether EX Special or Basic Attack',
      stat: ZzzStats.ELEMENT_DMG,
      toggle: stacks('Stacks', 2),
      values: [15, 17, 19.5, 21, 24],
    },
  ]),
  '14156': engineBuffs('Joyau Dore', 'Anomaly', [
    {
      id: 'ap',
      label: 'Anomaly Proficiency at 2 Wind EX Special stacks',
      stat: ZzzStats.ANOMALY_PROFICIENCY,
      toggle: after('2 stacks'),
      values: [60, 69, 78, 87, 96],
      giverElement: 'Wind',
    },
  ]),
  '14157': engineBuffs('Chief Sidekick', 'Stun', [
    {
      id: 'dmg',
      label: 'DMG Bonus per Fire EX Special',
      stat: ZzzStats.ELEMENT_DMG,
      toggle: stacks('Stacks', 2),
      values: [12.5, 14.4, 16.3, 18.1, 20],
      giverElement: 'Fire',
    },
  ]),
  '14158': engineBuffs('Ode of Resurrected Wings', 'Anomaly', [
    { id: 'dmg', label: 'DMG Bonus after Refringe', stat: ZzzStats.ELEMENT_DMG, toggle: after('After Refringe'), values: [30, 34.5, 39, 43.5, 48] },
  ]),
  '14136': engineBuffs('Spectral Gaze', 'Stun', [
    {
      id: 'def-shred',
      label: 'enemy DEF shred after an Electric Aftershock',
      stat: 'defShred',
      toggle: after('After an Electric Aftershock'),
      values: [25, 28.75, 32.5, 36.25, 40],
    },
  ]),
  '14162': engineBuffs('Crimson Moon Casket', 'Stun', [
    {
      id: 'dmg',
      label: 'DMG Bonus after a Wind EX Special',
      stat: ZzzStats.ELEMENT_DMG,
      toggle: after('After a Wind EX Special'),
      values: [20, 23, 26, 29, 32],
    },
  ]),
}
