export const ZzzStats = {
  HP: 'HP',
  ATK: 'ATK',
  DEF: 'DEF',
  HP_P: 'HP%',
  ATK_P: 'ATK%',
  DEF_P: 'DEF%',
  CRIT_RATE: 'CRIT Rate',
  CRIT_DMG: 'CRIT DMG',
  ANOMALY_PROFICIENCY: 'Anomaly Proficiency',
  ANOMALY_MASTERY: 'Anomaly Mastery',
  IMPACT: 'Impact',
  ENERGY_REGEN: 'Energy Regen',
  PEN: 'PEN',
  PEN_RATIO: 'PEN Ratio',
  // The element is resolved from the agent at calculation time
  ELEMENT_DMG: 'Element DMG%',
} as const

type ZzzStatsKeys = keyof typeof ZzzStats
export type ZzzStatsValues = (typeof ZzzStats)[ZzzStatsKeys]

export const MAX_DISC_LEVEL = 15

export type DiscSlot = 1 | 2 | 3 | 4 | 5 | 6
// The slots whose main stat varies
export type MainStatSlot = 4 | 5 | 6
export type DiscRarity = 'S' | 'A' | 'B'

export type DiscSubstat = {
  stat: ZzzStatsValues,
  // The value is derived as rolls x the per-roll increment, see discStats.ts
  rolls: number,
}

export type Disc = {
  id: string,
  slot: DiscSlot,
  setId: string,
  // Display name from the source, a fallback until a set registry exists
  setName: string,
  rarity: DiscRarity,
  level: number,
  main: {
    stat: ZzzStatsValues,
    value: number,
  },
  substats: DiscSubstat[],
  locked: boolean,
  // Agent id, only present when the source knows the in-game owner
  equippedBy?: string,
}
