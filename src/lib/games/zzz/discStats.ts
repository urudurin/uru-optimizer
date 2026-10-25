import {
  type DiscRarity,
  type DiscSlot,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Slots 1-3 always have the same flat main stat
export const FIXED_MAIN_STAT_BY_SLOT: Partial<Record<DiscSlot, ZzzStatsValues>> = {
  1: ZzzStats.HP,
  2: ZzzStats.ATK,
  3: ZzzStats.DEF,
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
