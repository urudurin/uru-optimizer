import {
  defaultRotation,
  hasTalentData,
  type Rotation,
} from 'lib/games/genshin/damage/damage'
import {
  STAT_PRIORITIES,
  STAT_REVIEWED,
  statPriority,
  weightsFromPriority,
} from 'lib/games/genshin/data/statPriorities'
import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'

// Each Genshin character's metadata (shared/characterMetadata.ts, after HSR's ScoringMetadata), built from our tables:
// substat weights from data/statPriorities.ts, the optimizer's default rank (rotation damage when the character has
// talent data, average ATK hit otherwise) and the default rotation (damage/damage.ts). No main stats, team or benchmark
// sets yet.

export type GenshinMetadata = CharacterMetadata<Rotation>

const cache = new Map<string, GenshinMetadata>()

// constellation: for the default rotation's constellation lines (Mizuki's C1)
export function genshinMetadata(characterId: string, constellation = 0): GenshinMetadata {
  const key = `${characterId}|${constellation}`
  const cached = cache.get(key)
  if (cached) return cached
  const priority = statPriority(characterId)
  const listed = STAT_PRIORITIES[characterId] !== undefined
  const metadata: GenshinMetadata = {
    characterId,
    stats: weightsFromPriority(priority),
    parts: {},
    sortOption: hasTalentData(characterId) ? 'damage' : 'avg:atk',
    rotation: defaultRotation(characterId, [], [], constellation),
    source: listed
      ? 'Our own table (data/statPriorities.ts), from the in-game talent descriptions'
      : 'Default for characters not in our table: an ATK crit damage dealer',
    confidence: priority.confidence,
    reviewed: STAT_REVIEWED,
  }
  cache.set(key, metadata)
  return metadata
}
