import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'
import { weightsFromPriority } from 'lib/games/shared/gearScore'
import {
  importedPresets,
  presetImportStore,
  type PresetResolver,
  withImported,
} from 'lib/games/shared/presetImports'
import {
  agentHits,
  defaultRotation,
  type Rotation,
} from 'lib/games/zzz/damage/damage'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import { parseImportedZzzPresets } from 'lib/games/zzz/data/importedPresets'
import {
  type BuildPreset,
  getPreset,
} from 'lib/games/zzz/data/presets'
import { SETS } from 'lib/games/zzz/data/sets'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import { MAIN_STATS_BY_SLOT } from 'lib/games/zzz/discStats'
import {
  parseStat,
  slugifySetName,
} from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { STAT_ROWS } from 'lib/games/zzz/statLabels'
import {
  type MainStatSlot,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Each agent's metadata (shared/characterMetadata.ts, after HSR's ScoringMetadata), built from our build presets
// (data/presets.ts): substat weights from the preset's substat priority (1, 0.8, 0.6, 0.4, 0.2), ideal main stats from
// its main stats, the optimizer's default rank (rotation damage when the agent has skill data, CRIT DMG otherwise) and
// the default rotation (damage/damage.ts). The preset itself rides along for the optimizer's preset picker.

export type ZzzMetadata = CharacterMetadata<Rotation> & { preset: BuildPreset }

const cache = new Map<string, ZzzMetadata>()

function baseZzzMetadata(agent: AgentData): ZzzMetadata {
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

const STAT_LABEL_VALUES = new Set<string>(Object.values(ZzzStats))

// How a ZZZ presets file names things (shared/presetImports.ts): agent names or ids, stats as the panel or the builds
// export writes them, set names or ids, disc slots 4/5/6
export const ZZZ_PRESET_RESOLVER: PresetResolver = {
  character: (value) => (AGENTS[value] ? value : Object.values(AGENTS).find((agent) => agent.name.toLowerCase() === value.toLowerCase())?.id),
  stat: (value) => (STAT_LABEL_VALUES.has(value) ? value : parseStat(value)),
  slot: (value) => (['4', '5', '6'].includes(value) ? value : undefined),
  mainStat: (slot, stat) => MAIN_STATS_BY_SLOT[Number(slot) as MainStatSlot]?.includes(stat as ZzzStatsValues) ?? false,
  set: (value) => (value ? SETS[value] ? value : slugifySetName(value) : undefined),
  weapon: (value) => (W_ENGINES[value] ? value : Object.values(W_ENGINES).find((engine) => engine.name.toLowerCase() === value.toLowerCase())?.id),
  sortOption: (value) => (value === 'damage' || STAT_ROWS.some((row) => row.key === value) ? value : undefined),
}

export function zzzImports() {
  return importedPresets('zzz', ZZZ_PRESET_RESOLVER)
}

// The file's build presets (the optimizer's Recommended build card), cached per file text
let presetCache: { text: string, parsed: ReturnType<typeof parseImportedZzzPresets> } | undefined
export function importedZzzPresets() {
  const { stored, enabled } = presetImportStore('zzz').getState()
  if (!stored || !enabled) return undefined
  if (presetCache?.text !== stored.text) presetCache = { text: stored.text, parsed: parseImportedZzzPresets(stored, Object.values(AGENTS)) }
  return presetCache.parsed
}

// The agent's metadata, with the user's imported presets laid over it when there are some (shared/presetImports.ts); the
// preset is the imported one then
export function zzzMetadata(agent: AgentData): ZzzMetadata {
  const base = baseZzzMetadata(agent)
  const entry = zzzImports()?.byCharacter[agent.id]
  if (!entry) return base
  return { ...withImported(base, entry), preset: importedZzzPresets()?.presets[agent.id] ?? base.preset }
}
