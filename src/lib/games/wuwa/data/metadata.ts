import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'
import {
  importedPresets,
  type PresetResolver,
  withImported,
} from 'lib/games/shared/presetImports'
import {
  defaultRotation,
  hasSkillData,
  type Rotation,
} from 'lib/games/wuwa/damage/damage'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import {
  characterName,
  CHARACTERS,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  STAT_PRIORITIES,
  STAT_REVIEWED,
  type StatPriority,
  statPriority,
  weightsFromPriority,
} from 'lib/games/wuwa/data/statPriorities'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
import { WUWA_TARGETS } from 'lib/games/wuwa/optimizer/targets'
import {
  type Cost,
  STAT_LABELS,
} from 'lib/games/wuwa/types'

// Each Resonator's metadata (shared/characterMetadata.ts, after HSR's ScoringMetadata), built from our tables: substat
// weights from data/statPriorities.ts (Kuro's guide site or the skill descriptions), the optimizer's default rank
// (rotation damage when the Resonator has skill data, average ATK hit otherwise) and the default rotation
// (damage/damage.ts), and main stats per echo cost worked out from the same entry (mainStatsFor), which the DPS score's
// benchmark also picks from. No team or benchmark sets yet.

export type WuwaMetadata = CharacterMetadata<Rotation>

// Resonators whose 4-cost main is Healing Bonus (their kit heals on their scaling stat)
const HEALERS = new Set(['verina', 'baizhi', 'the-shorekeeper'])

// Main stats per echo cost from a stat priority entry, our own rule (the usual WuWa build shape): crit Resonators take
// Crit Rate / Crit DMG on 4-cost, their element's DMG (or the scaling stat) on 3-cost, the scaling stat on 1-cost, and
// Energy Regen on 3-cost too when it ranks near Crit (weight 0.75 up); supports take the scaling stat (healers Healing
// Bonus on 4-cost) and Energy Regen first on 3-cost. Listed Resonators only; the rest keep any main stat
export function mainStatsFor(charId: string, priority: StatPriority): Record<string, string[]> {
  const scaling = `${priority.scaling}Pct`
  if (!priority.crit) {
    return { 4: [HEALERS.has(charId) ? 'healingBonus' : scaling], 3: ['energyRegen', scaling], 1: [scaling] }
  }
  const element = CHARACTER_INFO[charId]?.element
  return {
    4: ['critRate', 'critDmg'],
    3: [...(element ? [element] : []), scaling, ...((priority.er ?? 0) >= 0.75 ? ['energyRegen'] : [])],
    1: [scaling],
  }
}

const cache = new Map<string, WuwaMetadata>()

function baseWuwaMetadata(charId: string): WuwaMetadata {
  const cached = cache.get(charId)
  if (cached) return cached
  const priority = statPriority(charId)
  const listed = STAT_PRIORITIES[charId] !== undefined
  const weights = weightsFromPriority(priority)
  const parts = listed ? mainStatsFor(charId, priority) : {}
  const rotation = defaultRotation(charId)
  const metadata: WuwaMetadata = {
    characterId: charId,
    stats: weights,
    parts,
    sortOption: hasSkillData(charId) ? 'damage' : 'avg:atk',
    rotation,
    // The benchmark may pick its mains from these (no team or sets: the build's own sets stay)
    ...(listed ? { simulation: { teammates: [], rotation, sets: [], parts, substats: Object.keys(weights).filter((stat) => weights[stat] > 0) } } : {}),
    source: (!listed
      ? 'Default for Resonators not in our table: an ATK crit damage dealer'
      : priority.confidence === 'guide'
      ? 'Our own table (data/statPriorities.ts), from Kuro\'s guide site (wuwaguide.kurogames.com), cited per entry'
      : 'Our own table (data/statPriorities.ts), from the in-game skill descriptions')
      + (listed ? '; main stats per cost from our own rule (data/metadata.ts mainStatsFor)' : ''),
    confidence: priority.confidence,
    reviewed: STAT_REVIEWED,
  }
  cache.set(charId, metadata)
  return metadata
}

const STAT_BY_NAME = new Map(Object.entries(STAT_LABELS).flatMap(([key, label]) => [[key.toLowerCase(), key], [label.toLowerCase(), key]]))
const byIdOrName = <T extends { id: string, name: string }>(items: Record<string, T>) => (value: string) =>
  items[value] ? value : Object.values(items).find((item) => item.name.toLowerCase() === value.toLowerCase())?.id

// How a WuWa presets file names things (shared/presetImports.ts): datamine ids or in-game names; slots are echo costs
export const WUWA_PRESET_RESOLVER: PresetResolver = {
  character: (value) => (CHARACTERS[value] ? value : Object.keys(CHARACTERS).find((id) => characterName(id).toLowerCase() === value.toLowerCase())),
  stat: (value) => STAT_BY_NAME.get(value.toLowerCase()),
  slot: (value) => (['1', '3', '4'].includes(value) ? value : undefined),
  mainStat: (slot, stat) => MAIN_STAT_MAX[Number(slot) as Cost]?.[stat as keyof (typeof MAIN_STAT_MAX)[Cost]] !== undefined,
  set: byIdOrName(SONATA_SETS),
  weapon: byIdOrName(WEAPONS),
  sortOption: (value) => (value === 'damage' || WUWA_TARGETS.some((target) => target.value === value) ? value : undefined),
}

export function wuwaImports() {
  return importedPresets('wuwa', WUWA_PRESET_RESOLVER)
}

// The Resonator's metadata, with the user's imported presets laid over it when there are some (shared/presetImports.ts)
export function wuwaMetadata(charId: string): WuwaMetadata {
  return withImported(baseWuwaMetadata(charId), wuwaImports()?.byCharacter[charId])
}
