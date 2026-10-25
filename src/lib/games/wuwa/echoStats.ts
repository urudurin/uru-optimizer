import {
  type Cost,
  ELEMENT_DMG_KEYS,
  MAX_ECHO_LEVEL,
  type StatKey,
  type SubstatKey,
} from 'lib/games/wuwa/types'

// Main stat and substat values of 5-star echoes, ported from the WuwaEchoScorer project (datamine phantomgrowth for
// the level scaling). Not yet checked against the in-game stat screen in this project.

const ELEMENTAL_30 = Object.fromEntries(ELEMENT_DMG_KEYS.map((key) => [key, 30])) as Partial<Record<StatKey, number>>

// Main stat values at +25, by cost. A stat missing for a cost can't be that cost's main stat
export const MAIN_STAT_MAX: Record<Cost, Partial<Record<StatKey, number>>> = {
  4: { critRate: 22, critDmg: 44, atkPct: 33, hpPct: 33, defPct: 41.8, healingBonus: 26.4 },
  3: { atkPct: 30, hpPct: 30, defPct: 38, energyRegen: 32, ...ELEMENTAL_30 },
  1: { atkPct: 18, hpPct: 22.8, defPct: 18 },
}

// The fixed second main stat every echo of a cost carries, at +25
export const SECONDARY_MAIN: Record<Cost, { stat: StatKey, max: number }> = {
  4: { stat: 'atkFlat', max: 150 },
  3: { stat: 'atkFlat', max: 100 },
  1: { stat: 'hpFlat', max: 2280 },
}

// Fraction of the +25 value an echo's main stats have at a level: linear from 20% at +0
export function mainStatLevelScale(level: number): number {
  return 0.2 + (0.8 * level) / MAX_ECHO_LEVEL
}

export function isValidMainStat(cost: Cost, stat: StatKey): boolean {
  return MAIN_STAT_MAX[cost][stat] !== undefined
}

export function mainStatValue(cost: Cost, stat: StatKey, level: number): number {
  return (MAIN_STAT_MAX[cost][stat] ?? 0) * mainStatLevelScale(level)
}

export function secondaryMainValue(cost: Cost, level: number): number {
  return SECONDARY_MAIN[cost].max * mainStatLevelScale(level)
}

const PCT_8 = [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6] as const

// Every value a substat can roll, lowest tier first
export const SUBSTAT_TIERS: Record<SubstatKey, readonly number[]> = {
  critRate: [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5],
  critDmg: [12.6, 13.8, 15.0, 16.2, 17.4, 18.6, 19.8, 21.0],
  atkPct: PCT_8,
  hpPct: PCT_8,
  defPct: [8.1, 9.0, 10.0, 10.9, 11.8, 12.8, 13.8, 14.7],
  energyRegen: [6.8, 7.6, 8.4, 9.2, 10.0, 10.8, 11.6, 12.4],
  basicDmg: PCT_8,
  heavyDmg: PCT_8,
  skillDmg: PCT_8,
  libDmg: PCT_8,
  atkFlat: [30, 40, 50, 60],
  defFlat: [40, 50, 60, 70],
  hpFlat: [320, 360, 390, 430, 470, 510, 540, 580],
}

export const SUBSTAT_KEYS = Object.keys(SUBSTAT_TIERS) as SubstatKey[]

const TIER_TOLERANCE = 1e-6

// 1-based tier of a roll value, or undefined if the value can't roll
export function tierOf(stat: SubstatKey, value: number): number | undefined {
  const tiers = SUBSTAT_TIERS[stat] as readonly number[] | undefined
  if (!tiers) return undefined
  const i = tiers.findIndex((tier) => Math.abs(tier - value) < TIER_TOLERANCE)
  return i === -1 ? undefined : i + 1
}

export function maxRoll(stat: SubstatKey): number {
  const tiers = SUBSTAT_TIERS[stat]
  return tiers[tiers.length - 1]
}

// Mean tier value as a fraction of the max roll, assuming every tier is equally likely
export function avgRollPct(stat: SubstatKey): number {
  const tiers = SUBSTAT_TIERS[stat]
  const mean = tiers.reduce((sum, tier) => sum + tier, 0) / tiers.length
  return mean / maxRoll(stat)
}
