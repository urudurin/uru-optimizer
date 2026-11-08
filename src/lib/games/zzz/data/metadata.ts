import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'
import { weightsFromPriority } from 'lib/games/shared/gearScore'
import {
  agentHits,
  defaultRotation,
  type Rotation,
} from 'lib/games/zzz/damage/damage'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import {
  type BuildPreset,
  getPreset,
} from 'lib/games/zzz/data/presets'

// Each agent's metadata (shared/characterMetadata.ts, after HSR's ScoringMetadata), built from our build presets
// (data/presets.ts): substat weights from the preset's substat priority (1, 0.8, 0.6, 0.4, 0.2), ideal main stats from
// its main stats, the optimizer's default rank (rotation damage when the agent has skill data, CRIT DMG otherwise) and
// the default rotation (damage/damage.ts). The preset itself rides along for the optimizer's preset picker.

export type ZzzMetadata = CharacterMetadata<Rotation> & { preset: BuildPreset }

const cache = new Map<string, ZzzMetadata>()

export function zzzMetadata(agent: AgentData): ZzzMetadata {
  const cached = cache.get(agent.id)
  if (cached) return cached
  const preset = getPreset(agent)
  const metadata: ZzzMetadata = {
    characterId: agent.id,
    stats: weightsFromPriority(preset.substatPriority),
    parts: preset.mainStats,
    sortOption: agentHits(agent.id).length > 0 ? 'damage' : 'critDmg',
    rotation: defaultRotation(agent.id),
    source: preset.source,
    confidence: preset.confidence,
    reviewed: preset.reviewed,
    preset,
  }
  cache.set(agent.id, metadata)
  return metadata
}

// The default rank for an agent id (the optimizer's defaults run before agent data may be loaded)
export function zzzDefaultRank(agentId: string): 'damage' | 'critDmg' {
  return agentHits(agentId).length > 0 ? 'damage' : 'critDmg'
}
