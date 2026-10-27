import type { HitKind } from 'lib/games/zzz/damage/damage'
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
// Only the optimizer counts them, and only when ranking by rotation damage. Agents whose sheet in genshin-optimizer is
// still a placeholder (Aria, Velina, Nangong Yu, Norma, Pyrois, Remielle) have nothing here yet.
// Personal, non-commercial use.

export type ZzzEffectToggle = { kind: 'switch', label: string } | { kind: 'stacks', label: string, max: number }

export type ZzzCombatContext = {
  mindscape: number,
  // true/false for a switch, the stack count for stacks
  setting: boolean | number,
}

export type ZzzCombatEffect = {
  id: string,
  label: string,
  toggle?: ZzzEffectToggle,
  // Mindscape it needs
  minMindscape?: number,
  stats?: (context: ZzzCombatContext) => { stat: ZzzStatsValues, value: number }[],
  kinds?: (context: ZzzCombatContext) => Partial<Record<HitKind, number>>,
  skills?: (context: ZzzCombatContext) => Record<string, number>,
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
  '1431': [{
    id: 'ye-core-dmg',
    label: 'Core Skill: DMG +25%',
    stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 25 }],
    confidence: 'sourced',
  }],
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
      label: 'Core Skill: Zeroed In: ATK +280 for the squad (more from Energy Regen above 1.6, not counted, at most 700)',
      toggle: { kind: 'switch', label: 'Zeroed In' },
      stats: () => [{ stat: ZzzStats.ATK, value: 280 }],
      confidence: 'sourced',
    },
  ],
  // Claret
  '1611': [
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
  kindBonus: Partial<Record<HitKind, number>>,
  skillBonus: Record<string, number>,
}

export function defaultEffectSetting(effect: ZzzCombatEffect): boolean | number {
  return effect.toggle?.kind === 'stacks' ? effect.toggle.max : true
}

export function resolveZzzCombat(agentId: string, mindscape: number, settings: Record<string, boolean | number>): ZzzResolvedCombat {
  const resolved: ZzzResolvedCombat = { applied: [], statEffects: [], kindBonus: {}, skillBonus: {} }
  for (const effect of KIT_EFFECTS[agentId] ?? []) {
    const setting = settings[effect.id] ?? defaultEffectSetting(effect)
    if ((effect.minMindscape ?? 0) > mindscape) {
      resolved.applied.push({ effect, setting, counted: false, reason: `Needs Mindscape ${effect.minMindscape}` })
      continue
    }
    const counted = setting !== false && setting !== 0
    resolved.applied.push({ effect, setting, counted, reason: counted ? undefined : 'Turned off' })
    if (!counted) continue
    const context = { mindscape, setting }
    for (const { stat, value } of effect.stats?.(context) ?? []) {
      resolved.statEffects.push({ stat, value, source: `Kit: ${effect.label}`, confidence: effect.confidence })
    }
    for (const [kind, value] of Object.entries(effect.kinds?.(context) ?? {}) as [HitKind, number][]) {
      resolved.kindBonus[kind] = (resolved.kindBonus[kind] ?? 0) + value
    }
    for (const [skill, value] of Object.entries(effect.skills?.(context) ?? {})) {
      resolved.skillBonus[skill] = (resolved.skillBonus[skill] ?? 0) + value
    }
  }
  return resolved
}
