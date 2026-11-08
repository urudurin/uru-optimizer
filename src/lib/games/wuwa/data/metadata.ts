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
import {
  characterName,
  CHARACTERS,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  STAT_PRIORITIES,
  STAT_REVIEWED,
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
// (damage/damage.ts). No main stats, team or benchmark sets yet.

export type WuwaMetadata = CharacterMetadata<Rotation>

const cache = new Map<string, WuwaMetadata>()

function baseWuwaMetadata(charId: string): WuwaMetadata {
  const cached = cache.get(charId)
  if (cached) return cached
  const priority = statPriority(charId)
  const listed = STAT_PRIORITIES[charId] !== undefined
  const metadata: WuwaMetadata = {
    characterId: charId,
    stats: weightsFromPriority(priority),
    parts: {},
    sortOption: hasSkillData(charId) ? 'damage' : 'avg:atk',
    rotation: defaultRotation(charId),
    source: !listed
      ? 'Default for Resonators not in our table: an ATK crit damage dealer'
      : priority.confidence === 'guide'
      ? 'Our own table (data/statPriorities.ts), from Kuro\'s guide site (wuwaguide.kurogames.com), cited per entry'
      : 'Our own table (data/statPriorities.ts), from the in-game skill descriptions',
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
