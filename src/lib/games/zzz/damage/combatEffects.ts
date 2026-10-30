import {
  addAnomalyBonuses,
  type AnomalyBonuses,
  type HitKind,
  type KindBonus,
} from 'lib/games/zzz/damage/damage'
import {
  SET_EFFECTS,
  W_ENGINE_EFFECTS,
} from 'lib/games/zzz/damage/gearEffects'
import type { StatEffect } from 'lib/games/zzz/data/dataTypes'
import {
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// What an agent's own kit does in combat, on top of the stat screen and the Core Skill stats in data/agents.ts: the
// buffs that make the rotation damage line up with the game, after genshin-optimizer's ZZZ character sheets
// (https://github.com/frzyc/genshin-optimizer, libs/zzz/formula/src/data/char/sheets and libs/zzz/stats, MIT).
// Values are at Core Skill F; Mindscape effects need the build's Mindscape. Each effect gives
//   - stats: stat bonuses for the stat calculator (ATK, CRIT Rate, Element DMG...)
//   - kinds: DMG Bonus for one kind of hit (Ultimate DMG, EX Special Attack DMG...)
//   - skills: DMG Bonus for one skill's hits only, by skill key (Miyabi's Shimotsuki)
//   - aftershockCritDmg / aftershockDefIgnore: CRIT DMG and DEF ignore for Aftershock hits only
//   - resIgnore / defIgnore: RES and DEF ignore for the whole rotation, in percent (added to the team's shred)
//   - sheerDmg / sharpDmg: Sheer or Sharp DMG Bonus, a multiplier of its own on Rupture or Armorer skill hits
//   - anomalies: bonuses to some anomalies only (Shock DMG, Disorder multiplier, Assault CRIT)
// Only the optimizer counts them, and only when ranking by rotation damage. Agents whose sheet in genshin-optimizer is
// still a placeholder (Aria, Velina, Nangong Yu, Norma, Pyrois, Remielle) have kits from the user's in-game screenshots.
// Personal, non-commercial use.

export type ZzzEffectToggle = { kind: 'switch', label: string } | { kind: 'stacks', label: string, max: number }

export type ZzzCombatContext = {
  mindscape: number,
  // true/false for a switch, the stack count for stacks
  setting: boolean | number,
  // The Enemy card's Stunned switch, for effects that only work on a stunned enemy
  enemyStunned: boolean,
}

export type ZzzCombatEffect = {
  id: string,
  label: string,
  toggle?: ZzzEffectToggle,
  // Mindscape it needs
  minMindscape?: number,
  stats?: (context: ZzzCombatContext) => Pick<StatEffect, 'stat' | 'value' | 'fromStat'>[],
  kinds?: (context: ZzzCombatContext) => KindBonus,
  skills?: (context: ZzzCombatContext) => Record<string, number>,
  // Sharp damage (Armorer agents): Laceration DMG in percent, and CRIT Rate per point of CRIT DMG
  laceration?: (context: ZzzCombatContext) => number,
  critRateFromCritDmg?: number,
  // Aftershock hits only: CRIT DMG as a fraction of the agent's CRIT DMG, and DEF ignore in percent
  aftershockCritDmg?: number,
  aftershockDefIgnore?: number,
  // Bonuses to some anomalies only (damage.ts AnomalyBonuses)
  anomalies?: (context: ZzzCombatContext) => AnomalyBonuses,
  resIgnore?: (context: ZzzCombatContext) => number,
  defIgnore?: (context: ZzzCombatContext) => number,
  // Points on the enemy's stun multiplier (Nangong Yu's Misstep), added to the team's
  stunBonus?: (context: ZzzCombatContext) => number,
  // DEF ignore for some kinds of hits only, in percent (damage.ts rotationSkills)
  kindDefIgnore?: (context: ZzzCombatContext) => Partial<Record<HitKind, number>>,
  // CRIT DMG for some kinds of hits only, in percent (damage.ts rotationSkills)
  kindCritDmg?: (context: ZzzCombatContext) => Partial<Record<HitKind, number>>,
  // Ether Veil vulnerability cap in percent (DamageSetup.veilVulnerabilityCap); the largest one counts
  veilVulnerabilityCap?: (context: ZzzCombatContext) => number,
  sheerDmg?: (context: ZzzCombatContext) => number,
  sharpDmg?: (context: ZzzCombatContext) => number,
  // Gear effects for agents of one specialty or attribute only
  specialty?: string,
  element?: string,
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

// By agent id
export const KIT_EFFECTS: Record<string, ZzzCombatEffect[]> = {
  // Miyabi
  '1091': [
    {
      id: 'miyabi-ult-ice',
      label: 'Ice DMG +30% after the Ultimate',
      toggle: { kind: 'switch', label: 'After the Ultimate' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 30 }],
      confidence: 'sourced',
    },
    {
      id: 'miyabi-ability',
      label: 'Additional Ability: Shimotsuki DMG +60% with 3 Support, Anomaly or Section 6 agents in the squad',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      skills: () => ({ BasicAttackShimotsuki: 60 }),
      confidence: 'sourced',
    },
    {
      id: 'miyabi-m2',
      label: 'Mindscape 2: Dodge Counter DMG +30% and CRIT Rate +15%',
      minMindscape: 2,
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 15 }],
      kinds: () => ({ dodgeCounter: 30 }),
      confidence: 'sourced',
    },
  ],
  // Ye Shunguang: the Core Skill CRIT Rate is in data/agents.ts already
  // GO's sheet was a placeholder until its 2.5 update (Oct 25, 2026); the rest is from that full sheet
  '1431': [
    {
      id: 'ye-core-dmg',
      label: 'Core Skill: DMG +25%',
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 25 }],
      confidence: 'sourced',
    },
    {
      id: 'ye-core-vulnerability',
      label: 'Core Skill: in the Ether Veil, hits count the enemy\'s stun multiplier even when it isn\'t stunned, up to 210% (310% at Mindscape 4)',
      toggle: { kind: 'switch', label: 'Ether Veil' },
      veilVulnerabilityCap: ({ mindscape }) => (mindscape >= 4 ? 200 : 110),
      confidence: 'sourced',
    },
    {
      id: 'ye-m1',
      label: 'Mindscape 1: DMG +10% and 20% of the enemy\'s DEF ignored',
      minMindscape: 1,
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 10 }],
      defIgnore: () => 20,
      confidence: 'sourced',
    },
    {
      id: 'ye-m2',
      label: 'Mindscape 2: EX Special Attack and Ultimate ignore 40% of the enemy\'s DEF',
      minMindscape: 2,
      kindDefIgnore: () => ({ exSpecial: 40, ult: 40 }),
      confidence: 'sourced',
    },
  ],
  // Yixuan: Meditation's CRIT DMG is in data/agents.ts already
  '1371': [
    {
      id: 'yixuan-core',
      label: 'Core Skill: EX Special Attack, Assist Follow-Up, Chain Attack and Ultimate DMG +60%',
      kinds: () => ({ exSpecial: 60, assistFollowUp: 60, chain: 60, ult: 60 }),
      confidence: 'sourced',
    },
    {
      id: 'yixuan-m1',
      label: 'Mindscape 1: CRIT Rate +10%',
      minMindscape: 1,
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 10 }],
      confidence: 'sourced',
    },
  ],
  // Soldier 0 - Anby: Voltage Surge's CRIT Rate is in data/agents.ts already
  '1381': [
    {
      id: 'anby0-core',
      label: 'Core Skill: DMG +25% against enemies Marked with Silver Star',
      toggle: { kind: 'switch', label: 'Marked with Silver Star' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 25 }],
      confidence: 'sourced',
    },
    {
      id: 'anby0-m2',
      label: 'Mindscape 2: CRIT Rate +12% against marked enemies',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Marked with Silver Star' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 12 }],
      confidence: 'sourced',
    },
    {
      id: 'anby0-core-aftershock-crit',
      label: 'Core Skill: Aftershock CRIT DMG +35% of her CRIT DMG against marked enemies',
      toggle: { kind: 'switch', label: 'Marked with Silver Star' },
      aftershockCritDmg: 0.35,
      confidence: 'sourced',
    },
    {
      id: 'anby0-ability-aftershock',
      label: 'Additional Ability: Aftershock DMG +25% against marked enemies, with a Stun or Support agent in the squad',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      kinds: () => ({ aftershock: 25 }),
      confidence: 'sourced',
    },
    {
      id: 'anby0-m4-res-ignore',
      label: 'Mindscape 4: ignores 12% of the enemy\'s Electric RES',
      minMindscape: 4,
      resIgnore: () => 12,
      confidence: 'sourced',
    },
  ],
  // Orphie & Magus
  '1301': [
    {
      id: 'orphie-core-crit',
      label: 'Core Skill: CRIT Rate +25%',
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 25 }],
      confidence: 'sourced',
    },
    {
      id: 'orphie-zeroed-in',
      label: 'Core Skill: Zeroed In: ATK +280 for the squad, +20 per 0.1 Energy Regen above 1.6, at most 700',
      toggle: { kind: 'switch', label: 'Zeroed In' },
      stats: () => [{ stat: ZzzStats.ATK, value: 280, fromStat: { stat: 'energyRegen', above: 1.6, per: 200, max: 700 } }],
      confidence: 'sourced',
    },
    {
      id: 'orphie-core-aftershock',
      label: 'Core Skill: Aftershock DMG +85%',
      kinds: () => ({ aftershock: 85 }),
      confidence: 'sourced',
    },
    {
      id: 'orphie-ability-def-ignore',
      label: 'Additional Ability: Aftershock ignores 25% of the enemy\'s DEF while Zeroed In',
      toggle: { kind: 'switch', label: 'Zeroed In' },
      aftershockDefIgnore: 25,
      confidence: 'sourced',
    },
    {
      id: 'orphie-m1-res-ignore',
      label: 'Mindscape 1: ignores 15% of the enemy\'s Fire RES',
      minMindscape: 1,
      resIgnore: () => 15,
      confidence: 'sourced',
    },
  ],
  // Pulchra
  '1351': [{
    id: 'pulchra-ability-aftershock',
    label: 'Additional Ability: Aftershock DMG +30% while the enemy is in her Binding Trap',
    toggle: { kind: 'switch', label: 'Binding Trap' },
    kinds: () => ({ aftershock: 30 }),
    confidence: 'sourced',
  }],
  // Jane: Gnawed's Assault CRIT (Core Skill), Mindscape 2's Assault CRIT DMG
  '1261': [
    {
      id: 'jane-core-assault-crit',
      label: 'Core Skill: Assault can CRIT against Gnawed enemies: CRIT Rate 40% + 0.16% per Anomaly Proficiency, CRIT DMG 50%',
      toggle: { kind: 'switch', label: 'Gnawed' },
      anomalies: () => ({ assault: { critRate: 40, critRatePerAp: 0.16, critDmg: 50 } }),
      confidence: 'sourced',
    },
    {
      id: 'jane-m2-assault-crit-dmg',
      label: 'Mindscape 2: Assault CRIT DMG +50%',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Gnawed' },
      anomalies: () => ({ assault: { critDmg: 50 } }),
      confidence: 'sourced',
    },
    {
      id: 'jane-m2-def-ignore',
      label: 'Mindscape 2: ignores 15% of the enemy\'s DEF',
      minMindscape: 2,
      defIgnore: () => 15,
      confidence: 'sourced',
    },
  ],
  // Alice
  '1401': [
    {
      id: 'alice-core-disorder',
      label: 'Core Skill: Physical Disorder multiplier +18% per second the Assault had left',
      anomalies: () => ({ disorder: { addPerSecondLeft: 18 } }),
      confidence: 'sourced',
    },
    {
      id: 'alice-m4-res-ignore',
      label: 'Mindscape 4: ignores 10% of the enemy\'s Physical RES',
      minMindscape: 4,
      resIgnore: () => 10,
      confidence: 'sourced',
    },
  ],
  // Grace
  '1181': [{
    id: 'grace-ability-shock',
    label: 'Additional Ability: Shock DMG +18% per EX Special Attack hit (2 stacks), with Electric, Belobog or Anomaly agents in the squad',
    toggle: { kind: 'stacks', label: 'EX Special hits', max: 2 },
    anomalies: ({ setting }) => ({ shock: { dmg: 18 * Number(setting) } }),
    confidence: 'sourced',
  }],
  // Vivian
  '1331': [
    {
      id: 'vivian-ability-corruption',
      label: 'Additional Ability: Corruption and Ether Disorder DMG +12% (a multiplier of its own)',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      anomalies: () => ({ corruption: { buff: 12 }, disorder: { buff: 12 } }),
      confidence: 'sourced',
    },
    {
      id: 'vivian-m1-anomaly',
      label: 'Mindscape 1: Anomaly and Disorder DMG +16% with Prophecy',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Prophecy' },
      anomalies: () => ({ anomaly: { buff: 16 }, disorder: { buff: 16 } }),
      confidence: 'sourced',
    },
  ],
  // Yanagi
  '1221': [
    {
      id: 'yanagi-core-disorder',
      label: 'Core Skill: Disorder multiplier +250% after an EX Special Attack',
      toggle: { kind: 'switch', label: 'After an EX Special' },
      anomalies: () => ({ disorder: { add: 250 } }),
      confidence: 'sourced',
    },
    {
      id: 'yanagi-core-electric',
      label: 'Core Skill: Electric DMG +20% after an EX Special Attack',
      toggle: { kind: 'switch', label: 'After an EX Special' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 20 }],
      confidence: 'sourced',
    },
  ],
  // Aria: in-game text at Core Skill level 7 (the user's screenshot, Oct 30 2026); GO's sheet is a placeholder. Her
  // Abloom lines are in damage.ts (ariaAbloomPerAm)
  '1501': [
    {
      id: 'aria-core-ap',
      label: 'Core Skill: Anomaly Proficiency +90',
      stats: () => [{ stat: ZzzStats.ANOMALY_PROFICIENCY, value: 90 }],
      confidence: 'confirmed',
    },
    {
      id: 'aria-core-abloom-stunned',
      label: 'Core Skill: Abloom +50% (a multiplier of its own) when the enemy is stunned (the Enemy card\'s Stunned switch)',
      anomalies: ({ enemyStunned }) => (enemyStunned ? { abloom: { buff: 50 } } : {}),
      confidence: 'confirmed',
    },
    {
      id: 'aria-ability-corruption',
      label: 'Additional Ability: Corruption lasts 3s longer (6 more ticks of 62.5%), with a Stun, Support or Anomaly agent or her faction in the squad',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      anomalies: () => ({ corruption: { add: 6 * 62.5 } }),
      confidence: 'confirmed',
    },
  ],
  // Velina: in-game text at Core Skill level 7 (the user's screenshots, Oct 30 2026); GO's sheet is a placeholder. Her
  // Abloom lines are in damage.ts (VELINA_ABLOOM), her cyclones' own hits in the skill data
  '1561': [
    {
      id: 'velina-core-energy',
      label: 'Core Skill: DMG +0.21% and Anomaly Mastery +0.5 per 0.01 Energy Regen above 1.2 (up to 35% and 84)',
      stats: () => [
        { stat: ZzzStats.ELEMENT_DMG, value: 0, fromStat: { stat: 'energyRegen', above: 1.2, per: 21, max: 35 } },
        { stat: ZzzStats.ANOMALY_MASTERY_FLAT, value: 0, fromStat: { stat: 'energyRegen', above: 1.2, per: 50, max: 84 } },
      ],
      confidence: 'confirmed',
    },
    {
      id: 'velina-core-windbite',
      label:
        'Core Skill: every third Vortex spends 2 Windbite for +150% Vortex multiplier (counted as +50% on each Vortex), and summons a Sweeping Cyclone instead of a Condensed one',
      toggle: { kind: 'switch', label: 'Windbite' },
      anomalies: () => ({ vortex: { add: 50 } }),
      confidence: 'confirmed',
    },
    {
      id: 'velina-ability',
      label: 'Additional Ability: Windswept and Vortex DMG +10%, and her Ultimate\'s Abloom, with an Anomaly or Wind agent in the squad',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      anomalies: () => ({ wind: { dmg: 10 }, vortex: { dmg: 10 } }),
      confidence: 'confirmed',
    },
  ],
  // Nangong Yu: in-game text at Core Skill level 7 (the user's screenshots, Oct 30 2026); GO's sheet is a placeholder.
  // Her Vibrato Abloom and Polarity Disorder lines are in damage.ts; what she gives the squad is in team/buffs.ts too
  '1511': [
    {
      id: 'nangong-core-ap',
      label: 'Core Skill: Anomaly Proficiency +120',
      stats: () => [{ stat: ZzzStats.ANOMALY_PROFICIENCY, value: 120 }],
      confidence: 'confirmed',
    },
    {
      id: 'nangong-core-squad-dmg',
      label: 'Core Skill: squad DMG +25% for 30s after her Basic Attack: Adorable Explosive Impact or EX Special hits',
      toggle: { kind: 'switch', label: 'After her Basic or EX Special' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 25 }],
      confidence: 'confirmed',
    },
    {
      id: 'nangong-core-vibrato',
      label: 'Core Skill: Vibrato Abloom ratio +25% per Vibrato stack on the enemy when it clears (a multiplier of its own)',
      toggle: { kind: 'stacks', label: 'Vibrato stacks', max: 4 },
      anomalies: ({ setting }) => ({ abloom: { buff: 25 * Number(setting) } }),
      confidence: 'confirmed',
    },
    {
      id: 'nangong-misstep',
      label: 'Additional Ability: Misstep, the enemy\'s stun multiplier +30% (after her Basic Attack\'s third hit or Ultimate)',
      toggle: { kind: 'switch', label: 'Misstep' },
      stunBonus: () => 30,
      confidence: 'confirmed',
    },
  ],
  // Norma: in-game text at Core Skill level 7 (the user's screenshots, Oct 30 2026); GO's sheet is a placeholder. Not
  // counted: her ATK from Sheer Force (she's a Stun agent, our stats give her none), Daze and Preheated Chamber
  '1571': [
    {
      id: 'norma-core-crit-dmg',
      label: 'Core Skill: CRIT DMG +1.7% per 1% CRIT Rate above 50% (up to 85%)',
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 0, fromStat: { stat: 'critRate', above: 50, per: 1.7, max: 85 } }],
      confidence: 'confirmed',
    },
    {
      id: 'norma-ability-tech-divide',
      label: 'Additional Ability: Tech Divide, the enemy\'s stun multiplier +3% per stack (up to 10)',
      toggle: { kind: 'stacks', label: 'Tech Divide stacks', max: 10 },
      stunBonus: ({ setting }) => 3 * Number(setting),
      confidence: 'confirmed',
    },
    {
      id: 'norma-ability-barrage',
      label: 'Additional Ability: during En-Nah Barrage, ATK +870 (at level 60) and squad DMG +20%',
      toggle: { kind: 'switch', label: 'En-Nah Barrage' },
      stats: () => [{ stat: ZzzStats.ATK, value: 870 }, { stat: ZzzStats.ELEMENT_DMG, value: 20 }],
      confidence: 'confirmed',
    },
  ],
  // Pyrois: in-game text at Core Skill level 7 and Mindscapes 1-4 (the user's screenshots, Oct 30 2026); GO's sheet is
  // a placeholder, its skill multipliers are used. Her Contaminated and Totalize hits are rotation lines (damage.ts
  // EXTRA_SKILLS). Not counted: Solar Prominence, Decibels, Energy, shields, Daze, Mindscape 3's skill levels (set the
  // Rotation card's skill level)
  '1551': [
    {
      id: 'pyrois-core-mirage',
      label: 'Core Skill: Mirage (after Total Annihilation), Ultimate CRIT DMG +40% against a stunned enemy (the Enemy card\'s Stunned switch)',
      toggle: { kind: 'switch', label: 'Mirage' },
      kindCritDmg: ({ enemyStunned }) => (enemyStunned ? { ult: 40 } : {}),
      confidence: 'confirmed',
    },
    {
      id: 'pyrois-core-sunflare',
      label: 'Core Skill: Sunflare (after Triumphant Return), DMG +40%',
      toggle: { kind: 'switch', label: 'Sunflare' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 40 }],
      confidence: 'confirmed',
    },
    {
      id: 'pyrois-ability-crit-dmg',
      label: 'Additional Ability: CRIT DMG +40% with a Stun or Support agent in the squad',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 40 }],
      confidence: 'confirmed',
    },
    {
      id: 'pyrois-m1-crit-rate',
      label: 'Mindscape 1: CRIT Rate +8%',
      minMindscape: 1,
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 8 }],
      confidence: 'confirmed',
    },
  ],
  // Remielle: in-game text at Core Skill level 7 (the user's screenshots, Oct 30 2026); GO's sheet is a placeholder. Her
  // Refringe strengthens teammates' anomalies (team/buffs.ts); her own Luminize damage depends on their stored anomalies'
  // strength, which isn't modelled
  '1581': [{
    id: 'remielle-squad-atk',
    label: 'Additional Ability: ATK +6% / 12% / 40% of her initial ATK with 1 / 2 / 3 Anomaly agents in the squad (up to 1,600)',
    toggle: { kind: 'stacks', label: 'Anomaly agents in the squad', max: 3 },
    stats: ({ setting }) => [{
      stat: ZzzStats.ATK,
      value: 0,
      fromStat: { stat: 'atk', above: 0, per: [0, 0.06, 0.12, 0.4][Math.min(3, Number(setting))] ?? 0, max: 1600 },
    }],
    confidence: 'confirmed',
  }],
  // Claret
  '1611': [
    {
      id: 'claret-core-crit-from-crit-dmg',
      label: 'Core Skill: CRIT Rate +0.35% per 1% CRIT DMG (her Sharp damage uses CRIT Rate and Laceration, not CRIT DMG)',
      critRateFromCritDmg: 0.35,
      confidence: 'sourced',
    },
    {
      id: 'claret-ability-laceration',
      label: 'Additional Ability: Laceration DMG +25% with Remnant Edge, with 3 Stun, Armorer or Electric agents in the squad',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      laceration: () => 25,
      confidence: 'sourced',
    },
    {
      id: 'claret-core-crit',
      label: 'Core Skill: CRIT Rate +30% with Crimson Inscription',
      toggle: { kind: 'switch', label: 'Crimson Inscription' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 30 }],
      confidence: 'sourced',
    },
    {
      id: 'claret-core-basic',
      label: 'Core Skill: Basic Attack DMG +15% after a Perfect Dodge',
      toggle: { kind: 'switch', label: 'After a Perfect Dodge' },
      kinds: () => ({ basic: 15 }),
      confidence: 'sourced',
    },
  ],
  // Rina
  '1211': [{
    id: 'rina-m2',
    label: 'Mindscape 2: DMG +15% while Rina is the active agent',
    minMindscape: 2,
    toggle: { kind: 'switch', label: 'Rina on field' },
    stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 15 }],
    confidence: 'sourced',
  }],
}

export type ZzzAppliedEffect = { effect: ZzzCombatEffect, setting: boolean | number, counted: boolean, reason?: string }

export type ZzzResolvedCombat = {
  applied: ZzzAppliedEffect[],
  // Stat bonuses as effects for computeStats (ComputeInput.teamEffects)
  statEffects: StatEffect[],
  kindBonus: KindBonus,
  skillBonus: Record<string, number>,
  // Sharp damage: extra Laceration DMG and CRIT Rate per point of CRIT DMG
  lacerationBonus: number,
  critRateFromCritDmg: number,
  // Aftershock hits only: CRIT DMG as a fraction of CRIT DMG, DEF ignore in percent
  aftershockCritDmg: number,
  aftershockDefIgnore: number,
  anomalyBonus: AnomalyBonuses,
  // RES and DEF ignore for every hit, Sheer and Sharp DMG Bonus, in percent
  resIgnore: number,
  defIgnore: number,
  stunBonus: number,
  kindDefIgnore: Partial<Record<HitKind, number>>,
  kindCritDmg: Partial<Record<HitKind, number>>,
  veilVulnerabilityCap: number,
  sheerDmg: number,
  sharpDmg: number,
}

export function defaultEffectSetting(effect: ZzzCombatEffect): boolean | number {
  return effect.toggle?.kind === 'stacks' ? effect.toggle.max : true
}

// The gear the rotation is worked out with: the W-Engine picked for the search and the sets the set filter picks
// (damage/gearEffects.ts)
export type ZzzCombatGear = {
  wEngineId?: string,
  refinement: number,
  // Set ids with the pieces counted (4 for the 4-piece filter, 2 for the 2-piece one)
  sets: { setId: string, pieces: 2 | 4 }[],
  // The agent's, for effects that need a specialty or attribute
  specialty: string,
  element: string,
}

// Each source's effects, with the prefix that keeps their settings apart
function effectSources(agentId: string, gear: ZzzCombatGear | undefined): { effect: ZzzCombatEffect, source: string }[] {
  const kit = (KIT_EFFECTS[agentId] ?? []).map((effect) => ({ effect, source: 'Kit' }))
  if (!gear) return kit
  const engine = gear.wEngineId ? (W_ENGINE_EFFECTS[gear.wEngineId]?.(gear.refinement) ?? []) : []
  const sets = gear.sets.flatMap(({ setId, pieces }) => (SET_EFFECTS[setId] ?? []).filter((entry) => entry.pieces <= pieces).flatMap((entry) => entry.effects))
  return [
    ...kit,
    ...engine.map((effect) => ({ effect, source: 'W-Engine' })),
    ...sets.map((effect) => ({ effect, source: 'Disc set' })),
  ]
}

export function resolveZzzCombat(
  agentId: string,
  mindscape: number,
  settings: Record<string, boolean | number>,
  gear?: ZzzCombatGear,
  enemyStunned = false,
): ZzzResolvedCombat {
  const resolved: ZzzResolvedCombat = {
    applied: [],
    statEffects: [],
    kindBonus: {},
    skillBonus: {},
    lacerationBonus: 0,
    critRateFromCritDmg: 0,
    aftershockCritDmg: 0,
    aftershockDefIgnore: 0,
    anomalyBonus: {},
    resIgnore: 0,
    defIgnore: 0,
    stunBonus: 0,
    kindDefIgnore: {},
    kindCritDmg: {},
    veilVulnerabilityCap: 0,
    sheerDmg: 0,
    sharpDmg: 0,
  }
  for (const { effect, source } of effectSources(agentId, gear)) {
    const setting = settings[effect.id] ?? defaultEffectSetting(effect)
    if ((effect.minMindscape ?? 0) > mindscape) {
      resolved.applied.push({ effect, setting, counted: false, reason: `Needs Mindscape ${effect.minMindscape}` })
      continue
    }
    if (effect.specialty && gear && effect.specialty !== gear.specialty) {
      resolved.applied.push({ effect, setting, counted: false, reason: `Only for ${effect.specialty} agents` })
      continue
    }
    if (effect.element && gear && effect.element !== gear.element) {
      resolved.applied.push({ effect, setting, counted: false, reason: `Only for ${effect.element} agents` })
      continue
    }
    const counted = setting !== false && setting !== 0
    resolved.applied.push({ effect, setting, counted, reason: counted ? undefined : 'Turned off' })
    if (!counted) continue
    const context = { mindscape, setting, enemyStunned }
    for (const { stat, value, fromStat } of effect.stats?.(context) ?? []) {
      resolved.statEffects.push({ stat, value, ...(fromStat ? { fromStat } : {}), source: `${source}: ${effect.label}`, confidence: effect.confidence })
    }
    for (const [kind, value] of Object.entries(effect.kinds?.(context) ?? {}) as [keyof KindBonus, number][]) {
      resolved.kindBonus[kind] = (resolved.kindBonus[kind] ?? 0) + value
    }
    resolved.lacerationBonus += effect.laceration?.(context) ?? 0
    resolved.critRateFromCritDmg += effect.critRateFromCritDmg ?? 0
    resolved.aftershockCritDmg += effect.aftershockCritDmg ?? 0
    resolved.aftershockDefIgnore += effect.aftershockDefIgnore ?? 0
    addAnomalyBonuses(resolved.anomalyBonus, effect.anomalies?.(context) ?? {})
    resolved.resIgnore += effect.resIgnore?.(context) ?? 0
    resolved.defIgnore += effect.defIgnore?.(context) ?? 0
    resolved.stunBonus += effect.stunBonus?.(context) ?? 0
    for (const [kind, value] of Object.entries(effect.kindDefIgnore?.(context) ?? {}) as [HitKind, number][]) {
      resolved.kindDefIgnore[kind] = (resolved.kindDefIgnore[kind] ?? 0) + value
    }
    for (const [kind, value] of Object.entries(effect.kindCritDmg?.(context) ?? {}) as [HitKind, number][]) {
      resolved.kindCritDmg[kind] = (resolved.kindCritDmg[kind] ?? 0) + value
    }
    resolved.veilVulnerabilityCap = Math.max(resolved.veilVulnerabilityCap, effect.veilVulnerabilityCap?.(context) ?? 0)
    resolved.sheerDmg += effect.sheerDmg?.(context) ?? 0
    resolved.sharpDmg += effect.sharpDmg?.(context) ?? 0
    for (const [skill, value] of Object.entries(effect.skills?.(context) ?? {})) {
      resolved.skillBonus[skill] = (resolved.skillBonus[skill] ?? 0) + value
    }
  }
  return resolved
}
