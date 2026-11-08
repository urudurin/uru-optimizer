import {
  defaultRotation,
  hasTalentData,
  type Rotation,
} from 'lib/games/genshin/damage/damage'
import stats from 'lib/games/genshin/data/generated/stats.json'
import { MAIN_STAT_OPTIONS } from 'lib/games/genshin/data/mainStatOptions'
import {
  GENSHIN_RECOMMENDATIONS,
  RECOMMENDATIONS_REVIEWED,
} from 'lib/games/genshin/data/recommendations'
import {
  STAT_PRIORITIES,
  STAT_REVIEWED,
  statPriority,
  weightsFromPriority,
} from 'lib/games/genshin/data/statPriorities'
import { toGoodKey } from 'lib/games/genshin/goodKeys'
import type { MainStatSlot } from 'lib/games/genshin/optimizer/artifactOptimizer'
import { GENSHIN_TARGETS } from 'lib/games/genshin/optimizer/targets'
import {
  type GenshinStatKey,
  STAT_LABELS,
} from 'lib/games/genshin/types'
import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'
import {
  importedPresets,
  type PresetResolver,
  withImported,
} from 'lib/games/shared/presetImports'

// Each Genshin character's metadata (shared/characterMetadata.ts, after HSR's ScoringMetadata), built from our tables:
// substat weights from data/statPriorities.ts, the optimizer's default rank (rotation damage when the character has
// talent data, average ATK hit otherwise), the default rotation (damage/damage.ts), and for the characters in
// data/recommendations.ts their main stats, benchmark sets and Default scoring team (the simulation).

export type GenshinMetadata = CharacterMetadata<Rotation>

const cache = new Map<string, GenshinMetadata>()

// constellation: for the default rotation's constellation lines (Mizuki's C1)
function baseGenshinMetadata(characterId: string, constellation: number): GenshinMetadata {
  const key = `${characterId}|${constellation}`
  const cached = cache.get(key)
  if (cached) return cached
  const priority = statPriority(characterId)
  const listed = STAT_PRIORITIES[characterId] !== undefined
  const recommended = GENSHIN_RECOMMENDATIONS[characterId]
  const weights = weightsFromPriority(priority)
  const rotation = defaultRotation(characterId, [], [], constellation)
  const metadata: GenshinMetadata = {
    characterId,
    stats: weights,
    parts: recommended?.parts ?? {},
    sortOption: hasTalentData(characterId) ? 'damage' : 'avg:atk',
    rotation,
    ...(recommended
      ? {
        simulation: {
          teammates: recommended.teammates ?? [],
          rotation,
          sets: recommended.sets,
          parts: recommended.parts,
          substats: Object.keys(weights).filter((stat) => weights[stat] > 0),
        },
      }
      : {}),
    source: (listed
      ? 'Our own table (data/statPriorities.ts), from the in-game talent descriptions'
      : 'Default for characters not in our table: an ATK crit damage dealer')
      + (recommended ? '; main stats, sets and team from our own data/recommendations.ts (unverified)' : ''),
    confidence: recommended ? 'unverified' : priority.confidence,
    reviewed: recommended ? RECOMMENDATIONS_REVIEWED : STAT_REVIEWED,
  }
  cache.set(key, metadata)
  return metadata
}

const CHARACTER_IDS = new Set(Object.keys((stats as { characters: Record<string, unknown> }).characters))
const WEAPON_IDS = new Set(Object.keys((stats as { weapons: Record<string, unknown> }).weapons))
const STAT_BY_NAME = new Map(Object.entries(STAT_LABELS).flatMap(([key, label]) => [[key.toLowerCase(), key], [label.toLowerCase(), key]]))

// How a Genshin presets file names things (shared/presetImports.ts): GOOD keys or in-game names
export const GENSHIN_PRESET_RESOLVER: PresetResolver = {
  character: (value) => (CHARACTER_IDS.has(value) ? value : CHARACTER_IDS.has(toGoodKey(value)) ? toGoodKey(value) : undefined),
  stat: (value) => STAT_BY_NAME.get(value.toLowerCase()),
  slot: (value) => (value.toLowerCase() in MAIN_STAT_OPTIONS ? value.toLowerCase() : undefined),
  mainStat: (slot, stat) => MAIN_STAT_OPTIONS[slot as MainStatSlot]?.includes(stat as GenshinStatKey) ?? false,
  set: (value) => toGoodKey(value) || undefined,
  weapon: (value) => (WEAPON_IDS.has(toGoodKey(value)) ? toGoodKey(value) : undefined),
  sortOption: (value) => (value === 'damage' || GENSHIN_TARGETS.some((target) => target.value === value) ? value : undefined),
}

export function genshinImports() {
  return importedPresets('genshin', GENSHIN_PRESET_RESOLVER)
}

// The character's metadata, with the user's imported presets laid over it when there are some (shared/presetImports.ts)
export function genshinMetadata(characterId: string, constellation = 0): GenshinMetadata {
  return withImported(baseGenshinMetadata(characterId, constellation), genshinImports()?.byCharacter[characterId])
}
