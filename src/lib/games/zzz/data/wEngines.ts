import type {
  StatEffect,
  WEngineData,
} from 'lib/games/zzz/data/dataTypes'
import {
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// CRIT DMG from the passive by refinement R1-R5, read from a user export of the W-Engine
const CLOUDCLEAVE_PASSIVE_CRIT_DMG = [25, 28.7, 32.5, 36.2, 40]

export const CLOUDCLEAVE_RADIANCE: WEngineData = {
  id: '14143',
  name: 'Cloudcleave Radiance',
  rarity: 'S',
  specialty: 'Attack',
  baseAtk: 743,
  subStat: { stat: ZzzStats.CRIT_DMG, value: 48 },
  // The DMG bonus and Physical RES ignore parts of the passive aren't stat-screen values and aren't modeled
  passive: (refinement) => {
    const value = CLOUDCLEAVE_PASSIVE_CRIT_DMG[refinement - 1]
    if (value === undefined) return []
    return [
      {
        stat: ZzzStats.CRIT_DMG,
        value,
        when: 'veilTriggered',
        source: 'Cloudcleave Radiance passive',
        confidence: refinement === 1 ? 'confirmed' : 'sourced',
      } satisfies StatEffect,
    ]
  },
}

// Builds the passive for an engine with one always-on stat bonus, R1 sourced and higher refinements from a user export
function flatPassive(stat: ZzzStatsValues, values: number[], source: string): WEngineData['passive'] {
  return (refinement) => {
    const value = values[refinement - 1]
    if (value === undefined) return []
    return [{ stat, value, source, confidence: refinement === 1 ? 'sourced' : 'unverified' } satisfies StatEffect]
  }
}

export const HAILSTORM_SHRINE: WEngineData = {
  id: '14109',
  name: 'Hailstorm Shrine',
  rarity: 'S',
  specialty: 'Anomaly',
  baseAtk: 743,
  subStat: { stat: ZzzStats.CRIT_RATE, value: 24 },
  // The stacking Ice DMG bonus isn't modeled
  passive: flatPassive(ZzzStats.CRIT_DMG, [50, 57, 65, 72, 80], 'Hailstorm Shrine passive'),
}

export const QINGMING_BIRDCAGE: WEngineData = {
  id: '14137',
  name: 'Qingming Birdcage',
  rarity: 'S',
  specialty: 'Rupture',
  baseAtk: 743,
  subStat: { stat: ZzzStats.HP_P, value: 30 },
  // The Qingming Companion Ether DMG and Sheer DMG stacks aren't modeled
  passive: flatPassive(ZzzStats.CRIT_RATE, [20, 23, 26, 29, 32], 'Qingming Birdcage passive'),
}

// The export lists 60/69/78/87/96, which is the flat part plus 3 full stacks (each stack is a third of the flat part).
// Icy Veins gives R1 as 30 flat + 10 per stack, the split for R2-R5 is derived from that
const SEVERED_INNOCENCE_FLAT_CRIT_DMG = [30, 34.5, 39, 43.5, 48]

export const SEVERED_INNOCENCE: WEngineData = {
  id: '14138',
  name: 'Severed Innocence',
  rarity: 'S',
  specialty: 'Attack',
  baseAtk: 713,
  subStat: { stat: ZzzStats.CRIT_DMG, value: 48 },
  // The Electric DMG bonus at 3 stacks isn't modeled
  passive: (refinement) => {
    const flat = SEVERED_INNOCENCE_FLAT_CRIT_DMG[refinement - 1]
    if (flat === undefined) return []
    const confidence = refinement === 1 ? 'sourced' : 'unverified'
    return [
      { stat: ZzzStats.CRIT_DMG, value: flat, source: 'Severed Innocence passive', confidence },
      {
        stat: ZzzStats.CRIT_DMG,
        value: flat,
        when: 'onField',
        source: 'Severed Innocence passive (3 stacks)',
        confidence,
      },
    ] satisfies StatEffect[]
  },
}

export const W_ENGINES: Record<string, WEngineData> = {
  [CLOUDCLEAVE_RADIANCE.id]: CLOUDCLEAVE_RADIANCE,
  [HAILSTORM_SHRINE.id]: HAILSTORM_SHRINE,
  [QINGMING_BIRDCAGE.id]: QINGMING_BIRDCAGE,
  [SEVERED_INNOCENCE.id]: SEVERED_INNOCENCE,
}
