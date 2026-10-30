import {
  addAnomalyBonuses,
  type AnomalyBonuses,
  type HitScoped,
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
  kindDefIgnore?: (context: ZzzCombatContext) => HitScoped,
  // CRIT DMG and CRIT Rate for some hits only (by kind, skill key or hit key), in percent (damage.ts rotationSkills)
  kindCritDmg?: (context: ZzzCombatContext) => HitScoped,
  kindCritRate?: (context: ZzzCombatContext) => HitScoped,
  // The enemy takes more DMG, in percent (added to the team's)
  dmgTaken?: (context: ZzzCombatContext) => number,
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
      kindCritDmg: ({ enemyStunned }) => ({ ult: enemyStunned ? 40 : 0 }),
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
  // From here to Claret: genshin-optimizer's ZZZ sheets (MIT, Oct 26 2026), Core Skill F, read by hand. Not counted:
  // Daze, Anomaly Buildup, Energy, shields, flat additional DMG, multiplier increases (Hugo's Totalize, Evelyn's Chain
  // Attacks), RES ignore for some hits only, and stacks GO counts per hit
  // Anby
  '1011': [
    {
      id: 'anby-m2-basic',
      label: 'Mindscape 2: Basic Attack DMG +30% against a stunned enemy (the Enemy card\'s Stunned switch)',
      minMindscape: 2,
      kinds: ({ enemyStunned }) => ({ basic: enemyStunned ? 30 : 0 }),
      confidence: 'sourced',
    },
    {
      id: 'anby-m6-charge',
      label: 'Mindscape 6: Basic Attack and EX Special DMG +45% after spending a charge',
      minMindscape: 6,
      toggle: { kind: 'switch', label: 'Charge spent' },
      kinds: () => ({ basic: 45, exSpecial: 45 }),
      confidence: 'sourced',
    },
  ],
  // Anton
  '1111': [
    {
      id: 'anton-core-piledriver',
      label: 'Core Skill: Piledriver hits DMG +24%',
      skills: () =>
        Object.fromEntries(
          [
            'BasicAttackEnthusiasticDrills:3',
            'BasicAttackEnthusiasticDrillsBurstMode:2',
            'SpecialAttackSpinBro:0',
            'EXSpecialAttackSmashTheHorizonBro:0',
            'SpecialAttackExplosiveDrillBurstMode:0',
            'ChainAttackGoGoGo:0',
            'UltimateGoGoGoGoGo:0',
          ].map((key) => [key, 24]),
        ),
      confidence: 'sourced',
    },
    {
      id: 'anton-core-drill',
      label: 'Core Skill: Drill hits DMG +40%',
      skills: () =>
        Object.fromEntries(
          [
            'BasicAttackEnthusiasticDrillsBurstMode:1',
            'DodgeCounterOverloadDrillBurstMode:0',
            'QuickAssistProtectiveDrillBurstMode:0',
            'AssistFollowUpLimitBurst:0',
          ].map((key) => [key, 40]),
        ),
      confidence: 'sourced',
    },
    {
      id: 'anton-ability-shock',
      label: 'Additional Ability: Shock +45% (a multiplier of its own) in Burst Mode, with 3 Electric or Belobog agents in the squad',
      toggle: { kind: 'switch', label: 'Burst Mode, squad qualifies' },
      anomalies: () => ({ shock: { buff: 45 } }),
      confidence: 'sourced',
    },
    {
      id: 'anton-m4-crit',
      label: 'Mindscape 4: CRIT Rate +10% for the squad after a Chain Attack or Ultimate',
      minMindscape: 4,
      toggle: { kind: 'switch', label: 'After a Chain Attack or Ultimate' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 10 }],
      confidence: 'sourced',
    },
    {
      id: 'anton-m6-drill',
      label: 'Mindscape 6: Burst Mode drill hits DMG +4% per Piledriver CRIT (up to 6)',
      minMindscape: 6,
      toggle: { kind: 'stacks', label: 'Piledriver CRITs', max: 6 },
      skills: ({ setting }) =>
        Object.fromEntries(
          [
            'BasicAttackEnthusiasticDrillsBurstMode:0',
            'BasicAttackEnthusiasticDrillsBurstMode:1',
            'BasicAttackEnthusiasticDrillsBurstMode:2',
            'DodgeCounterOverloadDrillBurstMode:0',
          ]
            .map((key) => [key, 4 * Number(setting)]),
        ),
      confidence: 'sourced',
    },
  ],
  // Astra Yao: Idyllic Cadenza counts for her too (her squad gets it from team/buffs.ts)
  '1311': [{
    id: 'astra-idyllic-cadenza',
    label: 'Idyllic Cadenza: DMG +20%, CRIT DMG +25% (skill level 12) and ATK +35% of her initial ATK (up to 1,200)',
    toggle: { kind: 'switch', label: 'Idyllic Cadenza' },
    stats: () => [
      { stat: ZzzStats.ELEMENT_DMG, value: 20 },
      { stat: ZzzStats.CRIT_DMG, value: 25 },
      { stat: ZzzStats.ATK, value: 0, fromStat: { stat: 'atk', above: 0, per: 0.35, max: 1200 } },
    ],
    confidence: 'sourced',
  }],
  // Banyue (her Sheer Force from HP is in data/enkaGameData.ts)
  '1471': [
    {
      id: 'banyue-core',
      label: 'Core Skill: Fire DMG +36% and CRIT DMG +36% after her EX Special follow-up (her +300 Sheer Force isn\'t counted)',
      toggle: { kind: 'switch', label: 'After the EX Special follow-up' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 36 }, { stat: ZzzStats.CRIT_DMG, value: 36 }],
      confidence: 'sourced',
    },
    {
      id: 'banyue-ability',
      label: 'Additional Ability: Fire DMG +5% per Vidyaraja stack (up to 3), with a Support or Stun agent in the squad',
      toggle: { kind: 'stacks', label: 'Vidyaraja stacks', max: 3 },
      stats: ({ setting, mindscape }) => [{ stat: ZzzStats.ELEMENT_DMG, value: (mindscape >= 6 ? 13 : 5) * Number(setting) }],
      confidence: 'sourced',
    },
    {
      id: 'banyue-m1-res',
      label: 'Mindscape 1: the enemy\'s Fire RES -10% (Tremor)',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Tremor' },
      resIgnore: () => 10,
      confidence: 'sourced',
    },
    {
      id: 'banyue-m2',
      label: 'Mindscape 2: CRIT DMG +15% and Fire DMG +15% after her EX Special follow-up',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'After the EX Special follow-up' },
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 15 }, { stat: ZzzStats.ELEMENT_DMG, value: 15 }],
      confidence: 'sourced',
    },
    {
      id: 'banyue-m4',
      label: 'Mindscape 4: Basic Attack and EX Special DMG +30%',
      minMindscape: 4,
      kinds: () => ({ basic: 30, exSpecial: 30 }),
      confidence: 'sourced',
    },
  ],
  // Ben
  '1121': [
    {
      id: 'ben-core-atk',
      label: 'Core Skill: ATK +80% of his DEF',
      stats: () => [{ stat: ZzzStats.ATK, value: 0, fromStat: { stat: 'def', above: 0, per: 0.8, max: Number.POSITIVE_INFINITY } }],
      confidence: 'sourced',
    },
    {
      id: 'ben-ability-crit',
      label: 'Additional Ability: CRIT Rate +16% for the squad while shielded, with 3 Fire or Belobog agents in the squad',
      toggle: { kind: 'switch', label: 'Shielded, squad qualifies' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 16 }],
      confidence: 'sourced',
    },
    {
      id: 'ben-m4',
      label: 'Mindscape 4: his counter hits DMG +30% after blocking',
      minMindscape: 4,
      toggle: { kind: 'switch', label: 'Blocked an attack' },
      skills: () => ({ 'SpecialAttackFiscalFist:1': 30, 'EXSpecialAttackCashflowCounter:2': 30 }),
      confidence: 'sourced',
    },
  ],
  // Billy
  '1081': [
    {
      id: 'billy-core',
      label: 'Core Skill: Full Firepower\'s last two hits DMG +50%',
      skills: () => ({ 'BasicAttackFullFirepower:2': 50, 'BasicAttackFullFirepower:3': 50 }),
      confidence: 'sourced',
    },
    {
      id: 'billy-ability',
      label: 'Additional Ability: Ultimate DMG +50% per stack (up to 2), with 3 Physical or Cunning Hares agents in the squad',
      toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
      kinds: ({ setting }) => ({ ult: 50 * Number(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'billy-m2',
      label: 'Mindscape 2: Dodge Counter DMG +25%',
      minMindscape: 2,
      kinds: () => ({ dodgeCounter: 25 }),
      confidence: 'sourced',
    },
    {
      id: 'billy-m6',
      label: 'Mindscape 6: DMG +6% per stack (up to 5)',
      minMindscape: 6,
      toggle: { kind: 'stacks', label: 'Stacks', max: 5 },
      stats: ({ setting }) => [{ stat: ZzzStats.ELEMENT_DMG, value: 6 * Number(setting) }],
      confidence: 'sourced',
    },
  ],
  // Burnice
  '1171': [{
    id: 'burnice-m4',
    label: 'Mindscape 4: EX Special and Assist CRIT Rate +30%',
    minMindscape: 4,
    kindCritRate: () => ({ exSpecial: 30, quickAssist: 30, assist: 30, assistFollowUp: 30 }),
    confidence: 'sourced',
  }],
  // Caesar (her squad gets the ATK and DMG taken from team/buffs.ts)
  '1071': [
    {
      id: 'caesar-core-atk',
      label: 'Core Skill: Radiant Aegis, ATK +1,000 (+1,500 at Mindscape 2)',
      toggle: { kind: 'switch', label: 'Radiant Aegis' },
      stats: ({ mindscape }) => [{ stat: ZzzStats.ATK, value: mindscape >= 2 ? 1500 : 1000 }],
      confidence: 'sourced',
    },
    {
      id: 'caesar-ability',
      label: 'Additional Ability: the enemy takes 25% more DMG (Debuff), with a Defensive Assist or Sons of Calydon member',
      toggle: { kind: 'switch', label: 'Debuff, squad qualifies' },
      dmgTaken: () => 25,
      confidence: 'sourced',
    },
    {
      id: 'caesar-m1',
      label: 'Mindscape 1: the enemy\'s RES -15% during Radiant Aegis',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Radiant Aegis' },
      resIgnore: () => 15,
      confidence: 'sourced',
    },
    {
      id: 'caesar-m6',
      label: 'Mindscape 6: Shield Bash and Aiding Blade DMG +50%; CRIT Rate +30% and CRIT DMG +60% after them',
      minMindscape: 6,
      toggle: { kind: 'switch', label: 'After Shield Bash or Aiding Blade' },
      skills: () => ({ 'EXSpecialAttackOverpoweredShieldBash:0': 50, 'AssistFollowUpAidingBlade:0': 50 }),
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 30 }, { stat: ZzzStats.CRIT_DMG, value: 60 }],
      confidence: 'sourced',
    },
  ],
  // Corin
  '1061': [
    {
      id: 'corin-core',
      label: 'Core Skill: extended hits DMG +37.5%',
      skills: () =>
        Object.fromEntries(
          [
            'BasicAttackWipeout:2',
            'BasicAttackWipeout:4',
            'DashAttackOopsyDaisy:0',
            'DodgeCounterNope:1',
            'SpecialAttackCleanSweep:1',
            'EXSpecialAttackSkirtAlert:1',
            'ChainAttackSorry:0',
            'UltimateVeryVerySorry:0',
            'QuickAssistEmergencyMeasures:1',
            'AssistFollowUpQuickSweep:0',
          ].map((key) => [key, 37.5]),
        ),
      confidence: 'sourced',
    },
    {
      id: 'corin-ability',
      label: 'Additional Ability: DMG +35% against a stunned enemy, with 3 Physical or Victoria Housekeeping agents in the squad',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      stats: ({ enemyStunned }) => [{ stat: ZzzStats.ELEMENT_DMG, value: enemyStunned ? 35 : 0 }],
      confidence: 'sourced',
    },
    {
      id: 'corin-m1',
      label: 'Mindscape 1: DMG +12% after her Chain Attack or Ultimate hits',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'After a Chain Attack or Ultimate' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 12 }],
      confidence: 'sourced',
    },
  ],
  // Dialyn
  '1481': [
    {
      id: 'dialyn-core-stun',
      label: 'Core Skill: Malicious Complaint, the enemy\'s stun multiplier +30% (+50% at Mindscape 2)',
      toggle: { kind: 'switch', label: 'Malicious Complaint' },
      stunBonus: ({ mindscape }) => (mindscape >= 2 ? 50 : 30),
      confidence: 'sourced',
    },
    {
      id: 'dialyn-ability',
      label: 'Additional Ability: CRIT DMG +50%, and squad DMG +40% with Overwhelmingly Positive',
      toggle: { kind: 'switch', label: 'Squad qualifies, Overwhelmingly Positive' },
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 50 }, { stat: ZzzStats.ELEMENT_DMG, value: 40 }],
      confidence: 'sourced',
    },
    {
      id: 'dialyn-m1',
      label: 'Mindscape 1: squad RES ignore 15% with Overwhelmingly Positive',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Overwhelmingly Positive' },
      resIgnore: () => 15,
      confidence: 'sourced',
    },
    {
      id: 'dialyn-m2',
      label: 'Mindscape 2: squad DMG +15% with Malicious Complaint',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Malicious Complaint' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 15 }],
      confidence: 'sourced',
    },
    {
      id: 'dialyn-m4',
      label: 'Mindscape 4: ATK +500 with Overwhelmingly Positive',
      minMindscape: 4,
      toggle: { kind: 'switch', label: 'Overwhelmingly Positive' },
      stats: () => [{ stat: ZzzStats.ATK, value: 500 }],
      confidence: 'sourced',
    },
  ],
  // Ellen
  '1191': [
    {
      id: 'ellen-core',
      label: 'Core Skill: CRIT DMG +100% for her Flash Freeze Basic Attacks, Arctic Ambush, Chain Attack and Ultimate',
      kindCritDmg: () => ({
        BasicAttackFlashFreezeTrimming: 100,
        BasicAttackGlacialBladeWave: 100,
        BasicAttackIcyBlade: 100,
        DashAttackArcticAmbush: 100,
        chain: 100,
        ult: 100,
      }),
      confidence: 'sourced',
    },
    {
      id: 'ellen-ability',
      label: 'Additional Ability: Ice DMG +3% per Ice attack (up to 10), with 3 Ice or Victoria Housekeeping agents in the squad',
      toggle: { kind: 'stacks', label: 'Ice attacks', max: 10 },
      stats: ({ setting }) => [{ stat: ZzzStats.ELEMENT_DMG, value: 3 * Number(setting) }],
      confidence: 'sourced',
    },
    {
      id: 'ellen-m1',
      label: 'Mindscape 1: CRIT Rate +2% per Flash Freeze charge spent (up to 6)',
      minMindscape: 1,
      toggle: { kind: 'stacks', label: 'Charges spent', max: 6 },
      stats: ({ setting }) => [{ stat: ZzzStats.CRIT_RATE, value: 2 * Number(setting) }],
      confidence: 'sourced',
    },
    {
      id: 'ellen-m2',
      label: 'Mindscape 2: EX Special CRIT DMG +20% per Flash Freeze charge (up to 3)',
      minMindscape: 2,
      toggle: { kind: 'stacks', label: 'Flash Freeze charges', max: 3 },
      kindCritDmg: ({ setting }) => ({ exSpecial: 20 * Number(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'ellen-m6',
      label: 'Mindscape 6: PEN Ratio +20% after an EX Special, Chain Attack or quick charge',
      minMindscape: 6,
      toggle: { kind: 'switch', label: 'After an EX Special or Chain Attack' },
      stats: () => [{ stat: ZzzStats.PEN_RATIO, value: 20 }],
      confidence: 'sourced',
    },
  ],
  // Evelyn
  '1321': [
    {
      id: 'evelyn-core',
      label: 'Core Skill: CRIT Rate +25% with Binding Seal',
      toggle: { kind: 'switch', label: 'Binding Seal' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 25 }],
      confidence: 'sourced',
    },
    {
      id: 'evelyn-ability',
      label:
        'Additional Ability: Chain Attack and Ultimate DMG +30%, with a Stun or Support agent in the squad (their +25% multiplier at 80% CRIT Rate isn\'t counted)',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      kinds: () => ({ chain: 30, ult: 30 }),
      confidence: 'sourced',
    },
    {
      id: 'evelyn-m1',
      label: 'Mindscape 1: ignores 12% of a bound enemy\'s DEF',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Enemy bound' },
      defIgnore: () => 12,
      confidence: 'sourced',
    },
    {
      id: 'evelyn-m2',
      label: 'Mindscape 2: ATK +15%',
      minMindscape: 2,
      stats: () => [{ stat: ZzzStats.ATK_P, value: 15 }],
      confidence: 'sourced',
    },
    {
      id: 'evelyn-m4',
      label: 'Mindscape 4: CRIT DMG +40% while shielded',
      minMindscape: 4,
      toggle: { kind: 'switch', label: 'Shielded' },
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 40 }],
      confidence: 'sourced',
    },
  ],
  // Harumasa
  '1201': [
    {
      id: 'harumasa-core-crit',
      label: 'Core Skill: Hiten no Tsuru Slash and Ultimate CRIT Rate +25%',
      kindCritRate: () => ({ DashAttackHitenNoTsuruSlash: 25, ult: 25 }),
      confidence: 'sourced',
    },
    {
      id: 'harumasa-core-crit-dmg',
      label: 'Core Skill: Hiten no Tsuru Slash and Ultimate CRIT DMG +12% per Gleaming Edge (up to 6)',
      toggle: { kind: 'stacks', label: 'Gleaming Edge', max: 6 },
      kindCritDmg: ({ setting }) => ({ DashAttackHitenNoTsuruSlash: 12 * Number(setting), ult: 12 * Number(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'harumasa-ability',
      label: 'Additional Ability: DMG +40% against a stunned or anomaly-afflicted enemy, with a Stun or Anomaly agent in the squad',
      toggle: { kind: 'switch', label: 'Enemy stunned or afflicted, squad qualifies' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 40 }],
      confidence: 'sourced',
    },
    {
      id: 'harumasa-m2',
      label: 'Mindscape 2: Hiten no Tsuru Slash DMG +50% with Electro Blitz',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Electro Blitz' },
      skills: () => ({ DashAttackHitenNoTsuruSlash: 50 }),
      confidence: 'sourced',
    },
    {
      id: 'harumasa-m6',
      label: 'Mindscape 6: Electric RES ignore 15% with Ha-oto no Ya',
      minMindscape: 6,
      toggle: { kind: 'switch', label: 'Ha-oto no Ya' },
      resIgnore: () => 15,
      confidence: 'sourced',
    },
  ],
  // Hugo
  '1291': [
    {
      id: 'hugo-core',
      label: 'Core Skill: CRIT Rate +12% and CRIT DMG +25% with Dark Abyss Reverb (Totalize\'s multiplier increase isn\'t counted)',
      toggle: { kind: 'switch', label: 'Dark Abyss Reverb' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 12 }, { stat: ZzzStats.CRIT_DMG, value: 25 }],
      confidence: 'sourced',
    },
    {
      id: 'hugo-core-atk',
      label: 'Core Skill: ATK +300 with one Stun agent in the squad, +900 with two',
      toggle: { kind: 'stacks', label: 'Stun agents in the squad', max: 2 },
      stats: ({ setting }) => [{ stat: ZzzStats.ATK, value: [0, 300, 900][Number(setting)] ?? 900 }],
      confidence: 'sourced',
    },
    {
      id: 'hugo-ability',
      label: 'Additional Ability: Chain Attack DMG +15% (+35% more against normal enemies); EX Special and Ultimate DMG +40% against a stunned enemy',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      kinds: ({ enemyStunned }) => ({ chain: 15, exSpecial: enemyStunned ? 40 : 0, ult: enemyStunned ? 40 : 0 }),
      confidence: 'sourced',
    },
    {
      id: 'hugo-m1',
      label: 'Mindscape 1: EX Special and Ultimate CRIT Rate +12% and CRIT DMG +30% against a stunned enemy',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Dark Abyss Reverb' },
      kindCritRate: ({ enemyStunned }) => ({ exSpecial: enemyStunned ? 12 : 0, ult: enemyStunned ? 12 : 0 }),
      kindCritDmg: ({ enemyStunned }) => ({ exSpecial: enemyStunned ? 30 : 0, ult: enemyStunned ? 30 : 0 }),
      confidence: 'sourced',
    },
    {
      id: 'hugo-m2',
      label: 'Mindscape 2: EX Special and Ultimate ignore 15% of a stunned enemy\'s DEF',
      minMindscape: 2,
      kindDefIgnore: ({ enemyStunned }) => ({ exSpecial: enemyStunned ? 15 : 0, ult: enemyStunned ? 15 : 0 }),
      confidence: 'sourced',
    },
    {
      id: 'hugo-m4',
      label: 'Mindscape 4: Ice RES ignore 12% after a charged shot hits',
      minMindscape: 4,
      toggle: { kind: 'switch', label: 'Charged shot hit' },
      resIgnore: () => 12,
      confidence: 'sourced',
    },
    {
      id: 'hugo-m6',
      label: 'Mindscape 6: EX Special and Ultimate DMG +60% against a stunned enemy',
      minMindscape: 6,
      kinds: ({ enemyStunned }) => ({ exSpecial: enemyStunned ? 60 : 0, ult: enemyStunned ? 60 : 0 }),
      confidence: 'sourced',
    },
  ],
  // Ju Fufu (her squad buffs count for her too)
  '1391': [
    {
      id: 'jufufu-core',
      label: 'Core Skill: Tiger\'s Roar, CRIT DMG +20% (+0.05% per ATK above 2,800, up to 30% more), Chain Attack DMG +20%, Ultimate DMG +40%',
      toggle: { kind: 'switch', label: 'Tiger\'s Roar' },
      stats: () => [
        { stat: ZzzStats.CRIT_DMG, value: 20 },
        { stat: ZzzStats.CRIT_DMG, value: 0, fromStat: { stat: 'atk', above: 2800, per: 0.05, max: 30 } },
      ],
      kinds: () => ({ chain: 20, ult: 40 }),
      confidence: 'sourced',
    },
    {
      id: 'jufufu-m1',
      label: 'Mindscape 1: CRIT Rate +12%; the enemy\'s stun multiplier +35% after her Chain Attack hits',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'After her Chain Attack' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 12 }],
      stunBonus: () => 35,
      confidence: 'sourced',
    },
    {
      id: 'jufufu-m2',
      label: 'Mindscape 2: CRIT DMG +22% (squad)',
      minMindscape: 2,
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 22 }],
      confidence: 'sourced',
    },
    {
      id: 'jufufu-m4',
      label: 'Mindscape 4: CRIT DMG +35%',
      minMindscape: 4,
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 35 }],
      confidence: 'sourced',
    },
    {
      id: 'jufufu-m6',
      label: 'Mindscape 6: Chain Attack DMG +30%',
      minMindscape: 6,
      kinds: () => ({ chain: 30 }),
      confidence: 'sourced',
    },
  ],
  // Koleda
  '1101': [
    {
      id: 'koleda-ability',
      label: 'Additional Ability: Chain Attack DMG +35% per EX Special debuff (up to 2) on a stunned enemy, with 3 Fire, Belobog, Rupture or Armorer agents',
      toggle: { kind: 'stacks', label: 'EX Special debuffs', max: 2 },
      kinds: ({ setting, enemyStunned }) => ({ chain: enemyStunned ? 35 * Number(setting) : 0 }),
      confidence: 'sourced',
    },
    {
      id: 'koleda-m4',
      label: 'Mindscape 4: Chain Attack and Ultimate DMG +18% per charge (up to 2)',
      minMindscape: 4,
      toggle: { kind: 'stacks', label: 'Charges', max: 2 },
      kinds: ({ setting }) => ({ chain: 18 * Number(setting), ult: 18 * Number(setting) }),
      confidence: 'sourced',
    },
  ],
  // Lighter
  '1161': [
    {
      id: 'lighter-core-res',
      label: 'Core Skill: the enemy\'s Fire and Ice RES -15% after Morale Burst hits',
      toggle: { kind: 'switch', label: 'Morale Burst hit' },
      resIgnore: () => 15,
      confidence: 'sourced',
    },
    {
      id: 'lighter-ability',
      label:
        'Additional Ability: Fire and Ice DMG +25% at 20 Elation stacks, +0.5% per Impact above 170 (up to 75% in all), with 2 Attack or Sons of Calydon agents',
      toggle: { kind: 'switch', label: '20 Elation, squad qualifies' },
      stats: ({ mindscape }) => [
        { stat: ZzzStats.ELEMENT_DMG, value: mindscape >= 2 ? 31.25 : 25 },
        { stat: ZzzStats.ELEMENT_DMG, value: 0, fromStat: { stat: 'impact', above: 170, per: mindscape >= 2 ? 0.625 : 0.5, max: mindscape >= 2 ? 62.5 : 50 } },
      ],
      confidence: 'sourced',
    },
    {
      id: 'lighter-m1',
      label: 'Mindscape 1: the enemy\'s Fire and Ice RES -10% more (Collapse); his finishing move DMG +30%',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Collapse' },
      resIgnore: () => 10,
      skills: () => ({ 'BasicAttackLFormThunderingFist:15': 30 }),
      confidence: 'sourced',
    },
    {
      id: 'lighter-m2',
      label: 'Mindscape 2: the enemy\'s stun multiplier +25% (Collapse)',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Collapse' },
      stunBonus: () => 25,
      confidence: 'sourced',
    },
  ],
  // Lucia (her squad buffs count for her too)
  '1451': [
    {
      id: 'lucia-core',
      label: 'Core Skill: Dreamer\'s Nursery Rhyme, DMG +20%',
      toggle: { kind: 'switch', label: 'Dreamer\'s Nursery Rhyme' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 20 }],
      confidence: 'sourced',
    },
    {
      id: 'lucia-ability',
      label: 'Additional Ability: CRIT DMG +30% with Darkbreaker, with a Rupture or Stun agent in the squad',
      toggle: { kind: 'switch', label: 'Darkbreaker, squad qualifies' },
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 30 }],
      confidence: 'sourced',
    },
    {
      id: 'lucia-m1',
      label: 'Mindscape 1: RES ignore 18% with Dreamer\'s Nursery Rhyme',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Dreamer\'s Nursery Rhyme' },
      resIgnore: () => 18,
      confidence: 'sourced',
    },
  ],
  // Lycaon
  '1141': [
    {
      id: 'lycaon-core',
      label: 'Core Skill: the enemy\'s Ice RES -25% after his EX Special or Assist Follow-Up hits',
      toggle: { kind: 'switch', label: 'After his EX Special or Follow-Up' },
      resIgnore: () => 25,
      confidence: 'sourced',
    },
    {
      id: 'lycaon-ability',
      label: 'Additional Ability: the stunned enemy\'s stun multiplier +35%, with 3 Ice, Victoria Housekeeping or Anomaly agents',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      stunBonus: () => 35,
      confidence: 'sourced',
    },
    {
      id: 'lycaon-m6',
      label: 'Mindscape 6: DMG +10% per charged hit (up to 3)',
      minMindscape: 6,
      toggle: { kind: 'stacks', label: 'Charged hits', max: 3 },
      stats: ({ setting }) => [{ stat: ZzzStats.ELEMENT_DMG, value: 10 * Number(setting) }],
      confidence: 'sourced',
    },
  ],
  // Manato (his Sheer Force from HP is in data/enkaGameData.ts)
  '1441': [
    {
      id: 'manato-core-strikes',
      label: 'Core Skill: Blazing Wind Misty Slash and Assist Follow-Up CRIT DMG +50% while spending HP',
      toggle: { kind: 'switch', label: 'Spending HP' },
      kindCritDmg: () => ({ BasicAttackBlazingWindMistySlash: 50, assistFollowUp: 50 }),
      confidence: 'sourced',
    },
    {
      id: 'manato-core-molten-edge',
      label: 'Core Skill: Molten Edge, CRIT Rate +10% and Fire DMG +20%',
      toggle: { kind: 'switch', label: 'Molten Edge' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 10 }, { stat: ZzzStats.ELEMENT_DMG, value: 20 }],
      confidence: 'sourced',
    },
    {
      id: 'manato-m2',
      label: 'Mindscape 2: Fire RES ignore 8% with Molten Edge',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Molten Edge' },
      resIgnore: () => 8,
      confidence: 'sourced',
    },
    {
      id: 'manato-m4',
      label: 'Mindscape 4: HP +8%',
      minMindscape: 4,
      stats: () => [{ stat: ZzzStats.HP_P, value: 8 }],
      confidence: 'sourced',
    },
  ],
  // Nekomata
  '1021': [
    {
      id: 'nekomata-core',
      label: 'Core Skill: DMG +60% after a Dodge Counter or Quick Assist hits',
      toggle: { kind: 'switch', label: 'After a Dodge Counter or Quick Assist' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 60 }],
      confidence: 'sourced',
    },
    {
      id: 'nekomata-ability',
      label: 'Additional Ability: EX Special DMG +35% per Assault inflicted (up to 2), with 3 Support, Physical or Cunning Hares agents',
      toggle: { kind: 'stacks', label: 'Assaults inflicted', max: 2 },
      kinds: ({ setting }) => ({ exSpecial: 35 * Number(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'nekomata-m1',
      label: 'Mindscape 1: Physical RES ignore 16% attacking from behind',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'From behind' },
      resIgnore: () => 16,
      confidence: 'sourced',
    },
    {
      id: 'nekomata-m4',
      label: 'Mindscape 4: CRIT Rate +7% per EX Special used (up to 2)',
      minMindscape: 4,
      toggle: { kind: 'stacks', label: 'EX Specials used', max: 2 },
      stats: ({ setting }) => [{ stat: ZzzStats.CRIT_RATE, value: 7 * Number(setting) }],
      confidence: 'sourced',
    },
    {
      id: 'nekomata-m6',
      label: 'Mindscape 6: CRIT DMG +18% per Chain Attack or Ultimate used (up to 3)',
      minMindscape: 6,
      toggle: { kind: 'stacks', label: 'Chain Attacks or Ultimates', max: 3 },
      stats: ({ setting }) => [{ stat: ZzzStats.CRIT_DMG, value: 18 * Number(setting) }],
      confidence: 'sourced',
    },
  ],
  // Piper
  '1281': [
    {
      id: 'piper-ability',
      label: 'Additional Ability: squad DMG +18% at 20 Power, with 4 Anomaly, Physical or Sons of Calydon members counted',
      toggle: { kind: 'switch', label: '20 Power, squad qualifies' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 18 }],
      confidence: 'sourced',
    },
    {
      id: 'piper-m2',
      label: 'Mindscape 2: Physical DMG +10%, +1% per Power (up to 20, 30 at Mindscape 1)',
      minMindscape: 2,
      toggle: { kind: 'stacks', label: 'Power', max: 30 },
      stats: ({ setting, mindscape }) => [{ stat: ZzzStats.ELEMENT_DMG, value: 10 + Math.min(Number(setting), mindscape >= 1 ? 30 : 20) }],
      confidence: 'sourced',
    },
  ],
  // Qingyi
  '1251': [
    {
      id: 'qingyi-flash-connect',
      label: 'Enchanted Moonlit Blossoms DMG +1% per Flash Connect Voltage spent (up to 25)',
      toggle: { kind: 'stacks', label: 'Voltage spent', max: 25 },
      skills: ({ setting }) => ({ BasicAttackEnchantedMoonlitBlossoms: Number(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'qingyi-core',
      label: 'Core Skill: Subjugation, the enemy\'s stun multiplier +4% per stack (up to 20; x1.35 at Mindscape 2); her Chain Attack DMG +3% per stack',
      toggle: { kind: 'stacks', label: 'Subjugation', max: 20 },
      stunBonus: ({ setting, mindscape }) => 4 * Number(setting) * (mindscape >= 2 ? 1.35 : 1),
      skills: ({ setting }) => ({ 'ChainAttackTranquilSerenade:0': 3 * Number(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'qingyi-ability',
      label: 'Additional Ability: ATK +6 per Impact above 120 (up to 600)',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      stats: () => [{ stat: ZzzStats.ATK, value: 0, fromStat: { stat: 'impact', above: 120, per: 6, max: 600 } }],
      confidence: 'sourced',
    },
    {
      id: 'qingyi-m1',
      label: 'Mindscape 1: after spending 25 Voltage, ignores 15% of the enemy\'s DEF and CRIT Rate +20%',
      minMindscape: 1,
      toggle: { kind: 'switch', label: 'Spent 25 Voltage' },
      defIgnore: () => 15,
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 20 }],
      confidence: 'sourced',
    },
    {
      id: 'qingyi-m6',
      label: 'Mindscape 6: the enemy\'s RES -20% after Moonlit Blossoms hit; Enchanted Moonlit Blossoms CRIT DMG +100%',
      minMindscape: 6,
      toggle: { kind: 'switch', label: 'Moonlit Blossoms hit' },
      resIgnore: () => 20,
      kindCritDmg: () => ({ BasicAttackEnchantedMoonlitBlossoms: 100 }),
      confidence: 'sourced',
    },
  ],
  // Roxy
  '1621': [
    {
      id: 'roxy-core-atk',
      label: 'Core Skill: ATK +5 per 0.01 Energy Regen above 1.2 (up to 960)',
      stats: () => [{ stat: ZzzStats.ATK, value: 0, fromStat: { stat: 'energyRegen', above: 1.2, per: 500, max: 960 } }],
      confidence: 'sourced',
    },
    {
      id: 'roxy-core-contamination',
      label: 'Core Skill: Contamination, the squad\'s CRIT DMG +0.4% per 1% of her CRIT Rate (up to 40%)',
      toggle: { kind: 'switch', label: 'Contamination' },
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 0, fromStat: { stat: 'critRate', above: 0, per: 0.4, max: 40 } }],
      confidence: 'sourced',
    },
    {
      id: 'roxy-ability',
      label: 'Additional Ability: DMG +80% (8% + 1.2% per level), and the enemy\'s stun multiplier +30%, with an Attack, Rupture or Armorer agent',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 80 }],
      stunBonus: () => 30,
      confidence: 'sourced',
    },
    {
      id: 'roxy-m1',
      label: 'Mindscape 1: CRIT DMG +40%; the enemy\'s RES -15%',
      minMindscape: 1,
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 40 }],
      resIgnore: () => 15,
      confidence: 'sourced',
    },
    {
      id: 'roxy-m2',
      label: 'Mindscape 2: the enemy\'s stun multiplier +30% more',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Chill hits' },
      stunBonus: () => 30,
      confidence: 'sourced',
    },
    {
      id: 'roxy-m4',
      label: 'Mindscape 4: Ultimate DMG +20%',
      minMindscape: 4,
      kinds: () => ({ ult: 20 }),
      confidence: 'sourced',
    },
    {
      id: 'roxy-m6',
      label: 'Mindscape 6: Wind RES ignore 15%',
      minMindscape: 6,
      resIgnore: () => 15,
      confidence: 'sourced',
    },
  ],
  // Seed
  '1461': [
    {
      id: 'seed-core-onslaught',
      label: 'Core Skill: Onslaught, ATK +1,000 and CRIT DMG +30%',
      toggle: { kind: 'switch', label: 'Onslaught' },
      stats: () => [{ stat: ZzzStats.ATK, value: 1000 }, { stat: ZzzStats.CRIT_DMG, value: 30 }],
      confidence: 'sourced',
    },
    {
      id: 'seed-core-besiege',
      label: 'Core Skill: Besiege, DMG +25%',
      toggle: { kind: 'switch', label: 'Besiege' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 25 }],
      confidence: 'sourced',
    },
    {
      id: 'seed-ability',
      label: 'Additional Ability: Falling Petals Basic Attacks and Ultimate DMG +30% (their Electric RES ignore isn\'t counted)',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      skills: () => ({
        BasicAttackFallingPetalsDownfallFirstForm: 30,
        BasicAttackFallingPetalsDownfallSecondForm: 30,
        BasicAttackFallingPetalsSlaughter: 30,
      }),
      kinds: () => ({ ult: 30 }),
      confidence: 'sourced',
    },
    {
      id: 'seed-m1',
      label: 'Mindscape 1: Falling Petals Downfall CRIT DMG +30%',
      minMindscape: 1,
      kindCritDmg: () => ({ BasicAttackFallingPetalsDownfallFirstForm: 30, BasicAttackFallingPetalsDownfallSecondForm: 30 }),
      confidence: 'sourced',
    },
    {
      id: 'seed-m2',
      label: 'Mindscape 2: ignores 20% of the enemy\'s DEF with Besiege',
      minMindscape: 2,
      toggle: { kind: 'switch', label: 'Besiege' },
      defIgnore: () => 20,
      confidence: 'sourced',
    },
    {
      id: 'seed-m4',
      label: 'Mindscape 4: Ultimate DMG +20% with Besiege',
      minMindscape: 4,
      toggle: { kind: 'switch', label: 'Besiege' },
      kinds: () => ({ ult: 20 }),
      confidence: 'sourced',
    },
    {
      id: 'seed-m6',
      label: 'Mindscape 6: CRIT DMG +50%',
      minMindscape: 6,
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 50 }],
      confidence: 'sourced',
    },
  ],
  // Soldier 11
  '1041': [
    {
      id: 'soldier11-core',
      label: 'Core Skill: Fire Suppression Basic and Dash Attack DMG +70%',
      skills: () => ({ BasicAttackFireSuppression: 70, DashAttackFireSuppression: 70 }),
      confidence: 'sourced',
    },
    {
      id: 'soldier11-ability',
      label: 'Additional Ability: Fire DMG +10% (+22.5% more against a stunned enemy), with 3 Fire or Defense Force agents',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      stats: ({ enemyStunned }) => [{ stat: ZzzStats.ELEMENT_DMG, value: enemyStunned ? 32.5 : 10 }],
      confidence: 'sourced',
    },
    {
      id: 'soldier11-m2',
      label: 'Mindscape 2: Fire Suppression DMG +3% per stack (up to 12)',
      minMindscape: 2,
      toggle: { kind: 'stacks', label: 'Stacks', max: 12 },
      skills: ({ setting }) => ({ BasicAttackFireSuppression: 3 * Number(setting), DashAttackFireSuppression: 3 * Number(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'soldier11-m6',
      label: 'Mindscape 6: Fire RES ignore 25% after spending a charge',
      minMindscape: 6,
      toggle: { kind: 'switch', label: 'Charge spent' },
      resIgnore: () => 25,
      confidence: 'sourced',
    },
  ],
  // Trigger (her squad gets her other buffs from team/buffs.ts)
  '1361': [
    {
      id: 'trigger-core-stun',
      label: 'Core Skill: the stunned enemy\'s stun multiplier +35% after her Aftershocks hit',
      toggle: { kind: 'switch', label: 'Aftershock hit' },
      stunBonus: () => 35,
      confidence: 'sourced',
    },
    {
      id: 'trigger-m2',
      label: 'Mindscape 2: squad CRIT DMG +6% per Hunter\'s Gaze (up to 4)',
      minMindscape: 2,
      toggle: { kind: 'stacks', label: 'Hunter\'s Gaze', max: 4 },
      stats: ({ setting }) => [{ stat: ZzzStats.CRIT_DMG, value: 6 * Number(setting) }],
      confidence: 'sourced',
    },
  ],
  // Yidhari (her Sheer Force from HP is in data/enkaGameData.ts)
  '1051': [
    {
      id: 'yidhari-core',
      label: 'Core Skill: DMG +2% per 1% of HP missing (up to 50%)',
      toggle: { kind: 'stacks', label: 'HP missing (%)', max: 50 },
      stats: ({ setting }) => [{ stat: ZzzStats.ELEMENT_DMG, value: 2 * Number(setting) }],
      confidence: 'sourced',
    },
    {
      id: 'yidhari-ability',
      label: 'Additional Ability: CRIT DMG +30% at 50% HP missing, with a Stun or Support agent in the squad',
      toggle: { kind: 'switch', label: '50% HP missing, squad qualifies' },
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 30 }],
      confidence: 'sourced',
    },
    {
      id: 'yidhari-m2',
      label: 'Mindscape 2: CRIT DMG +40%',
      minMindscape: 2,
      stats: () => [{ stat: ZzzStats.CRIT_DMG, value: 40 }],
      confidence: 'sourced',
    },
    {
      id: 'yidhari-m6',
      label: 'Mindscape 6: Sheer DMG +25% with Erudition',
      minMindscape: 6,
      toggle: { kind: 'switch', label: 'Erudition' },
      sheerDmg: () => 25,
      confidence: 'sourced',
    },
  ],
  // Zhu Yuan
  '1241': [
    {
      id: 'zhuyuan-core',
      label: 'Core Skill: Enhanced Shotshell hits DMG +40% (+40% more against a stunned enemy)',
      skills: ({ enemyStunned }) =>
        Object.fromEntries(
          ['BasicAttackPleaseDoNotResist:3', 'BasicAttackPleaseDoNotResist:4', 'BasicAttackPleaseDoNotResist:5', 'DashAttackOverwhelmingFirepower:1']
            .map((key) => [key, enemyStunned ? 80 : 40]),
        ),
      confidence: 'sourced',
    },
    {
      id: 'zhuyuan-ability',
      label: 'Additional Ability: CRIT Rate +30% after an EX Special, Chain Attack or Ultimate, with 2 Support or Criminal Investigation agents',
      toggle: { kind: 'switch', label: 'Squad qualifies' },
      stats: () => [{ stat: ZzzStats.CRIT_RATE, value: 30 }],
      confidence: 'sourced',
    },
    {
      id: 'zhuyuan-m2',
      label: 'Mindscape 2: Enhanced Shotshell DMG +10% per Shotshell hit (up to 5)',
      minMindscape: 2,
      toggle: { kind: 'stacks', label: 'Shotshell hits', max: 5 },
      skills: ({ setting }) =>
        Object.fromEntries(
          ['BasicAttackPleaseDoNotResist:3', 'BasicAttackPleaseDoNotResist:4', 'BasicAttackPleaseDoNotResist:5', 'DashAttackOverwhelmingFirepower:1']
            .map((key) => [key, 10 * Number(setting)]),
        ),
      confidence: 'sourced',
    },
  ],
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
  kindDefIgnore: HitScoped,
  kindCritDmg: HitScoped,
  kindCritRate: HitScoped,
  dmgTaken: number,
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

function addScoped(into: HitScoped, from: HitScoped | undefined) {
  for (const [key, value] of Object.entries(from ?? {})) into[key] = (into[key] ?? 0) + value
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
    kindCritRate: {},
    dmgTaken: 0,
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
    addScoped(resolved.kindDefIgnore, effect.kindDefIgnore?.(context))
    addScoped(resolved.kindCritDmg, effect.kindCritDmg?.(context))
    addScoped(resolved.kindCritRate, effect.kindCritRate?.(context))
    resolved.dmgTaken += effect.dmgTaken?.(context) ?? 0
    resolved.veilVulnerabilityCap = Math.max(resolved.veilVulnerabilityCap, effect.veilVulnerabilityCap?.(context) ?? 0)
    resolved.sheerDmg += effect.sheerDmg?.(context) ?? 0
    resolved.sharpDmg += effect.sharpDmg?.(context) ?? 0
    for (const [skill, value] of Object.entries(effect.skills?.(context) ?? {})) {
      resolved.skillBonus[skill] = (resolved.skillBonus[skill] ?? 0) + value
    }
  }
  return resolved
}
