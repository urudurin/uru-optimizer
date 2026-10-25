import {
  type DiscRarity,
  type DiscSlot,
  type MainStatSlot,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Slots 1-3 always have the same flat main stat
export const FIXED_MAIN_STAT_BY_SLOT: Partial<Record<DiscSlot, ZzzStatsValues>> = {
  1: ZzzStats.HP,
  2: ZzzStats.ATK,
  3: ZzzStats.DEF,
}

// Main stats slots 4-6 can roll
export const MAIN_STATS_BY_SLOT: Record<MainStatSlot, ZzzStatsValues[]> = {
  4: [ZzzStats.HP_P, ZzzStats.ATK_P, ZzzStats.DEF_P, ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG, ZzzStats.ANOMALY_PROFICIENCY],
  5: [ZzzStats.HP_P, ZzzStats.ATK_P, ZzzStats.DEF_P, ZzzStats.PEN_RATIO, ZzzStats.ELEMENT_DMG],
  6: [ZzzStats.HP_P, ZzzStats.ATK_P, ZzzStats.DEF_P, ZzzStats.ANOMALY_MASTERY, ZzzStats.IMPACT, ZzzStats.ENERGY_REGEN],
}

type RollValues = Partial<Record<ZzzStatsValues, number>>

// Per-roll substat increments observed in a sample export of S-rank discs.
// TODO: replace with values from game data, and add the other rarities.
const S_RANK_ROLL_VALUES: RollValues = {
  [ZzzStats.HP]: 112,
  [ZzzStats.ATK]: 19,
  [ZzzStats.DEF]: 15,
  [ZzzStats.HP_P]: 3,
  [ZzzStats.ATK_P]: 3,
  [ZzzStats.DEF_P]: 4.8,
  [ZzzStats.CRIT_RATE]: 2.4,
  [ZzzStats.CRIT_DMG]: 4.8,
  [ZzzStats.ANOMALY_PROFICIENCY]: 9,
  [ZzzStats.PEN]: 9,
}

const ROLL_VALUES_BY_RARITY: Partial<Record<DiscRarity, RollValues>> = {
  S: S_RANK_ROLL_VALUES,
}

export function getSubstatValue(rarity: DiscRarity, stat: ZzzStatsValues, rolls: number): number | undefined {
  const perRoll = ROLL_VALUES_BY_RARITY[rarity]?.[stat]
  if (perRoll === undefined) return undefined

  // Round away floating point noise such as 2.4 * 3 = 7.199999999999999
  return Math.round(perRoll * rolls * 10_000) / 10_000
}
