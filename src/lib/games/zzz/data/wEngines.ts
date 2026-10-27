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
  // The Physical RES ignore part isn't modeled. The DMG part is genshin-optimizer's (same values as the CRIT DMG part)
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
      },
      { stat: ZzzStats.ELEMENT_DMG, value, when: 'veilTriggered', source: 'Cloudcleave Radiance passive (DMG)', confidence: 'sourced' },
    ] satisfies StatEffect[]
  },
}

// W-Engine passives never show on the stat screen, even the always-on parts (confirmed with Hailstorm Shrine and
// Severed Innocence screenshots), so they count as combat-only through onField

// Builds the passive for an engine with one always-on stat bonus, R1 sourced and higher refinements from a user export
function flatPassive(stat: ZzzStatsValues, values: number[], source: string): WEngineData['passive'] {
  return (refinement) => {
    const value = values[refinement - 1]
    if (value === undefined) return []
    return [{ stat, value, when: 'onField', source, confidence: refinement === 1 ? 'sourced' : 'unverified' } satisfies StatEffect]
  }
}

// Adds a stacking part from genshin-optimizer's W-Engine sheet (R1-R5 values from its generated stats, MIT) to a passive,
// counted in combat at full stacks
function withStacks(
  base: WEngineData['passive'],
  stat: ZzzStatsValues,
  perStack: number[],
  stacks: number,
  element: string,
  source: string,
): WEngineData['passive'] {
  return (refinement) => {
    const value = perStack[refinement - 1]
    if (value === undefined) return []
    return [
      ...base(refinement),
      { stat, value: Math.round(value * stacks * 100) / 100, when: 'onField', element, source, confidence: 'sourced' } satisfies StatEffect,
    ]
  }
}

export const HAILSTORM_SHRINE: WEngineData = {
  id: '14109',
  name: 'Hailstorm Shrine',
  rarity: 'S',
  specialty: 'Anomaly',
  baseAtk: 743,
  subStat: { stat: ZzzStats.CRIT_RATE, value: 24 },
  passive: withStacks(
    flatPassive(ZzzStats.CRIT_DMG, [50, 57, 65, 72, 80], 'Hailstorm Shrine passive'),
    ZzzStats.ELEMENT_DMG,
    [20, 23, 26, 29, 32],
    2,
    'Ice',
    'Hailstorm Shrine passive (Ice DMG, 2 stacks)',
  ),
}

export const QINGMING_BIRDCAGE: WEngineData = {
  id: '14137',
  name: 'Qingming Birdcage',
  rarity: 'S',
  specialty: 'Rupture',
  baseAtk: 743,
  subStat: { stat: ZzzStats.HP_P, value: 30 },
  // The Sheer DMG stacks on EX Special and Ultimate aren't modeled
  passive: withStacks(
    flatPassive(ZzzStats.CRIT_RATE, [20, 23, 26, 29, 32], 'Qingming Birdcage passive'),
    ZzzStats.ELEMENT_DMG,
    [8, 9.2, 10.4, 11.6, 12.8],
    2,
    'Ether',
    'Qingming Birdcage passive (Ether DMG, 2 Qingming Companion stacks)',
  ),
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
  passive: withStacks(
    (refinement) => {
      const flat = SEVERED_INNOCENCE_FLAT_CRIT_DMG[refinement - 1]
      if (flat === undefined) return []
      const confidence = refinement === 1 ? 'sourced' : 'unverified'
      return [
        { stat: ZzzStats.CRIT_DMG, value: flat, when: 'onField', source: 'Severed Innocence passive', confidence },
        {
          stat: ZzzStats.CRIT_DMG,
          value: flat,
          when: 'onField',
          source: 'Severed Innocence passive (3 stacks)',
          confidence,
        },
      ] satisfies StatEffect[]
    },
    ZzzStats.ELEMENT_DMG,
    [20, 23, 26, 29, 32],
    1,
    'Electric',
    'Severed Innocence passive (Electric DMG at 3 stacks)',
  ),
}

export const W_ENGINES: Record<string, WEngineData> = {
  [CLOUDCLEAVE_RADIANCE.id]: CLOUDCLEAVE_RADIANCE,
  [HAILSTORM_SHRINE.id]: HAILSTORM_SHRINE,
  [QINGMING_BIRDCAGE.id]: QINGMING_BIRDCAGE,
  [SEVERED_INNOCENCE.id]: SEVERED_INNOCENCE,
}
