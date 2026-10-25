import type {
  AgentData,
  StatEffect,
} from 'lib/games/zzz/data/dataTypes'
import { ZzzStats } from 'lib/games/zzz/types'

// Unity (Core Skill) CRIT Rate by Core Skill level A-F. The DMG part of Unity isn't a stat-screen value
const YE_UNITY_CRIT_RATE = [17.5, 20, 22.5, 25, 27.5, 30]

const yeCoreEffects: Record<number, StatEffect[]> = Object.fromEntries(
  YE_UNITY_CRIT_RATE.map((value, i) => [
    i + 1,
    [
      {
        stat: ZzzStats.CRIT_RATE,
        value,
        when: 'onField',
        source: 'Core Skill: Unity',
        confidence: i === 5 ? 'confirmed' : 'sourced',
      } satisfies StatEffect,
    ],
  ]),
)

export const YE_SHUNGUANG: AgentData = {
  id: '1431',
  name: 'Ye Shunguang',
  element: 'Physical',
  specialty: 'Attack',
  level: 60,
  // HP, Impact, Anomaly Mastery and Anomaly Proficiency (with discs) matched the in-game screen and a user export.
  // ATK, DEF and CRIT come from the same community source, CRIT Rate 19.4 includes the 14.4 Core Skill bonus
  base: {
    hp: 7673,
    atk: 938,
    def: 606,
    impact: 83,
    critRate: 19.4,
    critDmg: 50,
    anomalyMastery: 94,
    anomalyProficiency: 93,
    penRatio: 0,
    energyRegen: 1.2,
  },
  coreEffects: yeCoreEffects,
}

// Used for agents whose Core Skill has no effect that shows up as a stat
function coreEffectsAtEveryLevel(effects: StatEffect[]): Record<number, StatEffect[]> {
  return Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [level, effects]))
}

export const MIYABI: AgentData = {
  id: '1091',
  name: 'Miyabi',
  element: 'Ice',
  specialty: 'Anomaly',
  level: 60,
  // From Gachabase, includes the Core Skill ATK +75 and Anomaly Proficiency +90.
  // Every value matched the in-game stat screen (screenshot of a real build)
  base: {
    hp: 7673,
    atk: 880,
    def: 606,
    impact: 86,
    critRate: 5,
    critDmg: 50,
    anomalyMastery: 116,
    anomalyProficiency: 238,
    penRatio: 0,
    energyRegen: 1.2,
  },
  coreEffects: coreEffectsAtEveryLevel([]),
}

export const YIXUAN: AgentData = {
  id: '1371',
  name: 'Yixuan',
  element: 'Ether',
  specialty: 'Rupture',
  level: 60,
  // From Gachabase, includes the Core Skill CRIT Rate +14.4 and HP +420. HP, Impact and CRIT match a user export
  base: {
    hp: 8373,
    atk: 872,
    def: 441,
    impact: 93,
    critRate: 19.4,
    critDmg: 50,
    anomalyMastery: 92,
    anomalyProficiency: 90,
    penRatio: 0,
    energyRegen: 1.2,
  },
  // Core Passive: 0.1 Sheer Force per point of max HP, on top of the 0.3 per ATK every Rupture agent has.
  // A screenshot (ATK 2173, HP 20454, Sheer Force 2696) matches when each part is rounded down: 651 + 2045
  sheerForce: { fromAtk: 0.3, fromHp: 0.1 },
  // Meditation after her Ultimate, needs a Stun, Support or Defense teammate, which rides on onField like Anby's
  coreEffects: coreEffectsAtEveryLevel([{
    stat: ZzzStats.CRIT_DMG,
    value: 40,
    when: 'onField',
    source: 'Additional Ability: Auric Ink Undercurrent (Meditation)',
    confidence: 'sourced',
  }]),
}

export const SOLDIER_0_ANBY: AgentData = {
  id: '1381',
  name: 'Soldier 0 - Anby',
  element: 'Electric',
  specialty: 'Attack',
  level: 60,
  // From Gachabase, includes the Core Skill CRIT Rate +14.4 and ATK +75. Gachabase's 7673/929/612 are rounded and came
  // out one point off on the stat screen. The game's base stats are fractional, so HP, ATK and DEF are fitted to a
  // screenshot of a real build: ATK must be in [928.12, 928.72) with the 713 W-Engine, HP in [7673.6, 7674.4),
  // DEF in [610.9, 611.7). Every value then matches the screen
  base: {
    hp: 7674,
    atk: 928.4,
    def: 611,
    impact: 93,
    critRate: 19.4,
    critDmg: 50,
    anomalyMastery: 94,
    anomalyProficiency: 93,
    penRatio: 0,
    energyRegen: 1.2,
  },
  // Voltage Surge (Additional Ability) needs a Stun or Support teammate, which isn't a condition yet, so it rides on onField
  coreEffects: coreEffectsAtEveryLevel([{
    stat: ZzzStats.CRIT_RATE,
    value: 10,
    when: 'onField',
    source: 'Additional Ability: Voltage Surge',
    confidence: 'sourced',
  }]),
}

export const AGENTS: Record<string, AgentData> = {
  [YE_SHUNGUANG.id]: YE_SHUNGUANG,
  [MIYABI.id]: MIYABI,
  [YIXUAN.id]: YIXUAN,
  [SOLDIER_0_ANBY.id]: SOLDIER_0_ANBY,
}
