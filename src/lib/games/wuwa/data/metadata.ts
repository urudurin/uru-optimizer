import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'
import {
  defaultRotation,
  hasSkillData,
  type Rotation,
} from 'lib/games/wuwa/damage/damage'
import {
  STAT_PRIORITIES,
  STAT_REVIEWED,
  statPriority,
  weightsFromPriority,
} from 'lib/games/wuwa/data/statPriorities'

// Each Resonator's metadata (shared/characterMetadata.ts, after HSR's ScoringMetadata), built from our tables: substat
// weights from data/statPriorities.ts (Kuro's guide site or the skill descriptions), the optimizer's default rank
// (rotation damage when the Resonator has skill data, average ATK hit otherwise) and the default rotation
// (damage/damage.ts). No main stats, team or benchmark sets yet.

export type WuwaMetadata = CharacterMetadata<Rotation>

const cache = new Map<string, WuwaMetadata>()

export function wuwaMetadata(charId: string): WuwaMetadata {
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
