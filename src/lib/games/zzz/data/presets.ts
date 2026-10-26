import type {
  AgentData,
  Confidence,
  Specialty,
} from 'lib/games/zzz/data/dataTypes'
import type { FinalStats } from 'lib/games/zzz/stats/computeStats'
import {
  type MainStatSlot,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Our own build recommendations, kept in this file and edited by hand. Nothing here is fetched or copied from a guide
// site: each preset starts from the user's own build and general game knowledge, and is re-checked against the game on
// the review schedule below. Once damage math exists, the optimizer itself should replace most of this.

export type SetChoice = {
  // Set ids as produced by slugifySetName in the importer
  fourPiece: string,
  // Missing means any 2-piece
  twoPiece?: string,
}

export type BuildPreset = {
  // First is the default, the rest are alternatives the user can switch to
  sets: SetChoice[],
  // An empty list means any main stat
  mainStats: Record<MainStatSlot, ZzzStatsValues[]>,
  // What to look for in substats, best first. Shown as advice, not used by the search
  substatPriority: ZzzStatsValues[],
  rankBy: keyof FinalStats,
  // Breaks ties in rankBy, compared in order
  thenBy: (keyof FinalStats)[],
  notes: string,
  // Where the preset came from, in plain words
  source: string,
  confidence: Confidence,
  // Last time someone checked this preset against the game, YYYY-MM-DD
  reviewed: string,
}

// How often presets should be looked at again, in days
export const REVIEW_INTERVAL_DAYS = 21

const CRIT_SUBS = [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG]

export const PRESETS: Record<string, BuildPreset> = {
  // Miyabi
  '1091': {
    sets: [{ fourPiece: 'branch-blade-song', twoPiece: 'woodpecker-electro' }],
    mainStats: {
      4: [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG],
      5: [ZzzStats.PEN_RATIO, ZzzStats.ELEMENT_DMG, ZzzStats.ATK_P],
      6: [ZzzStats.ATK_P],
    },
    substatPriority: [...CRIT_SUBS, ZzzStats.ATK_P, ZzzStats.PEN, ZzzStats.ATK],
    rankBy: 'critDmg',
    thenBy: ['critRate', 'atk'],
    notes:
      'Branch & Blade Song\'s 4-piece (CRIT DMG +30 from 115 Anomaly Mastery, CRIT Rate +12 with Freeze or Shatter) only counts with the combat conditions on',
    source: 'Your own build, crit main stats from general knowledge',
    confidence: 'unverified',
    reviewed: '2026-10-25',
  },
  // Yixuan
  '1371': {
    sets: [{ fourPiece: 'yunkui-tales', twoPiece: 'woodpecker-electro' }],
    mainStats: {
      4: [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG],
      5: [ZzzStats.ELEMENT_DMG, ZzzStats.HP_P],
      6: [ZzzStats.HP_P],
    },
    substatPriority: [...CRIT_SUBS, ZzzStats.HP_P, ZzzStats.PEN],
    rankBy: 'sheerForce',
    thenBy: ['critDmg', 'critRate'],
    notes: 'Rupture: Sheer Force replaces ATK, and her Sheer Force grows with max HP',
    source: 'Your own build',
    confidence: 'unverified',
    reviewed: '2026-10-25',
  },
  // Soldier 0 - Anby
  '1381': {
    sets: [{ fourPiece: 'shadow-harmony', twoPiece: 'woodpecker-electro' }],
    mainStats: {
      4: [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG],
      5: [ZzzStats.ELEMENT_DMG, ZzzStats.ATK_P, ZzzStats.PEN_RATIO],
      6: [ZzzStats.ATK_P],
    },
    substatPriority: [...CRIT_SUBS, ZzzStats.ATK_P, ZzzStats.PEN, ZzzStats.ATK],
    rankBy: 'critDmg',
    thenBy: ['critRate', 'atk'],
    notes: 'Shadow Harmony stacks from Aftershocks and Dash Attacks, turn on the combat condition to count them',
    source: 'Your own build',
    confidence: 'unverified',
    reviewed: '2026-10-25',
  },
  // Ye Shunguang
  '1431': {
    sets: [{ fourPiece: 'white-water-ballad', twoPiece: 'branch-blade-song' }],
    mainStats: {
      4: [ZzzStats.ATK_P, ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG],
      5: [ZzzStats.ATK_P, ZzzStats.ELEMENT_DMG],
      6: [ZzzStats.ATK_P],
    },
    substatPriority: [...CRIT_SUBS, ZzzStats.ATK_P, ZzzStats.ATK],
    rankBy: 'critDmg',
    thenBy: ['atk', 'critRate'],
    notes: 'Her Core Skill and White Water Ballad give a lot of CRIT Rate in combat, so ATK% in slot 4 can beat a crit main stat',
    source: 'Your own build',
    confidence: 'unverified',
    reviewed: '2026-10-25',
  },
}

type SpecialtyDefault = Pick<BuildPreset, 'mainStats' | 'substatPriority' | 'rankBy' | 'thenBy'>

// A starting point for agents without their own preset, from what each specialty generally needs. No set advice
const SPECIALTY_DEFAULTS: Record<Specialty, SpecialtyDefault> = {
  Attack: {
    mainStats: { 4: [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG], 5: [ZzzStats.ELEMENT_DMG, ZzzStats.ATK_P], 6: [ZzzStats.ATK_P] },
    substatPriority: [...CRIT_SUBS, ZzzStats.ATK_P, ZzzStats.PEN],
    rankBy: 'critDmg',
    thenBy: ['critRate', 'atk'],
  },
  Anomaly: {
    mainStats: {
      4: [ZzzStats.ANOMALY_PROFICIENCY],
      5: [ZzzStats.ELEMENT_DMG, ZzzStats.ATK_P, ZzzStats.PEN_RATIO],
      6: [ZzzStats.ANOMALY_MASTERY, ZzzStats.ATK_P],
    },
    substatPriority: [ZzzStats.ANOMALY_PROFICIENCY, ZzzStats.ATK_P, ZzzStats.PEN],
    rankBy: 'anomalyProficiency',
    thenBy: ['atk', 'anomalyMastery'],
  },
  Stun: {
    mainStats: { 4: [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG], 5: [ZzzStats.ELEMENT_DMG, ZzzStats.ATK_P], 6: [ZzzStats.IMPACT] },
    substatPriority: [...CRIT_SUBS, ZzzStats.ATK_P],
    rankBy: 'impact',
    thenBy: ['critRate', 'atk'],
  },
  Support: {
    mainStats: { 4: [ZzzStats.ATK_P, ZzzStats.HP_P, ZzzStats.DEF_P], 5: [ZzzStats.ATK_P, ZzzStats.PEN_RATIO], 6: [ZzzStats.ENERGY_REGEN] },
    substatPriority: [ZzzStats.ATK_P, ZzzStats.PEN, ZzzStats.ANOMALY_PROFICIENCY],
    rankBy: 'energyRegen',
    thenBy: ['atk'],
  },
  Defense: {
    mainStats: { 4: [ZzzStats.DEF_P], 5: [ZzzStats.DEF_P], 6: [ZzzStats.DEF_P, ZzzStats.IMPACT] },
    substatPriority: [ZzzStats.DEF_P, ZzzStats.DEF, ...CRIT_SUBS],
    rankBy: 'def',
    thenBy: ['impact'],
  },
  Rupture: {
    mainStats: { 4: [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG], 5: [ZzzStats.ELEMENT_DMG, ZzzStats.HP_P], 6: [ZzzStats.HP_P] },
    substatPriority: [...CRIT_SUBS, ZzzStats.HP_P],
    rankBy: 'sheerForce',
    thenBy: ['critDmg', 'critRate'],
  },
}

// The agent's own preset, or a generic one for its specialty
export function getPreset(agent: AgentData): BuildPreset {
  const preset = PRESETS[agent.id]
  if (preset) return preset
  return {
    ...SPECIALTY_DEFAULTS[agent.specialty],
    sets: [],
    notes: `No preset for ${agent.name} yet, this is a generic ${agent.specialty} starting point`,
    source: 'Generic default for the specialty',
    confidence: 'unverified',
    reviewed: '2026-10-25',
  }
}

// Whole days between the review date and today, or undefined when the date can't be read
export function daysSinceReview(preset: BuildPreset, today: Date): number | undefined {
  const reviewed = Date.parse(`${preset.reviewed}T00:00:00Z`)
  if (Number.isNaN(reviewed)) return undefined
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((todayUtc - reviewed) / 86_400_000)
}

export function needsReview(preset: BuildPreset, today: Date): boolean {
  const days = daysSinceReview(preset, today)
  return days === undefined || days >= REVIEW_INTERVAL_DAYS
}
